"""Fraud Detection Pipeline — thin orchestrator (#636, #1122, #1379)

Wires stage modules into a FastAPI app.  All logic lives in:
  repository.py, scoring.py, stages/idempotency.py, stages/trace_id.py,
  stages/scoring_worker.py, stages/routes.py

See ADR-008: docs/adr/ADR-008-fraud-detection-scoring-pipeline-design.md
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator, Optional

import structlog
from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared"))
from db_config import load_db_pool_config  # noqa: E402
from structured_logger import configure_structlog  # noqa: E402

from repository import (  # noqa: F401
    CampaignRecord, ContributionEvent, Flag, FlagReason, FlagSeverity, RefundEvent,
    append_contribution, append_campaign, append_refund, enqueue_flag, next_flag_id,
    get_contributions, get_refunds, get_campaign_records, get_flags, total_flag_count,
    mark_flag_reviewed,
)
from scoring import (  # noqa: F401
    WASH_WINDOW_SECONDS, WASH_MIN_OCCURRENCES, SPIKE_WINDOW_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS, DUPLICATE_JACCARD_THRESHOLD, DUPLICATE_SCAN_MIN_INTERVAL_SECONDS,
    scan_wash_contributions, scan_contribution_spikes, scan_duplicate_content, run_full_scan,
)
import scoring as _scoring
import repository as _repo

from stages.trace_id import TraceIDMiddleware
from stages.idempotency import IdempotencyStore, IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LEN  # noqa: F401
from stages.scoring_worker import (  # noqa: F401
    ContributionPayload, ScoringJob, scoring_queue as _scoring_queue,
    scoring_worker as _scoring_worker,
)
from stages.routes import (
    healthz as _healthz, readyz as _readyz, ingest_contribution,
    trigger_scan, get_metrics_handler, moderation_queue_handler, mark_reviewed_handler,
    _IDEMPOTENCY_STORE, IdempotencyStore,  # noqa: F401
)
from config import load_fraud_detection_config  # noqa: F401

configure_structlog()
log: structlog.BoundLogger = structlog.get_logger("fraud_detection")

# ---------------------------------------------------------------------------
# Trace-ID convention — imported from the canonical module
# ---------------------------------------------------------------------------

from stages.trace_id import (  # noqa: E402  (after stdlib/third-party imports)
    TRACE_ID_HEADER,
    TraceIDMiddleware,
    is_valid_trace_id as _is_valid_trace_id,
    trace_id_var as _trace_id_var,
)


# ---------------------------------------------------------------------------
# Tuneable thresholds (see docs/fraud-detection-heuristics.md for rationale)
# ---------------------------------------------------------------------------
WASH_WINDOW_SECONDS = 3600          # contributions that refund within 1 h
WASH_MIN_OCCURRENCES = 3            # flag after 3 wash cycles
SPIKE_WINDOW_SECONDS = 600          # 10-minute rolling window
SPIKE_MAX_CONTRIBUTIONS = 50        # > 50 contributions in 10 min → spike
DUPLICATE_JACCARD_THRESHOLD = 0.8   # titles ≥ 80 % token overlap → duplicate

# Scoring job queue settings
SCORING_QUEUE_MAXSIZE = 1000        # bounded queue; 503 if full


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------
class FlagReason(str, Enum):
    WASH_CONTRIBUTION = "wash_contribution"
    CONTRIBUTION_SPIKE = "contribution_spike"
    DUPLICATE_CONTENT = "duplicate_content"


class FlagSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Flag:
    id: str
    reason: FlagReason
    severity: FlagSeverity
    campaign_id: str
    wallet: Optional[str]
    detail: str
    flagged_at: float = field(default_factory=time.time)
    reviewed: bool = False


# ---------------------------------------------------------------------------
# Moderation queue (in-memory; replace with DB in production)
# ---------------------------------------------------------------------------
_QUEUE: list[Flag] = []
_FLAG_COUNTER = 0


def _next_flag_id() -> str:
    global _FLAG_COUNTER
    _FLAG_COUNTER += 1
    return f"FLAG-{_FLAG_COUNTER:05d}"


def _enqueue(flag: Flag) -> None:
    _QUEUE.append(flag)


# ---------------------------------------------------------------------------
# Indexed event store (populated by indexer; stubbed here)
# ---------------------------------------------------------------------------
@dataclass
class ContributionEvent:
    campaign_id: str
    wallet: str
    amount: int
    timestamp: float


@dataclass
class RefundEvent:
    campaign_id: str
    wallet: str
    timestamp: float


@dataclass
class CampaignRecord:
    id: str
    title: str
    description: str


_CONTRIBUTIONS: list[ContributionEvent] = []
_REFUNDS: list[RefundEvent] = []
_CAMPAIGN_RECORDS: list[CampaignRecord] = []


DB_POOL_CONFIG = load_db_pool_config()
log.info("db_pool_config_resolved", **DB_POOL_CONFIG.__dict__)

# Backward-compatibility aliases — tests_pipeline.py imports these from here.
_CONTRIBUTIONS = _repo._CONTRIBUTIONS
_REFUNDS = _repo._REFUNDS
_CAMPAIGN_RECORDS = _repo._CAMPAIGN_RECORDS
_QUEUE = _repo._QUEUE


def __getattr__(name: str):
    if name == "_last_duplicate_scan_at":
        return _scoring._last_duplicate_scan_at
    raise AttributeError(name)


def __setattr__(name: str, value):  # type: ignore[override]
    if name == "_last_duplicate_scan_at":
        _scoring._last_duplicate_scan_at = value
        return
    raise AttributeError(name)


@asynccontextmanager
async def lifespan(app_: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_scoring_worker())
    log.info("scoring_worker_task_created")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        log.info("scoring_worker_task_stopped")


app = FastAPI(title="Fund-My-Cause Fraud Detection", version="1.2.0", lifespan=lifespan)
app.add_middleware(TraceIDMiddleware)

app.get("/healthz")(_healthz)
app.get("/readyz")(_readyz)
app.post("/contributions")(ingest_contribution)
app.post("/scan")(trigger_scan)
app.get("/metrics")(get_metrics_handler)
app.get("/moderation-queue")(moderation_queue_handler)
app.patch("/moderation-queue/{flag_id}/reviewed")(mark_reviewed_handler)

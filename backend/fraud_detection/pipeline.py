"""Fraud Detection Pipeline — thin orchestrator (#636, #1122, #1379)

Wires stage modules into a FastAPI app.  All logic lives in:
  repository.py, scoring.py, stages/idempotency.py, stages/trace_id.py,
  stages/scoring_worker.py, stages/routes.py

See ADR-008: docs/adr/ADR-008-fraud-detection-scoring-pipeline-design.md
"""
from __future__ import annotations

import asyncio, os, sys  # noqa: E401
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI

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

# Load and validate fraud detection configuration at startup
# Fails fast with a complete error report if any config is invalid
try:
    FRAUD_CONFIG = load_fraud_detection_config()
    log.info("fraud_detection_config_loaded", config=repr(FRAUD_CONFIG))
except ValueError as e:
    log.fatal("fraud_detection_config_validation_failed", error=str(e))
    sys.exit(1)

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

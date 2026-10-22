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

# Shared scoring helpers — single implementation per #1514.
from scoring import jaccard_similarity

# ---------------------------------------------------------------------------
# Logging — structlog configured for JSON output in production,
# coloured console output in development.
# ---------------------------------------------------------------------------

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
# Idempotency — store protocol + helpers
# ---------------------------------------------------------------------------

from stages.idempotency import (  # noqa: E402
    DEFAULT_TTL_SECONDS,
    IdempotencyStore,
    InMemoryIdempotencyStore,
    check_idempotency,
    record_idempotency,
)

# Application-wide idempotency store.
# Swap for PostgresIdempotencyStore(pool) in production via dependency injection
# or application lifespan configuration.
_idempotency_store: IdempotencyStore = InMemoryIdempotencyStore()


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

def scan_wash_contributions() -> list[Flag]:
    """
    Wash contribution heuristic.


def __setattr__(name: str, value):  # type: ignore[override]
    if name == "_last_duplicate_scan_at":
        _scoring._last_duplicate_scan_at = value
        return
    raise AttributeError(name)

    for (campaign_id, wallet), count in wash_count.items():
        if count >= WASH_MIN_OCCURRENCES:
            flags.append(Flag(
                id=_next_flag_id(),
                reason=FlagReason.WASH_CONTRIBUTION,
                severity=FlagSeverity.HIGH,
                campaign_id=campaign_id,
                wallet=wallet,
                detail=f"Wallet performed {count} wash cycles within {WASH_WINDOW_SECONDS}s",
            ))
    return flags


def scan_contribution_spikes() -> list[Flag]:
    """
    Sudden-spike heuristic.

    If a campaign receives more than SPIKE_MAX_CONTRIBUTIONS in any
    SPIKE_WINDOW_SECONDS rolling window, flag it as a potential sybil attack.
    """
    flags: list[Flag] = []
    by_campaign: dict[str, list[float]] = {}
    for c in _CONTRIBUTIONS:
        by_campaign.setdefault(c.campaign_id, []).append(c.timestamp)

    for campaign_id, timestamps in by_campaign.items():
        ts = sorted(timestamps)
        for i, t_start in enumerate(ts):
            window = [t for t in ts[i:] if t - t_start <= SPIKE_WINDOW_SECONDS]
            if len(window) > SPIKE_MAX_CONTRIBUTIONS:
                flags.append(Flag(
                    id=_next_flag_id(),
                    reason=FlagReason.CONTRIBUTION_SPIKE,
                    severity=FlagSeverity.MEDIUM,
                    campaign_id=campaign_id,
                    wallet=None,
                    detail=(
                        f"{len(window)} contributions in "
                        f"{SPIKE_WINDOW_SECONDS}s window "
                        f"(threshold: {SPIKE_MAX_CONTRIBUTIONS})"
                    ),
                ))
                break  # one flag per campaign per scan
    return flags


def scan_duplicate_content() -> list[Flag]:
    """
    Duplicate-content heuristic.

    Compares every pair of campaigns by title Jaccard similarity.
    Pairs above DUPLICATE_JACCARD_THRESHOLD are flagged.
    """
    flags: list[Flag] = []
    records = _CAMPAIGN_RECORDS
    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            a, b = records[i], records[j]
            sim = jaccard_similarity(a.title, b.title)
            if sim >= DUPLICATE_JACCARD_THRESHOLD:
                flags.append(Flag(
                    id=_next_flag_id(),
                    reason=FlagReason.DUPLICATE_CONTENT,
                    severity=FlagSeverity.LOW,
                    campaign_id=b.id,
                    wallet=None,
                    detail=(
                        f"Title Jaccard similarity {sim:.2f} with campaign {a.id} "
                        f"(threshold: {DUPLICATE_JACCARD_THRESHOLD})"
                    ),
                ))
    return flags


def run_full_scan() -> list[Flag]:
    """Execute all heuristics and append new flags to the moderation queue."""
    scan_log = log.bind(operation="run_full_scan")
    scan_log.info("scan_started")

    new_flags: list[Flag] = []
    new_flags.extend(scan_wash_contributions())
    new_flags.extend(scan_contribution_spikes())
    new_flags.extend(scan_duplicate_content())
    for f in new_flags:
        _enqueue(f)

    scan_log.info("scan_completed", new_flags=len(new_flags), queue_depth=len(_QUEUE))
    return new_flags


# ---------------------------------------------------------------------------
# Contribution notification model
# ---------------------------------------------------------------------------

@dataclass
class ContributionPayload:
    """
    Payload posted by graphql-api to ``POST /contributions``.

    Mirrors ``ContributionNotification`` in
    ``services/graphql-api/src/services/fraud-client.ts``.
    """
    campaignId: str
    contributor: str
    amount: str          # stringified bigint
    transactionHash: str
    timestamp: float     # Unix epoch seconds


# ---------------------------------------------------------------------------
# Async scoring job queue (#904)
# ---------------------------------------------------------------------------

@dataclass
class ScoringJob:
    """A unit of async fraud-scoring work enqueued per incoming contribution."""
    payload: ContributionPayload
    enqueued_at: float = field(default_factory=time.time)


#: Bounded asyncio queue — prevents unbounded memory growth under load.
#: When full, POST /contributions returns 503 rather than blocking.
_scoring_queue: asyncio.Queue[ScoringJob] = asyncio.Queue(maxsize=SCORING_QUEUE_MAXSIZE)

# ---------------------------------------------------------------------------
# Queue metrics — updated by _scoring_worker
# ---------------------------------------------------------------------------
_JOBS_PROCESSED: int = 0
_TOTAL_FLAGS_FOUND: int = 0
_AVG_LATENCY_MS_EMA: float = 0.0   # exponential moving average, α=0.1
_LAST_JOB_AT: Optional[float] = None
_EMA_ALPHA = 0.1                    # smoothing factor for latency EMA


async def _scoring_worker() -> None:
    """
    Background coroutine that drains the scoring queue.

    For each job:
    1. Dequeue a ScoringJob.
    2. Store the contribution in the in-memory event store.
    3. Run the full heuristic scan (run_full_scan).
    4. Update metrics (job count, flag count, EMA latency).
    5. Mark the task done.

    Any exception is logged and swallowed so the worker never crashes.
    """
    global _JOBS_PROCESSED, _TOTAL_FLAGS_FOUND, _AVG_LATENCY_MS_EMA, _LAST_JOB_AT

    worker_log = log.bind(component="scoring_worker")
    worker_log.info("scoring_worker_started")

    while True:
        job: ScoringJob = await _scoring_queue.get()
        try:
            payload = job.payload

            # Store the contribution event
            _CONTRIBUTIONS.append(ContributionEvent(
                campaign_id=payload.campaignId,
                wallet=payload.contributor,
                amount=int(payload.amount) if payload.amount.isdigit() else 0,
                timestamp=payload.timestamp,
            ))

            # Run the full scan to apply heuristics post-hoc
            new_flags = run_full_scan()

            # Update metrics
            processing_latency_ms = (time.time() - job.enqueued_at) * 1000
            _JOBS_PROCESSED += 1
            _TOTAL_FLAGS_FOUND += len(new_flags)
            _LAST_JOB_AT = time.time()

            # Exponential moving average for latency
            if _JOBS_PROCESSED == 1:
                _AVG_LATENCY_MS_EMA = processing_latency_ms
            else:
                _AVG_LATENCY_MS_EMA = (
                    _EMA_ALPHA * processing_latency_ms
                    + (1 - _EMA_ALPHA) * _AVG_LATENCY_MS_EMA
                )

            worker_log.info(
                "job_processed",
                campaign_id=payload.campaignId,
                contributor=payload.contributor,
                new_flags=len(new_flags),
                processing_latency_ms=round(processing_latency_ms, 2),
                queue_depth_after=_scoring_queue.qsize(),
                total_jobs_processed=_JOBS_PROCESSED,
            )
        except Exception as exc:
            worker_log.error(
                "job_processing_error",
                error=str(exc),
                campaign_id=getattr(job.payload, "campaignId", "unknown"),
            )
        finally:
            _scoring_queue.task_done()


# ---------------------------------------------------------------------------
# Application lifespan: start/stop the scoring worker
# ---------------------------------------------------------------------------

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

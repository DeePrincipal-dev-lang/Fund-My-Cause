"""
Async scoring worker stage for the fraud detection pipeline.

Owns the domain payload types (ContributionPayload, ScoringJob), the
asyncio queue, per-worker metrics, and the background coroutine that drains
the queue.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional

import structlog

from repository import (
    ContributionEvent,
    append_contribution,
)
from scoring import run_full_scan

log: structlog.BoundLogger = structlog.get_logger("fraud_detection")

SCORING_QUEUE_MAXSIZE = 1000

# ---------------------------------------------------------------------------
# Domain types
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
    amount: str
    transactionHash: str
    timestamp: float


@dataclass
class ScoringJob:
    """A unit of async fraud-scoring work enqueued per incoming contribution."""

    payload: ContributionPayload
    enqueued_at: float = field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Queue and metrics
# ---------------------------------------------------------------------------

scoring_queue: asyncio.Queue[ScoringJob] = asyncio.Queue(maxsize=SCORING_QUEUE_MAXSIZE)

_JOBS_PROCESSED: int = 0
_TOTAL_FLAGS_FOUND: int = 0
_AVG_LATENCY_MS_EMA: float = 0.0
_LAST_JOB_AT: Optional[float] = None
_EMA_ALPHA = 0.1


def get_metrics() -> dict:
    """Return current worker metrics."""
    return {
        "queue_depth": scoring_queue.qsize(),
        "total_jobs_processed": _JOBS_PROCESSED,
        "total_flags_found": _TOTAL_FLAGS_FOUND,
        "avg_processing_latency_ms": round(_AVG_LATENCY_MS_EMA, 3),
        "last_job_at": _LAST_JOB_AT,
    }


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------


async def scoring_worker() -> None:
    """
    Background coroutine that drains the scoring queue.

    For each job:
    1. Dequeue a ScoringJob.
    2. Store the contribution via the repository layer.
    3. Run the full heuristic scan via the scoring layer.
    4. Update metrics.
    5. Mark the task done.
    """
    global _JOBS_PROCESSED, _TOTAL_FLAGS_FOUND, _AVG_LATENCY_MS_EMA, _LAST_JOB_AT

    worker_log = log.bind(component="scoring_worker")
    worker_log.info("scoring_worker_started")

    while True:
        job: ScoringJob = await scoring_queue.get()
        try:
            payload = job.payload

            append_contribution(ContributionEvent(
                campaign_id=payload.campaignId,
                wallet=payload.contributor,
                amount=int(payload.amount) if payload.amount.isdigit() else 0,
                timestamp=payload.timestamp,
            ))

            new_flags = run_full_scan()

            processing_latency_ms = (time.time() - job.enqueued_at) * 1000
            _JOBS_PROCESSED += 1
            _TOTAL_FLAGS_FOUND += len(new_flags)
            _LAST_JOB_AT = time.time()

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
                queue_depth_after=scoring_queue.qsize(),
                total_jobs_processed=_JOBS_PROCESSED,
            )
        except Exception as exc:
            worker_log.error(
                "job_processing_error",
                error=str(exc),
                campaign_id=getattr(job.payload, "campaignId", "unknown"),
            )
        finally:
            scoring_queue.task_done()

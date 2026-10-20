"""
Pipeline stages for fraud detection service.

Each stage is responsible for a specific part of the pipeline:
- idempotency: Idempotency key management
- trace_id: Trace-ID middleware for request correlation
- scoring_worker: Async scoring worker, payload types, and queue metrics
"""

from .base import Stage, run_stages, stage_names
from .idempotency import IdempotencyStore, IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_TTL_SECONDS, IDEMPOTENCY_KEY_MAX_LEN
from .trace_id import TraceIDMiddleware, TRACE_ID_HEADER
from .scoring_worker import (
    ContributionPayload,
    ScoringJob,
    scoring_queue,
    scoring_worker,
    get_metrics,
    SCORING_QUEUE_MAXSIZE,
)

__all__ = [
    "Stage",
    "run_stages",
    "stage_names",
    "IdempotencyStore",
    "IDEMPOTENCY_KEY_HEADER",
    "IDEMPOTENCY_TTL_SECONDS",
    "IDEMPOTENCY_KEY_MAX_LEN",
    "TraceIDMiddleware",
    "TRACE_ID_HEADER",
    "ContributionPayload",
    "ScoringJob",
    "scoring_queue",
    "scoring_worker",
    "get_metrics",
    "SCORING_QUEUE_MAXSIZE",
]

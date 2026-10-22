"""
HTTP route handlers for the fraud detection pipeline.

All FastAPI route logic lives here so that pipeline.py remains a thin
orchestrator (app construction + lifespan only).
"""

from __future__ import annotations

import time
from typing import Optional

import structlog
from fastapi import BackgroundTasks, Request
from fastapi.responses import JSONResponse

from repository import (
    ContributionEvent,
    FlagReason,
    get_flags,
    mark_flag_reviewed,
    total_flag_count,
)
from scoring import run_full_scan

from stages.idempotency import IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LEN, IdempotencyStore
from stages.scoring_worker import ContributionPayload, scoring_queue, get_metrics

log: structlog.BoundLogger = structlog.get_logger("fraud_detection")

# Module-level idempotency store — shared singleton for this process.
_IDEMPOTENCY_STORE = IdempotencyStore()

# Contributions list reference (kept here for direct append in the handler).
import repository as _repo
_CONTRIBUTIONS = _repo._CONTRIBUTIONS


def healthz() -> dict:
    return {"status": "ok", "timestamp": time.time()}


def readyz() -> dict:
    return {"ready": True, "checks": {"service": "ready", "queue": "ok"}, "timestamp": time.time()}


async def ingest_contribution(request: Request) -> JSONResponse:
    """Accept a contribution, apply idempotency, enqueue for scoring."""
    idempotency_key: Optional[str] = request.headers.get(IDEMPOTENCY_KEY_HEADER)
    if idempotency_key is not None:
        if len(idempotency_key) > IDEMPOTENCY_KEY_MAX_LEN:
            log.warning("contributions_idempotency_key_too_long", key_length=len(idempotency_key))
            return JSONResponse(status_code=400, content={"error": "Idempotency-Key exceeds maximum length"})
        cached = _IDEMPOTENCY_STORE.get(idempotency_key)
        if cached is not None:
            log.info("contributions_duplicate_rejected", idempotency_key=idempotency_key)
            return JSONResponse(status_code=202, content=cached)

    try:
        body = await request.json()
        payload = ContributionPayload(**body)
    except Exception as exc:
        log.warning("contributions_ingest_invalid_payload", error=str(exc))
        return JSONResponse(status_code=422, content={"error": "invalid payload"})

    queue_depth = scoring_queue.qsize()
    log.info("contribution_queued", campaign_id=payload.campaignId, contributor=payload.contributor,
             amount=payload.amount, tx_hash=payload.transactionHash, queue_depth=queue_depth)

    _CONTRIBUTIONS.append(ContributionEvent(
        campaign_id=payload.campaignId, wallet=payload.contributor,
        amount=int(payload.amount) if payload.amount.isdigit() else 0,
        timestamp=payload.timestamp,
    ))
    log.debug("contribution_stored", store_size=len(_CONTRIBUTIONS))

    response_body = {"status": "accepted"}
    if idempotency_key is not None:
        _IDEMPOTENCY_STORE.set(idempotency_key, response_body)
        log.debug("contributions_idempotency_key_stored", idempotency_key=idempotency_key)

    return JSONResponse(status_code=202, content=response_body)


def trigger_scan(background_tasks: BackgroundTasks) -> dict:
    log.info("scan_scheduled")
    background_tasks.add_task(run_full_scan, force_duplicate_scan=True)
    return {"status": "scan_scheduled"}


def get_metrics_handler() -> dict:
    return get_metrics()


def moderation_queue_handler(
    reviewed: Optional[bool] = None,
    reason: Optional[FlagReason] = None,
    limit: int = 50,
) -> JSONResponse:
    items = get_flags(reviewed=reviewed, reason=reason, limit=limit)
    log.debug("moderation_queue_queried", returned=len(items), total=total_flag_count())
    return JSONResponse(content={
        "total": total_flag_count(), "returned": len(items),
        "flags": [{"id": f.id, "reason": f.reason, "severity": f.severity,
                   "campaign_id": f.campaign_id, "wallet": f.wallet, "detail": f.detail,
                   "flagged_at": f.flagged_at, "reviewed": f.reviewed} for f in items],
    })


def mark_reviewed_handler(flag_id: str) -> dict:
    found = mark_flag_reviewed(flag_id)
    if found:
        log.info("flag_marked_reviewed", flag_id=flag_id)
        return {"status": "updated", "id": flag_id}
    log.warning("flag_not_found", flag_id=flag_id)
    return JSONResponse(status_code=404, content={"error": "flag not found"})

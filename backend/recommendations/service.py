"""
Campaign Recommendation Service (#635)

Exposes GET /recommendations with per-wallet personalisation.
Falls back to trending/popular campaigns for cold-start users.
Results are cached with a configurable TTL.

Schema Audit (#897)
───────────────────
Audit date: 2026-07-28
Auditor: automated (no Postgres persistence yet; store is in-memory)

The service uses two domain types:

1. ``Campaign`` dataclass
   ┌───────────────────┬──────────────┬──────────────────────────────┐
   │ Field             │ Read?        │ Written?                     │
   ├───────────────────┼──────────────┼──────────────────────────────┤
   │ id                │ Yes (key)    │ Yes (seeded)                 │
   │ title             │ Yes (resp)   │ Yes (seeded)                 │
   │ category          │ Yes (score)  │ Yes (seeded)                 │
   │ total_raised      │ Yes (score)  │ Yes (seeded)                 │
   │ contributor_count │ Yes (score)  │ Yes (seeded)                 │
   │ created_at        │ Yes (score)  │ Yes (seeded)                 │
   └───────────────────┴──────────────┴──────────────────────────────┘
   Result: NO unused columns.  All six fields are referenced by at
   least one of: _trending_score(), _personalised_score(), _recommend().

2. ``IndexedActivity`` dataclass
   ┌──────────────────────────┬──────────────┬──────────────────────┐
   │ Field                    │ Read?        │ Written?             │
   ├──────────────────────────┼──────────────┼──────────────────────┤
   │ wallet                   │ Yes (key)    │ Yes (_ACTIVITY dict) │
   │ contributed_campaign_ids │ Yes (score)  │ Yes (_ACTIVITY dict) │
   │ preferred_categories     │ Yes (score)  │ Yes (_ACTIVITY dict) │
   └──────────────────────────┴──────────────┴──────────────────────┘
   Result: NO unused columns.

Verification method: static read of every field reference across this
module (grep / manual inspection).  See tests_service.py →
``test_all_campaign_fields_used`` for the automated regression guard.

Migration note
──────────────
When a real SQL/NoSQL persistence layer is introduced, drop any columns
that are not present in the ``Campaign`` or ``IndexedActivity`` dataclasses
above with a data-preserving rollback migration.  The migration template
is documented in ``docs/adr/ADR-005-fraud-detection-vs-recommendations-service-split.md``.

Structured logging (#895)
──────────────────────────
Uses structlog with the same configuration as fraud_detection/pipeline.py:
  - merge_contextvars as the first processor (injects trace_id on every line)
  - TraceIDMiddleware extracts X-Trace-ID from inbound requests and binds it
    into structlog's context-var store for the request lifetime
  - JSON output in production (LOG_FORMAT=json), coloured console in dev
See docs/logging-conventions.md for the project-wide logging convention.

Cold-start fallback algorithm (#1387)
─────────────────────────────────────
The recommendation endpoint has two scoring paths and picks one per
request.  The choice is deterministic and driven entirely by whether the
caller's wallet has an IndexedActivity record:

  wallet param missing          → cold path (trending)
  wallet present, no activity   → cold path (trending), personalised=False
  wallet present, activity row  → warm path (personalised)

The warm path additionally filters out campaigns the wallet has already
contributed to and applies a category boost to preferred categories.
The cold path applies neither — it returns the top N by trending score.

Boundary definition
    The "cold → warm boundary" is exactly the presence of an
    IndexedActivity row for the wallet.  An empty row (no contributions,
    no preferred categories) still selects the warm path — the service
    reports personalised=True — but the warm score for every campaign
    equals its trending score, so the observable output is identical to
    the cold path except for the personalised flag.

Degradation under partial data
    - No contributions, no categories → warm path, no exclusions, no
      boosts.  Scores equal trending scores.
    - Contributions only              → warm path, exclusions apply,
      no boosts.
    - Categories only                 → warm path, no exclusions,
      boosts apply to matching categories.
    - Both signals                    → fully warmed-up scoring.
    - All campaigns already contributed → warm path returns an empty
      recommendations list (not an error).

The boundary is intentionally documented here and asserted by
``tests_cold_start.py::TestColdStartBoundary`` so that any future change
to the selection rule breaks a test before it reaches production.
"""

from __future__ import annotations

import logging
import math
import os
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

import structlog
from fastapi import FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from scoring_config import SCORING_CONFIG
from error_schema import bad_request, internal_error

# ---------------------------------------------------------------------------
# Shared DB pool config (#1128) — see backend/shared/db_config.py. Neither
# service in this repo is packaged as an installable Python package, so we
# add the sibling `backend/shared/` directory to sys.path rather than
# duplicating the config module per service.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared"))
from db_config import load_db_pool_config  # noqa: E402

# ---------------------------------------------------------------------------
# Structured logging — same configuration as fraud_detection/pipeline.py
# (#895 — centralise logging across all backend services)
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,       # injects trace_id automatically
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()
        if __import__("os").getenv("LOG_FORMAT") != "json"
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(__import__("os").getenv("LOG_LEVEL", "INFO"))
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

log: structlog.BoundLogger = structlog.get_logger("recommendations")

# Effective DB pool configuration (#1128). Not yet backing a live connection
# pool — this service stores data in-memory (see module docstring) — but
# resolved and logged at startup so the single shared source of truth is
# visible in this service's logs ahead of a real persistence layer landing.
DB_POOL_CONFIG = load_db_pool_config()
log.info("db_pool_config_resolved", **DB_POOL_CONFIG.__dict__)

# ---------------------------------------------------------------------------
# Trace-ID convention (mirrors fraud_detection/pipeline.py)
# ---------------------------------------------------------------------------

#: The canonical header name — must match TRACE_ID_HEADER in shared-utils.
TRACE_ID_HEADER = "x-trace-id"

#: Valid Fund-My-Cause trace IDs match this pattern.
_TRACE_ID_RE = re.compile(r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$")


def _is_valid_trace_id(value: str) -> bool:
    return bool(_TRACE_ID_RE.match(value))


# ---------------------------------------------------------------------------
# Trace-ID middleware
# ---------------------------------------------------------------------------

class TraceIDMiddleware(BaseHTTPMiddleware):
    """
    Extract (or generate) an X-Trace-ID for every inbound request.

    Mirrors the implementation in fraud_detection/pipeline.py — see
    docs/logging-conventions.md for the canonical description.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if _is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        log.info(
            "request_started",
            method=request.method,
            path=request.url.path,
        )

        response: Response = await call_next(request)

        # Echo the trace ID back so callers can correlate their logs.
        response.headers[TRACE_ID_HEADER] = trace_id

        log.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )

        return response


# ---------------------------------------------------------------------------
# In-process cache (TTL-based)
# ---------------------------------------------------------------------------
_CACHE: dict[str, tuple[float, object]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

# _CACHE is keyed by distinct (wallet, limit) pairs, so an unbounded number of
# distinct wallets querying the service would grow it without limit. Bound it
# with simple FIFO eviction (dicts preserve insertion order in Python 3.7+),
# mirroring the bounded-queue approach fraud_detection uses for its own
# in-memory growth risk.
CACHE_MAX_SIZE = 1000


def _cache_get(key: str) -> object | None:
    entry = _CACHE.get(key)
    if entry and time.time() - entry[0] < CACHE_TTL_SECONDS:
        return entry[1]
    return None


def _cache_set(key: str, value: object) -> None:
    if key not in _CACHE and len(_CACHE) >= CACHE_MAX_SIZE:
        oldest_key = next(iter(_CACHE))
        del _CACHE[oldest_key]
    _CACHE[key] = (time.time(), value)


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------
@dataclass
class Campaign:
    id: str
    title: str
    category: str
    total_raised: int
    contributor_count: int
    created_at: float


@dataclass
class IndexedActivity:
    """Indexed on-chain activity for a contributor wallet."""

    wallet: str
    contributed_campaign_ids: list[str] = field(default_factory=list)
    preferred_categories: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Stub data store (replace with real DB / Horizon indexer in production)
# ---------------------------------------------------------------------------
_CAMPAIGNS: list[Campaign] = [
    Campaign("c1", "Open-Source Wallet", "tech", 50_000, 120, time.time() - 86400),
    Campaign("c2", "Community Garden", "environment", 20_000, 45, time.time() - 3600),
    Campaign("c3", "Stellar SDK Docs", "tech", 80_000, 200, time.time() - 172800),
    Campaign("c4", "Local Music Festival", "arts", 15_000, 30, time.time() - 7200),
    Campaign("c5", "Solar Panels for Schools", "environment", 120_000, 300, time.time() - 43200),
]

_ACTIVITY: dict[str, IndexedActivity] = {}


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------
def _trending_score(c: Campaign) -> float:
    """Recency-weighted activity: more weight to recent, active campaigns."""
    age_hours = max((time.time() - c.created_at) / 3600, SCORING_CONFIG.age_divisor_min)
    return (c.contributor_count * math.log1p(c.total_raised)) / age_hours


def _personalised_score(c: Campaign, activity: IndexedActivity) -> float:
    base = _trending_score(c)
    # Boost campaigns in categories the user has previously contributed to
    category_boost = SCORING_CONFIG.category_boost if c.category in activity.preferred_categories else 1.0
    # Exclude campaigns the user already contributed to
    already_contributed = c.id in activity.contributed_campaign_ids
    return 0.0 if already_contributed else base * category_boost


def _recommend(wallet: Optional[str], limit: int) -> list[dict]:
    activity = _ACTIVITY.get(wallet) if wallet else None

    # Compute each campaign's score exactly once per request and reuse it for
    # sorting, filtering, and the output payload — previously
    # _personalised_score()/_trending_score() was called three separate times
    # per campaign (once for each of those three uses).
    if activity:
        # Log the resolved activity record's wallet (not just the raw query
        # param) for auditability — it's the key that actually drove scoring.
        log.debug("personalising_recommendations", wallet=activity.wallet)
        scores = {c.id: _personalised_score(c, activity) for c in _CAMPAIGNS}
    else:
        scores = {c.id: _trending_score(c) for c in _CAMPAIGNS}

    scored = sorted(_CAMPAIGNS, key=lambda c: scores[c.id], reverse=True)
    if activity:
        # Exclude campaigns the wallet has already contributed to (score == 0).
        scored = [c for c in scored if scores[c.id] > 0.0]

    return [
        {
            "campaign_id": c.id,
            "title": c.title,
            "category": c.category,
            "total_raised": c.total_raised,
            "contributor_count": c.contributor_count,
            "score": round(scores[c.id], 4),
        }
        for c in scored[:limit]
    ]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Fund-My-Cause Recommendation Service", version="1.0.0")

# Register TraceIDMiddleware so every request gets trace_id bound in structlog.
app.add_middleware(TraceIDMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "timestamp": time.time()}


@app.get("/readyz")
def readyz() -> dict:
    return {
        "ready": True,
        "checks": {"service": "ready"},
        "timestamp": time.time(),
    }


@app.get("/recommendations")
def get_recommendations(
    wallet: Optional[str] = Query(None, description="Stellar wallet address for personalisation"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of recommendations"),
) -> JSONResponse:
    """
    Return ranked campaign recommendations.

    - If `wallet` is provided and has indexed activity, results are personalised
      by category affinity and exclude campaigns already contributed to.
    - Cold-start (unknown wallet or no wallet) returns the top trending campaigns.
    - Results are cached per (wallet, limit) key for CACHE_TTL_SECONDS.

    Success response (200):
        { wallet, personalised, recommendations, cached_at }

    Error responses follow the standard error envelope from error_schema.py:
        { "error": { "code": "...", "message": "...", "detail": "..." } }
    """
    cache_key = f"{wallet}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        log.debug("recommendations_cache_hit", wallet=wallet, limit=limit)
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    log.info(
        "recommendations_requested",
        wallet=wallet,
        limit=limit,
        personalised=wallet in _ACTIVITY if wallet else False,
    )

    try:
        recommendations = _recommend(wallet, limit)
    except Exception as exc:
        log.error("recommendations_scoring_failed", wallet=wallet, limit=limit, error=str(exc))
        return internal_error(
            "Failed to compute recommendations",
            detail=str(exc) if __import__("os").getenv("LOG_FORMAT") != "json" else None,
        )

    payload = {
        "wallet": wallet,
        "personalised": wallet is not None and wallet in _ACTIVITY,
        "recommendations": recommendations,
        "cached_at": time.time(),
    }
    _cache_set(cache_key, payload)

    log.info(
        "recommendations_returned",
        wallet=wallet,
        count=len(recommendations),
        personalised=payload["personalised"],
    )

    return JSONResponse(content=payload, headers={"X-Cache": "MISS"})

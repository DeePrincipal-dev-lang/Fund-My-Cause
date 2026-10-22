"""
Canonical Trace-ID utilities for Fund-My-Cause Python services.

Convention (must match packages/shared-utils/src/trace.ts)
──────────────────────────────────────────────────────────
Header name : x-trace-id
Format      : fmc-<timestamp_hex>-<random_hex>
              timestamp = 8 hex chars (Unix seconds, 32-bit big-endian)
              random    = 16 hex chars (8 random bytes)
Example     : fmc-67946a1b-3f8c2a0d9e4b71c2
Total length: 28 characters

See docs/trace-id-spec.md for the full specification.
"""

from __future__ import annotations

import re
import secrets
import time
from contextvars import ContextVar
from typing import Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# Public constants
# ---------------------------------------------------------------------------

#: The canonical HTTP header name for trace propagation.
TRACE_ID_HEADER: str = "x-trace-id"

#: Valid Fund-My-Cause trace IDs must match this pattern.
TRACE_ID_RE: re.Pattern[str] = re.compile(r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$")

#: Holds the trace ID for the current async request context.
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")

# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def is_valid_trace_id(value: str) -> bool:
    """Return True iff *value* is a well-formed Fund-My-Cause trace ID."""
    return bool(TRACE_ID_RE.match(value))


def generate_trace_id() -> str:
    """
    Generate a new Fund-My-Cause trace ID.

    Uses ``secrets.token_bytes`` for cryptographically-strong randomness.
    """
    ts_hex = format(int(time.time()) & 0xFFFFFFFF, "08x")
    rand_hex = secrets.token_bytes(8).hex()
    return f"fmc-{ts_hex}-{rand_hex}"


# ---------------------------------------------------------------------------
# Starlette / FastAPI middleware
# ---------------------------------------------------------------------------

log: structlog.BoundLogger = structlog.get_logger(__name__)


class TraceIDMiddleware(BaseHTTPMiddleware):
    """
    Extract (or fall back) an X-Trace-ID for every inbound request.

    - If the caller supplies a well-formed ``x-trace-id`` header it is stored
      in ``trace_id_var`` and bound into structlog's context-var store so that
      every downstream log call automatically carries the ``trace_id`` field.
    - If the header is absent or malformed a ``unknown-<timestamp>`` fallback
      is used so log lines are never missing the field.
    - The resolved value is echoed back as a response header.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw: str = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        # Bind into structlog's context-var store — every log.* call in this
        # request automatically carries trace_id from here on.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        # Also store in a plain ContextVar for non-structlog callsites.
        trace_id_var.set(trace_id)

        log.info(
            "request_started",
            method=request.method,
            path=request.url.path,
        )

        response: Response = await call_next(request)

        # Echo the trace ID back so callers can correlate their own logs.
        response.headers[TRACE_ID_HEADER] = trace_id

        log.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )

        return response

"""
Trace-ID middleware stage for the fraud detection pipeline.

Extracts or generates an X-Trace-ID for every inbound HTTP request and
binds it into structlog's context-var store so every log line automatically
includes the trace_id field.
"""

from __future__ import annotations

import re
import time
from contextvars import ContextVar
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

log: structlog.BoundLogger = structlog.get_logger("fraud_detection")

TRACE_ID_HEADER = "x-trace-id"
_TRACE_ID_RE = re.compile(r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$")
_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")


def _is_valid_trace_id(value: str) -> bool:
    return bool(_TRACE_ID_RE.match(value))


class TraceIDMiddleware(BaseHTTPMiddleware):
    """Extract (or generate) an X-Trace-ID for every inbound request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if _is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        _trace_id_var.set(trace_id)

        log.info("request_started", method=request.method, path=request.url.path)
        response: Response = await call_next(request)
        response.headers[TRACE_ID_HEADER] = trace_id
        log.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )
        return response

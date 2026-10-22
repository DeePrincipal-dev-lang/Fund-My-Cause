"""
Shared error-response schema for the Fund-My-Cause recommendation service.

All HTTP error responses from this service MUST be constructed through this
module so clients can rely on a consistent envelope regardless of which
endpoint produced the error.

Error envelope
──────────────
{
    "error": {
        "code":    "<SCREAMING_SNAKE_CASE string>",
        "message": "<human-readable description>",
        "detail":  "<optional extra context, may be null>"
    }
}

Standard error codes
────────────────────
BAD_REQUEST         – malformed query parameters (e.g. limit out of range)
NOT_FOUND           – requested resource does not exist
INTERNAL_ERROR      – unexpected server-side failure
SERVICE_UNAVAILABLE – dependency unavailable (e.g. upstream data store)

Usage example
─────────────
    from error_schema import bad_request, internal_error

    @app.get("/recommendations")
    def get_recommendations(limit: int = Query(5, ge=1, le=20)):
        if limit > 20:
            return bad_request("limit must be between 1 and 20", detail=f"got {limit}")
        ...
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi.responses import JSONResponse


# ---------------------------------------------------------------------------
# Canonical error codes
# ---------------------------------------------------------------------------

class ErrorCode:
    BAD_REQUEST: str = "BAD_REQUEST"
    NOT_FOUND: str = "NOT_FOUND"
    INTERNAL_ERROR: str = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE: str = "SERVICE_UNAVAILABLE"


# ---------------------------------------------------------------------------
# Envelope dataclass
# ---------------------------------------------------------------------------

@dataclass
class ErrorDetail:
    code: str
    message: str
    detail: Optional[str] = None


@dataclass
class ErrorEnvelope:
    error: ErrorDetail

    def to_dict(self) -> dict:
        result: dict = {
            "error": {
                "code": self.error.code,
                "message": self.error.message,
            }
        }
        if self.error.detail is not None:
            result["error"]["detail"] = self.error.detail
        return result


# ---------------------------------------------------------------------------
# Factory helpers — use these everywhere instead of bare JSONResponse(…)
# ---------------------------------------------------------------------------

def _make_response(
    http_status: int,
    code: str,
    message: str,
    detail: Optional[str] = None,
) -> JSONResponse:
    """Build a ``JSONResponse`` whose body conforms to the error envelope schema."""
    envelope = ErrorEnvelope(error=ErrorDetail(code=code, message=message, detail=detail))
    return JSONResponse(status_code=http_status, content=envelope.to_dict())


def bad_request(message: str, detail: Optional[str] = None) -> JSONResponse:
    """HTTP 400 — malformed input."""
    return _make_response(400, ErrorCode.BAD_REQUEST, message, detail)


def not_found(message: str, detail: Optional[str] = None) -> JSONResponse:
    """HTTP 404 — resource not found."""
    return _make_response(404, ErrorCode.NOT_FOUND, message, detail)


def internal_error(message: str = "An unexpected error occurred", detail: Optional[str] = None) -> JSONResponse:
    """HTTP 500 — unexpected server failure."""
    return _make_response(500, ErrorCode.INTERNAL_ERROR, message, detail)


def service_unavailable(message: str, detail: Optional[str] = None) -> JSONResponse:
    """HTTP 503 — upstream dependency unavailable."""
    return _make_response(503, ErrorCode.SERVICE_UNAVAILABLE, message, detail)

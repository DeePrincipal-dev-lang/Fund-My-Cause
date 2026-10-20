"""
Tests for the standardized error-response schema (#1123).

Verifies that:
1. All error factory functions return the canonical envelope shape.
2. HTTP status codes are correct for each factory.
3. Optional ``detail`` field is included only when provided.
4. All endpoints in service.py return errors that conform to the schema.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse

from error_schema import (
    ErrorCode,
    ErrorDetail,
    ErrorEnvelope,
    bad_request,
    internal_error,
    not_found,
    service_unavailable,
)
from service import app

client = TestClient(app)


# ── Envelope shape ────────────────────────────────────────────────────────────

class TestErrorEnvelopeShape:
    """Every error response must have the standard envelope."""

    def _assert_envelope(self, response: JSONResponse, expected_status: int, expected_code: str) -> dict:
        assert response.status_code == expected_status, (
            f"Expected HTTP {expected_status}, got {response.status_code}"
        )
        body = response.body
        import json
        data = json.loads(body)
        assert "error" in data, f"Missing 'error' key in response: {data}"
        error = data["error"]
        assert "code" in error, f"Missing 'code' in error envelope: {error}"
        assert "message" in error, f"Missing 'message' in error envelope: {error}"
        assert error["code"] == expected_code, (
            f"Expected code '{expected_code}', got '{error['code']}'"
        )
        return data

    def test_bad_request_status_and_code(self):
        resp = bad_request("test bad request")
        self._assert_envelope(resp, 400, ErrorCode.BAD_REQUEST)

    def test_not_found_status_and_code(self):
        resp = not_found("test not found")
        self._assert_envelope(resp, 404, ErrorCode.NOT_FOUND)

    def test_internal_error_status_and_code(self):
        resp = internal_error("test internal error")
        self._assert_envelope(resp, 500, ErrorCode.INTERNAL_ERROR)

    def test_service_unavailable_status_and_code(self):
        resp = service_unavailable("test unavailable")
        self._assert_envelope(resp, 503, ErrorCode.SERVICE_UNAVAILABLE)

    def test_detail_included_when_provided(self):
        resp = bad_request("param out of range", detail="limit must be 1–20")
        import json
        data = json.loads(resp.body)
        assert data["error"]["detail"] == "limit must be 1–20"

    def test_detail_omitted_when_not_provided(self):
        resp = bad_request("param out of range")
        import json
        data = json.loads(resp.body)
        assert "detail" not in data["error"]

    def test_detail_omitted_when_none(self):
        resp = internal_error("oops", detail=None)
        import json
        data = json.loads(resp.body)
        assert "detail" not in data["error"]

    def test_message_is_preserved(self):
        msg = "custom descriptive message"
        resp = not_found(msg)
        import json
        data = json.loads(resp.body)
        assert data["error"]["message"] == msg


# ── ErrorEnvelope dataclass ───────────────────────────────────────────────────

class TestErrorEnvelopeDataclass:
    def test_to_dict_without_detail(self):
        env = ErrorEnvelope(error=ErrorDetail(code="BAD_REQUEST", message="bad"))
        d = env.to_dict()
        assert d == {"error": {"code": "BAD_REQUEST", "message": "bad"}}
        assert "detail" not in d["error"]

    def test_to_dict_with_detail(self):
        env = ErrorEnvelope(error=ErrorDetail(code="NOT_FOUND", message="not found", detail="id=42"))
        d = env.to_dict()
        assert d["error"]["detail"] == "id=42"


# ── Endpoint conformance ──────────────────────────────────────────────────────

class TestEndpointErrorConformance:
    """
    Verify that FastAPI's built-in 422 validation errors and successful
    responses from service.py are sensible, and that the /recommendations
    endpoint handles unexpected exceptions with a standard 500 envelope.
    """

    def test_invalid_limit_zero_returns_422(self):
        """FastAPI's own validation returns 422 for limit=0 (ge=1 constraint)."""
        r = client.get("/recommendations?limit=0")
        assert r.status_code == 422

    def test_invalid_limit_too_large_returns_422(self):
        r = client.get("/recommendations?limit=99")
        assert r.status_code == 422

    def test_valid_request_returns_200(self):
        r = client.get("/recommendations?limit=3")
        assert r.status_code == 200
        body = r.json()
        assert "recommendations" in body
        assert "personalised" in body
        assert "wallet" in body

    def test_scoring_exception_returns_standard_500(self, monkeypatch):
        """If _recommend() raises unexpectedly, the endpoint must return a 500 envelope."""
        import service as svc

        def boom(wallet, limit):
            raise RuntimeError("simulated scoring failure")

        monkeypatch.setattr(svc, "_recommend", boom)
        # Clear cache so the endpoint actually calls _recommend
        svc._CACHE.clear()

        r = client.get("/recommendations?limit=2")
        assert r.status_code == 500
        body = r.json()
        assert "error" in body
        assert body["error"]["code"] == "INTERNAL_ERROR"
        assert "message" in body["error"]

    def test_health_endpoint_not_affected_by_error_schema(self):
        """Health endpoint must still return 200 with status ok."""
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── Error code constants ──────────────────────────────────────────────────────

class TestErrorCodeConstants:
    def test_all_expected_codes_exist(self):
        assert ErrorCode.BAD_REQUEST == "BAD_REQUEST"
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"
        assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"
        assert ErrorCode.SERVICE_UNAVAILABLE == "SERVICE_UNAVAILABLE"

"""
Tests for the shared error-response schema.

Verifies that:
1. All error factory functions return the canonical envelope shape.
2. HTTP status codes are correct for each factory.
3. Optional detail field is included only when provided.
4. Error codes are standardized across all services.
"""

from __future__ import annotations

import json

import pytest
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


class TestErrorEnvelopeShape:
    """Every error response must have the standard envelope."""

    def _parse_response(self, response: JSONResponse) -> dict:
        return json.loads(response.body)

    def test_bad_request_status_and_code(self):
        resp = bad_request("test bad request")
        assert resp.status_code == 400
        data = self._parse_response(resp)
        assert data["error"]["code"] == ErrorCode.BAD_REQUEST
        assert data["error"]["message"] == "test bad request"

    def test_not_found_status_and_code(self):
        resp = not_found("test not found")
        assert resp.status_code == 404
        data = self._parse_response(resp)
        assert data["error"]["code"] == ErrorCode.NOT_FOUND

    def test_internal_error_status_and_code(self):
        resp = internal_error("test internal error")
        assert resp.status_code == 500
        data = self._parse_response(resp)
        assert data["error"]["code"] == ErrorCode.INTERNAL_ERROR

    def test_service_unavailable_status_and_code(self):
        resp = service_unavailable("test unavailable")
        assert resp.status_code == 503
        data = self._parse_response(resp)
        assert data["error"]["code"] == ErrorCode.SERVICE_UNAVAILABLE

    def test_detail_included_when_provided(self):
        resp = bad_request("param out of range", detail="limit must be 1–20")
        data = self._parse_response(resp)
        assert data["error"]["detail"] == "limit must be 1–20"

    def test_detail_omitted_when_not_provided(self):
        resp = bad_request("param out of range")
        data = self._parse_response(resp)
        assert "detail" not in data["error"]

    def test_detail_omitted_when_none(self):
        resp = internal_error("oops", detail=None)
        data = self._parse_response(resp)
        assert "detail" not in data["error"]

    def test_message_is_preserved(self):
        msg = "custom descriptive message"
        resp = not_found(msg)
        data = self._parse_response(resp)
        assert data["error"]["message"] == msg

    def test_error_key_always_present(self):
        resp = bad_request("test")
        data = self._parse_response(resp)
        assert "error" in data
        assert isinstance(data["error"], dict)


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
        assert d["error"]["code"] == "NOT_FOUND"
        assert d["error"]["message"] == "not found"

    def test_error_detail_construction(self):
        detail = ErrorDetail(code="TEST_CODE", message="test msg", detail="extra")
        assert detail.code == "TEST_CODE"
        assert detail.message == "test msg"
        assert detail.detail == "extra"

    def test_error_detail_without_optional_detail(self):
        detail = ErrorDetail(code="TEST_CODE", message="test msg")
        assert detail.detail is None


class TestErrorCodeConstants:
    def test_all_expected_codes_exist(self):
        assert ErrorCode.BAD_REQUEST == "BAD_REQUEST"
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"
        assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"
        assert ErrorCode.SERVICE_UNAVAILABLE == "SERVICE_UNAVAILABLE"

    def test_code_values_are_screaming_snake_case(self):
        for code in [
            ErrorCode.BAD_REQUEST,
            ErrorCode.NOT_FOUND,
            ErrorCode.INTERNAL_ERROR,
            ErrorCode.SERVICE_UNAVAILABLE,
        ]:
            assert code.isupper()
            assert " " not in code

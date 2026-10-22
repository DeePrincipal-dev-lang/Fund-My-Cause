"""
Unit tests for backend/fraud_detection/stages/trace_id.py

Validates:
- is_valid_trace_id() against the shared cross-language fixture file
- generate_trace_id() produces valid IDs
- TraceIDMiddleware accepts / rejects IDs and echoes them correctly

Shared fixture: fixtures/trace-id-fixtures.json (consumed by both the
TypeScript and Python suites — any mismatch means the implementations have
diverged).
"""

from __future__ import annotations

import json
import os
import re
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from stages.trace_id import (
    TRACE_ID_HEADER,
    TRACE_ID_RE,
    TraceIDMiddleware,
    generate_trace_id,
    is_valid_trace_id,
)

# ---------------------------------------------------------------------------
# Locate the shared fixture file relative to this test file.
# Structure: Fund-My-Cause/
#   fixtures/trace-id-fixtures.json
#   backend/fraud_detection/stages/tests_trace_id.py  ← this file
# ---------------------------------------------------------------------------
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
_FIXTURE_PATH = os.path.join(_REPO_ROOT, "fixtures", "trace-id-fixtures.json")


@pytest.fixture(scope="module")
def fixtures() -> dict:
    with open(_FIXTURE_PATH, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# is_valid_trace_id — cross-language fixtures
# ---------------------------------------------------------------------------

class TestIsValidTraceId:
    def test_valid_ids_from_fixture(self, fixtures):
        """Every ID in fixtures['valid'] must be accepted."""
        for trace_id in fixtures["valid"]:
            assert is_valid_trace_id(trace_id), (
                f"Expected valid trace ID to pass validation: {trace_id!r}"
            )

    def test_invalid_ids_from_fixture(self, fixtures):
        """Every ID in fixtures['invalid'] must be rejected."""
        for trace_id in fixtures["invalid"]:
            assert not is_valid_trace_id(trace_id), (
                f"Expected invalid trace ID to fail validation: {trace_id!r}"
            )

    def test_rejects_none_like_values(self):
        assert not is_valid_trace_id("")
        # is_valid_trace_id is typed to accept str; empty string is the edge case.


# ---------------------------------------------------------------------------
# generate_trace_id
# ---------------------------------------------------------------------------

class TestGenerateTraceId:
    def test_output_is_valid(self):
        trace_id = generate_trace_id()
        assert is_valid_trace_id(trace_id), (
            f"generate_trace_id() produced invalid ID: {trace_id!r}"
        )

    def test_format_structure(self):
        trace_id = generate_trace_id()
        parts = trace_id.split("-")
        assert len(parts) == 3, f"Expected 3 dash-separated parts, got: {trace_id!r}"
        prefix, ts_hex, rand_hex = parts
        assert prefix == "fmc"
        assert len(ts_hex) == 8
        assert len(rand_hex) == 16
        assert re.fullmatch(r"[0-9a-f]{8}", ts_hex)
        assert re.fullmatch(r"[0-9a-f]{16}", rand_hex)

    def test_unique_ids(self):
        """Two successive calls must not produce the same ID (statistical)."""
        ids = {generate_trace_id() for _ in range(20)}
        assert len(ids) == 20, "generate_trace_id() produced collisions"

    def test_timestamp_is_recent(self):
        before = int(time.time())
        trace_id = generate_trace_id()
        after = int(time.time())
        ts_hex = trace_id.split("-")[1]
        ts = int(ts_hex, 16)
        assert before <= ts <= after + 1, (
            f"Embedded timestamp {ts} is outside [{before}, {after}]"
        )


# ---------------------------------------------------------------------------
# TRACE_ID_HEADER and TRACE_ID_RE constants
# ---------------------------------------------------------------------------

class TestConstants:
    def test_header_name(self):
        assert TRACE_ID_HEADER == "x-trace-id"

    def test_regex_pattern(self):
        assert TRACE_ID_RE.pattern == r"^fmc-[0-9a-f]{8}-[0-9a-f]{16}$"


# ---------------------------------------------------------------------------
# TraceIDMiddleware — integration via TestClient
# ---------------------------------------------------------------------------

def _make_app() -> FastAPI:
    """Build a minimal FastAPI app wrapped with TraceIDMiddleware."""
    app = FastAPI()
    app.add_middleware(TraceIDMiddleware)

    @app.get("/ping")
    def ping():
        return {"pong": True}

    return app


class TestTraceIDMiddleware:
    @pytest.fixture(autouse=True)
    def client(self):
        self._client = TestClient(_make_app(), raise_server_exceptions=True)

    def test_valid_header_echoed_back(self):
        valid_id = "fmc-67946a1b-3f8c2a0d9e4b71c2"
        resp = self._client.get("/ping", headers={TRACE_ID_HEADER: valid_id})
        assert resp.status_code == 200
        assert resp.headers[TRACE_ID_HEADER] == valid_id

    def test_missing_header_gets_fallback(self):
        resp = self._client.get("/ping")
        assert resp.status_code == 200
        echo = resp.headers.get(TRACE_ID_HEADER, "")
        assert echo.startswith("unknown-"), (
            f"Expected fallback trace ID starting with 'unknown-', got: {echo!r}"
        )

    def test_invalid_header_gets_fallback(self):
        resp = self._client.get(
            "/ping",
            headers={TRACE_ID_HEADER: "not-a-valid-trace-id"},
        )
        assert resp.status_code == 200
        echo = resp.headers.get(TRACE_ID_HEADER, "")
        assert echo.startswith("unknown-"), (
            f"Expected fallback trace ID starting with 'unknown-', got: {echo!r}"
        )

    def test_uppercase_header_rejected(self):
        """IDs with uppercase hex are non-compliant and should produce a fallback."""
        resp = self._client.get(
            "/ping",
            headers={TRACE_ID_HEADER: "FMC-67946A1B-3F8C2A0D9E4B71C2"},
        )
        echo = resp.headers.get(TRACE_ID_HEADER, "")
        assert echo.startswith("unknown-")

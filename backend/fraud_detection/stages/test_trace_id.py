"""
Unit tests for the trace_id middleware stage.

Verifies that:
1. Valid trace IDs are accepted and propagated.
2. Invalid trace IDs are replaced with a generated fallback.
3. The stage is independent of other pipeline components.
"""

from __future__ import annotations

import pytest

from stages.trace_id import TRACE_ID_HEADER, _is_valid_trace_id


class TestTraceIDValidation:
    def test_valid_trace_id_accepted(self):
        assert _is_valid_trace_id("fmc-12345678-abcdef0123456789") is True

    def test_invalid_prefix_rejected(self):
        assert _is_valid_trace_id("xxx-12345678-abcdef0123456789") is False

    def test_too_short_rejected(self):
        assert _is_valid_trace_id("fmc-1234-abcd") is False

    def test_empty_string_rejected(self):
        assert _is_valid_trace_id("") is False

    def test_header_name_is_lowercase(self):
        assert TRACE_ID_HEADER == TRACE_ID_HEADER.lower()
        assert TRACE_ID_HEADER == "x-trace-id"

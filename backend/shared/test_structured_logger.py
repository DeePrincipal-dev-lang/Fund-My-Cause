"""Tests for the shared structured logging configuration."""

import os
import sys

import structlog

sys.path.insert(0, os.path.dirname(__file__))

from structured_logger import configure_structlog


def test_configured_logger_merges_trace_id_context():
    previous_config = structlog.get_config()
    try:
        configure_structlog()
        processors = structlog.get_config()["processors"]
        assert processors[0] is structlog.contextvars.merge_contextvars

        structlog.contextvars.bind_contextvars(trace_id="fmc-12345678-abcdef0123456789")
        event = processors[0](None, "info", {"event": "fraud_decision"})
        assert event["trace_id"] == "fmc-12345678-abcdef0123456789"
    finally:
        structlog.contextvars.clear_contextvars()
        structlog.configure(**previous_config)
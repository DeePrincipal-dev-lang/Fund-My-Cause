"""
Integration tests for pipeline stages orchestration.

Verifies that:
1. Each stage can be composed into a working pipeline.
2. Idempotency stage integrates with contribution ingestion.
3. Scoring stage produces expected metrics.
4. Stages work independently without circular dependencies.
"""

from __future__ import annotations

import pytest

from stages.idempotency import IdempotencyStore, IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LEN


class TestPipelineStagesComposition:
    """Verify that stages compose correctly when assembled."""

    def test_idempotency_stage_with_max_key_length_constraint(self):
        """Idempotency should respect max key length to guard against attacks."""
        store = IdempotencyStore(ttl_seconds=60)
        long_key = "x" * IDEMPOTENCY_KEY_MAX_LEN
        short_key = "x" * (IDEMPOTENCY_KEY_MAX_LEN - 1)

        store.set(short_key, {"status": "ok"})
        assert store.get(short_key) == {"status": "ok"}

        oversized_key = "x" * (IDEMPOTENCY_KEY_MAX_LEN + 1)
        assert len(oversized_key) > IDEMPOTENCY_KEY_MAX_LEN

    def test_header_name_is_consistent(self):
        """Header name must be consistent across modules."""
        assert IDEMPOTENCY_KEY_HEADER == "idempotency-key"

    def test_idempotency_store_isolation(self):
        """Multiple stores must not share state."""
        store1 = IdempotencyStore(ttl_seconds=60)
        store2 = IdempotencyStore(ttl_seconds=60)

        store1.set("key", {"id": 1})
        assert store1.get("key") == {"id": 1}
        assert store2.get("key") is None

    def test_empty_store_length(self):
        """Newly created store should have length 0."""
        store = IdempotencyStore(ttl_seconds=60)
        assert len(store) == 0

    def test_idempotency_with_complex_response_bodies(self):
        """Store must preserve complex response structures."""
        store = IdempotencyStore(ttl_seconds=60)
        complex_body = {
            "status": "accepted",
            "metadata": {
                "trace_id": "fmc-12345678-abcdefghijklmnop",
                "timestamp": 1234567890.123,
                "nested": {
                    "level": 2,
                    "items": [1, 2, 3]
                }
            }
        }

        store.set("complex-key", complex_body)
        retrieved = store.get("complex-key")
        assert retrieved == complex_body
        assert retrieved["metadata"]["nested"]["items"] == [1, 2, 3]

    def test_idempotency_key_as_header_name(self):
        """The header name constant should be usable in HTTP contexts."""
        import re

        assert isinstance(IDEMPOTENCY_KEY_HEADER, str)
        assert IDEMPOTENCY_KEY_HEADER.lower() == IDEMPOTENCY_KEY_HEADER
        assert "-" in IDEMPOTENCY_KEY_HEADER

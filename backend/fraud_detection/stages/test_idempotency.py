"""
Tests for idempotency key storage and expiry logic.

Verifies that:
1. Keys can be stored and retrieved within TTL.
2. Expired keys are not returned.
3. Expiry queue correctly prunes old entries.
4. Store length reflects non-expired entries only.
"""

from __future__ import annotations

import time

import pytest

from stages.idempotency import IDEMPOTENCY_TTL_SECONDS, IdempotencyStore


class TestIdempotencyStore:
    def test_set_and_get_key(self):
        store = IdempotencyStore(ttl_seconds=60)
        body = {"status": "accepted"}
        store.set("test-key", body)

        result = store.get("test-key")
        assert result == body

    def test_get_nonexistent_key_returns_none(self):
        store = IdempotencyStore(ttl_seconds=60)
        result = store.get("nonexistent")
        assert result is None

    def test_key_expires_after_ttl(self):
        store = IdempotencyStore(ttl_seconds=1)
        body = {"status": "accepted"}
        store.set("test-key", body)

        assert store.get("test-key") is not None
        time.sleep(1.1)
        assert store.get("test-key") is None

    def test_multiple_keys_stored(self):
        store = IdempotencyStore(ttl_seconds=60)
        store.set("key1", {"id": 1})
        store.set("key2", {"id": 2})
        store.set("key3", {"id": 3})

        assert store.get("key1") == {"id": 1}
        assert store.get("key2") == {"id": 2}
        assert store.get("key3") == {"id": 3}

    def test_store_length_reflects_non_expired_entries(self):
        store = IdempotencyStore(ttl_seconds=1)
        store.set("key1", {"data": 1})
        store.set("key2", {"data": 2})

        assert len(store) == 2
        time.sleep(1.1)
        len(store)
        assert len(store) == 0

    def test_overwriting_key_updates_body(self):
        store = IdempotencyStore(ttl_seconds=60)
        store.set("key", {"v": 1})
        assert store.get("key") == {"v": 1}

        store.set("key", {"v": 2})
        assert store.get("key") == {"v": 2}

    def test_evict_expired_removes_old_entries(self):
        store = IdempotencyStore(ttl_seconds=1)
        store.set("key1", {"data": 1})
        time.sleep(1.1)
        store.set("key2", {"data": 2})

        assert store.get("key1") is None
        assert store.get("key2") == {"data": 2}

    def test_default_ttl_is_24_hours(self):
        store = IdempotencyStore()
        assert store._ttl == IDEMPOTENCY_TTL_SECONDS
        assert store._ttl == 86_400

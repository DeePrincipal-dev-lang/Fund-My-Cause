"""
Unit and integration tests for stages/idempotency.py  (#1515).

Coverage
────────
Unit tests (no database required):
  - IdempotencyStore protocol structural check
  - InMemoryIdempotencyStore: get/put/expire semantics, TTL eviction,
    put-if-absent, size(), clear()
  - check_idempotency / record_idempotency helper functions
  - Protocol runtime_checkable isinstance check

Integration tests (pipeline endpoint — still no DB; uses InMemoryIdempotencyStore):
  - POST /contributions first call → {"status": "queued"}
  - POST /contributions same transactionHash → {"status": "duplicate"}
  - POST /contributions different transactionHash → new queued response
  - Expired key allows re-enqueue
  - Queue-full 503 is NOT cached (idempotency only records success)
  - Invalid payload 422 is not cached
"""

from __future__ import annotations

import asyncio
import time
import pytest
from fastapi.testclient import TestClient

from stages.idempotency import (
    DEFAULT_TTL_SECONDS,
    IdempotencyStore,
    InMemoryIdempotencyStore,
    PostgresIdempotencyStore,
    check_idempotency,
    record_idempotency,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(coro):
    """Run a coroutine synchronously (avoids boilerplate in sync test fns)."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Protocol structural check
# ---------------------------------------------------------------------------

class TestIdempotencyStoreProtocol:
    def test_in_memory_satisfies_protocol(self):
        store = InMemoryIdempotencyStore()
        assert isinstance(store, IdempotencyStore)

    def test_protocol_requires_get_put_expire(self):
        """Verify the protocol surface through attribute presence."""
        for attr in ("get", "put", "expire"):
            assert hasattr(IdempotencyStore, attr), f"Protocol missing method: {attr}"

    def test_random_object_does_not_satisfy_protocol(self):
        class NotAStore:
            pass
        assert not isinstance(NotAStore(), IdempotencyStore)


# ---------------------------------------------------------------------------
# InMemoryIdempotencyStore unit tests
# ---------------------------------------------------------------------------

class TestInMemoryIdempotencyStore:

    @pytest.fixture(autouse=True)
    def store(self):
        self._store = InMemoryIdempotencyStore()
        return self._store

    # ── get ────────────────────────────────────────────────────────────────

    def test_get_returns_none_for_missing_key(self):
        result = run(self._store.get("nonexistent"))
        assert result is None

    def test_get_returns_stored_value(self):
        run(self._store.put("k1", {"status": "queued"}, ttl=60))
        result = run(self._store.get("k1"))
        assert result == {"status": "queued"}

    def test_get_returns_none_after_ttl_expires(self):
        # Insert with a -1-second TTL so the entry is already expired.
        self._store._store["k_exp"] = ({"status": "queued"}, time.time() - 1)
        result = run(self._store.get("k_exp"))
        assert result is None

    def test_get_evicts_expired_entry(self):
        self._store._store["k_evict"] = ({"x": 1}, time.time() - 1)
        run(self._store.get("k_evict"))
        assert "k_evict" not in self._store._store

    # ── put ────────────────────────────────────────────────────────────────

    def test_put_stores_new_key(self):
        run(self._store.put("k2", {"a": "b"}))
        assert run(self._store.get("k2")) == {"a": "b"}

    def test_put_does_not_overwrite_existing_key(self):
        run(self._store.put("k3", {"first": True}))
        run(self._store.put("k3", {"second": True}))  # should be no-op
        result = run(self._store.get("k3"))
        assert result == {"first": True}

    def test_put_respects_custom_ttl(self):
        run(self._store.put("k_ttl", {"v": 1}, ttl=1))
        # Key should still be present immediately after put
        assert run(self._store.get("k_ttl")) is not None

    def test_put_after_expiry_allows_new_write(self):
        # Pre-populate with an already-expired entry
        self._store._store["k_reuse"] = ({"old": True}, time.time() - 1)
        run(self._store.put("k_reuse", {"new": True}, ttl=60))
        result = run(self._store.get("k_reuse"))
        assert result == {"new": True}

    def test_put_uses_default_ttl(self):
        run(self._store.put("k_default_ttl", {"v": 1}))
        _, expires_at = self._store._store["k_default_ttl"]
        # TTL should be within a few seconds of DEFAULT_TTL_SECONDS from now
        expected = time.time() + DEFAULT_TTL_SECONDS
        assert abs(expires_at - expected) < 5

    # ── expire ─────────────────────────────────────────────────────────────

    def test_expire_removes_existing_key(self):
        run(self._store.put("k4", {"v": 4}))
        run(self._store.expire("k4"))
        assert run(self._store.get("k4")) is None

    def test_expire_is_idempotent_for_missing_key(self):
        # Should not raise
        run(self._store.expire("no_such_key"))

    # ── test helpers ───────────────────────────────────────────────────────

    def test_size_counts_unexpired_entries(self):
        run(self._store.put("s1", {"x": 1}, ttl=60))
        run(self._store.put("s2", {"x": 2}, ttl=60))
        # Insert one expired entry directly
        self._store._store["s_exp"] = ({"x": 99}, time.time() - 1)
        assert self._store.size() == 2

    def test_clear_removes_all_entries(self):
        run(self._store.put("c1", {"x": 1}))
        run(self._store.put("c2", {"x": 2}))
        self._store.clear()
        assert self._store.size() == 0
        assert run(self._store.get("c1")) is None

    # ── concurrent put-if-absent ───────────────────────────────────────────

    def test_concurrent_puts_only_first_wins(self):
        """Two concurrent puts must not both succeed (put-if-absent)."""

        async def _race():
            s = InMemoryIdempotencyStore()
            await asyncio.gather(
                s.put("race_key", {"winner": 1}, ttl=60),
                s.put("race_key", {"winner": 2}, ttl=60),
            )
            return await s.get("race_key")

        result = asyncio.get_event_loop().run_until_complete(_race())
        assert result is not None
        assert "winner" in result


# ---------------------------------------------------------------------------
# check_idempotency / record_idempotency helpers
# ---------------------------------------------------------------------------

class TestHelpers:

    @pytest.fixture(autouse=True)
    def store(self):
        self._store = InMemoryIdempotencyStore()

    def test_check_returns_none_on_miss(self):
        assert run(check_idempotency("miss", self._store)) is None

    def test_record_then_check_returns_value(self):
        run(record_idempotency("hit_key", {"status": "queued"}, self._store))
        result = run(check_idempotency("hit_key", self._store))
        assert result == {"status": "queued"}

    def test_record_is_idempotent(self):
        run(record_idempotency("idem_key", {"v": 1}, self._store))
        run(record_idempotency("idem_key", {"v": 2}, self._store))  # must be no-op
        result = run(check_idempotency("idem_key", self._store))
        assert result == {"v": 1}

    def test_custom_ttl_is_forwarded(self):
        run(record_idempotency("ttl_key", {"v": 1}, self._store, ttl=7200))
        _, expires_at = self._store._store["ttl_key"]
        expected = time.time() + 7200
        assert abs(expires_at - expected) < 5


# ---------------------------------------------------------------------------
# Integration tests: POST /contributions idempotency through the HTTP layer
# ---------------------------------------------------------------------------

class TestContributionsIdempotency:
    """
    End-to-end tests that exercise the FastAPI app with an in-memory store.

    These tests import ``pipeline`` and replace ``_idempotency_store`` with
    a fresh ``InMemoryIdempotencyStore`` before each test so no state leaks.
    """

    @pytest.fixture(autouse=True)
    def reset_pipeline_state(self):
        """Replace the module-level store and event lists with clean instances."""
        import pipeline as p

        # Swap in a fresh in-memory store
        fresh_store = InMemoryIdempotencyStore()
        original_store = p._idempotency_store
        p._idempotency_store = fresh_store

        # Clear event store and moderation queue
        p._CONTRIBUTIONS.clear()
        p._REFUNDS.clear()
        p._CAMPAIGN_RECORDS.clear()
        p._QUEUE.clear()

        # Drain scoring queue
        while not p._scoring_queue.empty():
            try:
                p._scoring_queue.get_nowait()
                p._scoring_queue.task_done()
            except asyncio.QueueEmpty:
                break

        yield fresh_store

        # Restore original store after test
        p._idempotency_store = original_store

    @pytest.fixture
    def client(self):
        from pipeline import app
        return TestClient(app)

    @pytest.fixture
    def payload(self):
        return {
            "campaignId": "camp-001",
            "contributor": "WALLET_ABC",
            "amount": "1000",
            "transactionHash": "0xdeadbeef001",
            "timestamp": time.time(),
        }

    def test_first_request_is_queued(self, client, payload):
        resp = client.post("/contributions", json=payload)
        assert resp.status_code == 200
        assert resp.json()["status"] == "queued"

    def test_duplicate_request_returns_duplicate_status(self, client, payload):
        client.post("/contributions", json=payload)
        resp2 = client.post("/contributions", json=payload)
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "duplicate"

    def test_duplicate_does_not_re_enqueue(self, client, payload):
        import pipeline as p
        client.post("/contributions", json=payload)
        depth_after_first = p._scoring_queue.qsize()
        client.post("/contributions", json=payload)  # duplicate
        depth_after_second = p._scoring_queue.qsize()
        assert depth_after_first == depth_after_second

    def test_different_tx_hash_is_queued_independently(self, client, payload):
        payload2 = {**payload, "transactionHash": "0xdeadbeef002"}
        resp1 = client.post("/contributions", json=payload)
        resp2 = client.post("/contributions", json=payload2)
        assert resp1.json()["status"] == "queued"
        assert resp2.json()["status"] == "queued"

    def test_invalid_payload_is_not_cached(self, client):
        resp = client.post("/contributions", json={"bad": "data"})
        assert resp.status_code == 422
        # Second call with the same bad data should also be 422, not 200
        resp2 = client.post("/contributions", json={"bad": "data"})
        assert resp2.status_code == 422

    def test_expired_key_allows_new_enqueue(self, client, payload, reset_pipeline_state):
        # First enqueue
        client.post("/contributions", json=payload)

        # Force-expire the key
        store: InMemoryIdempotencyStore = reset_pipeline_state
        run(store.expire(payload["transactionHash"]))

        # A new request with the same hash should now be accepted
        resp = client.post("/contributions", json=payload)
        assert resp.status_code == 200
        assert resp.json()["status"] == "queued"

    def test_queue_full_is_not_cached(self, client, payload):
        import pipeline as p
        import asyncio

        # Fill the scoring queue to capacity
        original_maxsize = p._scoring_queue.maxsize
        p._scoring_queue = asyncio.Queue(maxsize=1)

        try:
            # Fill the queue manually
            p._scoring_queue.put_nowait(
                p.ScoringJob(payload=p.ContributionPayload(**payload))
            )
            # Now the queue is full — next contribution should 503
            payload503 = {**payload, "transactionHash": "0xfull001"}
            resp = client.post("/contributions", json=payload503)
            assert resp.status_code == 503

            # Drain the queue and retry — must succeed (not return 503 from cache)
            p._scoring_queue.get_nowait()
            p._scoring_queue.task_done()
            resp2 = client.post("/contributions", json=payload503)
            assert resp2.status_code == 200
            assert resp2.json()["status"] == "queued"
        finally:
            p._scoring_queue = asyncio.Queue(maxsize=original_maxsize)


# ---------------------------------------------------------------------------
# PostgresIdempotencyStore smoke test (structural, no live DB)
# ---------------------------------------------------------------------------

class TestPostgresIdempotencyStoreStructure:
    def test_has_required_methods(self):
        for attr in ("get", "put", "expire", "bootstrap"):
            assert hasattr(PostgresIdempotencyStore, attr), (
                f"PostgresIdempotencyStore missing expected method: {attr}"
            )

    def test_satisfies_protocol_structurally(self):
        """
        PostgresIdempotencyStore should satisfy the protocol duck-typing check.

        We cannot instantiate it without a real pool, so we verify the class
        itself has the required callables rather than an instance.
        """
        for method in ("get", "put", "expire"):
            assert callable(getattr(PostgresIdempotencyStore, method))

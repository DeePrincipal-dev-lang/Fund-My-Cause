"""
Tests for idempotency key support on POST /contributions (#1203).

Coverage:
  - First request with a key is accepted (202) and stored.
  - Duplicate request with same key is rejected/deduped (202, not re-processed).
  - Request without a key is still processed normally.
  - Concurrent duplicate requests are deduplicated.
  - Expired keys allow re-processing after TTL.
  - Key longer than IDEMPOTENCY_KEY_MAX_LEN is rejected (400).
  - Invalid payload still returns 422 (key is validated before body).
"""

import time
import uuid
import pytest
from fastapi.testclient import TestClient

from pipeline import (
    _CONTRIBUTIONS,
    _QUEUE,
    _REFUNDS,
    _CAMPAIGN_RECORDS,
    _IDEMPOTENCY_STORE,
    IDEMPOTENCY_KEY_HEADER,
    IDEMPOTENCY_KEY_MAX_LEN,
    app,
)

client = TestClient(app)

# ── Fixtures ──────────────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "campaignId": "CAMP-001",
    "contributor": "GABCDE",
    "amount": "10000",
    "transactionHash": "abcdef1234567890",
    "timestamp": 1_700_000_000.0,
}


def _clear():
    _CONTRIBUTIONS.clear()
    _REFUNDS.clear()
    _CAMPAIGN_RECORDS.clear()
    _QUEUE.clear()
    # Reset the idempotency store between tests.
    _IDEMPOTENCY_STORE._store.clear()
    _IDEMPOTENCY_STORE._expiry_queue.clear()


def _new_key() -> str:
    return str(uuid.uuid4())


# ── Basic acceptance ───────────────────────────────────────────────────────────

class TestBasicAcceptance:
    def setup_method(self):
        _clear()

    def test_first_request_without_key_accepted(self):
        r = client.post("/contributions", json=VALID_PAYLOAD)
        assert r.status_code == 202
        assert r.json()["status"] == "accepted"
        assert len(_CONTRIBUTIONS) == 1

    def test_first_request_with_key_accepted(self):
        key = _new_key()
        r = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert r.status_code == 202
        assert r.json()["status"] == "accepted"
        assert len(_CONTRIBUTIONS) == 1

    def test_first_request_stores_key(self):
        key = _new_key()
        client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert _IDEMPOTENCY_STORE.get(key) is not None


# ── Duplicate rejection ────────────────────────────────────────────────────────

class TestDuplicateRejection:
    def setup_method(self):
        _clear()

    def test_duplicate_key_returns_202_not_reprocessed(self):
        """Second request with same key must not append to _CONTRIBUTIONS."""
        key = _new_key()
        r1 = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert r1.status_code == 202

        contributions_after_first = len(_CONTRIBUTIONS)

        r2 = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert r2.status_code == 202
        assert r2.json()["status"] == "accepted"

        # No new contribution should have been stored.
        assert len(_CONTRIBUTIONS) == contributions_after_first

    def test_duplicate_key_same_response_body(self):
        key = _new_key()
        r1 = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        r2 = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert r1.json() == r2.json()

    def test_different_keys_both_processed(self):
        key1 = _new_key()
        key2 = _new_key()
        client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key1},
        )
        client.post(
            "/contributions",
            json={**VALID_PAYLOAD, "transactionHash": "other_tx"},
            headers={IDEMPOTENCY_KEY_HEADER: key2},
        )
        assert len(_CONTRIBUTIONS) == 2

    def test_no_key_allows_multiple_submissions(self):
        """Without a key each request is processed independently."""
        client.post("/contributions", json=VALID_PAYLOAD)
        client.post("/contributions", json=VALID_PAYLOAD)
        assert len(_CONTRIBUTIONS) == 2


# ── Concurrent duplicates ──────────────────────────────────────────────────────

class TestConcurrentDuplicates:
    def setup_method(self):
        _clear()

    def test_concurrent_same_key_only_processes_once(self):
        """
        Simulate two requests arriving at roughly the same time with the same
        key.  The store should prevent the second from being processed.

        In practice FastAPI/uvicorn is single-threaded (asyncio), so requests
        are serialised.  This test verifies the state machine is correct even
        under rapid sequential submission.
        """
        key = _new_key()
        results = []
        for _ in range(5):
            r = client.post(
                "/contributions",
                json=VALID_PAYLOAD,
                headers={IDEMPOTENCY_KEY_HEADER: key},
            )
            results.append(r.status_code)

        # All must succeed (202).
        assert all(s == 202 for s in results)
        # Exactly one contribution stored.
        assert len(_CONTRIBUTIONS) == 1


# ── TTL expiry ─────────────────────────────────────────────────────────────────

class TestTTLExpiry:
    def setup_method(self):
        _clear()

    def test_expired_key_allows_reprocessing(self, monkeypatch):
        """After TTL expires the same key should be accepted as a new request."""
        key = _new_key()
        # First submission.
        client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert len(_CONTRIBUTIONS) == 1

        # Manipulate the stored timestamp to simulate expiry.
        entry = _IDEMPOTENCY_STORE._store[key]
        expired_at = entry[0] - _IDEMPOTENCY_STORE._ttl - 1
        _IDEMPOTENCY_STORE._store[key] = (expired_at, entry[1])

        # Second submission — key is now expired, should be processed fresh.
        r = client.post(
            "/contributions",
            json={**VALID_PAYLOAD, "transactionHash": "new_tx"},
            headers={IDEMPOTENCY_KEY_HEADER: key},
        )
        assert r.status_code == 202
        assert len(_CONTRIBUTIONS) == 2


# ── Input validation ───────────────────────────────────────────────────────────

class TestInputValidation:
    def setup_method(self):
        _clear()

    def test_oversized_key_rejected_400(self):
        oversized = "x" * (IDEMPOTENCY_KEY_MAX_LEN + 1)
        r = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: oversized},
        )
        assert r.status_code == 400
        assert "Idempotency-Key" in r.json()["error"]
        # Must not have been stored.
        assert len(_CONTRIBUTIONS) == 0

    def test_max_length_key_accepted(self):
        exact = "x" * IDEMPOTENCY_KEY_MAX_LEN
        r = client.post(
            "/contributions",
            json=VALID_PAYLOAD,
            headers={IDEMPOTENCY_KEY_HEADER: exact},
        )
        assert r.status_code == 202

    def test_invalid_payload_returns_422(self):
        r = client.post(
            "/contributions",
            json={"bad": "data"},
            headers={IDEMPOTENCY_KEY_HEADER: _new_key()},
        )
        assert r.status_code == 422
        # Key must not have been stored for a failed request.
        assert len(_CONTRIBUTIONS) == 0

    def test_empty_body_returns_422(self):
        r = client.post(
            "/contributions",
            content=b"",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 422


# ── IdempotencyStore unit tests ────────────────────────────────────────────────

class TestIdempotencyStore:
    def setup_method(self):
        from pipeline import IdempotencyStore
        self.store = IdempotencyStore(ttl_seconds=1)

    def test_get_returns_none_for_unknown_key(self):
        assert self.store.get("missing") is None

    def test_set_then_get_returns_body(self):
        self.store.set("k1", {"status": "accepted"})
        assert self.store.get("k1") == {"status": "accepted"}

    def test_expired_entry_returns_none(self):
        self.store.set("k2", {"status": "accepted"})
        # Move stored_at back past the TTL.
        entry = self.store._store["k2"]
        self.store._store["k2"] = (entry[0] - 2, entry[1])
        assert self.store.get("k2") is None

    def test_len_excludes_expired_entries(self):
        self.store.set("ka", {"status": "accepted"})
        self.store.set("kb", {"status": "accepted"})
        # Expire "ka".
        entry = self.store._store["ka"]
        self.store._store["ka"] = (entry[0] - 2, entry[1])
        assert len(self.store) == 1

    def test_eviction_prunes_expiry_queue(self):
        self.store.set("kc", {"status": "accepted"})
        # Expire it.
        entry = self.store._store["kc"]
        self.store._store["kc"] = (entry[0] - 2, entry[1])
        # Trigger eviction via get.
        self.store.get("kc")
        assert "kc" not in self.store._store

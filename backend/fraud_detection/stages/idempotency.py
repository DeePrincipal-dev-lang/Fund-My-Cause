"""
Idempotency key support for contribution ingestion.

Provides in-memory TTL store for idempotency keys with lazy expiry.
For multi-worker deployments, replace with Redis SET ... NX EX calls.
"""

from __future__ import annotations

import time
from collections import deque
from typing import Deque, Dict, Optional, Tuple


IDEMPOTENCY_KEY_HEADER = "idempotency-key"
IDEMPOTENCY_TTL_SECONDS: int = 86_400
IDEMPOTENCY_KEY_MAX_LEN = 256


class IdempotencyStore:
    """
    In-memory TTL store for idempotency keys.

    Keys are stored with their expiry timestamp. An expiry queue (deque)
    lets the store prune expired keys lazily on each get/set call so
    memory doesn't grow unboundedly.
    """

    def __init__(self, ttl_seconds: int = IDEMPOTENCY_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._store: Dict[str, Tuple[float, dict]] = {}
        self._expiry_queue: Deque[Tuple[float, str]] = deque()

    def _evict_expired(self) -> None:
        """Remove keys whose TTL has elapsed."""
        now = time.time()
        while self._expiry_queue and self._expiry_queue[0][0] <= now:
            _expiry, key = self._expiry_queue.popleft()
            entry = self._store.get(key)
            if entry and entry[0] + self._ttl <= now:
                del self._store[key]

    def get(self, key: str) -> Optional[dict]:
        """Return the cached response body for key, or None if not found/expired."""
        self._evict_expired()
        entry = self._store.get(key)
        if entry is None:
            return None
        stored_at, body = entry
        if time.time() - stored_at > self._ttl:
            del self._store[key]
            return None
        return body

    def set(self, key: str, body: dict) -> None:
        """Persist body under key for TTL seconds."""
        self._evict_expired()
        now = time.time()
        self._store[key] = (now, body)
        self._expiry_queue.append((now + self._ttl, key))

    def __len__(self) -> int:
        """Return the number of non-expired keys currently stored."""
        now = time.time()
        return sum(
            1 for stored_at, _ in self._store.values()
            if now - stored_at <= self._ttl
        )

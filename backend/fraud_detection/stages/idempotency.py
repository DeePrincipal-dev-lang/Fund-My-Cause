"""
Idempotency store for Fund-My-Cause fraud-detection service (#1515).

Overview
────────
The ``POST /contributions`` endpoint must be idempotent: a caller that
retries the same ``transactionHash`` (e.g. after a network timeout) must
receive the original response rather than triggering a duplicate fraud-scoring
job.

Architecture
────────────
All idempotency state is managed through the ``IdempotencyStore`` protocol,
which three concrete classes implement:

  InMemoryIdempotencyStore   – dict-backed; zero dependencies; used in tests.
  PostgresIdempotencyStore   – asyncpg-backed; used in production.
  IdempotencyMiddleware      – FastAPI dependency that checks / records keys.

Callers depend only on the protocol — never on a concrete implementation —
so tests can inject ``InMemoryIdempotencyStore`` without touching a database.

Key / value semantics
─────────────────────
  key    – an opaque string (e.g. ``transactionHash``); must be unique within
           the TTL window.
  value  – a JSON-serialisable dict stored as the cached response body.
  ttl    – seconds until the record expires and the key may be reused.
           Default: 86 400 s (24 h).

Wire format (Postgres table)
────────────────────────────
  CREATE TABLE IF NOT EXISTS idempotency_keys (
      key        TEXT        PRIMARY KEY,
      response   JSONB       NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
  );

See docs/idempotency.md for the project-wide specification.
"""

from __future__ import annotations

import json
import time
from abc import abstractmethod
from typing import Any, Optional, Protocol, runtime_checkable

import structlog

log: structlog.BoundLogger = structlog.get_logger(__name__)

# Default TTL: 24 hours
DEFAULT_TTL_SECONDS: int = 86_400

# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class IdempotencyStore(Protocol):
    """
    Store protocol for idempotency keys.

    All methods are async to support both in-memory (trivially async) and
    remote-database implementations without a shim layer.
    """

    @abstractmethod
    async def get(self, key: str) -> Optional[dict[str, Any]]:
        """
        Return the cached response dict for *key*, or ``None`` if the key is
        absent or has expired.
        """

    @abstractmethod
    async def put(self, key: str, response: dict[str, Any], ttl: int = DEFAULT_TTL_SECONDS) -> None:
        """
        Store *response* under *key* for *ttl* seconds.

        If *key* already exists the stored value is **not** updated — the
        first write wins (put-if-absent semantics).
        """

    @abstractmethod
    async def expire(self, key: str) -> None:
        """
        Delete *key* immediately, regardless of its TTL.

        Useful for forced invalidation (e.g. an admin replay endpoint).
        """


# ---------------------------------------------------------------------------
# In-memory implementation (tests & local dev)
# ---------------------------------------------------------------------------


class InMemoryIdempotencyStore:
    """
    Thread-safe, dict-backed idempotency store.

    No external dependencies — suitable for unit tests and local development.
    Expired entries are evicted lazily on ``get`` and eagerly on ``put``.
    """

    def __init__(self) -> None:
        # Maps key → (response_dict, expires_at_unix_seconds)
        self._store: dict[str, tuple[dict[str, Any], float]] = {}

    # ------------------------------------------------------------------
    # Protocol implementation
    # ------------------------------------------------------------------

    async def get(self, key: str) -> Optional[dict[str, Any]]:
        entry = self._store.get(key)
        if entry is None:
            return None
        response, expires_at = entry
        if time.time() > expires_at:
            # Lazy eviction
            del self._store[key]
            log.debug("idempotency_key_expired_on_read", key=key)
            return None
        return response

    async def put(
        self,
        key: str,
        response: dict[str, Any],
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> None:
        # Put-if-absent: only write when the key is genuinely new / expired.
        existing = await self.get(key)
        if existing is not None:
            log.debug("idempotency_key_already_exists_skipped", key=key)
            return
        expires_at = time.time() + ttl
        self._store[key] = (response, expires_at)
        log.debug("idempotency_key_stored", key=key, ttl_seconds=ttl)

    async def expire(self, key: str) -> None:
        removed = self._store.pop(key, None)
        if removed is not None:
            log.debug("idempotency_key_force_expired", key=key)

    # ------------------------------------------------------------------
    # Test helpers (not part of the protocol)
    # ------------------------------------------------------------------

    def size(self) -> int:
        """Return the number of unexpired entries (for test assertions)."""
        now = time.time()
        return sum(1 for _, (_, exp) in self._store.items() if now <= exp)

    def clear(self) -> None:
        """Remove all entries (useful between test cases)."""
        self._store.clear()


# ---------------------------------------------------------------------------
# Postgres implementation (production)
# ---------------------------------------------------------------------------


class PostgresIdempotencyStore:
    """
    asyncpg-backed idempotency store.

    Requires an asyncpg ``Connection`` or ``Pool`` to be injected at
    construction time so the store itself has no knowledge of how the
    connection is established or pooled.

    Table DDL (must be applied once via a migration):

        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key        TEXT        PRIMARY KEY,
            response   JSONB       NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
            ON idempotency_keys (expires_at);

    A periodic cleanup job (e.g. a cron or pg_cron rule) should delete rows
    where ``expires_at < NOW()`` to bound table growth.
    """

    _DDL = """
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key        TEXT        PRIMARY KEY,
            response   JSONB       NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
            ON idempotency_keys (expires_at);
    """

    def __init__(self, pool: Any) -> None:
        """
        Parameters
        ----------
        pool:
            An ``asyncpg.Pool`` (or compatible object exposing ``.acquire()``).
        """
        self._pool = pool

    # ------------------------------------------------------------------
    # Schema bootstrap helper
    # ------------------------------------------------------------------

    async def bootstrap(self) -> None:
        """
        Create the ``idempotency_keys`` table and index if they do not exist.

        Call once at application startup (e.g. inside the FastAPI lifespan).
        """
        async with self._pool.acquire() as conn:
            await conn.execute(self._DDL)
        log.info("idempotency_keys_table_bootstrapped")

    # ------------------------------------------------------------------
    # Protocol implementation
    # ------------------------------------------------------------------

    async def get(self, key: str) -> Optional[dict[str, Any]]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT response
                FROM idempotency_keys
                WHERE key = $1
                  AND expires_at > NOW()
                """,
                key,
            )
        if row is None:
            return None
        raw = row["response"]
        # asyncpg returns JSONB columns as dicts already; guard for str just in case.
        result: dict[str, Any] = raw if isinstance(raw, dict) else json.loads(raw)
        log.debug("idempotency_key_hit", key=key)
        return result

    async def put(
        self,
        key: str,
        response: dict[str, Any],
        ttl: int = DEFAULT_TTL_SECONDS,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO idempotency_keys (key, response, expires_at)
                VALUES ($1, $2::jsonb, NOW() + ($3 || ' seconds')::INTERVAL)
                ON CONFLICT (key) DO NOTHING
                """,
                key,
                json.dumps(response),
                str(ttl),
            )
        log.debug("idempotency_key_put", key=key, ttl_seconds=ttl)

    async def expire(self, key: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM idempotency_keys WHERE key = $1",
                key,
            )
        log.debug("idempotency_key_force_expired", key=key)


# ---------------------------------------------------------------------------
# Idempotency guard — framework-agnostic helper
# ---------------------------------------------------------------------------


async def check_idempotency(
    key: str,
    store: IdempotencyStore,
) -> Optional[dict[str, Any]]:
    """
    Return a cached response if *key* has already been processed, else ``None``.

    Usage in a FastAPI handler::

        cached = await check_idempotency(tx_hash, store)
        if cached is not None:
            return JSONResponse(content=cached, status_code=200)
        # ... process normally ...
        await record_idempotency(tx_hash, result, store)
    """
    return await store.get(key)


async def record_idempotency(
    key: str,
    response: dict[str, Any],
    store: IdempotencyStore,
    ttl: int = DEFAULT_TTL_SECONDS,
) -> None:
    """
    Persist *response* under *key* so future duplicate requests are short-circuited.
    """
    await store.put(key, response, ttl=ttl)

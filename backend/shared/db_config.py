"""
Shared database connection-pool configuration (#1128).

Python mirror of `packages/shared-utils/src/db-config.ts` — same field names,
same defaults, same environment variables, so a pool tuned in one language
behaves identically when read from the other. See
`docs/db-pool-conventions.md` for the full reference.

Neither `fraud_detection` nor `recommendations` holds a live pooled DB
connection today (both use in-memory stores — see the module docstrings in
`pipeline.py` and `service.py`). This module exists so that whichever service
adopts a real pool first reads its settings from one place instead of
inventing its own shape, and so the two Python services can already share one
config surface instead of drifting independently.

Usage
-----
Both `backend/fraud_detection` and `backend/recommendations` import this
module via a small `sys.path` bootstrap (see the top of `pipeline.py` /
`service.py`) since neither service is packaged as an installable Python
package:

    from db_config import load_db_pool_config

    db_pool = load_db_pool_config()
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class DbPoolConfig:
    """Tunable connection-pool parameters, mirrored from the TS `DbPoolConfig`."""

    max: int = 10
    min: int = 2
    idle_timeout_ms: int = 30_000
    connection_timeout_ms: int = 5_000
    retry_attempts: int = 3
    retry_backoff_ms: int = 250


DEFAULT_DB_POOL_CONFIG = DbPoolConfig()


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def load_db_pool_config() -> DbPoolConfig:
    """
    Load the effective DB pool configuration from environment variables,
    falling back to `DEFAULT_DB_POOL_CONFIG` for anything unset or invalid.

    Environment variables (shared with the TypeScript loader):
      DB_POOL_MAX
      DB_POOL_MIN
      DB_POOL_IDLE_TIMEOUT_MS
      DB_POOL_CONNECTION_TIMEOUT_MS
      DB_POOL_RETRY_ATTEMPTS
      DB_POOL_RETRY_BACKOFF_MS
    """
    return DbPoolConfig(
        max=_int_env("DB_POOL_MAX", DEFAULT_DB_POOL_CONFIG.max),
        min=_int_env("DB_POOL_MIN", DEFAULT_DB_POOL_CONFIG.min),
        idle_timeout_ms=_int_env(
            "DB_POOL_IDLE_TIMEOUT_MS", DEFAULT_DB_POOL_CONFIG.idle_timeout_ms
        ),
        connection_timeout_ms=_int_env(
            "DB_POOL_CONNECTION_TIMEOUT_MS",
            DEFAULT_DB_POOL_CONFIG.connection_timeout_ms,
        ),
        retry_attempts=_int_env(
            "DB_POOL_RETRY_ATTEMPTS", DEFAULT_DB_POOL_CONFIG.retry_attempts
        ),
        retry_backoff_ms=_int_env(
            "DB_POOL_RETRY_BACKOFF_MS", DEFAULT_DB_POOL_CONFIG.retry_backoff_ms
        ),
    )

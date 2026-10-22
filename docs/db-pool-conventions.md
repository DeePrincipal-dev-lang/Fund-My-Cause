# Database Connection-Pool Conventions

This document is the authoritative reference for database connection-pool
configuration across Fund-My-Cause backend services (#1128). It exists so
that when a service adopts a real pooled DB connection, it reads its pool
settings from one shared place instead of inventing its own shape — the
drift the original issue called out.

## 1. Current state

As of this writing, **no backend service holds a live pooled database
connection**:

| Service | Storage |
|---|---|
| `services/indexer` | In-memory `EventStore` (see `services/indexer/README.md#connection-pool-configuration`) |
| `backend/fraud_detection` | In-memory moderation queue / event lists (see module docstring in `pipeline.py`) |
| `backend/recommendations` | In-memory campaign list + TTL cache (see module docstring in `service.py`) |

Each of these services resolves and logs the shared pool config below at
startup (`db_pool_config_resolved` / `Effective store configuration` log
lines) even though it isn't wired to a real connection yet, so that the first
service to adopt a durable store — and every one after it — has a working,
observable single source of truth to build on rather than a blank page.

## 2. Single source of truth

| Language | Module | Loader |
|---|---|---|
| TypeScript | `packages/shared-utils/src/db-config.ts` | `loadDbPoolConfig()` |
| Python | `backend/shared/db_config.py` | `load_db_pool_config()` |

Both expose the identical `DbPoolConfig` shape and read the identical
environment variables, so a pool tuned via env vars behaves the same
regardless of which language the consuming service is written in.

### TypeScript

```typescript
import { loadDbPoolConfig } from "@fund-my-cause/shared-utils";

const dbPool = loadDbPoolConfig();
```

Add `@fund-my-cause/shared-utils` as a `file:../../packages/shared-utils`
dependency (see `services/indexer/package.json` for an existing example).

### Python

Python services in this repo are not packaged as installable packages, so
they reach the shared module via a small `sys.path` bootstrap instead of a
package import — see the top of `backend/fraud_detection/pipeline.py` or
`backend/recommendations/service.py` for the two-line pattern:

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared"))
from db_config import load_db_pool_config

db_pool = load_db_pool_config()
```

## 3. Tunable parameters

| Field (TS) | Field (Python) | Env var | Default | Description |
|---|---|---|---|---|
| `max` | `max` | `DB_POOL_MAX` | `10` | Maximum number of connections held open in the pool. |
| `min` | `min` | `DB_POOL_MIN` | `2` | Minimum idle connections kept warm. |
| `idleTimeoutMillis` | `idle_timeout_ms` | `DB_POOL_IDLE_TIMEOUT_MS` | `30000` | Milliseconds an idle connection may sit before being closed. |
| `connectionTimeoutMillis` | `connection_timeout_ms` | `DB_POOL_CONNECTION_TIMEOUT_MS` | `5000` | Milliseconds to wait for a connection to become available before failing. |
| `retryAttempts` | `retry_attempts` | `DB_POOL_RETRY_ATTEMPTS` | `3` | Retry attempts on a transient connection failure. |
| `retryBackoffMs` | `retry_backoff_ms` | `DB_POOL_RETRY_BACKOFF_MS` | `250` | Base backoff (ms) between retries; doubles per attempt. |

These defaults are deliberately conservative starting points (small pool,
short idle timeout) rather than measured production values — no service has
generated real pooled-connection load yet. Re-tune them against the actual
database and traffic pattern of the first service that adopts a real pool,
and update this table with the measured rationale (mirroring how
`services/indexer/README.md#design-rationale` documents its in-memory-store
capacity levers).

## 4. Adding a real pool to a service

1. Add the driver's pool constructor (e.g. `pg.Pool`, `asyncpg.create_pool`,
   SQLAlchemy's `create_engine(..., pool_size=...)`) at your service's
   startup path.
2. Call `loadDbPoolConfig()` / `load_db_pool_config()` and map its fields onto
   the driver's pool options (field names intentionally mirror the common
   pool libraries: `max`, `min`, `idleTimeoutMillis`, etc.).
3. Do **not** hardcode pool numbers locally — if the driver needs a field this
   module doesn't expose yet, add it here first so every service benefits.
4. Update this document's "Current state" table once a service holds a live
   pool.

## 5. See also

- [Logging Conventions](./logging-conventions.md) — the equivalent
  cross-service convention doc for structured logging and trace-ID
  propagation (#1126).
- `services/indexer/README.md#connection-pool-configuration` — the in-memory
  analogue this module will eventually replace for the indexer.

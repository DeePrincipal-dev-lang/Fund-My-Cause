/**
 * Shared database connection-pool configuration (#1128).
 *
 * Every backend service that talks to a SQL/NoSQL database should size and
 * tune its pool from this single module rather than declaring its own ad hoc
 * `{ max, idleTimeoutMillis, ... }` object. Centralising it here prevents the
 * per-service drift the original issue called out — one service picking a
 * generous `max` and a short timeout, another the reverse, with no shared
 * rationale for either.
 *
 * Today, none of `fraud_detection`, `recommendations`, or `indexer` hold a
 * live pooled DB connection — see each service's own docs for why (in-memory
 * stores, `docs/adr/ADR-005-fraud-detection-vs-recommendations-service-split.md`,
 * `services/indexer/README.md#data-access-decision-837`). This module exists
 * so that the *first* service to adopt a real pool (and every one after it)
 * reads its settings from one place instead of inventing its own shape.
 *
 * A mirrored Python loader lives at `backend/shared/db_config.py` — the two
 * must be kept in sync (same field names, same defaults, same env vars). See
 * `docs/db-pool-conventions.md` for the full reference.
 */

export interface DbPoolConfig {
  /** Maximum number of connections held open in the pool. Default: 10. */
  max: number;
  /** Minimum number of idle connections kept warm. Default: 2. */
  min: number;
  /** Milliseconds an idle connection may sit before being closed. Default: 30_000. */
  idleTimeoutMillis: number;
  /** Milliseconds to wait for a connection to become available before failing. Default: 5_000. */
  connectionTimeoutMillis: number;
  /** Number of retry attempts on a transient connection failure. Default: 3. */
  retryAttempts: number;
  /** Base backoff (ms) between connection retry attempts (doubles per attempt). Default: 250. */
  retryBackoffMs: number;
}

export const DEFAULT_DB_POOL_CONFIG: DbPoolConfig = {
  max: 10,
  min: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  retryAttempts: 3,
  retryBackoffMs: 250,
};

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load the effective DB pool configuration from environment variables,
 * falling back to `DEFAULT_DB_POOL_CONFIG` for anything unset or invalid.
 *
 * Environment variables (shared across every service — see
 * `docs/db-pool-conventions.md`):
 *   DB_POOL_MAX
 *   DB_POOL_MIN
 *   DB_POOL_IDLE_TIMEOUT_MS
 *   DB_POOL_CONNECTION_TIMEOUT_MS
 *   DB_POOL_RETRY_ATTEMPTS
 *   DB_POOL_RETRY_BACKOFF_MS
 */
export function loadDbPoolConfig(
  env: Record<string, string | undefined> = process.env,
): DbPoolConfig {
  return {
    max: parseIntOrDefault(env.DB_POOL_MAX, DEFAULT_DB_POOL_CONFIG.max),
    min: parseIntOrDefault(env.DB_POOL_MIN, DEFAULT_DB_POOL_CONFIG.min),
    idleTimeoutMillis: parseIntOrDefault(
      env.DB_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_DB_POOL_CONFIG.idleTimeoutMillis,
    ),
    connectionTimeoutMillis: parseIntOrDefault(
      env.DB_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_DB_POOL_CONFIG.connectionTimeoutMillis,
    ),
    retryAttempts: parseIntOrDefault(
      env.DB_POOL_RETRY_ATTEMPTS,
      DEFAULT_DB_POOL_CONFIG.retryAttempts,
    ),
    retryBackoffMs: parseIntOrDefault(
      env.DB_POOL_RETRY_BACKOFF_MS,
      DEFAULT_DB_POOL_CONFIG.retryBackoffMs,
    ),
  };
}

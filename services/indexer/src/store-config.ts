/**
 * Store and RPC configuration for the indexer service (#902).
 *
 * Since the indexer uses an in-memory EventStore (no SQL/NoSQL pool),
 * there is no traditional connection pool to tune. Instead, these settings
 * govern the analogous resource-capacity levers:
 *   - maxEventCapacity: acts like pool size — bounds total memory consumption
 *   - eventBatchSize: bounds per-ingestion batch size (like pool acquire timeout)
 *   - RPC concurrency/timeout: bounds outbound connection reuse
 *
 * Design rationale (documented here in lieu of a real load test, since the
 * indexer currently has no durable DB to load-test against):
 *   - Peak ingestion rate: ~500 events/min observed on testnet
 *   - maxEventCapacity=100,000 → ~200 min of full-rate history in memory
 *   - rpcMaxConcurrentRequests=5 → prevents overwhelming the Stellar RPC endpoint
 *     (Stellar testnet recommends ≤10 concurrent RPC connections)
 *   - rpcRequestTimeoutMs=30,000 → matches Soroban RPC's recommended timeout
 *
 * When a durable store is introduced, replace this file with the shared pool
 * config from `@fund-my-cause/shared-utils` (`packages/shared-utils/src/db-config.ts`,
 * #1128) rather than a locally-defined pool shape — that module is the single
 * source of truth for DB pool tuning (max/min size, timeouts, retry policy)
 * across every backend service. See `docs/db-pool-conventions.md`.
 */

export interface StoreConfig {
  /** Maximum events to hold in memory before evicting oldest entries.
   *  Acts as the pool-size equivalent: bounds RAM usage. Default: 100_000. */
  maxEventCapacity: number;

  /** Maximum events per ingestion batch. Default: 500. */
  eventBatchSize: number;

  /** Milliseconds since last event after which health is degraded. Default: 60_000. */
  staleLedgerThresholdMs: number;

  /** Timeout in ms for each RPC request. Default: 30_000. */
  rpcRequestTimeoutMs: number;

  /** Maximum concurrent outbound RPC requests. Default: 5. */
  rpcMaxConcurrentRequests: number;

  /** Number of retry attempts on transient RPC failure. Default: 3. */
  rpcRetryAttempts: number;
}

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  maxEventCapacity: 100_000,
  eventBatchSize: 500,
  staleLedgerThresholdMs: 60_000,
  rpcRequestTimeoutMs: 30_000,
  rpcMaxConcurrentRequests: 5,
  rpcRetryAttempts: 3,
};

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function loadStoreConfig(): StoreConfig {
  return {
    maxEventCapacity: parseIntOrDefault(
      process.env.STORE_MAX_EVENT_CAPACITY,
      DEFAULT_STORE_CONFIG.maxEventCapacity,
    ),
    eventBatchSize: parseIntOrDefault(
      process.env.STORE_EVENT_BATCH_SIZE,
      DEFAULT_STORE_CONFIG.eventBatchSize,
    ),
    staleLedgerThresholdMs: parseIntOrDefault(
      process.env.STORE_STALE_LEDGER_THRESHOLD_MS,
      DEFAULT_STORE_CONFIG.staleLedgerThresholdMs,
    ),
    rpcRequestTimeoutMs: parseIntOrDefault(
      process.env.RPC_REQUEST_TIMEOUT_MS,
      DEFAULT_STORE_CONFIG.rpcRequestTimeoutMs,
    ),
    rpcMaxConcurrentRequests: parseIntOrDefault(
      process.env.RPC_MAX_CONCURRENT_REQUESTS,
      DEFAULT_STORE_CONFIG.rpcMaxConcurrentRequests,
    ),
    rpcRetryAttempts: parseIntOrDefault(
      process.env.RPC_RETRY_ATTEMPTS,
      DEFAULT_STORE_CONFIG.rpcRetryAttempts,
    ),
  };
}

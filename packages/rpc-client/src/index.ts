/**
 * @fund-my-cause/rpc-client
 *
 * Shared Soroban RPC utilities used by both graphql-api and indexer:
 *
 *  - `createRpcServer`  — factory that constructs a `rpc.Server` with
 *                         consistent options (allowHttp derived from URL).
 *  - `CircuitBreaker`   — three-state circuit breaker (CLOSED / OPEN / HALF_OPEN)
 *                         re-exported from `@fund-my-cause/shared-utils`.
 *  - `CircuitOpenError` — thrown by CircuitBreaker when the circuit is OPEN.
 *
 * All services should import from this package rather than constructing
 * `rpc.Server` directly. New code that only needs the breaker or retry helper
 * should import them from `@fund-my-cause/shared-utils` directly.
 */

export { createRpcServer } from "./factory.js";
export type { RpcServerOptions, rpc } from "./factory.js";

export { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";
export type {
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  CircuitState,
} from "./circuit-breaker.js";

export { withRetry, RetryExhaustedError } from "./retry.js";
export type { RetryOptions, RetryResult } from "./retry.js";

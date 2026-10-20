/**
 * @fund-my-cause/rpc-client
 *
 * Shared Soroban RPC utilities used by both graphql-api and indexer:
 *
 *  - `createRpcServer`  — factory that constructs a `rpc.Server` with
 *                         consistent options (allowHttp derived from URL).
 *  - `CircuitBreaker`   — three-state circuit breaker (CLOSED / OPEN / HALF_OPEN)
 *                         that wraps outbound RPC calls to prevent cascading failures.
 *  - `CircuitOpenError` — thrown by CircuitBreaker when the circuit is OPEN.
 *
 * All services should import from this package rather than constructing
 * `rpc.Server` directly or copying the CircuitBreaker implementation.
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

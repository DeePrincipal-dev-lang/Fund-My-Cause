/**
 * Backwards-compatible re-export of the canonical circuit breaker.
 *
 * The implementation now lives in @fund-my-cause/shared-utils so services do
 * not depend on the RPC client solely to use a generic resilience primitive.
 * Existing imports of this module and of `@fund-my-cause/rpc-client` continue
 * to work unchanged.
 */
export { CircuitBreaker, CircuitOpenError } from "@fund-my-cause/shared-utils";
export type {
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  CircuitState,
} from "@fund-my-cause/shared-utils";

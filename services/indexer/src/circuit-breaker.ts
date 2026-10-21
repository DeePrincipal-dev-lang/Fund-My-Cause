/**
 * Re-exports the canonical CircuitBreaker from @fund-my-cause/shared-utils.
 *
 * The implementation lives in one generic place so that graphql-api, indexer,
 * and any future service share the same state machine. All existing imports of
 * this module continue to work unchanged.
 */
export { CircuitBreaker, CircuitOpenError } from "@fund-my-cause/shared-utils";
export type {
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  CircuitState,
} from "@fund-my-cause/shared-utils";

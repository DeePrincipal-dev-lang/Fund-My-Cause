/**
 * HorizonCircuitBreaker
 * ─────────────────────
 * Horizon-specific wrapper around the shared, generic circuit breaker.
 *
 * The state machine itself lives in `@fund-my-cause/shared-utils` so indexer,
 * graphql-api, and future services share one implementation. This wrapper keeps
 * Horizon's defaults, error type, and the method names used by `HorizonClient`.
 *
 * ## States
 *
 * ```
 *          failure threshold
 *   CLOSED ─────────────────► OPEN
 *     ▲                         │
 *     │  trial succeeds         │ cooldown expires
 *     │                         ▼
 *     └─────────────────── HALF_OPEN
 *          (trial fails → back to OPEN, reset cooldown)
 * ```
 *
 * ## Configuration
 *
 * | Option            | Default | Description                                  |
 * |-------------------|---------|----------------------------------------------|
 * | failureThreshold  | 5       | Consecutive failures before tripping          |
 * | cooldownMs        | 30_000  | Milliseconds to wait before entering HALF_OPEN|
 *
 * ## Injectable clock
 *
 * Pass a custom `now` function (`() => number`) to control wall-clock time in
 * tests. This avoids `vi.useFakeTimers()` and keeps tests synchronous.
 */

import {
  AppError,
  CircuitBreaker,
  type CircuitState,
} from "@fund-my-cause/shared-utils";

export type { CircuitState };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when a call is rejected because the circuit is open. */
export class CircuitOpenError extends AppError {
  constructor(message = "Circuit is open — Horizon calls are suspended") {
    super("CIRCUIT_OPEN", message, { severity: "error" });
    this.name = "CircuitOpenError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CircuitBreakerOptions {
  /** Number of consecutive failures that trip the breaker. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds the breaker stays open before moving to HALF_OPEN. Default: 30_000 */
  cooldownMs?: number;
  /**
   * Injectable wall-clock provider. Defaults to `Date.now`.
   * Pass a custom function in tests to control time without fake timers.
   */
  now?: () => number;
}

// ---------------------------------------------------------------------------
// HorizonCircuitBreaker
// ---------------------------------------------------------------------------

export class HorizonCircuitBreaker extends CircuitBreaker {
  private lastError: Error | null = null;

  constructor(options: CircuitBreakerOptions = {}) {
    super({
      ...options,
      createCircuitOpenError: () => new CircuitOpenError(),
    });
  }

  /**
   * Execute `fn` through the circuit breaker.
   *
   * - CLOSED: runs `fn`; records success or failure accordingly.
   * - OPEN:   throws `CircuitOpenError` immediately (no network call).
   * - HALF_OPEN: runs `fn` as a single trial; transitions on outcome.
   */
  override async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await super.call(fn);
      this.lastError = null;
      return result;
    } catch (err) {
      this.lastError = err instanceof Error ? err : new Error(String(err));
      throw err;
    }
  }

  /** Alias used by `HorizonClient` for call execution. */
  execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.call(fn);
  }

  /** The current state of the circuit. */
  getState(): CircuitState {
    return this.currentState;
  }

  /** Whether a call may proceed without being rejected as OPEN. */
  canExecute(): boolean {
    return this.currentState !== "OPEN";
  }

  /** The last error observed while executing through the breaker. */
  getLastError(): Error | null {
    return this.currentState === "OPEN" ? new CircuitOpenError() : this.lastError;
  }

  /** Reset to CLOSED and clear the cached error as well as the shared counters. */
  override reset(): void {
    super.reset();
    this.lastError = null;
  }
}

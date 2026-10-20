/**
 * HorizonCircuitBreaker
 * ─────────────────────
 * A three-state circuit breaker that wraps outbound calls to the Stellar
 * Horizon REST API.  It protects the application from cascading failures when
 * Horizon is unavailable or slow.
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
 * ### CLOSED (normal)
 * Every call is forwarded to Horizon.  When `failureThreshold` consecutive
 * failures occur the breaker trips to OPEN.
 *
 * ### OPEN (tripped)
 * Calls are rejected immediately with a `CircuitOpenError` — no network
 * request is made.  After `cooldownMs` milliseconds have elapsed the breaker
 * moves to HALF_OPEN to probe whether Horizon has recovered.
 *
 * ### HALF_OPEN (probing)
 * A single trial request is allowed through.
 * - **Success** → transition to CLOSED and reset the failure counter.
 * - **Failure** → transition back to OPEN and restart the cooldown timer.
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
 * tests.  This avoids `vi.useFakeTimers()` and keeps tests synchronous.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

import { AppError } from "@fund-my-cause/shared-utils";

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

/** The three states of the circuit breaker. */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures that trip the breaker. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds the breaker stays open before moving to HALF_OPEN. Default: 30_000 */
  cooldownMs?: number;
  /**
   * Injectable wall-clock provider.  Defaults to `Date.now`.
   * Pass a custom function in tests to control time without fake timers.
   */
  now?: () => number;
}

// ---------------------------------------------------------------------------
// HorizonCircuitBreaker
// ---------------------------------------------------------------------------

export class HorizonCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** The current state of the circuit. */
  get currentState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  /**
   * Execute `fn` through the circuit breaker.
   *
   * - CLOSED: runs `fn`; records success or failure accordingly.
   * - OPEN:   throws `CircuitOpenError` immediately (no network call).
   * - HALF_OPEN: runs `fn` as a single trial; transitions on outcome.
   *
   * @throws {CircuitOpenError} when the circuit is OPEN
   * @throws any error thrown by `fn` (after recording the failure)
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === "OPEN") {
      throw new CircuitOpenError();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal state machine
  // ---------------------------------------------------------------------------

  /**
   * If the breaker is OPEN and the cooldown has elapsed, transition to
   * HALF_OPEN so that the next call() can act as a trial.
   */
  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === "OPEN" &&
      this.openedAt !== null &&
      this.now() - this.openedAt >= this.cooldownMs
    ) {
      this.state = "HALF_OPEN";
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      // Trial succeeded — fully recover.
      this.state = "CLOSED";
      this.failureCount = 0;
      this.openedAt = null;
    } else if (this.state === "CLOSED") {
      // Reset the consecutive-failure counter on every success.
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    if (this.state === "HALF_OPEN") {
      // Trial failed — go back to OPEN and restart the cooldown.
      this.state = "OPEN";
      this.openedAt = this.now();
      return;
    }

    // CLOSED state: increment and maybe trip.
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
    }
  }
}

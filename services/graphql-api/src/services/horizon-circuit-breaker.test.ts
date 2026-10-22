/**
 * Unit tests for HorizonCircuitBreaker state transitions.
 *
 * Design goals
 * ────────────
 * • No live Horizon endpoint — every "network call" is a vi.fn() stub.
 * • Time is controlled via an injectable `now` function — no vi.useFakeTimers().
 * • Each describe block covers exactly one acceptance criterion from #958:
 *   1. Closed → Open (failure threshold)
 *   2. Open → Half-Open (cooldown elapsed)
 *   3. Half-Open → Closed (trial success)
 *   4. Half-Open → Open  (trial failure)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HorizonCircuitBreaker,
  CircuitOpenError,
  type CircuitState,
} from "./horizon-circuit-breaker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a stub that always resolves — simulates a healthy Horizon call. */
const successFn = vi.fn().mockResolvedValue({ status: "ok" });

/** Create a stub that always rejects — simulates a failing Horizon call. */
function makeFailFn(message = "Horizon unavailable") {
  return vi.fn().mockRejectedValue(new Error(message));
}

/**
 * Drive `breaker` to the OPEN state by invoking `failFn` exactly
 * `threshold` times.  Returns without asserting so callers can continue.
 */
async function driveToOpen(
  breaker: HorizonCircuitBreaker,
  threshold: number,
  failFn: () => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < threshold; i++) {
    await breaker.call(failFn).catch(() => {});
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. CLOSED → OPEN: failure threshold
// ---------------------------------------------------------------------------

describe("CLOSED → OPEN: failure threshold", () => {
  it("starts in the CLOSED state", () => {
    const breaker = new HorizonCircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000 });
    expect(breaker.currentState).toBe<CircuitState>("CLOSED");
  });

  it("remains CLOSED while consecutive failures are below the threshold", async () => {
    const breaker = new HorizonCircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000 });
    const fail = makeFailFn();

    // 2 failures — threshold is 3, should still be CLOSED.
    await breaker.call(fail).catch(() => {});
    await breaker.call(fail).catch(() => {});

    expect(breaker.currentState).toBe<CircuitState>("CLOSED");
  });

  it("trips to OPEN exactly when the failure threshold is reached", async () => {
    const threshold = 3;
    const breaker = new HorizonCircuitBreaker({ failureThreshold: threshold, cooldownMs: 1_000 });
    const fail = makeFailFn();

    await driveToOpen(breaker, threshold, fail);

    expect(breaker.currentState).toBe<CircuitState>("OPEN");
  });

  it("throws CircuitOpenError on calls after tripping (no real network call)", async () => {
    const threshold = 2;
    const breaker = new HorizonCircuitBreaker({ failureThreshold: threshold, cooldownMs: 9_999 });
    const fail = makeFailFn();

    await driveToOpen(breaker, threshold, fail);

    const mock = vi.fn();
    await expect(breaker.call(mock)).rejects.toThrow(CircuitOpenError);

    // The user-supplied fn must NOT have been called — we short-circuited.
    expect(mock).not.toHaveBeenCalled();
  });

  it("resets the failure counter on a success so threshold resets from zero", async () => {
    const threshold = 3;
    const breaker = new HorizonCircuitBreaker({ failureThreshold: threshold, cooldownMs: 1_000 });
    const fail = makeFailFn();

    // 2 failures, then a success — counter resets.
    await breaker.call(fail).catch(() => {});
    await breaker.call(fail).catch(() => {});
    await breaker.call(successFn);

    expect(breaker.currentState).toBe<CircuitState>("CLOSED");

    // Need 3 more failures from scratch to trip again.
    await breaker.call(fail).catch(() => {});
    await breaker.call(fail).catch(() => {});
    expect(breaker.currentState).toBe<CircuitState>("CLOSED"); // still 2/3

    await breaker.call(fail).catch(() => {});
    expect(breaker.currentState).toBe<CircuitState>("OPEN");
  });
});

// ---------------------------------------------------------------------------
// 2. OPEN → HALF_OPEN: cooldown period expires
// ---------------------------------------------------------------------------

describe("OPEN → HALF_OPEN: cooldown period", () => {
  it("stays OPEN before the cooldown has elapsed", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());
    expect(breaker.currentState).toBe<CircuitState>("OPEN");

    // Advance time, but not past the cooldown.
    fakeTime = 29_999;
    expect(breaker.currentState).toBe<CircuitState>("OPEN");
  });

  it("transitions to HALF_OPEN exactly when the cooldown expires", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 30_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());

    // Advance to exactly the cooldown boundary.
    fakeTime = 30_000;
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");
  });

  it("transitions to HALF_OPEN when well past the cooldown", async () => {
    let fakeTime = 1_000;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 5_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());

    fakeTime = 100_000; // far past cooldown
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");
  });

  it("allows exactly one trial call through in HALF_OPEN", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());

    fakeTime = 1_000; // cooldown elapsed → HALF_OPEN
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");

    const trial = vi.fn().mockResolvedValue("pong");
    await breaker.call(trial);

    expect(trial).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. HALF_OPEN → CLOSED: successful trial request
// ---------------------------------------------------------------------------

describe("HALF_OPEN → CLOSED: successful trial", () => {
  /** Helper: breaker already in HALF_OPEN, ready for a trial. */
  async function makeBreakerInHalfOpen(): Promise<HorizonCircuitBreaker> {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());

    // Advance past cooldown to trigger HALF_OPEN.
    fakeTime = 1_000;
    // Read state once to trigger the internal transition.
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");

    return breaker;
  }

  it("transitions from HALF_OPEN to CLOSED on a successful trial", async () => {
    const breaker = await makeBreakerInHalfOpen();

    await breaker.call(successFn);

    expect(breaker.currentState).toBe<CircuitState>("CLOSED");
  });

  it("resets the failure counter after a successful trial", async () => {
    const threshold = 3;
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({ failureThreshold: threshold, cooldownMs: 1_000, now });
    const fail = makeFailFn();

    await driveToOpen(breaker, threshold, fail);
    fakeTime = 1_000; // cooldown → HALF_OPEN

    // Successful trial.
    await breaker.call(successFn);
    expect(breaker.currentState).toBe<CircuitState>("CLOSED");

    // After recovery, failure counter is zero — need `threshold` new failures to trip again.
    for (let i = 0; i < threshold - 1; i++) {
      await breaker.call(fail).catch(() => {});
    }
    expect(breaker.currentState).toBe<CircuitState>("CLOSED"); // not tripped yet

    await breaker.call(fail).catch(() => {});
    expect(breaker.currentState).toBe<CircuitState>("OPEN"); // tripped again
  });

  it("forwards the return value of a successful trial to the caller", async () => {
    const breaker = await makeBreakerInHalfOpen();

    const payload = { horizonVersion: "0.33.0" };
    const fn = vi.fn().mockResolvedValue(payload);

    const result = await breaker.call(fn);
    expect(result).toEqual(payload);
  });
});

// ---------------------------------------------------------------------------
// 4. HALF_OPEN → OPEN: failed trial request
// ---------------------------------------------------------------------------

describe("HALF_OPEN → OPEN: failed trial", () => {
  it("transitions back to OPEN when the trial fails", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
      now,
    });

    await driveToOpen(breaker, 1, makeFailFn());

    fakeTime = 1_000; // → HALF_OPEN
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");

    // Failed trial — should flip back to OPEN.
    await breaker.call(makeFailFn()).catch(() => {});
    expect(breaker.currentState).toBe<CircuitState>("OPEN");
  });

  it("resets the cooldown timer when the trial fails", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const cooldownMs = 5_000;
    const breaker = new HorizonCircuitBreaker({ failureThreshold: 1, cooldownMs, now });

    // First trip at t=0.
    await driveToOpen(breaker, 1, makeFailFn());

    // After cooldown → HALF_OPEN.
    fakeTime = cooldownMs; // exactly at boundary
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");

    // Trial fails at t=5_000 — breaker re-opens and re-sets openedAt = 5_000.
    await breaker.call(makeFailFn()).catch(() => {});
    expect(breaker.currentState).toBe<CircuitState>("OPEN");

    // t=5_000 + cooldownMs - 1 → still OPEN (new timer runs from t=5_000).
    fakeTime = cooldownMs + cooldownMs - 1; // 9_999
    expect(breaker.currentState).toBe<CircuitState>("OPEN");

    // t=5_000 + cooldownMs → HALF_OPEN again.
    fakeTime = cooldownMs + cooldownMs; // 10_000
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");
  });

  it("re-throws the error from the failed trial to the caller", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now });
    await driveToOpen(breaker, 1, makeFailFn("first failure"));

    fakeTime = 1_000;
    expect(breaker.currentState).toBe<CircuitState>("HALF_OPEN");

    const trialError = new Error("Horizon still down");
    const failTrial = vi.fn().mockRejectedValue(trialError);

    await expect(breaker.call(failTrial)).rejects.toThrow("Horizon still down");
  });

  it("rejects subsequent calls immediately after a failed trial (OPEN again)", async () => {
    let fakeTime = 0;
    const now = () => fakeTime;

    const breaker = new HorizonCircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000, now });
    await driveToOpen(breaker, 1, makeFailFn());

    fakeTime = 10_000; // → HALF_OPEN
    await breaker.call(makeFailFn()).catch(() => {}); // trial fails → OPEN

    // Next call should be short-circuited with CircuitOpenError.
    const realFn = vi.fn();
    await expect(breaker.call(realFn)).rejects.toThrow(CircuitOpenError);
    expect(realFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. No live endpoint — guarantee
// ---------------------------------------------------------------------------

describe("No live endpoint guarantee", () => {
  it("never calls the user fn when the circuit is OPEN", async () => {
    const breaker = new HorizonCircuitBreaker({ failureThreshold: 1, cooldownMs: 99_999 });
    await driveToOpen(breaker, 1, makeFailFn());

    const fn = vi.fn();
    await breaker.call(fn).catch(() => {});
    await breaker.call(fn).catch(() => {});
    await breaker.call(fn).catch(() => {});

    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. HorizonClient compatibility API
// ---------------------------------------------------------------------------

describe("HorizonClient compatibility API", () => {
  it("supports execute, getState, canExecute, and getLastError", async () => {
    const breaker = new HorizonCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
    });

    expect(breaker.getState()).toBe<CircuitState>("CLOSED");
    expect(breaker.canExecute()).toBe(true);
    await expect(breaker.execute(successFn)).resolves.toEqual({ status: "ok" });
    expect(breaker.getLastError()).toBeNull();

    await driveToOpen(breaker, 1, makeFailFn());

    expect(breaker.getState()).toBe<CircuitState>("OPEN");
    expect(breaker.canExecute()).toBe(false);
    expect(breaker.getLastError()).toBeInstanceOf(CircuitOpenError);
  });
});

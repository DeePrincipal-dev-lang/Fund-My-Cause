import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "../circuit-breaker.js";

function makeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const success = () => Promise.resolve("ok");
const failure = () => Promise.reject(new Error("upstream unavailable"));

async function trip(breaker: CircuitBreaker, failures: number): Promise<void> {
  for (let i = 0; i < failures; i++) {
    await breaker.call(failure).catch(() => undefined);
  }
}

describe("CircuitBreaker", () => {
  it("starts CLOSED with zeroed metrics", () => {
    const breaker = new CircuitBreaker();

    expect(breaker.currentState).toBe("CLOSED");
    expect(breaker.getMetrics()).toEqual({
      state: "CLOSED",
      failureCount: 0,
      openedAt: null,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpenRejections: 0,
    });
  });

  it("forwards successful calls and records metrics", async () => {
    const breaker = new CircuitBreaker();
    const fn = vi.fn(success);

    await expect(breaker.call(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getMetrics()).toMatchObject({
      successfulCalls: 1,
      failedCalls: 0,
      totalCalls: 1,
    });
  });

  it("stays CLOSED below the failure threshold", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    await trip(breaker, 2);

    expect(breaker.currentState).toBe("CLOSED");
    expect(breaker.getMetrics().failureCount).toBe(2);
    expect(breaker.getMetrics().failedCalls).toBe(2);
  });

  it("trips OPEN after reaching the failure threshold", async () => {
    const clock = makeClock(1_000);
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 500,
      now: clock.now,
    });

    await trip(breaker, 3);

    expect(breaker.currentState).toBe("OPEN");
    expect(breaker.getMetrics()).toMatchObject({
      failureCount: 3,
      openedAt: 1_000,
    });
  });

  it("resets the failure count after a success while CLOSED", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    await trip(breaker, 2);
    await breaker.call(success);

    expect(breaker.getMetrics().failureCount).toBe(0);
    expect(breaker.currentState).toBe("CLOSED");
  });

  it("rejects calls while OPEN without invoking the wrapped function", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    await trip(breaker, 1);

    const fn = vi.fn(success);
    await expect(breaker.call(fn)).rejects.toBeInstanceOf(CircuitOpenError);

    expect(fn).not.toHaveBeenCalled();
    expect(breaker.getMetrics()).toMatchObject({
      circuitOpenRejections: 1,
      totalCalls: 2,
    });
  });

  it("transitions OPEN to HALF_OPEN after the cooldown", async () => {
    const clock = makeClock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 500,
      now: clock.now,
    });
    await trip(breaker, 1);

    clock.advance(499);
    expect(breaker.currentState).toBe("OPEN");

    clock.advance(1);
    expect(breaker.currentState).toBe("HALF_OPEN");
    expect(breaker.getMetrics().state).toBe("HALF_OPEN");
  });

  it("closes after a successful HALF_OPEN trial", async () => {
    const clock = makeClock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      now: clock.now,
    });
    await trip(breaker, 1);
    clock.advance(100);

    await breaker.call(success);

    expect(breaker.currentState).toBe("CLOSED");
    expect(breaker.getMetrics()).toMatchObject({
      failureCount: 0,
      openedAt: null,
      successfulCalls: 1,
    });
  });

  it("reopens and restarts the cooldown after a failed HALF_OPEN trial", async () => {
    const clock = makeClock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      now: clock.now,
    });
    await trip(breaker, 1);

    clock.advance(100);
    expect(breaker.currentState).toBe("HALF_OPEN");

    await expect(breaker.call(failure)).rejects.toThrow("upstream unavailable");
    expect(breaker.currentState).toBe("OPEN");
    expect(breaker.getMetrics().openedAt).toBe(100);

    clock.advance(99);
    expect(breaker.currentState).toBe("OPEN");

    clock.advance(1);
    expect(breaker.currentState).toBe("HALF_OPEN");
  });

  it("resets state and counters", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    await trip(breaker, 1);
    await breaker.call(success).catch(() => undefined);

    breaker.reset();

    expect(breaker.currentState).toBe("CLOSED");
    expect(breaker.getMetrics()).toEqual({
      state: "CLOSED",
      failureCount: 0,
      openedAt: null,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      circuitOpenRejections: 0,
    });
  });

  it("does not count a CircuitOpenError thrown by the wrapped function as a failure", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });

    await expect(
      breaker.call(() => Promise.reject(new CircuitOpenError())),
    ).rejects.toBeInstanceOf(CircuitOpenError);

    expect(breaker.currentState).toBe("CLOSED");
    expect(breaker.getMetrics()).toMatchObject({
      failureCount: 0,
      failedCalls: 0,
    });
  });

  it("uses a custom circuit-open error factory", async () => {
    class ServiceCircuitOpenError extends Error {}
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      createCircuitOpenError: () => new ServiceCircuitOpenError("service open"),
    });
    await trip(breaker, 1);

    await expect(breaker.call(success)).rejects.toBeInstanceOf(
      ServiceCircuitOpenError,
    );
  });
});

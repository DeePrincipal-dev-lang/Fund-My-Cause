import { describe, it, expect } from "vitest";
import { createRpcServer } from "../factory.js";
import { CircuitBreaker, CircuitOpenError } from "../circuit-breaker.js";

// ---------------------------------------------------------------------------
// createRpcServer
// ---------------------------------------------------------------------------

describe("createRpcServer", () => {
  it("returns an rpc.Server instance for an https URL", () => {
    const server = createRpcServer({
      url: "https://soroban-testnet.stellar.org",
    });
    // rpc.Server exposes simulateTransaction, getLatestLedger, etc.
    expect(typeof server.simulateTransaction).toBe("function");
    expect(typeof server.getLatestLedger).toBe("function");
  });

  it("returns an rpc.Server instance for an http URL (local devnet)", () => {
    // Should not throw even though allowHttp is required for http:// URLs
    const server = createRpcServer({ url: "http://localhost:8000" });
    expect(typeof server.simulateTransaction).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// CircuitBreaker (promoted from indexer)
// ---------------------------------------------------------------------------

describe("CircuitBreaker", () => {
  it("starts in CLOSED state", () => {
    const cb = new CircuitBreaker();
    expect(cb.currentState).toBe("CLOSED");
  });

  it("trips to OPEN after failureThreshold consecutive failures", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const fail = () => Promise.reject(new Error("boom"));

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(fail)).rejects.toThrow("boom");
    }

    expect(cb.currentState).toBe("OPEN");
  });

  it("throws CircuitOpenError when OPEN", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.call(() => Promise.reject(new Error("x")))).rejects.toThrow(
      Error,
    );
    await expect(cb.call(() => Promise.resolve("y"))).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  it("transitions to HALF_OPEN after cooldown", async () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });

    await expect(
      cb.call(() => Promise.reject(new Error("trip"))),
    ).rejects.toThrow();
    expect(cb.currentState).toBe("OPEN");

    now = 1001;
    expect(cb.currentState).toBe("HALF_OPEN");
  });

  it("recovers to CLOSED after a successful trial in HALF_OPEN", async () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });

    await expect(
      cb.call(() => Promise.reject(new Error("trip"))),
    ).rejects.toThrow();

    now = 1001; // advance past cooldown → HALF_OPEN
    await cb.call(() => Promise.resolve("ok"));
    expect(cb.currentState).toBe("CLOSED");
  });

  it("reset() returns breaker to CLOSED with zeroed metrics", () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.reset();
    const m = cb.getMetrics();
    expect(m.state).toBe("CLOSED");
    expect(m.totalCalls).toBe(0);
    expect(m.failureCount).toBe(0);
  });

  it("getMetrics() reflects call history", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 5 });
    await cb.call(() => Promise.resolve("a"));
    await expect(
      cb.call(() => Promise.reject(new Error("b"))),
    ).rejects.toThrow();

    const m = cb.getMetrics();
    expect(m.totalCalls).toBe(2);
    expect(m.successfulCalls).toBe(1);
    expect(m.failedCalls).toBe(1);
    expect(m.circuitOpenRejections).toBe(0);
  });
});

/**
 * Unit tests for indexer health-check endpoints (#914).
 *
 * Tests /healthz (liveness) and /readyz (readiness) in both healthy and
 * unhealthy/degraded dependency states.
 *
 * Strategy: extract the route handler logic into testable pure functions so we
 * can unit-test without starting an HTTP server.  The same logic is wired into
 * the Express app in index.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { HealthChecker } from "../health-checker.js";
import pino from "pino";

const logger = pino({ level: "silent" });

// ── Route handler implementations (mirrors index.ts) ─────────────────────────
// Extracting these here lets us test all branches without supertest.

interface FakeRpcClient {
  isConnected(): boolean;
}

function handleHealthz(): { status: number; body: Record<string, unknown> } {
  return {
    status: 200,
    body: { status: "ok", timestamp: new Date().toISOString() },
  };
}

function handleReadyz(
  rpcClient: FakeRpcClient,
  isRunning: boolean,
): { status: number; body: Record<string, unknown> } {
  const rpcReachable = rpcClient.isConnected();
  if (isRunning && rpcReachable) {
    return {
      status: 200,
      body: {
        ready: true,
        checks: { rpc: "ok", indexer: "running" },
        timestamp: new Date().toISOString(),
      },
    };
  }
  return {
    status: 503,
    body: {
      ready: false,
      checks: {
        rpc: rpcReachable ? "ok" : "unreachable",
        indexer: isRunning ? "running" : "not_started",
      },
      timestamp: new Date().toISOString(),
    },
  };
}

function handleHealth(healthChecker: HealthChecker): {
  status: number;
  body: Record<string, unknown>;
} {
  const s = healthChecker.getStatus();
  const code =
    s.status === "healthy" ? 200 : s.status === "degraded" ? 202 : 503;
  return { status: code, body: s as unknown as Record<string, unknown> };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Indexer health endpoints (#914)", () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker(logger);
  });

  // ── /healthz — liveness probe ─────────────────────────────────────────────

  describe("GET /healthz (liveness)", () => {
    it("returns 200 regardless of RPC or indexer state (pure process liveness)", () => {
      // even with RPC down and indexer not started, liveness must return 200
      const result = handleHealthz();
      expect(result.status).toBe(200);
      expect(result.body.status).toBe("ok");
    });

    it("includes a valid ISO timestamp", () => {
      const { body } = handleHealthz();
      expect(typeof body.timestamp).toBe("string");
      expect(new Date(body.timestamp as string).getTime()).not.toBeNaN();
    });
  });

  // ── /readyz — readiness probe ─────────────────────────────────────────────

  describe("GET /readyz (readiness)", () => {
    it("returns 200 when RPC is reachable and indexer is running", () => {
      const { status, body } = handleReadyz({ isConnected: () => true }, true);
      expect(status).toBe(200);
      expect(body.ready).toBe(true);
      expect((body.checks as any).rpc).toBe("ok");
      expect((body.checks as any).indexer).toBe("running");
    });

    it("returns 503 when RPC is unreachable even if indexer is running", () => {
      const { status, body } = handleReadyz({ isConnected: () => false }, true);
      expect(status).toBe(503);
      expect(body.ready).toBe(false);
      expect((body.checks as any).rpc).toBe("unreachable");
      expect((body.checks as any).indexer).toBe("running");
    });

    it("returns 503 when indexer has not started even if RPC is reachable", () => {
      const { status, body } = handleReadyz({ isConnected: () => true }, false);
      expect(status).toBe(503);
      expect(body.ready).toBe(false);
      expect((body.checks as any).rpc).toBe("ok");
      expect((body.checks as any).indexer).toBe("not_started");
    });

    it("returns 503 when both RPC is down and indexer has not started", () => {
      const { status, body } = handleReadyz(
        { isConnected: () => false },
        false,
      );
      expect(status).toBe(503);
      expect(body.ready).toBe(false);
      expect((body.checks as any).rpc).toBe("unreachable");
      expect((body.checks as any).indexer).toBe("not_started");
    });

    it("includes a valid ISO timestamp in the response", () => {
      const { body } = handleReadyz({ isConnected: () => true }, true);
      expect(typeof body.timestamp).toBe("string");
      expect(new Date(body.timestamp as string).getTime()).not.toBeNaN();
    });
  });

  // ── /health — original endpoint (kept for compat) ─────────────────────────

  describe("GET /health (original liveness, kept for backwards compat)", () => {
    it("returns 202 (degraded), not 503, before any events are recorded during the startup grace period", () => {
      // A freshly-started service hasn't had a chance to process its first
      // event yet — that's not the same as being unhealthy.
      const { status, body } = handleHealth(healthChecker);
      expect(status).toBe(202);
      expect((body as any).status).toBe("degraded");
    });

    it("returns 503 (unhealthy) once the startup grace period elapses with still no events", () => {
      const shortGraceChecker = new HealthChecker(logger, 0);
      const { status, body } = handleHealth(shortGraceChecker);
      expect(status).toBe(503);
      expect((body as any).status).toBe("unhealthy");
    });

    it("returns 200 after a recent event is recorded (healthy)", () => {
      healthChecker.recordEvent(12345678);
      const { status, body } = handleHealth(healthChecker);
      expect(status).toBe(200);
      expect((body as any).status).toBe("healthy");
    });
  });
});

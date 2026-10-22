import { describe, it, expect, vi, afterEach } from "vitest";
import pino from "pino";
import { HealthChecker } from "./health-checker.js";

const logger = pino({ level: "silent" });

describe("HealthChecker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not report unhealthy immediately after boot with zero events processed", () => {
    const checker = new HealthChecker(logger, 30000);
    const status = checker.getStatus();

    expect(status.eventsProcessed).toBe(0);
    expect(status.status).not.toBe("unhealthy");
  });

  it("reports unhealthy once the startup grace period elapses with still no events", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const checker = new HealthChecker(logger, 30000);
    vi.setSystemTime(now + 30001);

    expect(checker.getStatus().status).toBe("unhealthy");
  });

  it("reports healthy once an event is recorded, even within the grace window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now());

    const checker = new HealthChecker(logger, 30000);
    checker.recordEvent(100);

    expect(checker.getStatus().status).toBe("healthy");
  });
});

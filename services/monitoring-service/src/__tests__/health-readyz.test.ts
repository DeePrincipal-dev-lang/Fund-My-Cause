import { describe, expect, it } from "@jest/globals";
import {
  buildDefaultDependencyChecks,
  getLiveness,
  getReadiness,
} from "../health";

describe("getLiveness", () => {
  it("reports ok status with uptime", () => {
    const startedAt = Date.now() - 5000;
    const result = getLiveness(startedAt);

    expect(result.status).toBe("ok");
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(5);
    expect(typeof result.timestamp).toBe("string");
  });
});

describe("getReadiness", () => {
  it("returns ok when all downstream dependencies are healthy", async () => {
    const deps = buildDefaultDependencyChecks({
      checkAlertTransport: async () => true,
      checkPagerDuty: async () => true,
      checkRulesEngineStore: async () => true,
    });

    const result = await getReadiness(deps);

    expect(result.status).toBe("ok");
    expect(result.checks).toEqual({
      alertTransport: "ok",
      pagerduty: "ok",
      rulesEngineStore: "ok",
    });
  });

  it("returns degraded when pagerduty is unreachable", async () => {
    const deps = buildDefaultDependencyChecks({
      checkAlertTransport: async () => true,
      checkPagerDuty: async () => false,
      checkRulesEngineStore: async () => true,
    });

    const result = await getReadiness(deps);

    expect(result.status).toBe("degraded");
    expect(result.checks.pagerduty).toBe("unreachable");
  });

  it("returns degraded when a dependency check throws", async () => {
    const deps = buildDefaultDependencyChecks({
      checkAlertTransport: async () => {
        throw new Error("connection refused");
      },
      checkPagerDuty: async () => true,
      checkRulesEngineStore: async () => true,
    });

    const result = await getReadiness(deps);

    expect(result.status).toBe("degraded");
    expect(result.checks.alertTransport).toBe("unreachable");
  });

  it("returns degraded when a dependency check times out", async () => {
    const deps = buildDefaultDependencyChecks({
      checkAlertTransport: async () =>
        new Promise((resolve) => setTimeout(() => resolve(true), 5000)),
      checkPagerDuty: async () => true,
      checkRulesEngineStore: async () => true,
    });
    deps[0].timeoutMs = 50;

    const result = await getReadiness(deps);

    expect(result.status).toBe("degraded");
    expect(result.checks.alertTransport).toBe("unreachable");
  });

  it("marks all dependencies unreachable when everything fails", async () => {
    const deps = buildDefaultDependencyChecks({
      checkAlertTransport: async () => false,
      checkPagerDuty: async () => false,
      checkRulesEngineStore: async () => false,
    });

    const result = await getReadiness(deps);

    expect(result.status).toBe("degraded");
    expect(Object.values(result.checks)).toEqual([
      "unreachable",
      "unreachable",
      "unreachable",
    ]);
  });
});

import { loadMonitoringServiceEnv } from "../monitoring-service/env";

const VALID = {
  PORT: "3000",
  DOWNSTREAM_API_URL: "http://localhost:4000/health",
  REDIS_URL: "redis://localhost:6379",
  PAGERDUTY_API_KEY: "p".repeat(30),
};

describe("monitoring-service env", () => {
  it("loads valid config", () => {
    const env = loadMonitoringServiceEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.ALERT_INTERVAL_MS).toBe(60_000);
  });

  it("fails when PAGERDUTY_API_KEY is missing", () => {
    expect(() =>
      loadMonitoringServiceEnv({ ...VALID, PAGERDUTY_API_KEY: "" }),
    ).toThrow(/PAGERDUTY_API_KEY/);
  });

  it("fails when DOWNSTREAM_API_URL is malformed", () => {
    expect(() =>
      loadMonitoringServiceEnv({ ...VALID, DOWNSTREAM_API_URL: "no" }),
    ).toThrow(/DOWNSTREAM_API_URL/);
  });
});

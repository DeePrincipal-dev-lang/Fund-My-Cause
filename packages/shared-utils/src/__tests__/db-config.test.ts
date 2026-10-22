import { describe, it, expect } from "vitest";
import { loadDbPoolConfig, DEFAULT_DB_POOL_CONFIG } from "../db-config";

describe("db-config", () => {
  describe("DEFAULT_DB_POOL_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_DB_POOL_CONFIG).toEqual({
        max: 10,
        min: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        retryAttempts: 3,
        retryBackoffMs: 250,
      });
    });
  });

  describe("loadDbPoolConfig", () => {
    it("returns defaults when env is empty", () => {
      expect(loadDbPoolConfig({})).toEqual(DEFAULT_DB_POOL_CONFIG);
    });

    it("returns defaults when env values are undefined", () => {
      expect(loadDbPoolConfig()).toEqual(DEFAULT_DB_POOL_CONFIG);
    });

    it("loads custom values from env", () => {
      const env = {
        DB_POOL_MAX: "20",
        DB_POOL_MIN: "5",
        DB_POOL_IDLE_TIMEOUT_MS: "60000",
        DB_POOL_CONNECTION_TIMEOUT_MS: "10000",
        DB_POOL_RETRY_ATTEMPTS: "5",
        DB_POOL_RETRY_BACKOFF_MS: "500",
      };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(20);
      expect(result.min).toBe(5);
      expect(result.idleTimeoutMillis).toBe(60_000);
      expect(result.connectionTimeoutMillis).toBe(10_000);
      expect(result.retryAttempts).toBe(5);
      expect(result.retryBackoffMs).toBe(500);
    });

    it("falls back to default for empty string env values", () => {
      const env = {
        DB_POOL_MAX: "",
        DB_POOL_MIN: "",
      };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(DEFAULT_DB_POOL_CONFIG.max);
      expect(result.min).toBe(DEFAULT_DB_POOL_CONFIG.min);
    });

    it("falls back to default for NaN env values", () => {
      const env = {
        DB_POOL_MAX: "not-a-number",
        DB_POOL_MIN: "abc",
      };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(DEFAULT_DB_POOL_CONFIG.max);
      expect(result.min).toBe(DEFAULT_DB_POOL_CONFIG.min);
    });

    it("handles partial env overrides", () => {
      const env = { DB_POOL_MAX: "50" };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(50);
      expect(result.min).toBe(DEFAULT_DB_POOL_CONFIG.min);
      expect(result.idleTimeoutMillis).toBe(
        DEFAULT_DB_POOL_CONFIG.idleTimeoutMillis,
      );
    });

    it("handles negative values (passthrough, no clamping)", () => {
      const env = { DB_POOL_MAX: "-1" };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(-1);
    });

    it("handles zero values", () => {
      const env = { DB_POOL_MAX: "0", DB_POOL_MIN: "0" };
      const result = loadDbPoolConfig(env);
      expect(result.max).toBe(0);
      expect(result.min).toBe(0);
    });
  });
});

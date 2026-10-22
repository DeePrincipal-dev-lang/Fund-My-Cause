/**
 * Tests for the rules engine (Issue #1131)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  loadAlertRules,
  loadRulesFromEnvironment,
  type AlertRulesConfig,
  type ValidationError,
} from "./rules-engine.js";

describe("Rules Engine (Issue #1131)", () => {
  describe("loadAlertRules", () => {
    it("should load threshold rules successfully", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "cpu-critical",
            type: "threshold",
            name: "CPU Critical",
            metric: "cpu_usage",
            severity: "critical",
            config: {
              threshold: 90,
              direction: "above",
            },
            enabled: true,
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors).toHaveLength(0);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].ruleId).toBe("cpu-critical");
    });

    it("should load rate rules successfully", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "error-rate-spike",
            type: "rate",
            name: "Error Rate Spike",
            metric: "error_count",
            severity: "critical",
            config: {
              threshold: 10,
              direction: "increase",
            },
            enabled: true,
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors).toHaveLength(0);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].ruleId).toBe("error-rate-spike");
    });

    it("should skip disabled rules with a warning", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "disabled-rule",
            type: "threshold",
            name: "Disabled Rule",
            metric: "test",
            severity: "info",
            config: {
              threshold: 50,
              direction: "above",
            },
            enabled: false,
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.rules).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("disabled");
    });

    it("should return errors for invalid rule ID", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "",
            type: "threshold",
            name: "Invalid Rule",
            metric: "test",
            severity: "critical",
            config: {
              threshold: 50,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("id");
    });

    it("should return errors for invalid rule type", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "bad-type",
            type: "invalid" as any,
            name: "Bad Type",
            metric: "test",
            severity: "critical",
            config: {
              threshold: 50,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("type"))).toBe(true);
    });

    it("should return errors for invalid threshold direction", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "bad-direction",
            type: "threshold",
            name: "Bad Direction",
            metric: "test",
            severity: "critical",
            config: {
              threshold: 50,
              direction: "sideways" as any,
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("direction"))).toBe(
        true,
      );
    });

    it("should return errors for invalid rate direction", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "bad-rate-direction",
            type: "rate",
            name: "Bad Rate Direction",
            metric: "test",
            severity: "critical",
            config: {
              threshold: 10,
              direction: "sideways" as any,
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("direction"))).toBe(
        true,
      );
    });

    it("should return errors for invalid severity", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "bad-severity",
            type: "threshold",
            name: "Bad Severity",
            metric: "test",
            severity: "catastrophic" as any,
            config: {
              threshold: 50,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("severity"))).toBe(
        true,
      );
    });

    it("should return errors for missing required fields", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "incomplete",
            type: "threshold",
            name: "Incomplete Rule",
            metric: "",
            severity: "critical",
            config: {
              threshold: 50,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("metric"))).toBe(
        true,
      );
    });

    it("should detect duplicate rule IDs", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "duplicate",
            type: "threshold",
            name: "Rule 1",
            metric: "cpu",
            severity: "critical",
            config: {
              threshold: 90,
              direction: "above",
            },
          },
          {
            id: "duplicate",
            type: "threshold",
            name: "Rule 2",
            metric: "memory",
            severity: "warning",
            config: {
              threshold: 85,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("Duplicate"))).toBe(
        true,
      );
    });

    it("should load multiple valid rules", () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "cpu-critical",
            type: "threshold",
            name: "CPU Critical",
            metric: "cpu_usage",
            severity: "critical",
            config: {
              threshold: 90,
              direction: "above",
            },
          },
          {
            id: "memory-warning",
            type: "threshold",
            name: "Memory Warning",
            metric: "memory_usage",
            severity: "warning",
            config: {
              threshold: 75,
              direction: "above",
            },
          },
          {
            id: "error-spike",
            type: "rate",
            name: "Error Spike",
            metric: "error_count",
            severity: "critical",
            config: {
              threshold: 5,
              direction: "increase",
            },
          },
        ],
      };

      const result = loadAlertRules(config);

      expect(result.errors).toHaveLength(0);
      expect(result.rules).toHaveLength(3);
      expect(result.rules.map((r) => r.ruleId)).toEqual([
        "cpu-critical",
        "memory-warning",
        "error-spike",
      ]);
    });
  });

  describe("loadRulesFromEnvironment", () => {
    const originalEnv = process.env.ALERT_RULES_CONFIG;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.ALERT_RULES_CONFIG = originalEnv;
      } else {
        delete process.env.ALERT_RULES_CONFIG;
      }
    });

    it("should load from environment variable if set", () => {
      const testConfig: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "env-rule",
            type: "threshold",
            name: "Env Rule",
            metric: "test",
            severity: "critical",
            config: {
              threshold: 100,
              direction: "above",
            },
          },
        ],
      };

      process.env.ALERT_RULES_CONFIG = JSON.stringify(testConfig);

      const result = loadRulesFromEnvironment();

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("env-rule");
    });

    it("should load defaults if environment variable is not set", () => {
      delete process.env.ALERT_RULES_CONFIG;

      const result = loadRulesFromEnvironment();

      expect(result.version).toBe("1.0");
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.rules.some((r) => r.id === "cpu-critical")).toBe(true);
      expect(result.rules.some((r) => r.id === "cpu-warning")).toBe(true);
      expect(result.rules.some((r) => r.id === "error-rate-increase")).toBe(
        true,
      );
    });

    it("should load defaults if environment variable contains invalid JSON", () => {
      process.env.ALERT_RULES_CONFIG = "invalid json {";

      const result = loadRulesFromEnvironment();

      expect(result.version).toBe("1.0");
      expect(result.rules.length).toBeGreaterThan(0);
    });
  });

  describe("Rule evaluation", () => {
    it("should evaluate loaded threshold rule successfully", async () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "test-threshold",
            type: "threshold",
            name: "Test Threshold",
            metric: "cpu_usage",
            severity: "critical",
            config: {
              threshold: 80,
              direction: "above",
            },
          },
        ],
      };

      const result = loadAlertRules(config);
      expect(result.errors).toHaveLength(0);
      expect(result.rules).toHaveLength(1);

      const rule = result.rules[0];
      const evalResult = rule.evaluate({
        metric: "cpu_usage",
        value: 90,
        threshold: 80,
      });

      expect(evalResult.triggered).toBe(true);
      expect(evalResult.severity).toBe("critical");
    });

    it("should evaluate loaded rate rule successfully", async () => {
      const config: AlertRulesConfig = {
        version: "1.0",
        rules: [
          {
            id: "test-rate",
            type: "rate",
            name: "Test Rate",
            metric: "error_count",
            severity: "warning",
            config: {
              threshold: 5,
              direction: "increase",
            },
          },
        ],
      };

      const result = loadAlertRules(config);
      expect(result.errors).toHaveLength(0);
      expect(result.rules).toHaveLength(1);

      const rule = result.rules[0];
      const evalResult = rule.evaluate({
        metric: "error_count",
        value: 100,
        threshold: 5,
        previousValue: 50,
        windowSeconds: 10,
      });

      expect(evalResult.triggered).toBe(true);
      expect(evalResult.severity).toBe("warning");
    });
  });
});

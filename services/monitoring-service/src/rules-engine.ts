/**
 * Rules engine for alert rule configuration — Issue #1131
 *
 * Centralizes alert rule configuration and provides a rules loader that:
 *   1. Reads rules from configuration (JSON file or environment)
 *   2. Validates configuration
 *   3. Instantiates AlertRule objects for use by AlertRuleEvaluator
 *
 * This allows alert thresholds and rules to be tuned at runtime without
 * modifying source code, addressing the risk identified in Issue #1131.
 */

import type {
  AlertRule,
  AlertRuleContext,
  AlertRuleResult,
} from "./alert-rule.js";
import { ThresholdAlertRule, RateAlertRule } from "./alert-rule.js";

/**
 * Represents a single alert rule from configuration.
 * The structure supports different rule types with type-specific settings.
 */
export interface AlertRuleConfig {
  /** Unique identifier for this rule. */
  id: string;
  /** Type of rule: 'threshold' or 'rate'. */
  type: "threshold" | "rate";
  /** Human-readable name for this rule. */
  name: string;
  /** Metric this rule applies to (e.g., "cpu_usage", "error_rate"). */
  metric: string;
  /** Severity level when rule fires: 'critical', 'warning', or 'info'. */
  severity: "critical" | "warning" | "info";
  /** Rule type-specific configuration. */
  config: ThresholdRuleConfig | RateRuleConfig;
  /** Whether this rule is enabled. */
  enabled?: boolean;
}

/** Configuration for threshold-based alert rules. */
export interface ThresholdRuleConfig {
  /** The threshold value to compare against. */
  threshold: number;
  /** Comparison direction: 'above' or 'below'. */
  direction: "above" | "below";
}

/** Configuration for rate-based alert rules. */
export interface RateRuleConfig {
  /** The rate threshold to compare against (per second). */
  threshold: number;
  /** Rate direction: 'increase' or 'decrease'. */
  direction: "increase" | "decrease";
}

/**
 * Represents a collection of alert rules with metadata.
 */
export interface AlertRulesConfig {
  /** Version of the configuration schema. */
  version: string;
  /** Timestamp when this config was last updated. */
  updatedAt?: string;
  /** The actual alert rules. */
  rules: AlertRuleConfig[];
}

/**
 * Validation error details for a single rule or configuration.
 */
export interface ValidationError {
  /** The rule ID or 'global' if it's a config-level error. */
  target: string;
  /** Error message. */
  message: string;
}

/**
 * Result of loading and validating alert rules.
 */
export interface RulesLoadResult {
  /** Successfully instantiated AlertRule objects. */
  rules: AlertRule[];
  /** Any validation warnings (non-blocking). */
  warnings: ValidationError[];
  /** Any validation errors (blocking). */
  errors: ValidationError[];
}

/**
 * Validates a threshold rule configuration.
 * @returns Validation errors if invalid, empty array if valid.
 */
function validateThresholdRuleConfig(
  ruleId: string,
  config: unknown,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof config !== "object" || config === null) {
    errors.push({
      target: ruleId,
      message: "Threshold rule config must be an object",
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  if (typeof cfg.threshold !== "number") {
    errors.push({
      target: ruleId,
      message: "threshold must be a number",
    });
  }

  if (!["above", "below"].includes(cfg.direction as string)) {
    errors.push({
      target: ruleId,
      message: 'direction must be "above" or "below"',
    });
  }

  return errors;
}

/**
 * Validates a rate rule configuration.
 * @returns Validation errors if invalid, empty array if valid.
 */
function validateRateRuleConfig(
  ruleId: string,
  config: unknown,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof config !== "object" || config === null) {
    errors.push({
      target: ruleId,
      message: "Rate rule config must be an object",
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  if (typeof cfg.threshold !== "number") {
    errors.push({
      target: ruleId,
      message: "threshold must be a number",
    });
  }

  if (!["increase", "decrease"].includes(cfg.direction as string)) {
    errors.push({
      target: ruleId,
      message: 'direction must be "increase" or "decrease"',
    });
  }

  return errors;
}

/**
 * Validates a single alert rule configuration.
 * @returns Validation errors if invalid, empty array if valid.
 */
function validateRuleConfig(rule: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof rule !== "object" || rule === null) {
    errors.push({
      target: "unknown",
      message: "Rule configuration must be an object",
    });
    return errors;
  }

  const r = rule as Record<string, unknown>;
  const ruleId = (r.id as string) || "unknown";

  // Validate required fields
  if (!r.id || typeof r.id !== "string") {
    errors.push({
      target: ruleId,
      message: "id is required and must be a string",
    });
  }

  if (!r.type || !["threshold", "rate"].includes(r.type as string)) {
    errors.push({
      target: ruleId,
      message: 'type is required and must be "threshold" or "rate"',
    });
  }

  if (!r.name || typeof r.name !== "string") {
    errors.push({
      target: ruleId,
      message: "name is required and must be a string",
    });
  }

  if (!r.metric || typeof r.metric !== "string") {
    errors.push({
      target: ruleId,
      message: "metric is required and must be a string",
    });
  }

  if (
    !r.severity ||
    !["critical", "warning", "info"].includes(r.severity as string)
  ) {
    errors.push({
      target: ruleId,
      message:
        'severity is required and must be "critical", "warning", or "info"',
    });
  }

  // Validate type-specific config
  if (r.type === "threshold") {
    errors.push(...validateThresholdRuleConfig(ruleId, r.config));
  } else if (r.type === "rate") {
    errors.push(...validateRateRuleConfig(ruleId, r.config));
  }

  return errors;
}

/**
 * Validates a full alert rules configuration.
 * @returns Validation errors if invalid, empty array if valid.
 */
function validateRulesConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof config !== "object" || config === null) {
    errors.push({
      target: "global",
      message: "Configuration must be an object",
    });
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  if (!cfg.version || typeof cfg.version !== "string") {
    errors.push({
      target: "global",
      message: "version is required and must be a string",
    });
  }

  if (!Array.isArray(cfg.rules)) {
    errors.push({
      target: "global",
      message: "rules must be an array",
    });
    return errors;
  }

  // Validate each rule
  const ruleIds = new Set<string>();
  for (const rule of cfg.rules as unknown[]) {
    const ruleErrors = validateRuleConfig(rule);
    errors.push(...ruleErrors);

    if (typeof rule === "object" && rule !== null) {
      const id = (rule as Record<string, unknown>).id as string;
      if (id && ruleIds.has(id)) {
        errors.push({
          target: id,
          message: "Duplicate rule ID",
        });
      }
      if (id) {
        ruleIds.add(id);
      }
    }
  }

  return errors;
}

/**
 * Loads alert rules from configuration.
 *
 * Validates configuration and returns a result containing:
 *   - Instantiated AlertRule objects ready for use
 *   - Any validation warnings
 *   - Any validation errors
 *
 * If validation errors are present, no rules are instantiated.
 */
export function loadAlertRules(config: AlertRulesConfig): RulesLoadResult {
  const errors = validateRulesConfig(config);
  const warnings: ValidationError[] = [];
  const rules: AlertRule[] = [];

  if (errors.length > 0) {
    return { rules: [], warnings, errors };
  }

  // Instantiate rules from valid configuration
  for (const ruleConfig of config.rules) {
    // Skip disabled rules
    if (ruleConfig.enabled === false) {
      warnings.push({
        target: ruleConfig.id,
        message: `Rule is disabled and will not be loaded`,
      });
      continue;
    }

    try {
      if (ruleConfig.type === "threshold") {
        const cfg = ruleConfig.config as ThresholdRuleConfig;
        rules.push(
          new ThresholdAlertRule({
            ruleId: ruleConfig.id,
            direction: cfg.direction,
            severity: ruleConfig.severity,
          }),
        );
      } else if (ruleConfig.type === "rate") {
        const cfg = ruleConfig.config as RateRuleConfig;
        rules.push(
          new RateAlertRule({
            ruleId: ruleConfig.id,
            direction: cfg.direction,
            severity: ruleConfig.severity,
          }),
        );
      }
    } catch (err) {
      errors.push({
        target: ruleConfig.id,
        message: `Failed to instantiate rule: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { rules, warnings, errors };
}

/**
 * Creates a rules configuration from environment variables or hardcoded defaults.
 *
 * Environment variable format (JSON):
 *   ALERT_RULES_CONFIG='{"version":"1.0","rules":[...]}'
 *
 * Falls back to reasonable defaults if the environment variable is not set.
 */
export function loadRulesFromEnvironment(): AlertRulesConfig {
  const configJson = process.env.ALERT_RULES_CONFIG;

  if (configJson) {
    try {
      return JSON.parse(configJson) as AlertRulesConfig;
    } catch (err) {
      console.warn("Failed to parse ALERT_RULES_CONFIG from environment:", err);
      // Fall through to defaults
    }
  }

  // Default configuration
  return {
    version: "1.0",
    updatedAt: new Date().toISOString(),
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
        } as ThresholdRuleConfig,
        enabled: true,
      },
      {
        id: "cpu-warning",
        type: "threshold",
        name: "CPU Warning",
        metric: "cpu_usage",
        severity: "warning",
        config: {
          threshold: 75,
          direction: "above",
        } as ThresholdRuleConfig,
        enabled: true,
      },
      {
        id: "error-rate-increase",
        type: "rate",
        name: "Error Rate Spike",
        metric: "error_count",
        severity: "critical",
        config: {
          threshold: 10,
          direction: "increase",
        } as RateRuleConfig,
        enabled: true,
      },
    ],
  };
}

import { createLogger } from "@fund-my-cause/shared-utils";

import type { AlertPayload, Transport } from "./alert-transport.js";

const logger = createLogger("monitoring-service:alert-rule");

export interface AlertRuleContext {
  metric: string;
  value: number;
  threshold: number;
  previousValue?: number;
  windowSeconds?: number;
  labels?: Record<string, string>;
}

export interface AlertRuleResult {
  ruleId: string;
  triggered: boolean;
  severity: "critical" | "warning" | "info";
  message: string;
  context: AlertRuleContext;
}

export interface AlertRule {
  readonly ruleId: string;
  evaluate(ctx: AlertRuleContext): AlertRuleResult;
}

export interface ThresholdAlertRuleOptions {
  ruleId: string;
  direction: "above" | "below";
  severity: "critical" | "warning" | "info";
}

export class ThresholdAlertRule implements AlertRule {
  readonly ruleId: string;
  private readonly direction: "above" | "below";
  private readonly severity: "critical" | "warning" | "info";

  constructor(options: ThresholdAlertRuleOptions) {
    this.ruleId = options.ruleId;
    this.direction = options.direction;
    this.severity = options.severity;
  }

  evaluate(ctx: AlertRuleContext): AlertRuleResult {
    const triggered =
      this.direction === "above" ? ctx.value > ctx.threshold : ctx.value < ctx.threshold;

    const message = triggered
      ? `${ctx.metric} is ${ctx.value} (${this.direction} threshold ${ctx.threshold})`
      : `${ctx.metric} is within bounds (${ctx.value} vs threshold ${ctx.threshold})`;

    return {
      ruleId: this.ruleId,
      triggered,
      severity: this.severity,
      message,
      context: ctx,
    };
  }
}

export interface RateAlertRuleOptions {
  ruleId: string;
  direction: "increase" | "decrease";
  severity: "critical" | "warning" | "info";
}

export class RateAlertRule implements AlertRule {
  readonly ruleId: string;
  private readonly direction: "increase" | "decrease";
  private readonly severity: "critical" | "warning" | "info";

  constructor(options: RateAlertRuleOptions) {
    this.ruleId = options.ruleId;
    this.direction = options.direction;
    this.severity = options.severity;
  }

  evaluate(ctx: AlertRuleContext): AlertRuleResult {
    if (ctx.previousValue === undefined || !ctx.windowSeconds || ctx.windowSeconds <= 0) {
      return {
        ruleId: this.ruleId,
        triggered: false,
        severity: this.severity,
        message: `${ctx.metric}: insufficient data for rate calculation (need previousValue and windowSeconds)`,
        context: ctx,
      };
    }

    const ratePerSecond = (ctx.value - ctx.previousValue) / ctx.windowSeconds;
    const triggered =
      this.direction === "increase"
        ? ratePerSecond > ctx.threshold
        : ratePerSecond < -ctx.threshold;

    const direction = this.direction === "increase" ? "increased" : "decreased";
    const message = triggered
      ? `${ctx.metric} ${direction} at ${ratePerSecond.toFixed(4)}/s (threshold ${ctx.threshold}/s)`
      : `${ctx.metric} rate is within bounds (${ratePerSecond.toFixed(4)}/s vs threshold ${ctx.threshold}/s)`;

    return {
      ruleId: this.ruleId,
      triggered,
      severity: this.severity,
      message,
      context: ctx,
    };
  }
}

export interface AlertmanagerAlert {
  status: "firing" | "resolved";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt?: string;
  generatorURL?: string;
  fingerprint?: string;
}

export interface AlertmanagerWebhookPayload {
  version: string;
  groupKey: string;
  status: "firing" | "resolved";
  receiver: string;
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  alerts: AlertmanagerAlert[];
}

export interface EvaluationResult {
  ruleId: string;
  fired: boolean;
  payload?: AlertPayload;
  deliveryResults?: Awaited<ReturnType<Transport["send"]>>;
  error?: string;
}

export interface AlertmanagerRule {
  id: string;
  description: string;
  severity: AlertPayload["severity"];
  matches: (alert: AlertmanagerAlert) => boolean;
  buildMessage: (alert: AlertmanagerAlert) => string;
  buildContext: (alert: AlertmanagerAlert) => Record<string, string>;
}

const DEFAULT_WEBHOOK_RULES: AlertmanagerRule[] = [
  {
    id: "high-error-rate",
    description: "Fires when error rate exceeds threshold",
    severity: "critical",
    matches: (alert) =>
      (alert.labels["alertname"] === "HighErrorRate" ||
        alert.labels["alertname"] === "ErrorRateHigh") &&
      alert.status === "firing",
    buildMessage: (alert) =>
      alert.annotations["description"] ||
      `High error rate detected on ${alert.labels["service"] ?? "unknown service"}`,
    buildContext: (alert) => ({
      service: alert.labels["service"] ?? "",
      instance: alert.labels["instance"] ?? "",
      environment: alert.labels["environment"] ?? "",
      ...(alert.annotations["runbook_url"]
        ? { runbook: alert.annotations["runbook_url"] }
        : {}),
    }),
  },
  {
    id: "service-down",
    description: "Fires when a monitored service is unavailable",
    severity: "critical",
    matches: (alert) =>
      (alert.labels["alertname"] === "ServiceDown" ||
        alert.labels["alertname"] === "InstanceDown") &&
      alert.status === "firing",
    buildMessage: (alert) =>
      alert.annotations["description"] ||
      `Service ${alert.labels["service"] ?? alert.labels["instance"] ?? "unknown"} is down`,
    buildContext: (alert) => ({
      service: alert.labels["service"] ?? "",
      instance: alert.labels["instance"] ?? "",
      job: alert.labels["job"] ?? "",
    }),
  },
  {
    id: "high-latency",
    description: "Fires when p99 latency exceeds the configured SLO",
    severity: "warning",
    matches: (alert) =>
      (alert.labels["alertname"] === "HighLatency" ||
        alert.labels["alertname"] === "SlowRequests") &&
      alert.status === "firing",
    buildMessage: (alert) =>
      alert.annotations["description"] ||
      `High latency detected on ${alert.labels["service"] ?? "unknown service"}`,
    buildContext: (alert) => ({
      service: alert.labels["service"] ?? "",
      quantile: alert.labels["quantile"] ?? "p99",
    }),
  },
  {
    id: "disk-space-low",
    description: "Fires when disk free space falls below threshold",
    severity: "warning",
    matches: (alert) =>
      alert.labels["alertname"] === "DiskSpaceLow" && alert.status === "firing",
    buildMessage: (alert) =>
      alert.annotations["description"] ||
      `Low disk space on ${alert.labels["instance"] ?? "unknown"}`,
    buildContext: (alert) => ({
      instance: alert.labels["instance"] ?? "",
      mountpoint: alert.labels["mountpoint"] ?? "/",
    }),
  },
  {
    id: "catch-all-critical",
    description: "Catch-all for any critical severity alert not matched by a specific rule",
    severity: "critical",
    matches: (alert) =>
      alert.labels["severity"] === "critical" && alert.status === "firing",
    buildMessage: (alert) =>
      alert.annotations["description"] ||
      alert.annotations["summary"] ||
      `Critical alert: ${alert.labels["alertname"] ?? "unknown"}`,
    buildContext: (alert) => ({
      alertname: alert.labels["alertname"] ?? "",
      ...alert.labels,
    }),
  },
];

export class AlertRuleEvaluator {
  private readonly metricRules: AlertRule[];
  private readonly webhookRules: AlertmanagerRule[];
  private readonly transport: Transport | null;

  constructor(rules: AlertRule[], transport: Transport | null);
  constructor(transport: Transport | null, extraRules?: AlertmanagerRule[]);
  constructor(
    rulesOrTransport: AlertRule[] | Transport | null,
    transportOrRules?: Transport | null | AlertmanagerRule[],
  ) {
    if (Array.isArray(rulesOrTransport)) {
      this.metricRules = rulesOrTransport;
      this.webhookRules = [];
      this.transport = (transportOrRules as Transport | null | undefined) ?? null;
      return;
    }

    this.metricRules = [];
    this.webhookRules = [
      ...((transportOrRules as AlertmanagerRule[] | undefined) ?? []),
      ...DEFAULT_WEBHOOK_RULES,
    ];
    this.transport = rulesOrTransport;
  }

  async evaluate(ctx: AlertRuleContext): Promise<AlertRuleResult[]>;
  async evaluate(
    webhookPayload: AlertmanagerWebhookPayload,
  ): Promise<EvaluationResult[]>;
  async evaluate(
    input: AlertRuleContext | AlertmanagerWebhookPayload,
  ): Promise<AlertRuleResult[] | EvaluationResult[]> {
    if (Array.isArray((input as AlertmanagerWebhookPayload).alerts)) {
      return this.evaluateWebhook(input as AlertmanagerWebhookPayload);
    }
    return this.evaluateMetric(input as AlertRuleContext);
  }

  async evaluateAlert(alert: AlertmanagerAlert): Promise<EvaluationResult[]> {
    return this.evaluateWebhook({ alerts: [alert] });
  }

  getRuleIds(): string[] {
    return [
      ...this.webhookRules.map((rule) => rule.id),
      ...this.metricRules.map((rule) => rule.ruleId),
    ];
  }

  private async evaluateMetric(ctx: AlertRuleContext): Promise<AlertRuleResult[]> {
    const results: AlertRuleResult[] = [];

    for (const rule of this.metricRules) {
      const result = rule.evaluate(ctx);
      results.push(result);

      if (result.triggered && this.transport) {
        const payload: AlertPayload = {
          ruleId: result.ruleId,
          severity: result.severity,
          message: result.message,
          context: { ...ctx, ...ctx.labels },
          timestamp: new Date().toISOString(),
        };
        await this.transport.send(payload);
      }
    }

    return results;
  }

  private async evaluateWebhook(
    webhookPayload: Pick<AlertmanagerWebhookPayload, "alerts">,
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const alert of webhookPayload.alerts ?? []) {
      for (const rule of this.webhookRules) {
        let fired = false;
        try {
          fired = rule.matches(alert);
        } catch (error) {
          results.push({
            ruleId: rule.id,
            fired: false,
            error: `Rule.matches() threw: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          continue;
        }

        if (!fired) {
          results.push({ ruleId: rule.id, fired: false });
          continue;
        }

        const payload: AlertPayload = {
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.buildMessage(alert),
          context: rule.buildContext(alert),
          timestamp: alert.startsAt || new Date().toISOString(),
        };

        if (!this.transport) {
          logger.warn(
            { ruleId: rule.id, payload },
            "Alert fired but no transport is configured",
          );
          results.push({ ruleId: rule.id, fired: true, payload });
          continue;
        }

        try {
          const deliveryResults = await this.transport.send(payload);
          results.push({ ruleId: rule.id, fired: true, payload, deliveryResults });
        } catch (error) {
          results.push({
            ruleId: rule.id,
            fired: true,
            payload,
            error: `Delivery failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      }
    }

    return results;
  }
}

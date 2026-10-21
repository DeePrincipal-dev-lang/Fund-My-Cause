import axios, { type AxiosInstance } from "axios";
import { createLogger } from "@fund-my-cause/shared-utils";

const logger = createLogger("monitoring-service:alert-transport");

export interface AlertPayload {
  ruleId: string;
  severity: "critical" | "warning" | "info";
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
}

export interface DeliveryResult {
  channel: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface Transport {
  send(alert: AlertPayload): Promise<DeliveryResult[]>;
}

export type AlertChannel =
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "slack"; webhookUrl: string }
  | { type: "email"; smtpEndpoint: string; to: string; from: string };

export interface AlertTransportConfig {
  channels: AlertChannel[];
  timeoutMs?: number;
}

export class AlertTransport implements Transport {
  private readonly http: AxiosInstance;
  private readonly config: AlertTransportConfig;

  constructor(config: AlertTransportConfig) {
    this.config = config;
    this.http = axios.create({
      timeout: config.timeoutMs ?? 5_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    return Promise.all(
      this.config.channels.map((channel) => this.deliverToChannel(channel, payload)),
    );
  }

  private async deliverToChannel(
    channel: AlertChannel,
    payload: AlertPayload,
  ): Promise<DeliveryResult> {
    try {
      switch (channel.type) {
        case "webhook":
          return await this.deliverWebhook(channel, payload);
        case "slack":
          return await this.deliverSlack(channel, payload);
        case "email":
          return await this.deliverEmail(channel, payload);
        default: {
          const exhaustive: never = channel;
          return {
            channel: (exhaustive as AlertChannel).type,
            success: false,
            error: `Unknown channel type: ${(exhaustive as AlertChannel).type}`,
          };
        }
      }
    } catch (error) {
      logger.error({ err: error, channel: channel.type }, "Alert delivery failed");
      return {
        channel: channel.type,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async deliverWebhook(
    channel: Extract<AlertChannel, { type: "webhook" }>,
    payload: AlertPayload,
  ): Promise<DeliveryResult> {
    const response = await this.http.post(channel.url, payload, {
      headers: channel.headers ?? {},
    });
    return {
      channel: "webhook",
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
    };
  }

  private async deliverSlack(
    channel: Extract<AlertChannel, { type: "slack" }>,
    payload: AlertPayload,
  ): Promise<DeliveryResult> {
    const severityEmoji: Record<AlertPayload["severity"], string> = {
      critical: "🚨",
      warning: "⚠️",
      info: "ℹ️",
    };
    const body = {
      text: `${severityEmoji[payload.severity]} *[${payload.ruleId}]* ${payload.message}`,
      attachments: [
        {
          color:
            payload.severity === "critical"
              ? "danger"
              : payload.severity === "warning"
                ? "warning"
                : "good",
          fields: Object.entries(payload.context).map(([title, value]) => ({
            title,
            value: String(value),
            short: true,
          })),
          footer: `Fund My Cause Monitoring | ${payload.timestamp}`,
        },
      ],
    };
    const response = await this.http.post(channel.webhookUrl, body);
    return {
      channel: "slack",
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
    };
  }

  private async deliverEmail(
    channel: Extract<AlertChannel, { type: "email" }>,
    payload: AlertPayload,
  ): Promise<DeliveryResult> {
    const body = {
      from: channel.from,
      to: channel.to,
      subject: `[${payload.severity.toUpperCase()}] ${payload.ruleId}: ${payload.message}`,
      text: [
        `Alert: ${payload.ruleId}`,
        `Severity: ${payload.severity}`,
        `Time: ${payload.timestamp}`,
        `Message: ${payload.message}`,
        "",
        "Context:",
        ...Object.entries(payload.context).map(([key, value]) => `  ${key}: ${String(value)}`),
      ].join("\n"),
    };
    const response = await this.http.post(channel.smtpEndpoint, body);
    return {
      channel: "email",
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
    };
  }
}

export function buildAlertTransportFromEnv(): AlertTransport | null {
  const channels: AlertChannel[] = [];

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    channels.push({ type: "webhook", url: webhookUrl });
  }

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhookUrl) {
    channels.push({ type: "slack", webhookUrl: slackWebhookUrl });
  }

  const smtpEndpoint = process.env.EMAIL_SMTP_ENDPOINT;
  const emailFrom = process.env.EMAIL_FROM;
  const emailTo = process.env.EMAIL_TO;
  if (smtpEndpoint && emailFrom && emailTo) {
    channels.push({ type: "email", smtpEndpoint, from: emailFrom, to: emailTo });
  }

  if (channels.length === 0) {
    logger.warn(
      "No notification channels configured. Set ALERT_WEBHOOK_URL, SLACK_WEBHOOK_URL, or EMAIL_*.",
    );
    return null;
  }

  return new AlertTransport({ channels });
}

export interface EmailAlertTransportOptions {
  to: string;
  subjectPrefix?: string;
}

export class EmailAlertTransport implements Transport {
  private readonly to: string;
  private readonly subjectPrefix: string;

  constructor(options: EmailAlertTransportOptions) {
    this.to = options.to;
    this.subjectPrefix = options.subjectPrefix ?? "[Alert]";
  }

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    const subject = `${this.subjectPrefix} [${payload.severity.toUpperCase()}] ${payload.message}`;
    const body = [
      `Rule:      ${payload.ruleId}`,
      `Severity:  ${payload.severity}`,
      `Message:   ${payload.message}`,
      `Timestamp: ${payload.timestamp}`,
      `Context:   ${JSON.stringify(payload.context, null, 2)}`,
    ].join("\n");

    logger.info(
      { to: this.to, subject, severity: payload.severity },
      "[EmailAlertTransport] Sending alert email",
    );
    logger.debug({ body }, "[EmailAlertTransport] Alert email body");
    return [{ channel: "email", success: true }];
  }

  async deliver(payload: AlertPayload): Promise<void> {
    await this.send(payload);
  }
}

export interface SlackAlertTransportOptions {
  channel: string;
  webhookUrl?: string;
}

const SEVERITY_EMOJI: Record<AlertPayload["severity"], string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

export class SlackAlertTransport implements Transport {
  private readonly channel: string;
  private readonly webhookUrl: string | undefined;

  constructor(options: SlackAlertTransportOptions) {
    this.channel = options.channel;
    this.webhookUrl = options.webhookUrl;
  }

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    const emoji = SEVERITY_EMOJI[payload.severity];
    const text = [
      `${emoji} *[${payload.severity.toUpperCase()}]* ${payload.message}`,
      `*Rule:* ${payload.ruleId}`,
      `*Time:* ${payload.timestamp}`,
      `*Context:* \`${JSON.stringify(payload.context)}\``,
    ].join("\n");

    if (!this.webhookUrl) {
      logger.info(
        { channel: this.channel, severity: payload.severity },
        "[SlackAlertTransport] Sending alert (simulated)",
      );
      logger.debug({ text }, "[SlackAlertTransport] Slack message body");
      return [{ channel: "slack", success: true }];
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: this.channel, text }),
        signal: AbortSignal.timeout(10_000),
      });
      return [
        {
          channel: "slack",
          success: response.ok,
          statusCode: response.status,
          error: response.ok ? undefined : `Slack delivery failed: HTTP ${response.status}`,
        },
      ];
    } catch (error) {
      return [
        {
          channel: "slack",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }

  async deliver(payload: AlertPayload): Promise<void> {
    const [result] = await this.send(payload);
    if (!result.success) {
      throw new Error(result.error ?? "Slack delivery failed");
    }
  }
}

export class CompositeAlertTransport implements Transport {
  private readonly transports: Transport[];

  constructor(transports: Transport[]) {
    if (transports.length === 0) {
      throw new Error("CompositeAlertTransport requires at least one transport");
    }
    this.transports = transports;
  }

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    const settled = await Promise.allSettled(
      this.transports.map((transport) => transport.send(payload)),
    );

    const results: DeliveryResult[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      } else {
        const message =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.error({ err: result.reason }, "[CompositeAlertTransport] Transport failed");
        results.push({ channel: "unknown", success: false, error: message });
      }
    }
    return results;
  }

  async deliver(payload: AlertPayload): Promise<void> {
    await this.send(payload);
  }
}

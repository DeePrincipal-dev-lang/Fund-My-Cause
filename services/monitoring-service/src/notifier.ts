import type { AlertPayload, DeliveryResult, Transport } from "./alert-transport";

export type NotifierHandler = (alert: AlertPayload) => Promise<void> | void;

export class NotifierTransport implements Transport {
  constructor(
    private readonly channel: string,
    private readonly handler: NotifierHandler,
  ) {}

  async send(alert: AlertPayload): Promise<DeliveryResult[]> {
    try {
      await this.handler(alert);
      return [{ channel: this.channel, success: true }];
    } catch (error) {
      return [
        {
          channel: this.channel,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }
}

export class MockTransport implements Transport {
  public delivered: AlertPayload[] = [];
  public shouldFail = false;

  constructor(private readonly channel = "mock") {}

  async send(payload: AlertPayload): Promise<DeliveryResult[]> {
    if (this.shouldFail) {
      throw new Error(`Transport delivery failed for ${this.channel}`);
    }
    this.delivered.push(payload);
    return [{ channel: this.channel, success: true }];
  }

  clear(): void {
    this.delivered = [];
    this.shouldFail = false;
  }
}

export const emailTransport = new MockTransport("email");
export const slackTransport = new MockTransport("slack");

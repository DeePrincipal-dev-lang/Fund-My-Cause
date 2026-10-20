/**
 * Payment event handlers — Issue #1283
 *
 * Handles payment-related webhook events:
 * - contribution.received
 */

import { WebhookEventType } from "../webhook.service";

export interface PaymentPayload {
  contributionId: string;
  campaignId: string;
  contributorAddress: string;
  amount: number;
  currency: string;
  transactionHash?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export const PAYMENT_EVENTS = new Set<WebhookEventType>([
  "contribution.received",
]);

/**
 * Handle contribution.received event.
 * Triggered when a contribution/payment is confirmed on-chain.
 */
export function handleContributionReceived(payload: PaymentPayload): void {
  if (
    !payload.contributionId ||
    !payload.campaignId ||
    !payload.contributorAddress ||
    payload.amount === undefined
  ) {
    throw new Error(
      "Invalid contribution.received payload: missing required fields",
    );
  }

  if (payload.amount <= 0) {
    throw new Error(
      "Invalid contribution.received payload: amount must be > 0",
    );
  }

  // TODO: Implement contribution received handling logic
}

/**
 * Router function for payment events.
 * Dispatches to appropriate handler based on event type.
 */
export function handlePaymentEvent(
  eventType: WebhookEventType,
  payload: PaymentPayload,
): void {
  switch (eventType) {
    case "contribution.received":
      return handleContributionReceived(payload);
    default:
      throw new Error(`Unknown payment event type: ${eventType}`);
  }
}

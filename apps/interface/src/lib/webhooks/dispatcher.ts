/**
 * Webhook dispatcher — Issue #1283
 *
 * Central dispatcher that routes webhook events to their respective handlers
 * based on event type. Handles unknown/malformed events gracefully.
 */

import { WebhookEventType } from "./webhook.service";
import {
  CAMPAIGN_EVENTS,
  handleCampaignEvent,
  CampaignPayload,
} from "./handlers/campaign";
import {
  PAYMENT_EVENTS,
  handlePaymentEvent,
  PaymentPayload,
} from "./handlers/payment";
import {
  MILESTONE_EVENTS,
  handleMilestoneEvent,
  MilestonePayload,
} from "./handlers/milestone";

export type WebhookPayload =
  | CampaignPayload
  | PaymentPayload
  | MilestonePayload;

export interface DispatcherOptions {
  throwOnUnknown?: boolean;
  logErrors?: boolean;
}

const DEFAULT_OPTIONS: DispatcherOptions = {
  throwOnUnknown: true,
  logErrors: false,
};

/**
 * Dispatch a webhook event to its appropriate handler.
 *
 * @param eventType - The webhook event type
 * @param payload   - The webhook payload
 * @param opts      - Configuration options
 * @throws Error if event type is unknown and throwOnUnknown is true
 */
export function dispatchWebhookEvent(
  eventType: string | WebhookEventType,
  payload: WebhookPayload,
  opts: DispatcherOptions = DEFAULT_OPTIONS,
): void {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // Validate event type is actually a known type
  if (!isValidEventType(eventType)) {
    const error = `Unknown webhook event type: ${eventType}`;
    if (options.logErrors) {
      console.error(error, { payload });
    }
    if (options.throwOnUnknown) {
      throw new Error(error);
    }
    return;
  }

  try {
    // Route to appropriate handler based on event type
    if (CAMPAIGN_EVENTS.has(eventType as WebhookEventType)) {
      handleCampaignEvent(
        eventType as WebhookEventType,
        payload as CampaignPayload,
      );
    } else if (PAYMENT_EVENTS.has(eventType as WebhookEventType)) {
      handlePaymentEvent(
        eventType as WebhookEventType,
        payload as PaymentPayload,
      );
    } else if (MILESTONE_EVENTS.has(eventType as WebhookEventType)) {
      handleMilestoneEvent(
        eventType as WebhookEventType,
        payload as MilestonePayload,
      );
    } else {
      const error = `No handler registered for event type: ${eventType}`;
      if (options.logErrors) {
        console.error(error, { payload });
      }
      if (options.throwOnUnknown) {
        throw new Error(error);
      }
    }
  } catch (error) {
    if (options.logErrors) {
      console.error("Error dispatching webhook event", {
        eventType,
        payload,
        error,
      });
    }
    throw error;
  }
}

/**
 * Check if an event type is valid and registered.
 */
export function isValidEventType(
  eventType: unknown,
): eventType is WebhookEventType {
  if (typeof eventType !== "string") return false;

  return (
    CAMPAIGN_EVENTS.has(eventType as WebhookEventType) ||
    PAYMENT_EVENTS.has(eventType as WebhookEventType) ||
    MILESTONE_EVENTS.has(eventType as WebhookEventType)
  );
}

/**
 * Get all registered event types.
 */
export function getRegisteredEventTypes(): WebhookEventType[] {
  return Array.from(
    new Set<WebhookEventType>([
      ...CAMPAIGN_EVENTS,
      ...PAYMENT_EVENTS,
      ...MILESTONE_EVENTS,
    ]),
  );
}

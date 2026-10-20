/**
 * Milestone event handlers — Issue #1283
 *
 * Handles milestone-related webhook events:
 * - milestone.reached
 */

import { WebhookEventType } from "../webhook.service";

export interface MilestonePayload {
  milestoneId: string;
  campaignId: string;
  percentage: number;
  amount: number;
  currency: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export const MILESTONE_EVENTS = new Set<WebhookEventType>([
  "milestone.reached",
]);

/**
 * Handle milestone.reached event.
 * Triggered when a campaign reaches a funding milestone (25%, 50%, 75%, 100%).
 */
export function handleMilestoneReached(payload: MilestonePayload): void {
  if (
    !payload.milestoneId ||
    !payload.campaignId ||
    payload.percentage === undefined ||
    payload.amount === undefined
  ) {
    throw new Error(
      "Invalid milestone.reached payload: missing required fields",
    );
  }

  if (payload.percentage < 0 || payload.percentage > 100) {
    throw new Error(
      "Invalid milestone.reached payload: percentage must be between 0 and 100",
    );
  }

  if (payload.amount < 0) {
    throw new Error(
      "Invalid milestone.reached payload: amount must be non-negative",
    );
  }

  // TODO: Implement milestone reached handling logic
}

/**
 * Router function for milestone events.
 * Dispatches to appropriate handler based on event type.
 */
export function handleMilestoneEvent(
  eventType: WebhookEventType,
  payload: MilestonePayload,
): void {
  switch (eventType) {
    case "milestone.reached":
      return handleMilestoneReached(payload);
    default:
      throw new Error(`Unknown milestone event type: ${eventType}`);
  }
}

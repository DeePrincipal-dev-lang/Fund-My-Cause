import type pino from "pino";
import type { EventRepository } from "../repository.js";
import { AchievementHandler } from "./crowdfund/achievement.handler.js";
import { CampaignHandler } from "./crowdfund/campaign.handler.js";
import { DonationHandler } from "./crowdfund/donation.handler.js";
import { EventDispatcher } from "./dispatcher.js";
import { AchievementPointsAwardedHandler } from "./achievements/points-awarded.handler.js";
import { AchievementUnlockedHandler } from "./achievements/unlocked.handler.js";
import { QFCalculatedHandler } from "./qf/calculated.handler.js";
import { RegisteredHandler } from "./registry/registered.handler.js";
import type { EventHandler } from "./types.js";

export type HandlerConstructor = new (logger: pino.Logger) => EventHandler;

/**
 * Canonical event-type-to-handler mapping (#1517).
 *
 * Each entry is keyed by the exact `IndexerEvent.type` value that the handler
 * processes. Keeping the mapping here makes the supported event types explicit
 * and lets the indexer build its dispatcher without maintaining a second list
 * of handler instances.
 */
export const EVENT_HANDLER_CONSTRUCTORS = {
  campaign: CampaignHandler,
  donation: DonationHandler,
  achievement: AchievementHandler,
  qf_calc: QFCalculatedHandler,
  ach_unl: AchievementUnlockedHandler,
  ach_pts: AchievementPointsAwardedHandler,
  reg_proj: RegisteredHandler,
} as const satisfies Record<string, HandlerConstructor>;

export type CanonicalEventType = keyof typeof EVENT_HANDLER_CONSTRUCTORS;

/**
 * Instantiate one handler per canonical event type.
 *
 * The runtime `eventType` declared by each handler is checked against its
 * registry key so the mapping and the handler cannot silently drift apart.
 */
export function createHandlers(logger: pino.Logger): EventHandler[] {
  return Object.entries(EVENT_HANDLER_CONSTRUCTORS).map(
    ([eventType, Handler]) => {
      const handler = new Handler(logger);

      if (handler.eventType !== eventType) {
        throw new Error(
          `${Handler.name} declares eventType "${handler.eventType}" but is registered as "${eventType}"`,
        );
      }

      return handler;
    },
  );
}

/**
 * Build the dispatcher from the canonical handler registry.
 *
 * Unknown event types are still persisted with `repository` by the
 * dispatcher's fallback path.
 */
export function createEventDispatcher(
  logger: pino.Logger,
  repository: EventRepository,
): EventDispatcher {
  return new EventDispatcher(createHandlers(logger), repository, logger);
}

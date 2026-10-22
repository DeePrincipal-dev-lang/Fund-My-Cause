import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

/**
 * Handles achievement events emitted by the crowdfund contract.
 *
 * Achievement events are emitted when a contributor earns a badge or
 * milestone reward (e.g. 'first_contribution', 'top_contributor').  Each
 * event carries the contributor address, the achievement type, the badge
 * identifier, and a points value.
 *
 * These events are persisted alongside all other event types so that the
 * /events and /stats endpoints surface them, and so that future consumers
 * (e.g. a gamification dashboard) can query them via the repository interface.
 *
 * Part of the `crowdfund` contract-type module (#1125) — see
 * `services/indexer/src/handlers/index.ts` for the full module layout.
 */
export class AchievementHandler implements EventHandler {
  readonly eventType = "achievement";
  readonly contractType = "crowdfund" as const;

  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Persist a batch of achievement events and log domain-specific diagnostics.
   *
   * @param events     Batch of events whose type is 'achievement'.
   * @param repository Repository instance to store events into.
   */
  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          contributor: event.data["contributor"],
          achievementType: event.data["achievement_type"],
          badge: event.data["badge"],
          points: event.data["points"],
        },
        "AchievementHandler: achievement event ingested",
      );
    }

    this.logger.debug(
      { count: events.length },
      "AchievementHandler: batch stored",
    );
  }
}

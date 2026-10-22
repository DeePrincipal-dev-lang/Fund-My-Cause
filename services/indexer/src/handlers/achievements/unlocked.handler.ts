import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

export class AchievementUnlockedHandler implements EventHandler {
  readonly eventType = "ach_unl";
  readonly contractType = "achievements" as const;
  static readonly aliases: readonly string[] = ["achievement_unlocked", "unlocked"];

  constructor(private readonly logger: pino.Logger) {}

  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          user: event.data["user"],
          achievementType: event.data["achievement_type"],
          pointsEarned: event.data["points_earned"],
        },
        "AchievementUnlockedHandler: achievement event ingested",
      );
    }

    this.logger.debug(
      { count: events.length },
      "AchievementUnlockedHandler: batch stored",
    );
  }
}
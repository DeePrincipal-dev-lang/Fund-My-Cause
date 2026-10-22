import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

export class AchievementPointsAwardedHandler implements EventHandler {
  readonly eventType = "ach_pts";
  readonly contractType = "achievements" as const;
  static readonly aliases: readonly string[] = [
    "achievement_points_awarded",
    "points_awarded",
  ];

  constructor(private readonly logger: pino.Logger) {}

  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          user: event.data["user"],
          points: event.data["points"],
          totalPoints: event.data["total_points"],
        },
        "AchievementPointsAwardedHandler: points event ingested",
      );
    }

    this.logger.debug(
      { count: events.length },
      "AchievementPointsAwardedHandler: batch stored",
    );
  }
}
import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

export class QFCalculatedHandler implements EventHandler {
  readonly eventType = "qf_calc";
  readonly contractType = "qf" as const;
  static readonly aliases: readonly string[] = ["qf_calculated"];

  constructor(private readonly logger: pino.Logger) {}

  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          totalDistributed: event.data["total_distributed"],
          remainingPool: event.data["remaining_pool"],
          recipientsFunded: event.data["recipients_funded"],
        },
        "QFCalculatedHandler: quadratic funding event ingested",
      );
    }

    this.logger.debug({ count: events.length }, "QFCalculatedHandler: batch stored");
  }
}
import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

/**
 * Handles campaign lifecycle events emitted by the crowdfund contract.
 *
 * Campaign events are emitted when a new campaign is created or when campaign
 * metadata is updated (title, description, social links).  Each event carries
 * the creator address, the funding goal, the deadline, the token address, and
 * the minimum contribution amount.
 *
 * This handler persists campaign events to the repository and emits
 * domain-specific log entries so operators can monitor campaign creation
 * activity without tailing raw event logs.
 *
 * Part of the `crowdfund` contract-type module (#1125) — see
 * `services/indexer/src/handlers/index.ts` for the full module layout.
 */
export class CampaignHandler implements EventHandler {
  readonly eventType = "campaign";
  readonly contractType = "crowdfund" as const;

  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Persist a batch of campaign events and log domain-specific diagnostics.
   *
   * @param events     Batch of events whose type is 'campaign'.
   * @param repository Repository instance to store events into.
   */
  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          creator: event.data["creator"],
          title: event.data["title"],
          goal: event.data["goal"],
          deadline: event.data["deadline"],
        },
        "CampaignHandler: campaign event ingested",
      );
    }

    this.logger.debug(
      { count: events.length },
      "CampaignHandler: batch stored",
    );
  }
}

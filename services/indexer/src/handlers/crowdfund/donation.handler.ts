import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

/**
 * Handles donation/contribution events emitted by the crowdfund contract.
 *
 * The primary event type is 'donation', which is emitted when a contributor
 * pledges tokens to a campaign.  For backward compatibility with the Soroban
 * contract's original 'Contribute' event name (used before the event taxonomy
 * was normalised), this handler also declares 'donation' as its canonical
 * type and the dispatcher maps 'Contribute' events here via an alias.
 *
 * Each event carries the contributor address, the amount pledged in stroops,
 * and a running total_raised figure for the campaign.
 *
 * Part of the `crowdfund` contract-type module (#1125) — see
 * `services/indexer/src/handlers/index.ts` for the full module layout.
 */
export class DonationHandler implements EventHandler {
  readonly eventType = "donation";
  readonly contractType = "crowdfund" as const;

  /**
   * Backward-compatibility alias: the Soroban contract originally emitted
   * 'Contribute' events before the event taxonomy was normalised to 'donation'.
   * The EventDispatcher checks this list when routing unknown event types so
   * that legacy 'Contribute' events are still handled here.
   */
  static readonly aliases: readonly string[] = ["Contribute"];

  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Persist a batch of donation/contribution events and log domain-specific
   * diagnostics, including the total contributed amount when available.
   *
   * @param events     Batch of events whose type is 'donation' or 'Contribute'.
   * @param repository Repository instance to store events into.
   */
  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    // Sum up all amounts in this batch for a useful aggregate log line.
    let batchTotal = BigInt(0);
    let parseable = true;

    for (const event of events) {
      const amount = event.data["amount"];
      if (typeof amount === "string") {
        try {
          batchTotal += BigInt(amount);
        } catch {
          parseable = false;
        }
      } else {
        parseable = false;
      }

      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          contributor: event.data["contributor"],
          amount: event.data["amount"],
          totalRaised: event.data["total_raised"],
        },
        "DonationHandler: donation event ingested",
      );
    }

    this.logger.debug(
      {
        count: events.length,
        batchTotal: parseable ? batchTotal.toString() : "n/a",
      },
      "DonationHandler: batch stored",
    );
  }
}

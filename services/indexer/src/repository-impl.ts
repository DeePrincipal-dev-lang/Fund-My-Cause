/**
 * Repository implementations backed by the in-memory EventStore (#898).
 *
 * `EventStoreRepository` satisfies EventRepository, CampaignRepository, and
 * ContributionRepository by delegating to the existing EventStore API.
 *
 * Handlers MUST depend on the repository interfaces, not on EventStore
 * directly, so the storage layer can be swapped without touching handler code.
 */

import type pino from "pino";
import { EventStore } from "./event-store.js";
import type {
  EventRepository,
  CampaignRepository,
  ContributionRepository,
} from "./repository.js";
import type { IndexerEvent } from "./rpc-client.js";

/** Event type emitted by the crowdfund contract for a contribution. */
const CONTRIBUTION_EVENT_TYPE = "Contribute";

/**
 * Single class that satisfies all three repository interfaces for the
 * current in-memory EventStore storage layer.
 *
 * Usage:
 *   const store = new EventStore(logger);
 *   const repo  = new EventStoreRepository(store);
 *   // Pass repo to handlers instead of store.
 */
export class EventStoreRepository
  implements EventRepository, CampaignRepository, ContributionRepository
{
  private readonly store: EventStore;
  private readonly logger: pino.Logger;

  constructor(store: EventStore, logger: pino.Logger) {
    this.store = store;
    this.logger = logger;
  }

  // ── EventRepository ────────────────────────────────────────────────────

  /** @inheritdoc */
  addEvents(events: IndexerEvent[]): void {
    this.store.addEvents(events);
    this.logger.debug(
      { count: events.length, total: this.store.getCount() },
      "EventStoreRepository.addEvents",
    );
  }

  /** @inheritdoc */
  queryByContract(contractId: string, limit = 100): IndexerEvent[] {
    return this.store.queryByContract(contractId, limit);
  }

  /** @inheritdoc */
  queryByType(type: string, limit = 100): IndexerEvent[] {
    return this.store.queryByType(type, limit);
  }

  /** @inheritdoc */
  getAllEvents(limit = 100): IndexerEvent[] {
    return this.store.getAllEvents(limit);
  }

  /** @inheritdoc */
  getCount(): number {
    return this.store.getCount();
  }

  // ── CampaignRepository ─────────────────────────────────────────────────

  /** @inheritdoc */
  getEventsByCampaign(campaignId: string, limit = 100): IndexerEvent[] {
    return this.store.queryByContract(campaignId, limit);
  }

  // ── ContributionRepository ─────────────────────────────────────────────

  /** @inheritdoc */
  getContributionsForCampaign(campaignId: string, limit = 100): IndexerEvent[] {
    return this.store.queryByContractAndType(
      campaignId,
      CONTRIBUTION_EVENT_TYPE,
      limit,
    );
  }
}

/**
 * Unit tests for the indexer repository layer (#898).
 *
 * Tests are split into two parts:
 *
 *  1. Handler-level unit tests that use a mock EventRepository so they are
 *     completely decoupled from EventStore.
 *
 *  2. Integration test verifying that EventStoreRepository satisfies all three
 *     repository interface contracts against a real (in-memory) EventStore.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import pino from "pino";
import type { IndexerEvent } from "./rpc-client.js";
import type {
  EventRepository,
  CampaignRepository,
  ContributionRepository,
} from "./repository.js";
import { EventStoreRepository } from "./repository-impl.js";
import { EventStore } from "./event-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<IndexerEvent> = {}): IndexerEvent {
  return {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    type: "Contribute",
    contractId: "CTEST001",
    data: { contributor: "GWALLET", amount: "1000000000" },
    ...overrides,
  };
}

const silentLogger = pino({ level: "silent" });

// ---------------------------------------------------------------------------
// Mock repository (simulates what a handler unit test would inject)
// ---------------------------------------------------------------------------

function createMockEventRepository(): EventRepository & {
  _events: IndexerEvent[];
} {
  const _events: IndexerEvent[] = [];
  return {
    _events,
    addEvents: vi.fn((events: IndexerEvent[]) => _events.push(...events)),
    queryByContract: vi.fn((id, limit = 100) =>
      _events.filter((e) => e.contractId === id).slice(0, limit),
    ),
    queryByType: vi.fn((type, limit = 100) =>
      _events.filter((e) => e.type === type).slice(0, limit),
    ),
    getAllEvents: vi.fn((limit = 100) => _events.slice(0, limit)),
    getCount: vi.fn(() => _events.length),
  };
}

// ---------------------------------------------------------------------------
// Part 1: Handler unit tests using mock repository
// ---------------------------------------------------------------------------

describe("handler unit tests (mock EventRepository)", () => {
  let repo: ReturnType<typeof createMockEventRepository>;

  beforeEach(() => {
    repo = createMockEventRepository();
  });

  it("addEvents is called with the events batch", () => {
    const events = [makeEvent(), makeEvent()];
    repo.addEvents(events);
    expect(repo.addEvents).toHaveBeenCalledWith(events);
    expect(repo.getCount()).toBe(2);
  });

  it("queryByContract returns only events for the requested contract", () => {
    const e1 = makeEvent({ contractId: "CAMP_A", type: "Contribute" });
    const e2 = makeEvent({ contractId: "CAMP_B", type: "Contribute" });
    repo.addEvents([e1, e2]);
    const results = repo.queryByContract("CAMP_A");
    expect(results).toHaveLength(1);
    expect(results[0].contractId).toBe("CAMP_A");
  });

  it("queryByType returns only events of the requested type", () => {
    const e1 = makeEvent({ type: "Contribute" });
    const e2 = makeEvent({ type: "Withdraw" });
    repo.addEvents([e1, e2]);
    const results = repo.queryByType("Withdraw");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("Withdraw");
  });

  it("getAllEvents respects the limit parameter", () => {
    const events = Array.from({ length: 10 }, () => makeEvent());
    repo.addEvents(events);
    const results = repo.getAllEvents(3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("getCount returns zero for an empty store", () => {
    expect(repo.getCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Part 2: Integration test — EventStoreRepository satisfies the interfaces
// ---------------------------------------------------------------------------

describe("EventStoreRepository integration (real EventStore)", () => {
  let store: EventStore;
  let repoImpl: EventStoreRepository;

  beforeEach(() => {
    store = new EventStore(silentLogger);
    repoImpl = new EventStoreRepository(store, silentLogger);
  });

  // ── EventRepository contract ────────────────────────────────────────────

  describe("satisfies EventRepository", () => {
    it("addEvents persists events retrievable via getAllEvents", () => {
      const events = [
        makeEvent({ contractId: "C1" }),
        makeEvent({ contractId: "C2" }),
      ];
      repoImpl.addEvents(events);
      const all = repoImpl.getAllEvents(100);
      expect(all).toHaveLength(2);
    });

    it("queryByContract filters by contract ID", () => {
      repoImpl.addEvents([
        makeEvent({ contractId: "C1" }),
        makeEvent({ contractId: "C2" }),
        makeEvent({ contractId: "C1" }),
      ]);
      const c1 = repoImpl.queryByContract("C1");
      expect(c1.length).toBe(2);
      expect(c1.every((e) => e.contractId === "C1")).toBe(true);
    });

    it("queryByType filters by event type", () => {
      repoImpl.addEvents([
        makeEvent({ type: "Contribute" }),
        makeEvent({ type: "Withdraw" }),
        makeEvent({ type: "Contribute" }),
      ]);
      const contributions = repoImpl.queryByType("Contribute");
      expect(contributions.length).toBe(2);
      expect(contributions.every((e) => e.type === "Contribute")).toBe(true);
    });

    it("getCount reflects the number of stored events", () => {
      expect(repoImpl.getCount()).toBe(0);
      repoImpl.addEvents([makeEvent(), makeEvent()]);
      expect(repoImpl.getCount()).toBe(2);
    });
  });

  // ── CampaignRepository contract ─────────────────────────────────────────

  describe("satisfies CampaignRepository", () => {
    it("getEventsByCampaign returns events for the campaign contract", () => {
      const campaignId = "CAMPAIGN_CONTRACT_1";
      repoImpl.addEvents([
        makeEvent({ contractId: campaignId }),
        makeEvent({ contractId: "OTHER_CONTRACT" }),
        makeEvent({ contractId: campaignId }),
      ]);
      const events = repoImpl.getEventsByCampaign(campaignId);
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.contractId === campaignId)).toBe(true);
    });

    it("getEventsByCampaign returns empty array for an unknown campaign", () => {
      const events = repoImpl.getEventsByCampaign("UNKNOWN_CAMPAIGN");
      expect(events).toEqual([]);
    });
  });

  // ── ContributionRepository contract ─────────────────────────────────────

  describe("satisfies ContributionRepository", () => {
    it("getContributionsForCampaign returns only Contribute events", () => {
      const campaignId = "CAMP_CONTRIB_1";
      repoImpl.addEvents([
        makeEvent({ contractId: campaignId, type: "Contribute" }),
        makeEvent({ contractId: campaignId, type: "Withdraw" }),
        makeEvent({ contractId: campaignId, type: "Contribute" }),
      ]);
      const contributions = repoImpl.getContributionsForCampaign(campaignId);
      expect(contributions).toHaveLength(2);
      expect(contributions.every((e) => e.type === "Contribute")).toBe(true);
    });

    it("getContributionsForCampaign excludes events from other campaigns", () => {
      const campaignId = "CAMP_CONTRIB_2";
      repoImpl.addEvents([
        makeEvent({ contractId: campaignId, type: "Contribute" }),
        makeEvent({ contractId: "OTHER_CAMP", type: "Contribute" }),
      ]);
      const contributions = repoImpl.getContributionsForCampaign(campaignId);
      expect(contributions).toHaveLength(1);
      expect(contributions[0].contractId).toBe(campaignId);
    });

    it("getContributionsForCampaign respects the limit", () => {
      const campaignId = "CAMP_CONTRIB_3";
      repoImpl.addEvents(
        Array.from({ length: 10 }, () =>
          makeEvent({ contractId: campaignId, type: "Contribute" }),
        ),
      );
      const contributions = repoImpl.getContributionsForCampaign(campaignId, 3);
      expect(contributions.length).toBeLessThanOrEqual(3);
    });

    it("finds contributions even when more recent non-Contribute events for the same campaign outnumber limit*10", () => {
      // Regression test: the old implementation over-fetched
      // queryByContract(campaignId, limit * 10) and filtered by type
      // client-side. With limit=2 that fetches only the 20 most-recent
      // events for the contract — if 20+ newer non-Contribute events exist,
      // the real (older) Contribute events never make it into that window
      // and are silently dropped.
      const campaignId = "CAMP_CONTRIB_4";
      const base = Date.now();

      const contributeEvents = Array.from({ length: 2 }, (_, i) =>
        makeEvent({
          contractId: campaignId,
          type: "Contribute",
          timestamp: base + i, // oldest
        }),
      );
      const noisyEvents = Array.from({ length: 25 }, (_, i) =>
        makeEvent({
          contractId: campaignId,
          type: "Withdraw",
          timestamp: base + 1000 + i, // all newer than the contributions
        }),
      );

      repoImpl.addEvents([...noisyEvents, ...contributeEvents]);

      const contributions = repoImpl.getContributionsForCampaign(campaignId, 2);
      expect(contributions).toHaveLength(2);
      expect(contributions.every((e) => e.type === "Contribute")).toBe(true);
    });
  });
});

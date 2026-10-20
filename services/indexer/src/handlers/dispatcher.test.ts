/**
 * Unit tests for EventDispatcher (#896)
 *
 * Verifies:
 *  - Mixed batches are routed to the correct domain handler
 *  - Unknown event types fall back to the fallback repository (no events lost)
 *  - Backward-compat aliases (e.g. 'Contribute' → DonationHandler) work
 *  - An empty batch is handled without calling any handler
 *  - EventStore end-state is unchanged vs. pre-refactor behavior (all events stored)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import pino from "pino";
import { EventDispatcher } from "./dispatcher.js";
import { CampaignHandler } from "./crowdfund/campaign.handler.js";
import { DonationHandler } from "./crowdfund/donation.handler.js";
import { AchievementHandler } from "./crowdfund/achievement.handler.js";
import { QFCalculatedHandler } from "./qf/calculated.handler.js";
import { AchievementUnlockedHandler } from "./achievements/unlocked.handler.js";
import { AchievementPointsAwardedHandler } from "./achievements/points-awarded.handler.js";
import { RegisteredHandler } from "./registry/registered.handler.js";
import type { EventHandler } from "./types.js";
import type { EventRepository } from "../repository.js";
import type { IndexerEvent } from "../rpc-client.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";
const CONTRACT_B = "CCAMPAIGN222222222222222222222222222222222222222222222";
const CONTRIBUTOR_1 = "GCONTRIB1111111111111111111111111111111111111111111111";

const campaignEvt: IndexerEvent = {
  id: "c-001",
  timestamp: 1_700_000_001,
  type: "campaign",
  contractId: CONTRACT_A,
  data: { creator: "GCREATOR", title: "Test Campaign", goal: "1000" },
};

const donationEvt: IndexerEvent = {
  id: "d-001",
  timestamp: 1_700_000_100,
  type: "donation",
  contractId: CONTRACT_A,
  data: { contributor: CONTRIBUTOR_1, amount: "500000000" },
};

const contributeEvt: IndexerEvent = {
  id: "contrib-001",
  timestamp: 1_700_000_150,
  type: "Contribute", // legacy alias for donation
  contractId: CONTRACT_B,
  data: { contributor: CONTRIBUTOR_1, amount: "1000000000" },
};

const achievementEvt: IndexerEvent = {
  id: "a-001",
  timestamp: 1_700_000_400,
  type: "achievement",
  contractId: CONTRACT_A,
  data: { contributor: CONTRIBUTOR_1, badge: "pioneer" },
};

const unknownEvt: IndexerEvent = {
  id: "u-001",
  timestamp: 1_700_000_500,
  type: "governance_vote", // no registered handler
  contractId: CONTRACT_A,
  data: { proposal: "42" },
};

const newContractEvents: IndexerEvent[] = [
  {
    id: "qf-dispatch-001",
    timestamp: 1_700_000_600_000,
    type: "qf_calc",
    contractId: "CQF111111111111111111111111111111111111111111111111",
    data: { total_distributed: "7500000", remaining_pool: "2500000" },
  },
  {
    id: "achievement-dispatch-001",
    timestamp: 1_700_000_700_000,
    type: "ach_unl",
    contractId: "CACHIEVEMENTS1111111111111111111111111111111111111111",
    data: { user: "GUSER", achievement_type: 2, points_earned: 100 },
  },
  {
    id: "points-dispatch-001",
    timestamp: 1_700_000_800_000,
    type: "ach_pts",
    contractId: "CACHIEVEMENTS1111111111111111111111111111111111111111",
    data: { user: "GUSER", points: 25, total_points: 125 },
  },
  {
    id: "registry-dispatch-001",
    timestamp: 1_700_000_900_000,
    type: "reg_proj",
    contractId: "CREGISTRY1111111111111111111111111111111111111111111",
    data: { project_id: 17, name: "Community Garden" },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockRepository(): EventRepository {
  return {
    addEvents: vi.fn(),
    queryByContract: vi.fn().mockReturnValue([]),
    queryByType: vi.fn().mockReturnValue([]),
    getAllEvents: vi.fn().mockReturnValue([]),
    getCount: vi.fn().mockReturnValue(0),
  };
}

function makeSpyHandler(
  eventType: string,
): EventHandler & { handle: ReturnType<typeof vi.fn> } {
  return {
    eventType,
    handle: vi.fn(),
  };
}

const silentLogger = pino({ level: "silent" });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EventDispatcher — handler routing", () => {
  it("routes canonical QF, achievements, and registry topics to isolated handlers", () => {
    const fallback = makeMockRepository();
    const handlers = [
      new QFCalculatedHandler(silentLogger),
      new AchievementUnlockedHandler(silentLogger),
      new AchievementPointsAwardedHandler(silentLogger),
      new RegisteredHandler(silentLogger),
    ];
    const handlerSpies = handlers.map((handler) =>
      vi.spyOn(handler, "handle"),
    );
    const dispatcher = new EventDispatcher(handlers, fallback, silentLogger);

    dispatcher.dispatch(newContractEvents);

    expect(handlerSpies.map((spy) => spy.mock.calls[0]?.[0])).toEqual(
      newContractEvents.map((event) => [event]),
    );
    expect(fallback.addEvents).not.toHaveBeenCalled();
  });

  it("routes campaign events to the CampaignHandler", () => {
    const campaignHandler = makeSpyHandler("campaign");
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher(
      [campaignHandler],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([campaignEvt]);

    expect(campaignHandler.handle).toHaveBeenCalledOnce();
    const [batch] = (campaignHandler.handle as ReturnType<typeof vi.fn>).mock
      .calls[0] as [IndexerEvent[]];
    expect(batch).toHaveLength(1);
    expect(batch[0]?.id).toBe("c-001");
  });

  it("routes donation events to the DonationHandler", () => {
    const donationHandler = makeSpyHandler("donation");
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher(
      [donationHandler],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([donationEvt]);

    expect(donationHandler.handle).toHaveBeenCalledOnce();
  });

  it("routes achievement events to the AchievementHandler", () => {
    const achievementHandler = makeSpyHandler("achievement");
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher(
      [achievementHandler],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([achievementEvt]);

    expect(achievementHandler.handle).toHaveBeenCalledOnce();
  });

  it("routes a mixed batch — each handler receives only its events", () => {
    const campaignSpy = makeSpyHandler("campaign");
    const donationSpy = makeSpyHandler("donation");
    const achievementSpy = makeSpyHandler("achievement");
    const fallback = makeMockRepository();

    const dispatcher = new EventDispatcher(
      [campaignSpy, donationSpy, achievementSpy],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([campaignEvt, donationEvt, achievementEvt]);

    // Each handler called exactly once with the right subset
    const campaignBatch = (campaignSpy.handle as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as IndexerEvent[];
    expect(campaignBatch).toHaveLength(1);
    expect(campaignBatch[0]?.type).toBe("campaign");

    const donationBatch = (donationSpy.handle as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as IndexerEvent[];
    expect(donationBatch).toHaveLength(1);
    expect(donationBatch[0]?.type).toBe("donation");

    const achievementBatch = (achievementSpy.handle as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0] as IndexerEvent[];
    expect(achievementBatch).toHaveLength(1);
    expect(achievementBatch[0]?.type).toBe("achievement");
  });
});

describe("EventDispatcher — backward-compat alias routing", () => {
  it("routes legacy registry events to the canonical registration handler", () => {
    const fallback = makeMockRepository();
    const registeredHandler = new RegisteredHandler(silentLogger);
    const handleSpy = vi.spyOn(registeredHandler, "handle");
    const legacyEvent: IndexerEvent = {
      id: "registry-legacy-001",
      timestamp: 1_700_000_900_000,
      type: "registered",
      contractId: "CREGISTRY1111111111111111111111111111111111111111111",
      data: { campaign_id: 17 },
    };
    const dispatcher = new EventDispatcher(
      [registeredHandler],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([legacyEvent]);

    expect(handleSpy).toHaveBeenCalledOnce();
    expect(fallback.addEvents).not.toHaveBeenCalled();
  });

  it("routes 'Contribute' events to DonationHandler via alias", () => {
    const fallback = makeMockRepository();
    const donationHandler = new DonationHandler(silentLogger);
    const handleSpy = vi.spyOn(donationHandler, "handle");

    const dispatcher = new EventDispatcher(
      [donationHandler],
      fallback,
      silentLogger,
    );
    dispatcher.dispatch([contributeEvt]);

    expect(handleSpy).toHaveBeenCalledOnce();
    const [batch] = handleSpy.mock.calls[0] as [IndexerEvent[]];
    expect(batch[0]?.type).toBe("Contribute");
  });
});

describe("EventDispatcher — fallback for unknown event types", () => {
  it("routes unknown event types to the fallback repository", () => {
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher([], fallback, silentLogger);

    dispatcher.dispatch([unknownEvt]);

    expect(fallback.addEvents).toHaveBeenCalledOnce();
    const stored = (fallback.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(stored[0]?.id).toBe("u-001");
  });

  it("does not lose unknown events even when known handlers are registered", () => {
    const campaignSpy = makeSpyHandler("campaign");
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher(
      [campaignSpy],
      fallback,
      silentLogger,
    );

    // Mixed: one known + one unknown
    dispatcher.dispatch([campaignEvt, unknownEvt]);

    expect(campaignSpy.handle).toHaveBeenCalledOnce();
    expect(fallback.addEvents).toHaveBeenCalledOnce();
    const fallbackBatch = (fallback.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(fallbackBatch[0]?.id).toBe("u-001");
  });
});

describe("EventDispatcher — empty batch", () => {
  it("does not call any handler on an empty batch", () => {
    const campaignSpy = makeSpyHandler("campaign");
    const fallback = makeMockRepository();
    const dispatcher = new EventDispatcher(
      [campaignSpy],
      fallback,
      silentLogger,
    );

    dispatcher.dispatch([]);

    expect(campaignSpy.handle).not.toHaveBeenCalled();
    expect(fallback.addEvents).not.toHaveBeenCalled();
  });
});

describe("EventDispatcher — integration with real handlers (EventStore end-state)", () => {
  /**
   * Verifies that the dispatcher + real handlers produce the same EventStore
   * state as calling eventRepository.addEvents directly — i.e. the refactor
   * does not change observable behavior.
   */
  it("stores all events identically to the pre-refactor direct addEvents path", () => {
    const allEvents = [
      campaignEvt,
      donationEvt,
      contributeEvt,
      achievementEvt,
      unknownEvt,
    ];

    // --- Pre-refactor path: direct addEvents ---
    const directRepo = makeMockRepository();
    directRepo.addEvents(allEvents);
    const directCall = (directRepo.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];

    // --- Post-refactor path: through dispatcher ---
    const dispatchedIds = new Set<string>();
    const collectingRepo: EventRepository = {
      addEvents: vi.fn((evts: IndexerEvent[]) => {
        evts.forEach((e) => dispatchedIds.add(e.id));
      }),
      queryByContract: vi.fn().mockReturnValue([]),
      queryByType: vi.fn().mockReturnValue([]),
      getAllEvents: vi.fn().mockReturnValue([]),
      getCount: vi.fn().mockReturnValue(0),
    };

    const dispatcher = new EventDispatcher(
      [
        new CampaignHandler(silentLogger),
        new DonationHandler(silentLogger),
        new AchievementHandler(silentLogger),
      ],
      collectingRepo,
      silentLogger,
    );
    dispatcher.dispatch(allEvents);

    // Every event ID from the direct path must appear in the dispatcher path
    const directIds = new Set(directCall.map((e) => e.id));
    expect(dispatchedIds).toEqual(directIds);
  });
});

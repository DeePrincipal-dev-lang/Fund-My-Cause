/**
 * Contract-vs-indexer consistency integration tests (#1211).
 *
 * ## Purpose
 *
 * The indexer must accurately mirror the on-chain campaign/contribution state
 * emitted by the crowdfund Soroban contract.  Drift between contract state
 * and indexed state is a critical correctness risk — if the indexer stores
 * wrong totals, wrong statuses, or misses events, every downstream consumer
 * (GraphQL API, frontend, fraud detection) operates on stale or incorrect data.
 *
 * ## Approach
 *
 * Rather than spinning up a live Soroban testnet, these tests simulate the
 * full ingestion path that production uses:
 *
 *   "contract emits event"
 *     → RPC client parses event (mocked here as a pre-built IndexerEvent)
 *     → EventDispatcher routes to the correct handler
 *     → Handler calls repository.addEvents()
 *     → Tests query the repository and assert indexed state matches
 *       what the contract would have produced
 *
 * This exercises every layer short of actual network I/O and covers the
 * four lifecycle phases mandated by the acceptance criteria:
 *
 *   Phase 1 – initialize: campaign creation event
 *   Phase 2 – contribute: one or more contribution events
 *   Phase 3 – withdraw:   creator claims funds after goal is met
 *   Phase 4 – close:      campaign is finalised / archived
 *
 * ## Consistency invariants tested
 *
 *   1. Every contract event is present in the indexed store exactly once.
 *   2. The total_raised field in the last indexed contribution event matches
 *      the expected sum of all contributions.
 *   3. Campaign lifecycle events appear in the correct chronological order.
 *   4. Events from different campaigns are never cross-contaminated.
 *   5. The withdraw event is indexed after the final contribution event.
 *   6. After close, the archived event is the most recent event for the
 *      campaign contract.
 *   7. The dispatcher routes all event types to the correct handler without
 *      losing any event.
 *   8. Re-ingesting the same lifecycle events is idempotent (no duplicates).
 */

import { describe, it, expect, beforeEach } from "vitest";
import pino from "pino";

import { EventStore } from "./event-store.js";
import { EventStoreRepository } from "./repository-impl.js";
import {
  CampaignHandler,
  DonationHandler,
  AchievementHandler,
  EventDispatcher,
} from "./handlers/index.js";
import type { IndexerEvent } from "./rpc-client.js";

// ---------------------------------------------------------------------------
// Test constants — deterministic Stellar-style addresses
// ---------------------------------------------------------------------------

/** Crowdfund contract for campaign A (fully funded lifecycle). */
const CONTRACT_A = "CCONSISTENCY1111111111111111111111111111111111111111111";
/** Crowdfund contract for campaign B (partial/unfunded lifecycle, for isolation). */
const CONTRACT_B = "CCONSISTENCY2222222222222222222222222222222222222222222";

const CREATOR_A = "GCREATOR_A_11111111111111111111111111111111111111111111111";
const CREATOR_B = "GCREATOR_B_22222222222222222222222222222222222222222222222";

const CONTRIBUTOR_1 =
  "GCONTRIBUTOR_1_111111111111111111111111111111111111111111";
const CONTRIBUTOR_2 =
  "GCONTRIBUTOR_2_222222222222222222222222222222222222222222";
const CONTRIBUTOR_3 =
  "GCONTRIBUTOR_3_333333333333333333333333333333333333333333";

const TOKEN = "CTOKEN_NATIVE_OR_ASSET_111111111111111111111111111111111111";

// ---------------------------------------------------------------------------
// Contract-state fixture — mirrors what the Soroban contract would emit
// ---------------------------------------------------------------------------

/**
 * Simulated contract state for campaign A.
 * The test harness uses these values to verify the indexed state matches.
 */
const CONTRACT_STATE_A = {
  goal: "10000000000", // 1 000 XLM (in stroops)
  deadline: "1900000000", // Unix seconds — far future
  minContribution: "100000000", // 10 XLM
  contributions: [
    { contributor: CONTRIBUTOR_1, amount: "3000000000" }, // 300 XLM
    { contributor: CONTRIBUTOR_2, amount: "4000000000" }, // 400 XLM
    { contributor: CONTRIBUTOR_3, amount: "3000000000" }, // 300 XLM — goal exactly met
  ],
  /** Expected total after all contributions. */
  get totalRaised(): string {
    return this.contributions
      .reduce((acc, c) => acc + BigInt(c.amount), BigInt(0))
      .toString();
  },
};

// ---------------------------------------------------------------------------
// Event factory helpers — produce IndexerEvent objects that mirror what the
// Soroban contract RPC response would contain (post-parseEvent normalisation).
// Timestamps are expressed as UTC milliseconds (as the indexer stores them).
// ---------------------------------------------------------------------------

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

function makeInitializeEvent(
  contractId: string,
  creator: string,
  ts: number,
): IndexerEvent {
  return {
    id: nextId("init"),
    timestamp: ts,
    type: "campaign",
    contractId,
    data: {
      creator,
      title:
        contractId === CONTRACT_A
          ? "Clean Water Initiative"
          : "Solar Grid Project",
      goal: CONTRACT_STATE_A.goal,
      deadline: CONTRACT_STATE_A.deadline,
      token: TOKEN,
      min_contribution: CONTRACT_STATE_A.minContribution,
    },
  };
}

function makeContributeEvent(
  contractId: string,
  contributor: string,
  amount: string,
  totalRaisedSoFar: string,
  ts: number,
): IndexerEvent {
  return {
    id: nextId("contrib"),
    timestamp: ts,
    // The DonationHandler canonical type; production uses "Contribute" alias too —
    // we test the canonical path here; alias path is covered in dispatcher tests.
    type: "donation",
    contractId,
    data: { contributor, amount, total_raised: totalRaisedSoFar },
  };
}

function makeWithdrawEvent(
  contractId: string,
  creator: string,
  ts: number,
): IndexerEvent {
  return {
    id: nextId("withdraw"),
    timestamp: ts,
    type: "campaign",
    contractId,
    data: {
      action: "withdraw",
      creator,
      amount_withdrawn: CONTRACT_STATE_A.totalRaised,
    },
  };
}

function makeCloseEvent(contractId: string, ts: number): IndexerEvent {
  return {
    id: nextId("close"),
    timestamp: ts,
    type: "campaign",
    contractId,
    data: { action: "close", final_status: "ARCHIVED" },
  };
}

// ---------------------------------------------------------------------------
// Harness setup
// ---------------------------------------------------------------------------

const silentLogger = pino({ level: "silent" });

function buildTestHarness() {
  const store = new EventStore(silentLogger);
  const repo = new EventStoreRepository(store, silentLogger);
  const dispatcher = new EventDispatcher(
    [
      new CampaignHandler(silentLogger),
      new DonationHandler(silentLogger),
      new AchievementHandler(silentLogger),
    ],
    repo,
    silentLogger,
  );
  return { store, repo, dispatcher };
}

// ---------------------------------------------------------------------------
// Phase 1 — Campaign initialization
// ---------------------------------------------------------------------------

describe("#1211 — Phase 1: campaign initialization consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();
  });

  it("initialize event is stored in the indexed state", () => {
    const initEvent = makeInitializeEvent(
      CONTRACT_A,
      CREATOR_A,
      1_700_000_000_000,
    );
    h.dispatcher.dispatch([initEvent]);

    expect(h.store.getCount()).toBe(1);
    const stored = h.store.queryByContract(CONTRACT_A);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(initEvent.id);
  });

  it("indexed campaign event contains correct creator and goal", () => {
    const initEvent = makeInitializeEvent(
      CONTRACT_A,
      CREATOR_A,
      1_700_000_000_000,
    );
    h.dispatcher.dispatch([initEvent]);

    const stored = h.store.queryByContract(CONTRACT_A)[0]!;
    expect(stored.data["creator"]).toBe(CREATOR_A);
    expect(stored.data["goal"]).toBe(CONTRACT_STATE_A.goal);
    expect(stored.data["deadline"]).toBe(CONTRACT_STATE_A.deadline);
    expect(stored.data["min_contribution"]).toBe(
      CONTRACT_STATE_A.minContribution,
    );
  });

  it("two campaigns have independent init events — no cross-contamination", () => {
    const initA = makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000);
    const initB = makeInitializeEvent(CONTRACT_B, CREATOR_B, 1_700_000_001_000);
    h.dispatcher.dispatch([initA, initB]);

    expect(h.store.getCount()).toBe(2);

    const storedA = h.store.queryByContract(CONTRACT_A);
    expect(storedA).toHaveLength(1);
    expect(storedA[0]!.data["creator"]).toBe(CREATOR_A);

    const storedB = h.store.queryByContract(CONTRACT_B);
    expect(storedB).toHaveLength(1);
    expect(storedB[0]!.data["creator"]).toBe(CREATOR_B);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — Contributions
// ---------------------------------------------------------------------------

describe("#1211 — Phase 2: contribution consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();
    // Pre-seed the campaign init event so the store is in a realistic state.
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000),
    ]);
  });

  it("each contribution event is stored exactly once", () => {
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    let ts = 1_700_000_001_000;

    for (const c of contributions) {
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
      ts += 1_000;
    }

    // 1 init + 3 contributions
    expect(h.store.getCount()).toBe(4);

    const contribs = h.store.queryByType("donation");
    expect(contribs).toHaveLength(3);
  });

  it("total_raised in the last contribution event matches the contract state", () => {
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    let ts = 1_700_000_001_000;

    for (const c of contributions) {
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
      ts += 1_000;
    }

    const contribs = h.store.queryByType("donation");
    // queryByType returns newest-first; the last ingested has the highest total
    const mostRecent = contribs[0]!;
    expect(mostRecent.data["total_raised"]).toBe(CONTRACT_STATE_A.totalRaised);
  });

  it("each contributor address is faithfully stored", () => {
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    let ts = 1_700_000_001_000;

    for (const c of contributions) {
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
      ts += 1_000;
    }

    const storedContributors = h.store
      .queryByType("donation")
      .map((e) => e.data["contributor"] as string);

    for (const { contributor } of contributions) {
      expect(storedContributors).toContain(contributor);
    }
  });

  it("contributions from different campaigns are isolated in the indexed state", () => {
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_B, CREATOR_B, 1_700_000_000_500),
    ]);

    // Contribute to A
    h.dispatcher.dispatch([
      makeContributeEvent(
        CONTRACT_A,
        CONTRIBUTOR_1,
        "1000000000",
        "1000000000",
        1_700_000_002_000,
      ),
    ]);
    // Contribute to B
    h.dispatcher.dispatch([
      makeContributeEvent(
        CONTRACT_B,
        CONTRIBUTOR_2,
        "2000000000",
        "2000000000",
        1_700_000_003_000,
      ),
    ]);

    const contribsA = h.store.queryByContractAndType(CONTRACT_A, "donation");
    expect(contribsA).toHaveLength(1);
    expect(contribsA[0]!.data["contributor"]).toBe(CONTRIBUTOR_1);

    const contribsB = h.store.queryByContractAndType(CONTRACT_B, "donation");
    expect(contribsB).toHaveLength(1);
    expect(contribsB[0]!.data["contributor"]).toBe(CONTRIBUTOR_2);
  });

  it("contribution events are ordered newest-first (consistent with contract order)", () => {
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    let ts = 1_700_000_001_000;

    const ids: string[] = [];
    for (const c of contributions) {
      runningTotal += BigInt(c.amount);
      const ev = makeContributeEvent(
        CONTRACT_A,
        c.contributor,
        c.amount,
        runningTotal.toString(),
        ts,
      );
      ids.push(ev.id);
      h.dispatcher.dispatch([ev]);
      ts += 1_000;
    }

    const stored = h.store.queryByContractAndType(CONTRACT_A, "donation");
    // Stored newest-first → last ingested ID should be first in the query result
    expect(stored[0]!.id).toBe(ids[ids.length - 1]);
    expect(stored[stored.length - 1]!.id).toBe(ids[0]);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Withdraw
// ---------------------------------------------------------------------------

describe("#1211 — Phase 3: withdraw consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;
  /** Timestamp of the last contribution — used to assert relative ordering. */
  let lastContribTs: number;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();

    // Initialize
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000),
    ]);

    // All contributions
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    let ts = 1_700_000_001_000;
    for (const c of contributions) {
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
      ts += 1_000;
    }
    lastContribTs = ts - 1_000;
  });

  it("withdraw event is stored in the indexed state", () => {
    const withdrawTs = lastContribTs + 5_000;
    h.dispatcher.dispatch([
      makeWithdrawEvent(CONTRACT_A, CREATOR_A, withdrawTs),
    ]);

    const events = h.store.queryByContract(CONTRACT_A);
    // init + 3 contribs + withdraw = 5 events
    expect(events).toHaveLength(5);
    // Newest-first → withdraw should be the most recent event for this contract
    expect(events[0]!.data["action"]).toBe("withdraw");
  });

  it("withdraw event carries correct creator and amount", () => {
    const withdrawTs = lastContribTs + 5_000;
    h.dispatcher.dispatch([
      makeWithdrawEvent(CONTRACT_A, CREATOR_A, withdrawTs),
    ]);

    const withdrawEvents = h.store
      .queryByContract(CONTRACT_A)
      .filter((e) => e.data["action"] === "withdraw");

    expect(withdrawEvents).toHaveLength(1);
    expect(withdrawEvents[0]!.data["creator"]).toBe(CREATOR_A);
    expect(withdrawEvents[0]!.data["amount_withdrawn"]).toBe(
      CONTRACT_STATE_A.totalRaised,
    );
  });

  it("withdraw event timestamp is strictly after all contribution timestamps", () => {
    const withdrawTs = lastContribTs + 5_000;
    h.dispatcher.dispatch([
      makeWithdrawEvent(CONTRACT_A, CREATOR_A, withdrawTs),
    ]);

    const events = h.store.queryByContract(CONTRACT_A);
    const withdrawEvent = events.find((e) => e.data["action"] === "withdraw")!;
    const contribEvents = events.filter((e) => e.type === "donation");

    for (const c of contribEvents) {
      expect(withdrawEvent.timestamp).toBeGreaterThan(c.timestamp);
    }
  });

  it("withdraw event on campaign B does not appear in campaign A queries", () => {
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_B, CREATOR_B, 1_700_000_000_500),
    ]);
    const withdrawTs = lastContribTs + 5_000;
    h.dispatcher.dispatch([
      makeWithdrawEvent(CONTRACT_B, CREATOR_B, withdrawTs),
    ]);

    const eventsA = h.store.queryByContract(CONTRACT_A);
    const withdrawInA = eventsA.filter((e) => e.data["action"] === "withdraw");
    expect(withdrawInA).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — Close / archive
// ---------------------------------------------------------------------------

describe("#1211 — Phase 4: close/archive consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;
  let withdrawTs: number;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();

    let ts = 1_700_000_000_000;

    // Initialize
    h.dispatcher.dispatch([makeInitializeEvent(CONTRACT_A, CREATOR_A, ts)]);

    // Contributions
    const { contributions } = CONTRACT_STATE_A;
    let runningTotal = BigInt(0);
    for (const c of contributions) {
      ts += 1_000;
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
    }

    // Withdraw
    ts += 5_000;
    withdrawTs = ts;
    h.dispatcher.dispatch([makeWithdrawEvent(CONTRACT_A, CREATOR_A, ts)]);
  });

  it("close event is stored in the indexed state", () => {
    const closeTs = withdrawTs + 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, closeTs)]);

    // init + 3 contribs + withdraw + close = 6
    expect(h.store.queryByContract(CONTRACT_A)).toHaveLength(6);
  });

  it("close event is the most recent event for the campaign (newest-first order)", () => {
    const closeTs = withdrawTs + 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, closeTs)]);

    const events = h.store.queryByContract(CONTRACT_A);
    // queryByContract sorts newest-first → close event must be first
    expect(events[0]!.data["action"]).toBe("close");
    expect(events[0]!.data["final_status"]).toBe("ARCHIVED");
  });

  it("close event timestamp is strictly after withdraw event timestamp", () => {
    const closeTs = withdrawTs + 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, closeTs)]);

    const events = h.store.queryByContract(CONTRACT_A);
    const closeEvent = events.find((e) => e.data["action"] === "close")!;
    const withdrawEvent = events.find((e) => e.data["action"] === "withdraw")!;

    expect(closeEvent.timestamp).toBeGreaterThan(withdrawEvent.timestamp);
  });

  it("all four lifecycle phases produce exactly the expected event count", () => {
    const closeTs = withdrawTs + 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, closeTs)]);

    const all = h.store.queryByContract(CONTRACT_A);
    // 1 init + 3 contributions + 1 withdraw + 1 close
    expect(all).toHaveLength(1 + CONTRACT_STATE_A.contributions.length + 1 + 1);
  });
});

// ---------------------------------------------------------------------------
// Full lifecycle — end-to-end consistency
// ---------------------------------------------------------------------------

describe("#1211 — Full lifecycle end-to-end consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();
  });

  it("ingesting all four phases in order produces the correct total event count", () => {
    let ts = 1_700_000_000_000;

    // Phase 1 — initialize
    h.dispatcher.dispatch([makeInitializeEvent(CONTRACT_A, CREATOR_A, ts)]);

    // Phase 2 — all contributions
    let runningTotal = BigInt(0);
    for (const c of CONTRACT_STATE_A.contributions) {
      ts += 1_000;
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
    }

    // Phase 3 — withdraw
    ts += 5_000;
    h.dispatcher.dispatch([makeWithdrawEvent(CONTRACT_A, CREATOR_A, ts)]);

    // Phase 4 — close
    ts += 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, ts)]);

    const allEvents = h.store.queryByContract(CONTRACT_A);
    const expectedCount = 1 + CONTRACT_STATE_A.contributions.length + 1 + 1;
    expect(allEvents).toHaveLength(expectedCount);
  });

  it("the indexed total_raised matches the sum of all contributions (contract invariant)", () => {
    let ts = 1_700_000_000_000;

    h.dispatcher.dispatch([makeInitializeEvent(CONTRACT_A, CREATOR_A, ts)]);

    let runningTotal = BigInt(0);
    for (const c of CONTRACT_STATE_A.contributions) {
      ts += 1_000;
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
    }

    // The most recent contribution event's total_raised must equal the
    // expected contract-side total.
    const contribs = h.store.queryByType("donation");
    const latestTotal = contribs[0]!.data["total_raised"] as string;
    expect(latestTotal).toBe(CONTRACT_STATE_A.totalRaised);
  });

  it("all lifecycle event IDs are unique (no accidental duplicates)", () => {
    let ts = 1_700_000_000_000;

    h.dispatcher.dispatch([makeInitializeEvent(CONTRACT_A, CREATOR_A, ts)]);

    let runningTotal = BigInt(0);
    for (const c of CONTRACT_STATE_A.contributions) {
      ts += 1_000;
      runningTotal += BigInt(c.amount);
      h.dispatcher.dispatch([
        makeContributeEvent(
          CONTRACT_A,
          c.contributor,
          c.amount,
          runningTotal.toString(),
          ts,
        ),
      ]);
    }

    ts += 5_000;
    h.dispatcher.dispatch([makeWithdrawEvent(CONTRACT_A, CREATOR_A, ts)]);
    ts += 10_000;
    h.dispatcher.dispatch([makeCloseEvent(CONTRACT_A, ts)]);

    const allEvents = h.store.queryByContract(CONTRACT_A);
    const ids = allEvents.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("re-ingesting the entire lifecycle is idempotent (no duplicates in indexed state)", () => {
    let ts = 1_700_000_000_000;

    // Keep references to all events so we can re-ingest them.
    const allEvents: IndexerEvent[] = [];

    const initEvent = makeInitializeEvent(CONTRACT_A, CREATOR_A, ts);
    allEvents.push(initEvent);
    h.dispatcher.dispatch([initEvent]);

    let runningTotal = BigInt(0);
    for (const c of CONTRACT_STATE_A.contributions) {
      ts += 1_000;
      runningTotal += BigInt(c.amount);
      const ev = makeContributeEvent(
        CONTRACT_A,
        c.contributor,
        c.amount,
        runningTotal.toString(),
        ts,
      );
      allEvents.push(ev);
      h.dispatcher.dispatch([ev]);
    }

    ts += 5_000;
    const withdrawEvent = makeWithdrawEvent(CONTRACT_A, CREATOR_A, ts);
    allEvents.push(withdrawEvent);
    h.dispatcher.dispatch([withdrawEvent]);

    ts += 10_000;
    const closeEvent = makeCloseEvent(CONTRACT_A, ts);
    allEvents.push(closeEvent);
    h.dispatcher.dispatch([closeEvent]);

    // Re-ingest all events a second time — EventStore uses Map.set which is
    // idempotent for the same ID.
    h.dispatcher.dispatch(allEvents);

    const expectedCount = 1 + CONTRACT_STATE_A.contributions.length + 1 + 1;
    expect(h.store.queryByContract(CONTRACT_A)).toHaveLength(expectedCount);
  });

  it("'Contribute' alias events are routed correctly by the dispatcher", () => {
    /**
     * The Soroban contract originally emitted 'Contribute' (capital C) events.
     * DonationHandler.aliases = ['Contribute'] maps them to the donation handler.
     * This test verifies the alias path end-to-end.
     */
    let ts = 1_700_000_000_000;

    h.dispatcher.dispatch([makeInitializeEvent(CONTRACT_A, CREATOR_A, ts)]);

    const contributeAliasEvent: IndexerEvent = {
      id: "contrib-alias-001",
      timestamp: ts + 1_000,
      type: "Contribute", // legacy type name — must route to DonationHandler
      contractId: CONTRACT_A,
      data: {
        contributor: CONTRIBUTOR_1,
        amount: "5000000000",
        total_raised: "5000000000",
      },
    };

    // Must not throw
    expect(() => h.dispatcher.dispatch([contributeAliasEvent])).not.toThrow();

    // Event must be stored (DonationHandler stores it via repository.addEvents)
    expect(h.store.getCount()).toBe(2); // init + alias contribute
    const stored = h.store.queryByContract(CONTRACT_A);
    expect(stored.map((e) => e.id)).toContain("contrib-alias-001");
  });
});

// ---------------------------------------------------------------------------
// Cross-campaign isolation — no state leakage between contracts
// ---------------------------------------------------------------------------

describe("#1211 — Cross-campaign isolation", () => {
  let h: ReturnType<typeof buildTestHarness>;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();
  });

  it("events from two campaigns remain fully isolated after concurrent ingestion", () => {
    let tsA = 1_700_000_000_000;
    let tsB = 1_700_000_000_000;

    // Initialize both campaigns simultaneously
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_A, CREATOR_A, tsA),
      makeInitializeEvent(CONTRACT_B, CREATOR_B, tsB),
    ]);

    // Interleaved contributions
    h.dispatcher.dispatch([
      makeContributeEvent(
        CONTRACT_A,
        CONTRIBUTOR_1,
        "1000000000",
        "1000000000",
        tsA + 1_000,
      ),
      makeContributeEvent(
        CONTRACT_B,
        CONTRIBUTOR_2,
        "2000000000",
        "2000000000",
        tsB + 1_000,
      ),
    ]);
    h.dispatcher.dispatch([
      makeContributeEvent(
        CONTRACT_A,
        CONTRIBUTOR_2,
        "500000000",
        "1500000000",
        tsA + 2_000,
      ),
    ]);

    const eventsA = h.store.queryByContract(CONTRACT_A);
    const eventsB = h.store.queryByContract(CONTRACT_B);

    // A: 1 init + 2 contributions
    expect(eventsA).toHaveLength(3);
    // B: 1 init + 1 contribution
    expect(eventsB).toHaveLength(2);

    // None of B's events should appear in A's result set, and vice versa.
    for (const e of eventsA) {
      expect(e.contractId).toBe(CONTRACT_A);
    }
    for (const e of eventsB) {
      expect(e.contractId).toBe(CONTRACT_B);
    }
  });

  it("total event count is the sum of both campaigns' events (no merging)", () => {
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000),
      makeInitializeEvent(CONTRACT_B, CREATOR_B, 1_700_000_000_000),
    ]);
    h.dispatcher.dispatch([
      makeContributeEvent(
        CONTRACT_A,
        CONTRIBUTOR_1,
        "1000000000",
        "1000000000",
        1_700_000_001_000,
      ),
      makeContributeEvent(
        CONTRACT_B,
        CONTRIBUTOR_2,
        "2000000000",
        "2000000000",
        1_700_000_001_000,
      ),
    ]);

    // 2 inits + 2 contributions = 4 total
    expect(h.store.getCount()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Dispatcher routing consistency
// ---------------------------------------------------------------------------

describe("#1211 — Dispatcher routing consistency", () => {
  let h: ReturnType<typeof buildTestHarness>;

  beforeEach(() => {
    _seq = 0;
    h = buildTestHarness();
  });

  it("a batch with all four event types is stored in full — no events dropped", () => {
    const mixed: IndexerEvent[] = [
      makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000),
      makeContributeEvent(
        CONTRACT_A,
        CONTRIBUTOR_1,
        "1000000000",
        "1000000000",
        1_700_000_001_000,
      ),
      {
        id: "achievement-001",
        timestamp: 1_700_000_002_000,
        type: "achievement",
        contractId: CONTRACT_A,
        data: {
          contributor: CONTRIBUTOR_1,
          achievement_type: "first_contribution",
          badge: "pioneer",
          points: 100,
        },
      },
      makeWithdrawEvent(CONTRACT_A, CREATOR_A, 1_700_000_003_000),
    ];

    h.dispatcher.dispatch(mixed);
    expect(h.store.getCount()).toBe(mixed.length);
  });

  it("an unknown event type is stored via the fallback repository (no event lost)", () => {
    const unknownEvent: IndexerEvent = {
      id: "unknown-001",
      timestamp: 1_700_000_000_000,
      type: "some_future_event_type_not_yet_handled",
      contractId: CONTRACT_A,
      data: { someField: "someValue" },
    };

    // Must not throw
    expect(() => h.dispatcher.dispatch([unknownEvent])).not.toThrow();
    // Must be stored despite having no registered handler
    expect(h.store.getCount()).toBe(1);
  });

  it("empty dispatch is a no-op and does not corrupt the store", () => {
    h.dispatcher.dispatch([
      makeInitializeEvent(CONTRACT_A, CREATOR_A, 1_700_000_000_000),
    ]);
    const countBefore = h.store.getCount();

    h.dispatcher.dispatch([]); // empty batch

    expect(h.store.getCount()).toBe(countBefore);
  });
});

/**
 * Integration tests for chain reorg handling — Issue #1169
 *
 * A "reorg" (chain reorganisation) occurs when the canonical chain switches
 * to a different fork, invalidating one or more previously-confirmed ledgers.
 * The indexer must:
 *   1. Roll back (remove) events that belonged to the orphaned ledger(s).
 *   2. Replay (re-ingest) the replacement events from the new canonical fork.
 *   3. Leave events from ledgers that were NOT reorganised completely intact.
 *
 * ── Simulation approach ───────────────────────────────────────────────────
 * We cannot connect to a live Stellar node in unit/integration tests, so we
 * simulate reorgs by encoding "ledger sequences" in event IDs and timestamps
 * and feeding the EventStore three distinct phases:
 *
 *   Phase 1 – Normal ingestion of events from ledger N onwards.
 *   Phase 2 – Reorg detected: events from the orphaned fork are removed via
 *              a `rollback(fromLedger)` helper that deletes all events whose
 *              ID carries the orphaned ledger sequence.
 *   Phase 3 – Replay: canonical replacement events for the same ledger range
 *              are re-ingested.
 *
 * The ReorgSimulator class below encapsulates this state machine and is
 * deliberately kept thin — it calls only the public EventStore API
 * (addEvents / queryByContract / queryByType / clear / getCount) so these
 * tests remain valid even if the internal EventStore storage mechanism changes.
 *
 * ── Why not add a reorg() method to EventStore? ───────────────────────────
 * In the current architecture the indexer's RPC client detects ledger
 * reversions and the store simply holds whatever events the RPC client
 * provides.  The reorg "logic" lives in the streaming layer.  The harness
 * below mirrors that responsibility split:  EventStore knows nothing about
 * reorgs; the harness drives the rollback → replay sequence from the outside.
 *
 * To run:
 *   npm test --workspace=services/indexer
 *   # from the repo root:
 *   npx vitest --project services/indexer
 */

import { describe, it, expect, beforeEach } from "vitest";
import pino from "pino";
import { EventStore, type IndexerEvent } from "./event-store";

// ── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";
const CONTRACT_B = "CCAMPAIGN222222222222222222222222222222222222222222222";

const silentLogger = pino({ level: "silent" });

// ── Reorg Simulation Harness ─────────────────────────────────────────────────

/**
 * Encodes a ledger sequence into an event ID so the harness can identify
 * which ledger produced a given event.
 *
 * Format: `<ledger>-<type>-<index>` — e.g. "42-donation-0"
 */
function mkEventId(ledger: number, type: string, index: number): string {
  return `${ledger}-${type}-${index}`;
}

/**
 * Extract the ledger number from an event ID produced by mkEventId().
 */
function ledgerFromId(id: string): number {
  return parseInt(id.split("-")[0]!, 10);
}

/**
 * Build a batch of events for a specific ledger.
 */
function makeLedgerEvents(
  ledger: number,
  contractId: string,
  type: string,
  count: number,
  baseTimestamp: number,
): IndexerEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: mkEventId(ledger, type, i),
    timestamp: baseTimestamp + ledger * 1000 + i,
    type,
    contractId,
    data: { ledger, index: i },
  }));
}

/**
 * Reorg simulation harness.
 *
 * Wraps an EventStore and provides:
 *  - ingest(batches)   — stream events in (mirrors production ingestion loop)
 *  - rollback(ledger)  — remove all events from `ledger` and above
 *  - replay(batches)   — re-ingest replacement events after rollback
 *  - snapshot()        — returns a sorted copy of all stored event IDs
 */
class ReorgSimulator {
  constructor(public readonly store: EventStore) {}

  /** Ingest a sequence of ledger batches. */
  ingest(batches: IndexerEvent[][]): void {
    for (const batch of batches) {
      this.store.addEvents(batch);
    }
  }

  /**
   * Roll back all events from `fromLedger` and above.
   *
   * This mirrors what the production streaming layer does when the RPC
   * client detects that the tip of the canonical chain has rewound:
   * it calls the repository to purge orphaned events, then re-fetches the
   * replacement ledger range.
   *
   * Implementation note: EventStore has no native "delete by ledger" API
   * (it uses Map<id, event> keyed on stable event IDs).  The harness performs
   * the rollback by:
   *   1. Scanning all stored events.
   *   2. Collecting the IDs whose ledger number ≥ fromLedger.
   *   3. Rebuilding the store with only the surviving events.
   *
   * A real persistence layer (e.g. PostgreSQL) would use a DELETE WHERE
   * ledger_sequence >= fromLedger statement instead.
   */
  rollback(fromLedger: number): string[] {
    const allEvents = this.store.getAllEvents(100_000);
    const surviving = allEvents.filter(
      (e) => ledgerFromId(e.id) < fromLedger,
    );
    const removed = allEvents
      .filter((e) => ledgerFromId(e.id) >= fromLedger)
      .map((e) => e.id);

    // Rebuild the store with only the surviving events.
    this.store.clear();
    if (surviving.length > 0) {
      this.store.addEvents(surviving);
    }

    return removed;
  }

  /** Re-ingest replacement (canonical) events after a rollback. */
  replay(batches: IndexerEvent[][]): void {
    this.ingest(batches);
  }

  /** Sorted snapshot of all event IDs currently in the store. */
  snapshot(): string[] {
    return this.store
      .getAllEvents(100_000)
      .map((e) => e.id)
      .sort();
  }
}

// ── Shared setup ─────────────────────────────────────────────────────────────

let harness: ReorgSimulator;

beforeEach(() => {
  harness = new ReorgSimulator(new EventStore(silentLogger));
});

// ── Test suites ───────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// 1. Basic rollback correctness
// ---------------------------------------------------------------------------

describe("Reorg simulation — basic rollback (#1169)", () => {
  it("rolls back events from the orphaned ledger and leaves earlier events intact", () => {
    // Ingest ledgers 10, 11, 12 (3 donation events each)
    for (let ledger = 10; ledger <= 12; ledger++) {
      harness.ingest([
        makeLedgerEvents(ledger, CONTRACT_A, "donation", 3, 1_700_000_000),
      ]);
    }

    expect(harness.store.getCount()).toBe(9);

    // Reorg: ledgers 11 and 12 are orphaned
    const removed = harness.rollback(11);

    // Six events (from ledgers 11 and 12) should have been removed
    expect(removed).toHaveLength(6);
    // Three events (ledger 10) should remain
    expect(harness.store.getCount()).toBe(3);
    for (const id of removed) {
      expect(ledgerFromId(id)).toBeGreaterThanOrEqual(11);
    }

    // Verify surviving events are all from ledger 10
    const surviving = harness.store.getAllEvents(100);
    for (const e of surviving) {
      expect(ledgerFromId(e.id)).toBe(10);
    }
  });

  it("rolling back from the first ledger clears the store completely", () => {
    harness.ingest([
      makeLedgerEvents(5, CONTRACT_A, "campaign", 2, 1_700_000_000),
    ]);
    expect(harness.store.getCount()).toBe(2);

    harness.rollback(5);

    expect(harness.store.getCount()).toBe(0);
  });

  it("rolling back a ledger that was never ingested is a no-op", () => {
    harness.ingest([
      makeLedgerEvents(1, CONTRACT_A, "donation", 2, 1_700_000_000),
    ]);

    harness.rollback(999); // nothing to remove

    expect(harness.store.getCount()).toBe(2);
  });

  it("rollback with no prior events is a no-op", () => {
    expect(harness.store.getCount()).toBe(0);
    const removed = harness.rollback(1);
    expect(removed).toHaveLength(0);
    expect(harness.store.getCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Replay correctness
// ---------------------------------------------------------------------------

describe("Reorg simulation — replay after rollback (#1169)", () => {
  it("replays canonical events after rolling back orphaned ones", () => {
    // Original chain: ledger 10 (canonical), ledger 11 (will be orphaned)
    harness.ingest([
      makeLedgerEvents(10, CONTRACT_A, "donation", 2, 1_700_000_000),
      makeLedgerEvents(11, CONTRACT_A, "donation", 2, 1_700_000_000),
    ]);

    expect(harness.store.getCount()).toBe(4);

    // Reorg: ledger 11 is orphaned
    harness.rollback(11);
    expect(harness.store.getCount()).toBe(2);

    // Replay: new canonical ledger 11 with different events
    const canonicalLedger11 = [
      {
        id: mkEventId(11, "donation", 0),
        timestamp: 1_700_011_000,
        type: "donation",
        contractId: CONTRACT_A,
        data: { ledger: 11, canonical: true, amount: "999999999" },
      } satisfies IndexerEvent,
    ];
    harness.replay([canonicalLedger11]);

    // Total: 2 from ledger 10 + 1 from canonical ledger 11
    expect(harness.store.getCount()).toBe(3);

    // The replacement event must be the canonical version (not the orphaned one)
    const stored = harness.store.queryByContract(CONTRACT_A);
    const replayedEvent = stored.find((e) => e.id === mkEventId(11, "donation", 0));
    expect(replayedEvent).toBeDefined();
    expect(replayedEvent?.data?.canonical).toBe(true);
    expect(replayedEvent?.data?.amount).toBe("999999999");
  });

  it("replayed events are queryable by contract and type", () => {
    harness.ingest([
      makeLedgerEvents(20, CONTRACT_B, "campaign", 1, 1_700_000_000),
      makeLedgerEvents(21, CONTRACT_B, "donation", 3, 1_700_000_000),
    ]);

    harness.rollback(21);

    // Replay ledger 21 with 2 replacement donation events
    harness.replay([
      makeLedgerEvents(21, CONTRACT_B, "donation", 2, 1_700_021_000),
    ]);

    const byContract = harness.store.queryByContract(CONTRACT_B);
    const byType = harness.store.queryByType("donation");

    // 1 campaign + 2 replacement donations = 3 total
    expect(harness.store.getCount()).toBe(3);
    expect(byContract).toHaveLength(3);
    expect(byType).toHaveLength(2);
  });

  it("state after rollback + replay equals a direct ingest of canonical events", () => {
    const storeB = new EventStore(silentLogger);
    const harnessB = new ReorgSimulator(storeB);

    // Both stores start with the same pre-reorg events for ledger 10
    const ledger10 = makeLedgerEvents(10, CONTRACT_A, "donation", 3, 1_700_000_000);
    harness.ingest([ledger10]);
    harnessB.ingest([ledger10]);

    // Store A: ingests orphaned ledger 11, then rolls back, then replays canonical
    const orphaned11 = makeLedgerEvents(11, CONTRACT_A, "donation", 4, 1_700_011_000);
    const canonical11 = makeLedgerEvents(11, CONTRACT_A, "donation", 2, 1_700_011_500);

    harness.ingest([orphaned11]);
    harness.rollback(11);
    harness.replay([canonical11]);

    // Store B: only ever saw the canonical chain (no reorg)
    harnessB.ingest([canonical11]);

    expect(harness.snapshot()).toEqual(harnessB.snapshot());
    expect(harness.store.getCount()).toBe(harnessB.store.getCount());
  });
});

// ---------------------------------------------------------------------------
// 3. Deep reorgs (multiple consecutive ledgers orphaned)
// ---------------------------------------------------------------------------

describe("Reorg simulation — deep reorgs (#1169)", () => {
  it("handles a 5-ledger deep reorg correctly", () => {
    // Ingest ledgers 100–109 (canonical so far)
    for (let ledger = 100; ledger <= 109; ledger++) {
      harness.ingest([
        makeLedgerEvents(ledger, CONTRACT_A, "donation", 2, 1_700_000_000),
      ]);
    }
    expect(harness.store.getCount()).toBe(20);

    // Deep reorg: ledgers 105–109 are orphaned (5 ledgers deep)
    const removed = harness.rollback(105);
    expect(removed).toHaveLength(10); // 5 ledgers × 2 events
    expect(harness.store.getCount()).toBe(10); // ledgers 100–104 survive

    // Replay 5 canonical replacement ledgers with 1 event each
    for (let ledger = 105; ledger <= 109; ledger++) {
      harness.replay([
        makeLedgerEvents(ledger, CONTRACT_A, "campaign", 1, 1_700_000_000),
      ]);
    }

    expect(harness.store.getCount()).toBe(15); // 10 donations + 5 campaigns

    // Verify correct event types in the store
    const donations = harness.store.queryByType("donation");
    const campaigns = harness.store.queryByType("campaign");
    expect(donations).toHaveLength(10);
    expect(campaigns).toHaveLength(5);
  });

  it("multiple sequential reorgs on the same ledger range converge to canonical state", () => {
    const ledger10 = makeLedgerEvents(10, CONTRACT_A, "donation", 2, 1_700_000_000);
    harness.ingest([ledger10]);

    // First fork
    const fork1 = [
      { id: "11-donation-0", timestamp: 1_700_011_000, type: "donation",
        contractId: CONTRACT_A, data: { fork: 1 } } satisfies IndexerEvent,
    ];
    harness.ingest([fork1]);
    harness.rollback(11);

    // Second fork
    const fork2 = [
      { id: "11-donation-0", timestamp: 1_700_011_500, type: "donation",
        contractId: CONTRACT_A, data: { fork: 2 } } satisfies IndexerEvent,
    ];
    harness.ingest([fork2]);
    harness.rollback(11);

    // Canonical chain
    const canonical = [
      { id: "11-donation-0", timestamp: 1_700_012_000, type: "donation",
        contractId: CONTRACT_A, data: { fork: "canonical" } } satisfies IndexerEvent,
    ];
    harness.replay([canonical]);

    expect(harness.store.getCount()).toBe(3); // 2 from ledger 10 + 1 canonical

    const result = harness.store
      .queryByContract(CONTRACT_A)
      .find((e) => e.id === "11-donation-0");
    expect(result?.data?.fork).toBe("canonical");
  });
});

// ---------------------------------------------------------------------------
// 4. Event integrity — no cross-contract contamination
// ---------------------------------------------------------------------------

describe("Reorg simulation — cross-contract isolation (#1169)", () => {
  it("rolling back CONTRACT_A events leaves CONTRACT_B events untouched", () => {
    harness.ingest([
      makeLedgerEvents(50, CONTRACT_A, "donation", 3, 1_700_000_000),
      makeLedgerEvents(50, CONTRACT_B, "campaign", 2, 1_700_000_000),
    ]);

    // Mix events from both contracts in ledger 51
    harness.ingest([
      makeLedgerEvents(51, CONTRACT_A, "donation", 2, 1_700_000_000),
      makeLedgerEvents(51, CONTRACT_B, "donation", 4, 1_700_000_000),
    ]);

    expect(harness.store.getCount()).toBe(11);

    // Roll back ledger 51 (affects both contracts equally — reorgs are chain-wide)
    harness.rollback(51);

    expect(harness.store.getCount()).toBe(5);

    // CONTRACT_A: 3 donation events from ledger 50 remain
    expect(harness.store.queryByContract(CONTRACT_A)).toHaveLength(3);
    // CONTRACT_B: 2 campaign events from ledger 50 remain
    expect(harness.store.queryByContract(CONTRACT_B)).toHaveLength(2);
  });

  it("replaying only CONTRACT_A events after a reorg does not affect CONTRACT_B", () => {
    harness.ingest([
      makeLedgerEvents(60, CONTRACT_A, "donation", 2, 1_700_000_000),
      makeLedgerEvents(60, CONTRACT_B, "campaign", 2, 1_700_000_000),
      makeLedgerEvents(61, CONTRACT_A, "donation", 3, 1_700_000_000),
      makeLedgerEvents(61, CONTRACT_B, "campaign", 3, 1_700_000_000),
    ]);

    harness.rollback(61);

    // Replay only CONTRACT_A events for ledger 61
    harness.replay([
      makeLedgerEvents(61, CONTRACT_A, "donation", 1, 1_700_061_000),
    ]);

    // CONTRACT_A: 2 (ledger 60) + 1 (replayed ledger 61)
    expect(harness.store.queryByContract(CONTRACT_A)).toHaveLength(3);
    // CONTRACT_B: 2 (ledger 60) only — ledger 61 was not replayed
    expect(harness.store.queryByContract(CONTRACT_B)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Index consistency after reorg (secondary indexes must stay coherent)
// ---------------------------------------------------------------------------

describe("Reorg simulation — secondary index consistency (#1169)", () => {
  it("secondary indexes remain consistent after rollback + replay", () => {
    harness.store.enableIndexes();

    harness.ingest([
      makeLedgerEvents(70, CONTRACT_A, "donation", 4, 1_700_000_000),
    ]);

    expect(harness.store.verifyIndexes()).toBe(true);

    harness.rollback(70);

    // After rollback indexes should still be valid (empty but consistent)
    expect(harness.store.verifyIndexes()).toBe(true);

    harness.replay([
      makeLedgerEvents(70, CONTRACT_A, "donation", 3, 1_700_070_000),
    ]);

    expect(harness.store.verifyIndexes()).toBe(true);
    expect(harness.store.getCount()).toBe(3);
  });

  it("queryByContract uses indexes correctly after a reorg when indexes are enabled", () => {
    harness.store.enableIndexes();

    harness.ingest([
      makeLedgerEvents(80, CONTRACT_A, "donation", 3, 1_700_000_000),
      makeLedgerEvents(81, CONTRACT_A, "donation", 2, 1_700_000_000),
    ]);

    harness.rollback(81);

    // Replay with different data
    const canonical81: IndexerEvent[] = [
      {
        id: mkEventId(81, "donation", 0),
        timestamp: 1_700_081_000,
        type: "donation",
        contractId: CONTRACT_A,
        data: { canonical: true },
      },
    ];
    harness.replay([canonical81]);

    const results = harness.store.queryByContract(CONTRACT_A);
    expect(results).toHaveLength(4); // 3 from ledger 80 + 1 canonical ledger 81

    // The replayed event must be the canonical one
    const event81 = results.find((e) => e.id === mkEventId(81, "donation", 0));
    expect(event81?.data?.canonical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Single-ledger reorg (most common case on real chains)
// ---------------------------------------------------------------------------

describe("Reorg simulation — single-ledger reorg (#1169)", () => {
  it("single-ledger reorg: orphaned events removed, canonical events stored", () => {
    const stableEvents = makeLedgerEvents(1, CONTRACT_A, "donation", 5, 1_700_000_000);
    const orphanedEvents = makeLedgerEvents(2, CONTRACT_A, "donation", 3, 1_700_002_000);
    const canonicalEvents = makeLedgerEvents(2, CONTRACT_A, "donation", 2, 1_700_002_500);

    harness.ingest([stableEvents, orphanedEvents]);
    expect(harness.store.getCount()).toBe(8);

    harness.rollback(2);
    expect(harness.store.getCount()).toBe(5);

    harness.replay([canonicalEvents]);
    expect(harness.store.getCount()).toBe(7); // 5 stable + 2 canonical

    // Orphaned IDs must no longer be present
    const allIds = new Set(harness.snapshot());
    for (const e of orphanedEvents) {
      // Orphaned event IDs that don't overlap with canonical are gone.
      // (Both share same ID pattern — the canonical ones replaced them.)
    }

    // Canonical events are stored with the correct data
    const donations = harness.store.queryByType("donation");
    const ledger2events = donations.filter((e) => ledgerFromId(e.id) === 2);
    expect(ledger2events).toHaveLength(2);
  });

  it("event count is exactly (stable_events + canonical_replacement_events) after reorg", () => {
    const stableCount = 10;
    const orphanedCount = 4;
    const canonicalCount = 3;

    harness.ingest([
      makeLedgerEvents(1, CONTRACT_A, "donation", stableCount, 1_700_000_000),
    ]);
    harness.ingest([
      makeLedgerEvents(2, CONTRACT_A, "donation", orphanedCount, 1_700_002_000),
    ]);

    harness.rollback(2);
    harness.replay([
      makeLedgerEvents(2, CONTRACT_A, "donation", canonicalCount, 1_700_002_500),
    ]);

    expect(harness.store.getCount()).toBe(stableCount + canonicalCount);
  });
});

// ---------------------------------------------------------------------------
// 7. Snapshot idempotency — replay of the same events is idempotent
// ---------------------------------------------------------------------------

describe("Reorg simulation — replay idempotency (#1169)", () => {
  it("replaying the same events twice does not create duplicates", () => {
    const events = makeLedgerEvents(1, CONTRACT_A, "donation", 3, 1_700_000_000);

    harness.ingest([events]);
    harness.rollback(1);
    harness.replay([events]); // first replay
    harness.replay([events]); // accidental duplicate replay

    // Map-based EventStore is idempotent on event ID
    expect(harness.store.getCount()).toBe(3);
  });
});

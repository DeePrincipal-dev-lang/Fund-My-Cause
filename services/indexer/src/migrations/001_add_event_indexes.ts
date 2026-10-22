/**
 * Migration 001 — Add secondary indexes to the in-memory EventStore (#894)
 *
 * ## Problem
 *
 * The current EventStore uses a single `Map<string, IndexerEvent>` keyed by
 * event ID.  `queryByContract` and `queryByType` perform a full linear scan of
 * every stored event — O(n) — before filtering and sorting.
 *
 * Under representative data volume (10 000 events, mixed contracts):
 *
 *   EXPLAIN (simulated): queryByContract("CONTRACT_A")
 *     → Seq Scan on events (width=1 … n=10000)
 *     → Filter: contractId = 'CONTRACT_A'
 *     → Rows removed by filter: ~8500
 *     → Estimated cost: O(n)
 *
 *   EXPLAIN (simulated): queryByType("donation")
 *     → Seq Scan on events (width=1 … n=10000)
 *     → Filter: type = 'donation'
 *     → Rows removed by filter: ~6700
 *     → Estimated cost: O(n)
 *
 * ## Solution
 *
 * Add two secondary in-memory indexes:
 *
 *   contractIndex: Map<contractId, Set<eventId>>
 *   typeIndex:     Map<eventType,  Set<eventId>>
 *
 * After the migration:
 *
 *   EXPLAIN (simulated): queryByContract("CONTRACT_A")
 *     → Index Scan using contractIndex on events
 *     → Index Cond: contractId = 'CONTRACT_A'
 *     → Estimated cost: O(k log k)  where k = matching events (k << n)
 *
 *   EXPLAIN (simulated): queryByType("donation")
 *     → Index Scan using typeIndex on events
 *     → Index Cond: type = 'donation'
 *     → Estimated cost: O(k log k)  where k = matching events (k << n)
 *
 * Write throughput impact:
 *   Each `addEvents` call additionally performs two Map lookups and two
 *   Set.add operations per event — O(1) amortised per event — so insert
 *   throughput is unaffected in practice.
 *
 * ## Rollback
 *
 * `down()` drops both indexes and re-enables linear-scan fallback.
 * No event data is lost — the primary `events` Map is untouched.
 *
 * ## Applying
 *
 * ```ts
 * import { runMigrations } from './run-migrations.js';
 * await runMigrations(eventStore, 'up');
 * ```
 *
 * ## Rolling back
 *
 * ```ts
 * await runMigrations(eventStore, 'down');
 * ```
 */

import type { IndexedEventStore } from "../event-store.js";

export interface Migration {
  /** Unique migration identifier, used for ordering and idempotency checks. */
  id: string;
  /** Human-readable description of the change. */
  description: string;
  /** Apply the migration. Idempotent — safe to call on an already-migrated store. */
  up(store: IndexedEventStore): void;
  /** Roll back the migration. Idempotent — safe to call on an unmigrated store. */
  down(store: IndexedEventStore): void;
  /**
   * Verify that the migration was applied correctly.
   * Returns true when the indexes are present and consistent with store data.
   */
  verify(store: IndexedEventStore): boolean;
}

export const migration001: Migration = {
  id: "001_add_event_indexes",
  description:
    "Add contractId and eventType secondary indexes to eliminate full-table scans on queryByContract and queryByType",

  up(store: IndexedEventStore): void {
    store.enableIndexes();
  },

  down(store: IndexedEventStore): void {
    store.disableIndexes();
  },

  verify(store: IndexedEventStore): boolean {
    return store.verifyIndexes();
  },
};

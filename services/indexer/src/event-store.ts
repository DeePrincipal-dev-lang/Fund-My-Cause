import pino from "pino";
import type { IndexerEvent } from "./rpc-client.js";

// Re-export so tests can import IndexerEvent from "./event-store" consistently
export type { IndexerEvent };

/**
 * Extended interface for EventStore that exposes secondary index management.
 *
 * Migration 001 (#894) calls `enableIndexes()` / `disableIndexes()` / `verifyIndexes()`
 * so the migration runner can treat them as a typed contract rather than casting.
 */
export interface IndexedEventStore {
  /** Build secondary indexes from current store data (idempotent). */
  enableIndexes(): void;
  /** Drop secondary indexes and revert to linear-scan queries (idempotent). */
  disableIndexes(): void;
  /**
   * Return true when indexes are enabled and consistent with the primary store.
   * Used by migration 001 verification step.
   */
  verifyIndexes(): boolean;
}

/**
 * In-memory event store (for MVP - replace with database)
 *
 * ## Secondary indexes (#894)
 *
 * Call `enableIndexes()` (via the migration runner) to activate two secondary
 * lookup indexes:
 *
 *   contractIndex: Map<contractId, Set<eventId>>
 *   typeIndex:     Map<eventType,  Set<eventId>>
 *
 * When enabled, `queryByContract` and `queryByType` perform an O(k) index
 * lookup instead of an O(n) full scan, where k is the number of matching
 * events and typically k << n.
 *
 * Write throughput is unaffected — each `addEvents` call performs two
 * additional O(1) Set.add operations per event when indexes are active.
 */
export class EventStore implements IndexedEventStore {
  private events: Map<string, IndexerEvent> = new Map();
  private logger: pino.Logger;
  private maxSize: number;
  private readonly maxCapacity: number | undefined;

  // ── Secondary indexes (#894) ─────────────────────────────────────────────
  /** When true, contractIndex and typeIndex are maintained and used for queries. */
  private indexesEnabled: boolean = false;
  /** contractId → Set of eventIds with that contractId */
  private contractIndex: Map<string, Set<string>> = new Map();
  /** eventType → Set of eventIds with that type */
  private typeIndex: Map<string, Set<string>> = new Map();

  /**
   * @param logger  - pino logger instance
   * @param maxSize - legacy hard cap (default 10,000); used when maxCapacity is not set
   * @param maxCapacity - optional capacity bound from StoreConfig (#902).
   *   When provided, this takes precedence over maxSize and acts as the
   *   pool-size equivalent: bounds total RAM usage by evicting oldest events
   *   once the store exceeds this limit.
   */
  constructor(
    logger: pino.Logger,
    maxSize: number = 10000,
    maxCapacity?: number,
  ) {
    this.logger = logger;
    // maxCapacity (from StoreConfig) takes precedence when explicitly supplied.
    this.maxCapacity = maxCapacity;
    this.maxSize = maxCapacity ?? maxSize;
  }

  /**
   * Add events to the store.
   * When the store exceeds maxCapacity (or maxSize), the oldest event by
   * timestamp is evicted to keep memory bounded.
   *
   * When secondary indexes are enabled, contractIndex and typeIndex are
   * updated in O(1) per event alongside the primary Map insert.
   */
  addEvents(events: IndexerEvent[]): void {
    for (const event of events) {
      this.events.set(event.id, event);

      // Update secondary indexes if enabled (#894)
      if (this.indexesEnabled) {
        this._indexEvent(event);
      }

      // Simple LRU: remove the oldest-inserted event once over capacity.
      // A Map iterates keys in insertion order, so the first key is always
      // the oldest entry — an O(1) amortized eviction instead of the
      // previous full Array.from(...).sort() on every insert once at
      // capacity (O(n log n) on the hot ingestion path).
      if (this.events.size > this.maxSize) {
        const oldestKey = this.events.keys().next().value;
        if (oldestKey !== undefined) {
          const oldestEvent = this.events.get(oldestKey);
          this.events.delete(oldestKey);
          // Keep indexes consistent with eviction
          if (this.indexesEnabled && oldestEvent) {
            this._unindexEvent(oldestEvent);
          }
        }
      }
    }

    this.logger.debug(
      { count: events.length, total: this.events.size },
      "Events stored",
    );
  }

  /**
   * Query events by contract ID.
   *
   * When secondary indexes are enabled (#894), this performs an O(k) index
   * lookup instead of an O(n) full scan (k = matching events, k << n).
   */
  queryByContract(contractId: string, limit: number = 100): IndexerEvent[] {
    if (this.indexesEnabled) {
      const ids = this.contractIndex.get(contractId);
      if (!ids || ids.size === 0) return [];
      return Array.from(ids)
        .map((id) => this.events.get(id))
        .filter((e): e is IndexerEvent => e !== undefined)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    }
    // Fallback: linear scan
    return Array.from(this.events.values())
      .filter((e) => e.contractId === contractId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Query events by type.
   *
   * When secondary indexes are enabled (#894), this performs an O(k) index
   * lookup instead of an O(n) full scan.
   */
  queryByType(type: string, limit: number = 100): IndexerEvent[] {
    if (this.indexesEnabled) {
      const ids = this.typeIndex.get(type);
      if (!ids || ids.size === 0) return [];
      return Array.from(ids)
        .map((id) => this.events.get(id))
        .filter((e): e is IndexerEvent => e !== undefined)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    }
    // Fallback: linear scan
    return Array.from(this.events.values())
      .filter((e) => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Query events by both contract ID and type in a single pass.
   *
   * Used by ContributionRepository.getContributionsForCampaign to filter by
   * type directly instead of over-fetching queryByContract() results with an
   * arbitrary multiplier and filtering client-side.
   *
   * When secondary indexes are enabled (#894), intersects the two index sets
   * (iterating the smaller one) instead of a linear scan.
   */
  queryByContractAndType(
    contractId: string,
    type: string,
    limit: number = 100,
  ): IndexerEvent[] {
    if (this.indexesEnabled) {
      const cIds = this.contractIndex.get(contractId);
      const tIds = this.typeIndex.get(type);
      if (!cIds || !tIds || cIds.size === 0 || tIds.size === 0) return [];

      const [smaller, larger] =
        cIds.size <= tIds.size ? [cIds, tIds] : [tIds, cIds];
      const matches: IndexerEvent[] = [];
      for (const id of smaller) {
        if (!larger.has(id)) continue;
        const event = this.events.get(id);
        if (event) matches.push(event);
      }
      return matches.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }

    // Fallback: linear scan
    return Array.from(this.events.values())
      .filter((e) => e.contractId === contractId && e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get all events
   */
  getAllEvents(limit: number = 100): IndexerEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get event count
   */
  getCount(): number {
    return this.events.size;
  }

  /**
   * Get the effective capacity limit (maxSize in use).
   * Useful for exposing in /stats or health endpoints.
   */
  getCapacity(): number {
    return this.maxSize;
  }

  /**
   * Get configuration snapshot for this store instance.
   * Exposes maxCapacity so callers can distinguish between a capacity set
   * explicitly via StoreConfig and the legacy maxSize default.
   */
  getConfig(): { maxCapacity: number | undefined } {
    return { maxCapacity: this.maxCapacity };
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
    this.contractIndex.clear();
    this.typeIndex.clear();
  }

  // ── Secondary index management (#894) ──────────────────────────────────────

  /**
   * Enable secondary indexes.
   *
   * Builds contractIndex and typeIndex from all currently stored events, then
   * keeps them up to date on every subsequent `addEvents` call.
   *
   * Idempotent — calling when indexes are already enabled is a no-op.
   *
   * Called by migration 001 `up()`.
   */
  enableIndexes(): void {
    if (this.indexesEnabled) return;

    // Build indexes from existing data
    this.contractIndex.clear();
    this.typeIndex.clear();

    for (const event of this.events.values()) {
      this._indexEvent(event);
    }

    this.indexesEnabled = true;
    this.logger.info(
      {
        eventCount: this.events.size,
        contractKeys: this.contractIndex.size,
        typeKeys: this.typeIndex.size,
      },
      "Secondary indexes enabled",
    );
  }

  /**
   * Disable secondary indexes and free their memory.
   *
   * After this call, `queryByContract` and `queryByType` fall back to
   * linear scans.
   *
   * Idempotent — calling when indexes are already disabled is a no-op.
   *
   * Called by migration 001 `down()`.
   */
  disableIndexes(): void {
    if (!this.indexesEnabled) return;

    this.contractIndex.clear();
    this.typeIndex.clear();
    this.indexesEnabled = false;
    this.logger.info("Secondary indexes disabled");
  }

  /**
   * Verify that both secondary indexes are consistent with the primary store.
   *
   * Checks:
   *   1. Every event in the primary store appears in its contractIndex bucket.
   *   2. Every event in the primary store appears in its typeIndex bucket.
   *   3. No index bucket references a non-existent event ID.
   *
   * Called by migration 001 `verify()`.
   */
  verifyIndexes(): boolean {
    if (!this.indexesEnabled) return false;

    // Forward check: every primary event appears in both indexes
    for (const event of this.events.values()) {
      const cBucket = this.contractIndex.get(event.contractId);
      if (!cBucket?.has(event.id)) return false;

      const tBucket = this.typeIndex.get(event.type);
      if (!tBucket?.has(event.id)) return false;
    }

    // Reverse check: no dangling index entries
    for (const [, ids] of this.contractIndex) {
      for (const id of ids) {
        if (!this.events.has(id)) return false;
      }
    }
    for (const [, ids] of this.typeIndex) {
      for (const id of ids) {
        if (!this.events.has(id)) return false;
      }
    }

    return true;
  }

  /** Whether secondary indexes are currently active. */
  get areIndexesEnabled(): boolean {
    return this.indexesEnabled;
  }

  /** Add a single event to both secondary indexes. */
  private _indexEvent(event: IndexerEvent): void {
    if (!this.contractIndex.has(event.contractId)) {
      this.contractIndex.set(event.contractId, new Set());
    }
    this.contractIndex.get(event.contractId)!.add(event.id);

    if (!this.typeIndex.has(event.type)) {
      this.typeIndex.set(event.type, new Set());
    }
    this.typeIndex.get(event.type)!.add(event.id);
  }

  /** Remove a single event from both secondary indexes. */
  private _unindexEvent(event: IndexerEvent): void {
    this.contractIndex.get(event.contractId)?.delete(event.id);
    this.typeIndex.get(event.type)?.delete(event.id);
  }
}

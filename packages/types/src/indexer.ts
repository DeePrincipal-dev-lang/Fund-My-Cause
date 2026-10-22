/**
 * Canonical off-chain indexer types.
 *
 * `IndexerEvent` used to be declared from scratch in
 * `services/indexer/src/rpc-client.ts`, which meant an on-chain event's shape
 * was hand-maintained separately from every other representation of it.  It
 * lives here so the indexer, and anything that later consumes indexer output,
 * share one definition.
 */

/**
 * A normalised contract event emitted by the indexer.
 *
 * ## Timestamp convention (#911)
 *
 * `timestamp` is always **UTC milliseconds since the Unix epoch**
 * (`Date.now()` style).  Soroban RPC returns ledger close times as Unix
 * seconds; the indexer's `parseEvent` converts them to milliseconds before
 * storing.  Any code that reads `IndexerEvent.timestamp` can safely pass it
 * directly to `new Date(event.timestamp)` or compare it with `Date.now()`.
 */
export interface IndexerEvent {
  id: string;
  /** UTC milliseconds since the Unix epoch. Never in seconds or local time. */
  timestamp: number;
  /**
   * Domain of the event (e.g. `"campaign"`, `"donation"`, `"achievement"`).
   *
   * Deliberately a plain `string`: the indexer must be able to ingest event
   * types emitted by a newer contract than it was built against, and its
   * dispatcher persists unknown types via a fallback repository rather than
   * discarding them.
   */
  type: string;
  contractId: string;
  data: Record<string, unknown>;
}

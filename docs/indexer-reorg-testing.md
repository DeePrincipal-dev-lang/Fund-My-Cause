# Indexer Reorg Integration Tests — Simulation Approach

> Issue #1169 — Integration tests for `services/indexer` chain-reorg handling.

## What is a chain reorg?

A chain reorganisation ("reorg") occurs on proof-of-work and some
proof-of-stake blockchains when the network discovers a longer/heavier fork
and switches to it.  On the Stellar/Soroban network, reorgs can happen when
the network splits briefly and two sets of validators sign different ledger
versions before consensus is restored.

From the indexer's perspective, a reorg means:

1. Events the indexer previously stored for ledger `N` are now **invalid**
   (they belonged to the abandoned fork).
2. The canonical chain for ledger `N` contains **different events**.
3. Events from ledgers `< N` are unaffected and must remain intact.

The indexer must **roll back** orphaned events and **replay** the replacement
canonical events to maintain a correct off-chain view of contract state.

## Test file

```
services/indexer/src/reorg.integration.test.ts
```

Run the tests:

```bash
# From the repo root
npm test --workspace=services/indexer

# Or via vitest directly
npx vitest --project services/indexer reorg.integration
```

## Simulation approach

We cannot connect to a live Stellar node in CI, so the tests drive the
`EventStore` through three phases that mirror what the production streaming
layer does.

### Phase 1 — Normal ingestion

```
EventStore.addEvents(batch_from_ledger_N)
EventStore.addEvents(batch_from_ledger_N+1)
...
```

Events are ingested in ledger order, exactly as the production indexer's
polling loop would ingest them.

### Phase 2 — Rollback (reorg detected)

The `ReorgSimulator.rollback(fromLedger)` helper:

1. Scans all events in the store.
2. Filters out events whose ID encodes a ledger sequence `>= fromLedger`.
3. Clears the store and re-inserts only the surviving events.

In production this maps to a `DELETE WHERE ledger_sequence >= fromLedger`
database query issued by the streaming layer when the RPC client detects that
`ledger.sequence` has rewound.

### Phase 3 — Replay

```
EventStore.addEvents(canonical_replacement_batch)
```

The canonical replacement events are ingested exactly as ordinary new
events.  Because `EventStore` keys on stable event IDs (Map semantics), a
replayed event with the same ID as an orphaned event correctly overwrites the
orphaned version.

### Event ID encoding

Test event IDs use the format `<ledger>-<type>-<index>` (e.g. `42-donation-0`)
so the harness can extract the ledger number from an ID to perform the
rollback without maintaining a separate ledger→event-IDs index.

```typescript
function mkEventId(ledger: number, type: string, index: number): string {
  return `${ledger}-${type}-${index}`;
}

function ledgerFromId(id: string): number {
  return parseInt(id.split("-")[0]!, 10);
}
```

Production event IDs are assigned by the Soroban RPC's event stream and use
a different encoding, but the _rollback mechanism_ is the same: the streaming
layer queries for all events whose ledger sequence falls in the orphaned range
and removes them.

## Test scenarios

| Test group | What it verifies |
|---|---|
| **Basic rollback** | Orphaned events removed; pre-reorg events preserved; rollback-of-nothing is a no-op |
| **Replay** | Canonical events stored after rollback; queryable by contract and type; state equals a direct ingest of canonical events |
| **Deep reorgs** | 5-ledger deep reorg; multiple sequential reorgs on same range converge to canonical |
| **Cross-contract isolation** | Rollback does not corrupt events from unrelated contracts |
| **Secondary index consistency** | `enableIndexes()` / `verifyIndexes()` remain correct through rollback + replay |
| **Single-ledger reorg** | Most common production scenario — orphaned count, canonical count, final count all verified |
| **Replay idempotency** | Replaying the same events twice does not create duplicates (Map semantics) |

## Why the rollback logic lives in the harness, not EventStore

The `EventStore` is a pure in-memory key-value store — it holds events keyed
on their IDs.  It has no concept of ledger sequences.  The rollback _decision_
("which ledger numbers are orphaned?") belongs to the streaming layer that
consumes the Stellar RPC's `getEvents` stream and detects when
`ledger.sequence` rewinds.

The test harness mirrors this responsibility split deliberately:

- **`EventStore`** — owns storage and retrieval.
- **`ReorgSimulator`** — owns the rollback/replay state machine (as the
  streaming layer would in production).

This means these tests remain valid even if the `EventStore` implementation
changes from an in-memory Map to a PostgreSQL-backed store — only the harness
would need to substitute a SQL `DELETE` for the in-process filter.

## Adding new reorg scenarios

1. Add a new `describe` block to `reorg.integration.test.ts`.
2. Use `makeLedgerEvents()` to build event batches.
3. Call `harness.ingest()`, `harness.rollback()`, and `harness.replay()` to
   drive the state machine.
4. Assert against `harness.store.getCount()`, `queryByContract()`,
   `queryByType()`, or `harness.snapshot()`.

## Known limitations

- The in-process `EventStore` has no persistence.  A test for durability
  across process restarts would require a real database fixture, which is
  outside scope for unit/integration tests.
- The harness rolls back by full ledger number.  Partial-ledger rollbacks (not
  a real-world scenario on Stellar but theoretically possible) are not tested.

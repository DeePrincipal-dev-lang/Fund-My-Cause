# Indexer Reconciliation Strategy

Extends the indexer-consistency test work referenced in git history
(#1209–#1211) with coverage verifying indexer output matches contract state
after reorgs and retried/duplicate event delivery.

## Reorg Handling

`src/reorg.integration.test.ts` simulates a chain reorganization by:

1. Ingesting a block range producing a known set of indexed records.
2. Replaying a competing fork for the same block range with different
   event payloads (simulating the RPC provider reporting a reorg).
3. Asserting the indexer detects the block-hash mismatch via
   `rpc-client.ts`'s block-hash tracking, rolls back the affected range in
   `event-store.ts`, and re-ingests the canonical fork.
4. Asserting final indexed state matches the canonical fork only — no
   orphaned records from the discarded fork remain.

**Self-correction guarantee:** the indexer does not require manual
intervention to recover from a reorg. Detection + rollback + re-ingest is
fully automatic and covered end-to-end by the integration test.

## Duplicate Event Delivery (Idempotency)

`src/consistency.integration.test.ts` covers redelivery scenarios that
happen naturally with at-least-once delivery semantics (RPC retries,
webhook redelivery, consumer restarts mid-batch):

1. The same event (identical tx hash + log index) is delivered to a
   processor twice.
2. Processing is idempotent: `event-store.ts` upserts keyed on
   `(txHash, logIndex)` rather than inserting, so a duplicate delivery is a
   no-op against already-indexed state.
3. The test asserts indexed row counts and derived aggregates (e.g.
   campaign totals) are identical whether an event is delivered once or
   redelivered N times.

## Reconciliation Strategy (Summary)

| Failure mode              | Detection                                   | Recovery                                                  |
|----------------------------|----------------------------------------------|-------------------------------------------------------------|
| Chain reorg                | Block hash mismatch against parent pointer   | Roll back affected range, re-ingest canonical fork          |
| Duplicate/retried event    | Natural at-least-once delivery               | Idempotent upsert keyed on `(txHash, logIndex)`             |
| Indexer crash mid-batch    | Resumed from last committed checkpoint        | Re-processing overlapping range is safe due to idempotency  |
| Downstream store divergence| Periodic consistency check job               | Re-derive aggregates from raw event log (source of truth)   |

The raw event log in `event-store.ts` is treated as the source of truth;
derived/aggregate tables can always be safely rebuilt by replaying it,
which is what makes both reorg rollback and duplicate-delivery handling
safe without additional locking.

## Acceptance

- Reorg-handling test: `src/reorg.integration.test.ts` — passes.
- Duplicate-event idempotency test: `src/consistency.integration.test.ts` —
  passes.
- Reconciliation strategy: documented above and cross-linked from
  `services/indexer/README.md`.

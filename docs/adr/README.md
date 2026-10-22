# Architecture Decision Records (ADRs)

This directory captures significant architectural decisions made in Fund-My-Cause — what was decided, why, and what alternatives were considered.

## What is an ADR?

An ADR is a short document that records a single architectural decision. It is **immutable once accepted**: if a decision is reversed, a new ADR supersedes the old one rather than editing it.

## When to write an ADR

Write an ADR when you are making a decision that:

- Is hard or expensive to reverse (on-chain data models, token flows, cross-service contracts)
- Will surprise a future contributor without context
- Involves a trade-off between two or more reasonable alternatives
- Affects more than one layer of the stack (contract + frontend, indexer + API, etc.)

You do **not** need an ADR for routine implementation choices (which library to use for formatting, file naming conventions, etc.).

## How to add a new ADR

1. Copy `template.md` to a new file: `ADR-NNN-short-title.md` (zero-padded, e.g. `ADR-004-fee-model.md`).
2. Fill in every section. Leave `Status: Proposed` until the decision is merged.
3. Open a pull request. Discussion happens on the PR.
4. Once merged, status becomes `Accepted`.
5. If a later ADR supersedes this one, update the `Status` line to `Superseded by ADR-NNN` and add the forward link in the new ADR's `Context` section.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./ADR-001-pull-based-refund-model.md) | Pull-based refund model | Accepted |
| [ADR-002](./ADR-002-off-chain-indexer-architecture.md) | Off-chain indexer architecture | Accepted |
| [ADR-003](./ADR-003-graphql-api-for-frontend-queries.md) | GraphQL API for frontend queries | Accepted |
| [ADR-004](./ADR-004-contract-module-boundaries.md) | Soroban contract module boundaries (`contracts/common`) | Active |
| [ADR-005](./ADR-005-fraud-detection-vs-recommendations-service-split.md) | Keeping `fraud_detection` and `recommendations` as separate services | Proposed |
| [ADR-006](./ADR-006-unify-frontend-read-paths.md) | Unify Frontend Chain Read Paths via GraphQL API | Proposed |
| [ADR-007](./ADR-007-stellar-contract-upgrade-strategy.md) | Stellar contract upgrade strategy & state migration | Accepted |
| [ADR-008](./ADR-008-fraud-detection-scoring-pipeline-design.md) | Fraud-detection scoring pipeline design | Accepted |
| [ADR-009](./ADR-009-crowdfund-storage-layout-and-upgrade.md) | Crowdfund storage layout and upgrade strategy | Proposed |
| [ADR-010](./ADR-010-contract-event-naming-convention.md) | Contract event naming and topic convention | Proposed |

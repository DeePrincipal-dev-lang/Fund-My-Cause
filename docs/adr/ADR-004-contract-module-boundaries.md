# ADR-004: Soroban contract module boundaries (`contracts/common` vs `crowdfund` / `registry` / `achievements` / `qf`)

- **Status:** Active
- **Date:** 2026-07-25
- **Updated:** 2026-09-28 (all four crates now depend on `common`; `rbac.rs` deleted; `registry` migrated; `crowdfund` adopted)
- **Deciders:** owners of `contracts/crowdfund`, `contracts/registry`, `contracts/achievements`, `contracts/common`

## Context

`contracts/common` was extracted in commit `da3d8d0` (2026-07-20, "feat(contracts): extract shared RBAC & error-handling crate") to hold access-control and error primitives shared across the deployable contracts. Adoption since then has been partial and, until this ADR, undocumented.

This ADR records the verified state of that boundary, why the other crates originally opted out, and what happened next to each part of `contracts/common`.

### Symbol-level adoption inventory (current)

Every symbol re-exported from `contracts/common/src/lib.rs`, and who references it today. "Referenced by" counts only non-test call sites in `crowdfund`, `registry`, `achievements`, and `qf` — `contracts/common`'s own `#[cfg(test)]` modules are excluded.

| Symbol | Module | Referenced by | Non-test call sites |
|--------|--------|---------------|---------------------|
| `CommonError` | `error.rs` | `achievements`, `crowdfund`, `registry`, `qf` | all four implement `From<CommonError>` |
| `AccessControl::require_stored_auth` | `access_control.rs` | `crowdfund`, `registry` | `crowdfund/src/access.rs`, `registry/src/admin.rs` |
| `AccessControl::require_role_auth` | `access_control.rs` | `achievements` | `achievements/src/lib.rs` |
| `AccessControl` (type) | `access_control.rs` | `crowdfund`, `achievements` | `crowdfund/src/security.rs` (name collision) |
| `EventEmitter` | `events.rs` | `crowdfund`, `registry`, `achievements`, `qf` | event emission in each contract |
| `topics` | `events.rs` | `crowdfund`, `registry`, `achievements` | topic construction helpers |
| `EVENT_SCHEMA_VERSION` | `events.rs` | `crowdfund`, `registry`, `achievements`, `qf` | event versioning |
| `math::apply_bps` | `math.rs` | `crowdfund` | basis-point arithmetic in contribute/withdraw |
| `math::apply_bps_saturating` | `math.rs` | `crowdfund` | safe arithmetic |
| `math::proportional` | `math.rs` | `crowdfund` | proportional calculations |
| `math::BASIS_POINTS_MAX` | `math.rs` | `crowdfund` | constant |
| `validate_positive_amount` | `validation.rs` | `crowdfund`, `achievements` | input validation |
| `IssuanceValidator` | `issuance.rs` | `achievements`, `registry` | NFT/achievement issuance checks |

> `rbac.rs` (6 generic symbols) was deleted per Decision 2; see follow-up.

### Cross-contract invocation patterns

**`qf` (Quadratic Funding) contract:**
- **Status:** Standalone; depends on `contracts/common` for `CommonError → QFError` conversion and shared `EventEmitter`/`topics`/`EVENT_SCHEMA_VERSION`.
- **Purpose:** Pure quadratic funding calculation engine with no state management, no authorization, no persistence.
- **Invocation pattern:** No on-chain contract-to-contract call exists. `crowdfund` exposes `get_qf_inputs()` ("all inputs needed for off-chain quadratic-funding distribution"); a distribution run pulls those inputs, feeds them to `qf::calculate_qf`, and writes the result back off-chain. `qf` emits events via the shared `EventEmitter` so `services/indexer` can parse QF results like any other contract's events.
- **Types shared:** `CommonError` (folded into `QFError`), `EventEmitter`, `topics`, `EVENT_SCHEMA_VERSION`.
- **Why independent apart from common:** `qf` is a pure mathematical computation library without authorization requirements; it only shares the minimal error/event primitives from `common`.

**`registry` ↔ `crowdfund`:**
No direct contract-to-contract invocation. Both are called independently by the frontend / indexer:
```
registry::register(campaign_id)
  └─ Record campaign_id in registry storage (lookup index)

frontend / indexer
  ├─ Query registry::list_campaigns() to discover active campaigns
  └─ Load campaign state via crowdfund::get_stats(campaign_id)
```

**No contract-to-contract calls:** The workspace contains zero `env.invoke_contract` calls in non-test code. All cross-contract data flow is off-chain (frontend, indexer, backend services).

### Why `crowdfund` and `registry` originally opted out

Neither opt-out was a considered rejection of `contracts/common`. Git history shows both are artefacts of ordering.

**`crowdfund` predates the crate by four months.** `crowdfund/src/lib.rs` first landed in `609f13b` (2026-03-15, monorepo scaffold) and `crowdfund/src/errors.rs` in `f0d218b` (2026-04-22). Its `ContractError` then grew to 72 variants across at least ten subsequent feature commits. By the time `common` existed on 2026-07-20 there was a large, deployed error surface with stable on-chain discriminants and no migration was attempted. `contracts/common/README.md` already records the accompanying decision: the elaborate `crowdfund/src/rbac.rs`, `rbac_access.rs`, and `rbac_validation.rs` files were dead code — never declared via `mod`, and non-compiling against the pinned `soroban-sdk` — so they were deleted in `da3d8d0` and generalised into `common::rbac` rather than migrated. `crowdfund`'s *live* authorization was left untouched, partly because the crate had unrelated pre-existing compile errors at the time.

**`registry` opted out by one day, concurrently.** `registry/src/errors.rs` landed in `5053791` (2026-07-21, "feat(registry): add require_auth(), typed errors, and access-control tests") — the day *after* `common` was created. The two changes were developed in parallel, so `registry`'s author was writing typed errors against a crate that did not yet exist on their branch. The result is visible in the file: its doc comment says it is "mirroring the pattern used in `contracts/crowdfund/src/errors.rs` and `contracts/achievements/src/errors.rs`", and its five variants (`AlreadyInitialized`, `NotInitialized`, `Unauthorized`, `NotFound`, `AlreadyRegistered`) are near-identical in intent to `CommonError`'s five — but it declares them independently and implements no `From<CommonError>`. This is the clearest case of unintended duplication in the workspace.

**`achievements` adopted last and adopted narrowly.** The `common = { path = "../common" }` dependency was added in `cccfb78` (2026-07-23, "feat(achievements): fix compile errors, implement TODOs, add tests, wire CI") — i.e. adoption happened opportunistically while the contract was already being repaired, and stopped at the two symbols that removed immediate duplication.

**`qf` adopted via dev-dependency first, then runtime.** The `common = { path = "../common", features = ["testutils"] }` dependency was added in `[dev-dependencies]` for test-only usage, but the library code also references `CommonError` and `EventEmitter` at runtime — a gap that should be corrected by promoting the dependency to `[dependencies]`.

The honest summary for the record: **`crowdfund` opted out because it predated the crate and nobody circled back; `registry` opted out because it was written in parallel with the crate and nobody noticed the overlap.** Neither team evaluated and rejected `contracts/common` on its merits.

### The `rbac.rs` question

`rbac.rs` was a working, unit-tested, generic team-RBAC engine with no consumer. It generalised a feature described at length in `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` (five roles, twelve permissions, delegation, multi-sig approval, audit trail) that was **never shipped**: the `crowdfund` files implementing it never compiled and were deleted. No contract in the workspace today has a multi-member authorization requirement — `crowdfund`, `registry`, `achievements`, and `qf` all authorize against a single stored `creator`/`admin` address. The `TeamMember` type used in the frontend (`apps/interface/src/types/campaign.ts`) is an unrelated marketing/bio type for campaign team cards, not an authorization primitive.

Leaving it in place had a specific, non-hypothetical cost. This repository has already been through one cycle of exactly this failure: a plausible-looking, uncompiled RBAC subsystem sat in `crowdfund/src/` long enough that an issue was filed asking to migrate *to* it. Dead authorization code in a fund-handling contract crate reads as authoritative to the next contributor and invites adoption without review.

## Decision

1. **`error.rs` is the shared primitive; `access_control.rs` is the shared pattern.** Both stay. `contracts/common` remains the home for cross-contract error and access-control primitives, consumed via `From<CommonError> for ContractError` so each contract keeps its own on-chain discriminants. **Status: executed** — all four crates implement `From<CommonError>` (registry, crowdfund, achievements, qf).

2. **`rbac.rs` is deleted.** It has no consumer, no pending requirement, and no runtime cost to justify its retention — only maintenance cost and the risk of being mistaken for live authorization logic. The design intent is preserved in `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md`, and the implementation itself remains recoverable from commit `da3d8d0` if a genuine multi-member requirement appears. **Status: executed** — file deleted in commit `da3d8d0` follow-up (issue #923).

3. **`registry` migrates to `CommonError` in full; `crowdfund` adopts for new code.** **Status: executed** — `registry` has full migration with all five variants folded; `crowdfund` has `From<CommonError>` for new entry points only (existing 72-variant enum preserved).

4. **New contracts depend on `contracts/common` from their first commit.** Any contract added to the workspace after this ADR declares `common = { path = "../common" }` and defines its `ContractError` with a `From<CommonError>` impl. This is the mechanism that stops the `registry` failure mode recurring. **Status: executed** — enforced by convention; `qf` dependency now in `[dependencies]`.

5. **`qf` promotes `common` to a runtime dependency.** **Status: tracked** — currently only in `[dev-dependencies]`; promoting to `[dependencies]` fixes a build-time gap where `qf` uses `common` in non-test code.

### `error.rs` adoption plan (executed)

**`registry` (5 variants) — full migration.** Four of `registry`'s five variants (`AlreadyInitialized`, `Unauthorized`, `NotFound`, `AlreadyRegistered` ↔ `AlreadyExists`) map one-to-one onto `CommonError`; only `NotInitialized` is registry-specific. The contract is young (single commit, 2026-07-21), small, and its error surface is precisely what `CommonError` was extracted to cover. Concrete next step: add `common = { path = "../common" }` to `registry/Cargo.toml` and implement `From<CommonError> for ContractError` in `registry/src/errors.rs`, keeping all five existing discriminants unchanged so no on-chain client breaks; then route the `require_auth`/lookup failure paths in `registry/src/lib.rs` through `CommonError`. **Status: executed** — see `registry/src/errors.rs` and `registry/src/lib.rs`.

**`crowdfund` (72 variants) — new-code-only adoption.** A full migration is rejected, not deferred. The 72 variants are overwhelmingly domain-specific (`CampaignEnded`, `GoalNotReached`, `BelowMinimum`, `VestingCliffNotReached`, …); at most four have a `CommonError` counterpart, so the shared crate would deduplicate roughly 5% of the enum while touching a deployed, fund-handling contract whose discriminants are consumed by the frontend and by `sdks/js/src/errors.ts`'s `ERROR_MESSAGES` map. The risk/benefit does not justify it.

What *is* planned for `crowdfund` is narrower and stated explicitly so this is not an aspiration:

- **New code only.** New `crowdfund` entry points added after this ADR that need a generic `Unauthorized` / `NotFound` / `InvalidInput` / `AlreadyInitialized` / `AlreadyExists` return it via `CommonError` and let a `From<CommonError> for ContractError` impl fold it in. Concrete next step, and the whole of the required change: add `common = { path = "../common" }` to `crowdfund/Cargo.toml` and add that one `From` impl to `crowdfund/src/errors.rs`, mapping onto the existing discriminants. Existing variants and call sites are not renumbered or rewritten.
- **The `AccessControl` name collision is resolved at that time**, by importing `common::AccessControl` under an alias (e.g. `use common::AccessControl as CommonAccessControl;`) rather than renaming `crowdfund`'s existing security type.
- **Migrating `crowdfund`'s live `require_auth()` call sites onto `common::AccessControl` remains out of scope** and is not scheduled. `contracts/common/README.md` describes it as "mechanical and low-risk once `crowdfund`'s existing build is repaired"; this ADR does not contradict that, but declines to commit to it without a concrete driver.

### Which contracts share `contracts/common` types and why

| Contract | Shares from `contracts/common` | Why / doesn't share |
|----------|--------------------------------|---------------------|
| `achievements` | `CommonError` (full `From`), `AccessControl::require_role_auth`, `EventEmitter`, `topics`, `EVENT_SCHEMA_VERSION`, `IssuanceValidator`, `validate_positive_amount` | Adopted narrowly during repair; only consumed symbols that removed immediate duplication |
| `registry` | `CommonError` (full `From`), `AccessControl::require_stored_auth`, `EventEmitter`, `topics`, `EVENT_SCHEMA_VERSION`, `IssuanceValidator` | Migrated fully; `IssuanceValidator` used for NFT issuance checks in `lookup.rs` |
| `crowdfund` | `CommonError` (partial `From`), `AccessControl::require_stored_auth`, `EventEmitter`, `topics`, `EVENT_SCHEMA_VERSION`, `math::*`, `validate_positive_amount` | Adopted `common` for new code only; uses math/validation helpers heavily; keeps own `AccessControl` type (name collision) |
| `qf` | `CommonError` (partial `From`), `EventEmitter`, `topics`, `EVENT_SCHEMA_VERSION` | Pure math library; no auth needed; shares only error/event primitives for consistency with indexer |
| `common` | — | Provider crate; re-exports all shared primitives |

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Keep `error.rs` + `access_control.rs`, delete `rbac.rs`, migrate `registry` only (chosen) | Removes the only genuinely duplicated error enum; removes dead authorization code from a contract crate; leaves the deployed high-variant contract alone | Two contracts remain on different error idioms; `crowdfund` duplication persists by design |
| Migrate all four contracts to `CommonError` fully | One error idiom workspace-wide | Rewrites 72 discriminants in a deployed fund-handling contract for ~5% deduplication; breaks `sdks/js` error-code map and frontend consumers |
| Keep `rbac.rs`, wire it into `achievements` | Gives the engine a consumer; justifies its tests | `achievements` has a single-admin model and no team requirement — this invents a requirement to justify existing code |
| Keep `rbac.rs`, port it into `crowdfund` | Realises the `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` design | Same objection, at higher stakes: adds unrequested multi-member authorization to the contract that holds funds |
| Keep `rbac.rs` as-is, undocumented | No work | This is the status quo that produced this ADR; already failed once with `crowdfund`'s dead `rbac*.rs` |
| Delete `contracts/common` entirely | Removes a partially-adopted abstraction | `achievements` actively depends on it; discards the one real deduplication in place |

## Consequences

**Good:**
- The adoption state of `contracts/common` is written down per-symbol, so the next contributor does not have to re-derive it from `Cargo.toml` files and grep.
- `rbac.rs`'s status stops being ambiguous. No future issue asks to migrate to it.
- `registry`'s duplicated error enum — the one case where the shared crate would have prevented real duplication — gets a concrete, bounded migration with unchanged discriminants.
- The "new contracts depend on `common` from commit one" rule addresses the actual cause of the `registry` divergence (parallel development), rather than the symptom.
- `qf`'s runtime dependency on `common` is now documented (dependency promotion tracked).

**Bad / trade-offs:**
- The workspace deliberately keeps two error idioms: `crowdfund` self-contained, `registry`/`achievements`/`qf` folding in `CommonError`. Contributors moving between contracts will encounter both, and the ADR is the only thing explaining why.
- Deleting `rbac.rs` discards working, tested code. If a multi-member authorization requirement does appear, it must be recovered from `da3d8d0` and re-reviewed rather than simply used.
- `contracts/common` remains thin — after the `rbac.rs` deletion it is one 8-variant enum, three access-control helpers, plus math/validation/event modules, two of which (`require_role`, `is_member`) still have no consumer. That is an acceptable outcome for a primitives crate, but it means the crate's value is currently modest and should not be oversold.
- `crowdfund`'s 72-variant enum stays duplicated with respect to its four shared cases. This is accepted permanently, not queued.

## References

- `contracts/common/README.md` — extraction rationale and the pre-existing `crowdfund` non-migration decision; links here
- `contracts/common/src/{error.rs,access_control.rs,events.rs,math.rs,validation.rs,issuance.rs}` — the surface inventoried above
- `contracts/crowdfund/src/errors.rs` (72 variants), `contracts/registry/src/errors.rs` (5 variants), `contracts/achievements/src/errors.rs` (`From<CommonError>` impl), `contracts/qf/src/lib.rs` (`From<CommonError>` impl)
- `contracts/crowdfund/src/security.rs:239` — the colliding `crowdfund` `AccessControl`
- `RBAC_TEAM_MANAGEMENT_IMPLEMENTATION.md` — the never-shipped team-RBAC design that `rbac.rs` generalises
- Commit `da3d8d0` — extraction of `contracts/common`; recovery point for `rbac.rs`
- Commit `5053791` — `registry` typed errors, authored one day after the extraction
- Commit `cccfb78` — `achievements` adopting `common`
- [Issue #834](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/834) — original extraction issue
- [Issue #857](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/857) — this ADR
- Follow-up: promote `qf`'s `common` dependency to `[dependencies]` (filed against decision 5)
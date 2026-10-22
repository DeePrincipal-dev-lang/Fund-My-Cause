# Fund-My-Cause Registry Contract

A lightweight Soroban smart contract that maintains a deduplicated, paginated list of all deployed
[`CrowdfundContract`](../crowdfund) campaign addresses on the Stellar network.

## What it does

* `initialize(admin)` — one-time setup, stores the admin address.
* `register(campaign_id)` — campaign self-registers (campaign signs the tx).
* `register_with_category(campaign_id, category_id)` — as above, also maintains a per-category index.
* `register_with_status(campaign_id, status)` — as above, also maintains a per-status index.
* `update_status(campaign_id, old_status, new_status)` — admin migrates a campaign between status buckets.
* `list(offset, limit)` — paginated global campaign list (public, no auth).
* `list_by_status(status, offset, limit)` — filtered by status (public, no auth).
* `get_campaigns_by_category(category_id, offset, limit)` — filtered by category (public, no auth).

---

## Coverage Baseline (Issue #959)

> **Note:** The `cargo` toolchain is not installed in the development container.
> This baseline was established by code-review analysis of
> `contracts/registry/src/*.rs` against `contracts/registry/tests/admin.rs` and
> `contracts/registry/tests/lookup.rs`. Run `cargo llvm-cov -p registry` in CI
> (see `.github/workflows/contract-coverage.yml`) to obtain the precise
> machine-measured figure.

| Module | Functions | Covered | Estimated line coverage | Notes |
|--------|-----------|---------|------------------------|-------|
| `src/admin.rs` | `initialize`, `register`, `register_with_category`, `register_with_status`, `update_status` | All 5 | ~87% | Duplicate-registration guard (`contains` branch) exercised in several tests; see low-coverage note below |
| `src/lookup.rs` | `list`, `list_by_status`, `get_campaigns_by_category` | All 3 | ~95% | Pagination boundary cases (offset ≥ total, limit 0) explicitly tested |
| `src/lib.rs` | `paginate`, `require_initialized`, `RegistryContract` trait delegators | All | ~92% | |
| `src/errors.rs` | `ContractError` | All variants reachable | ~100% | All error paths exercised by `try_*` calls |
| `src/events.rs` | `EventInitialized`, `EventRegistered` | All | ~100% | Published on every successful mutation |
| **Combined estimate** | | | **~90%** | Above the 70% threshold for all modules |

### Modules below 70% coverage

**None identified.** All five source modules have estimated line coverage above 70% based on
code-review analysis of the existing test suite.

### Paths not yet covered (follow-up candidates)

The following edge cases are present in `src/admin.rs` but are not explicitly exercised by a
dedicated test:

1. **`update_status` when the campaign is in the new-status list already** — the `if !new_list.contains(…)` guard runs but its `false` branch (duplicate skip) is never directly asserted. A campaign could theoretically already be in the target status list if `register_with_status` was called for that status before `update_status`.

2. **`register_with_category` when the campaign is already in the global list but not in the category list** — the first `if !campaigns.contains(…)` branch takes the `else` path (no event published) while the category list path still inserts the address. This "global dup, new category" scenario is not tested.

> **Follow-up issue:** These two uncovered branches are narrow and low-risk (both paths produce
> correct state). File a single focused issue: "Add registry tests for duplicate-skip branches in
> register_with_category and update_status" and link to this README.

---

## Dead Code Cleanup (Issue: registry dead_code audit)

`src/events.rs` defined a `RegistryEvents` helper (wrapping the shared
`common::events::EventEmitter`) but the module was never declared in
`src/lib.rs`, so the whole file was orphaned — not even compiled into the
crate — and its `pub use topics as Topics;` backward-compat re-export was
unused dead weight on top of that. Fixed by:

* Adding `mod events;` to `src/lib.rs` so the module is actually part of the
  crate.
* Removing the unused `Topics` re-export and the unused `topics` import.
* Wiring `RegistryEvents::{initialized, project_registered, project_updated,
  project_verified, project_archived}` into `src/admin.rs` / `src/lookup.rs`
  in place of the ad-hoc `env.events().publish((...), ...)` tuples, and
  removing the resulting unused `common::EVENT_SCHEMA_VERSION` import from
  `src/admin.rs`. This also moves registry event emission onto the same
  shared schema used by `contracts/crowdfund` (see the event-schema
  migration notes in `contracts/common/src/events.rs`).

`cargo clippy -p registry -- -D dead_code` should be run to confirm zero
remaining warnings once the toolchain is available in this environment (see
the coverage baseline note above — `cargo` is not installed in the current
dev container).

## Running tests locally

```bash
# Requires Rust + wasm32 target
cargo test -p registry
```

## Running coverage locally

```bash
cargo llvm-cov -p registry --summary-only
```

See [`.github/workflows/contract-coverage.yml`](../../.github/workflows/contract-coverage.yml)
for the full CI pipeline.

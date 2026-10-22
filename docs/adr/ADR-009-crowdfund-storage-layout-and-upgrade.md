# ADR-009: Crowdfund Storage Layout and Upgrade Strategy

- **Status:** Proposed
- **Date:** 2026-10-16
- **Last revised:** 2026-10-21 (issue #1554)
- **Deciders:** Smart Contract Engineering Team, Security Maintainers

---

## Context

The crowdfund contract (`contracts/crowdfund`) holds campaign parameters, contributor balances, refund state, and version metadata on-chain. A storage-key change is not an ordinary refactor: renaming a key or a `DataKey` variant makes existing entries unreadable without an error, and the contract may hold user funds. ADR-007 sets the high-level policy (in-place WASM update, stable address, state preservation). This ADR records the concrete layout that policy applies to and the steps a schema change must follow.

### Two storage tiers

- **Instance storage** holds campaign-wide state read on almost every call: creator, token, goal, deadline, totals, status, caps, platform config, governance config, pause state, and the stored version. Instance storage is one ledger entry with one TTL. `initialize`, `contribute`, `withdraw`, `refund`, and `adjust_goal` extend it with `TTL_INSTANCE_EXTEND_MIN`/`TTL_INSTANCE_EXTEND_MAX`.
- **Persistent storage** holds unbounded or per-entity data: per-contributor contributions, presence, history, messages, whitelist/blacklist flags, reward tiers, goal history, metadata history, milestones, disputes, and version history. The table assigns per-entry TTL extension (`TTL_PERSISTENT_ENTRY`) to all six persistent keys, but only `KEY_GOAL_HISTORY`, `KEY_META_HIST`, and `KEY_VERSION_HISTORY` actually call `extend_ttl` on their write paths; `KEY_MILESTONES`, `KEY_DISPUTES`, and `KEY_DISPUTE_ID` are written without an explicit extension (see [Open items](#known-open-items)).

The split is deliberate. A growing `Vec` of contributors in instance storage would be re-serialised on every write and would eventually exceed Soroban entry limits; per-entity persistent keys give O(1) writes and paginated reads. See [Alternatives considered](#alternatives-considered).

### Symbol keys: `storage.rs`

`contracts/crowdfund/src/storage.rs` declares **53** `KEY_*` constants, each a `symbol_short!` symbol of at most 9 characters. Its module documentation is the canonical table: constant, symbol, storage tier, and TTL policy.

As of this revision, the table labels 37 keys `instance`, 6 `persistent`, and 10 `reserved`. Two of the `reserved` labels are stale:

- `KEY_IPFS_CID` (`IPFSCID`) is read and written in **instance** storage by `metadata.rs` (`update_ipfs_cid`, `get_ipfs_cid`), via `MetadataField::IpfsCid`.
- `KEY_REENTRANCY_LOCK` (`REENTLK`) is read and written in **instance** storage by `security.rs` (`ReentrancyGuard::acquire`/`release`).

The effective split is therefore 39 instance, 6 persistent, and 8 constants that the current code does not read or write. Correcting those rows is tracked under [Open items](#known-open-items). The audit test checks table completeness, symbol uniqueness, and policy syntax; it does not verify that the declared tier or TTL policy matches actual usage.

The 8 constants not read or written today are `KEY_CONTRIBS`, `KEY_MILESTONE_STATUS`, `KEY_NEXT_RELEASE`, `KEY_VERIFICATION`, `KEY_ANALYTICS`, `KEY_ANALYTICS_DATA`, `KEY_DISPUTE_VOTE`, and `KEY_PERF_STATS`. They remain declared and are treated as reserved so their symbols are never reused. `KEY_CONTRIBS` is **retired**, not merely unused (see below).

`MetadataField` maps `Title`, `Description`, `SocialLinks`, `History`, and `IpfsCid` onto `TITLE`, `DESC`, `SOCIAL`, `METAHIST`, and `IPFSCID`. The audit test allows only these metadata aliases onto `KEY_*` symbols.

### Typed keys: `DataKey`

`DataKey` (`contracts/crowdfund/src/types/domain.rs`) is a `#[contracttype]` enum with **47** variants used for typed per-entity keys, such as `Contribution(Address)`, `ContributorPresence(Address)`, `ContributorIndex(u32)`, `ContributionHistory(Address)`, `GovernanceProposal(u32)`, and `RateLimitAmount(Address)`. The same enum is used with both tiers; the call site chooses instance or persistent storage.

The enum is encoded with the variant name as the discriminant (tuple variants encode the name plus their fields). Therefore:

- renaming a variant makes existing entries undecodable;
- reordering variants changes the name-to-index mapping and can decode an old value as the wrong variant;
- removing a variant has the same effect as renaming one.

New variants must be appended. A release that renames, reorders, or removes an existing variant requires a migration and its own review.

### Version record and current migration behaviour

- `CONTRACT_VERSION = 6` and `MIN_SUPPORTED_VERSION = 1` in `storage.rs`.
- `KEY_CONTRACT_VERSION` (`CVER`) in instance storage holds the stored version.
- `KEY_VERSION_HISTORY` (`VERHIST`) in persistent storage holds `Vec<VersionMigration>`, where each record is `{ from_version, to_version, timestamp }`.
- `migrate_version` (`lib.rs`) is admin-gated. It reads `CVER` (defaulting to `0`), writes `CONTRACT_VERSION`, appends a `VersionMigration` to `VERHIST` (preserving earlier records), extends the history entry's TTL, and emits `("contract", "migrated")`. It does **not** rewrite campaign data, and it does not reject a second call made at the current version.
- `check_version` reads `CVER` (defaulting to `CONTRACT_VERSION` when absent) and reports compatibility only when `MIN_SUPPORTED_VERSION <= stored <= CONTRACT_VERSION`. It emits `("contract", "version_checked")`. `version()` and `contract_version()` return the compile-time constant.

**Upgrade entry point:** the current crowdfund crate does not contain an `upgrade` function and does not call `update_current_contract_wasm`. ADR-007 describes in-place WASM replacement as the chosen mechanism, but the entry point still has to be added before in-place upgrades are possible. The tests named "upgrade" exercise version/migration entry points and post-upgrade state compatibility; they do not replace WASM. This ADR fixes the storage/version contract those steps rely on; it does not claim the replacement mechanism is implemented.

### Why the contributor layout changed

The original layout stored every contributor address in one `KEY_CONTRIBS: Vec<Address>` in instance storage. Each new contributor read, appended to, and rewrote the whole vector, making the write O(n) and the instance entry grow without bound. It was replaced by `DataKey::ContributorIndex(u32)` plus `DataKey::ContributorCount`, giving O(1) insertion and O(page_size) reads in `views::contributor_list` and the analytics code.

The switch landed while `CONTRACT_VERSION` was still 5 (commit `93606272`, 2026-06-20), and `migrate_version` does not backfill index entries from the retired vector. A deployment from before the switch would therefore need a one-time backfill before `contributor_list` is complete. This is exactly the kind of silent layout change this ADR exists to prevent.

## Decision

1. **Keys are the schema.** Never rename, reuse, reorder, or remove a `KEY_*` symbol or a `DataKey` variant. Add new keys/variants; retire old ones by leaving them declared and unread. A retired symbol is never reused for a different value type.
2. **Bump `CONTRACT_VERSION` for every layout change.** Additive changes are the default and do not need a value rewrite. Raise `MIN_SUPPORTED_VERSION` only when older data can no longer be read, and record that change in its own ADR.
3. **Migrations are explicit and admin-gated.** `migrate_version` records the transition. A release that must transform existing values adds an idempotent, tested migration step immediately after deployment. Read paths never perform migrations.
4. **Evidence is tests.** A schema change is accepted only when the tests listed under [References](#references) pass, and those tests are updated when the behaviour they assert changes.
5. **The table and this ADR are updated in the same change.** A new `KEY_*` requires a table row; a new `DataKey` variant that changes the layout story requires a note here.

### Migration steps

1. Add keys/variants additively in `storage.rs` / `types/domain.rs`. Do not change the value type stored under an existing key.
2. Bump `CONTRACT_VERSION` in `storage.rs`. `contracts/crowdfund/Cargo.toml` is currently `0.1.0`; the `0.{CONTRACT_VERSION}.0` convention in `docs/contract-upgrades.md` is not currently followed, so decide whether the package version needs a bump for the release.
3. If existing values must change, write the rewrite as an explicit step (extend `migrate_version` or add a separate admin-only function), seed the old layout in `migration_harness.rs`, and make re-running it safe.
4. Deploy the new WASM (ADR-007; see the entry-point gap above).
5. As admin, call `migrate_version` once per deployed contract. Verify `CVER`, the appended `VERHIST` record, and the `("contract", "migrated")` event.
6. Run `cargo test --workspace`, and specifically the tests listed under [References](#references).
7. Update the table in `storage.rs` and this ADR's key/version notes.

## Alternatives considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Symbol keys for campaign-wide fields (chosen) | Short keys minimise storage and I/O; greppable constants; matches live data | No compiler check; rename/reuse is a silent storage break | Chosen |
| Typed `DataKey` for every key | Compiler-checked construction; one inventory | Existing data sits under symbol keys; migrating all keys is costly and risky; variants still have encoding-stability rules | Rejected for this contract |
| One `KEY_CONTRIBS` `Vec<Address>` | One read returns the full list; simple | O(n) rewrite per new contributor; unbounded instance entry; hits Soroban limits; contends on every contribution | Rejected; replaced by `ContributorIndex` + `ContributorCount` |
| Full data rewrite on every version bump | One canonical layout | Expensive; a partial migration can strand funds | Rejected |
| Version bump only, additive changes (chosen default) | Cheap and low-risk; `migrate_version` stays small | Cannot handle breaking changes without an extra step | Chosen as default |
| Lazy migration on read | No admin step | Reads become writes; surprising fees and auth; timing depends on who calls first; hard to test | Rejected |
| Proxy or separate storage contract | Upgrade logic isolated | Second contract to trust and address; conflicts with ADR-007's stable-address goal | Rejected (see ADR-007) |

## Consequences

**Good:** The layout is inventoried in one table, version changes follow a fixed sequence, and the tests make key/variant drift visible. The contributor-list rewrite documents why the O(1) per-entity model is preferred.

**Bad / trade-offs:** Symbol keys are unchecked by the compiler, so correctness depends on review and on the audit test, which does not verify tier or TTL correctness. `migrate_version` is bookkeeping only; any real data transformation is additional code and tests. It is not idempotent at the current version (a second call appends a 6 → 6 record), so operators must call it once per upgrade. The contract has no WASM-upgrade entry point yet. `docs/contract-upgrades.md` is stale (it says v3 and lists `CONTRIBS` as active); treat this ADR and `storage.rs` as authoritative until it is updated.

### Known open items

- Correct the `KEY_IPFS_CID` and `KEY_REENTRANCY_LOCK` rows in the `storage.rs` table (both are instance, not reserved).
- Align the TTL-policy column with the code, or add the missing `extend_ttl` calls for `KEY_MILESTONES`, `KEY_DISPUTES`, and `KEY_DISPUTE_ID`.
- Add the `upgrade` entry point described by ADR-007, or document the deployment path that replaces it.
- For any pre-index v5 deployment, add and test a `KEY_CONTRIBS` → `ContributorIndex` backfill.
- Decide whether `migrate_version` should reject re-runs at the current version.
- Strengthen `upgrade_tests.rs` so its migration cases actually seed an old layout and call `migrate_version`; most currently assert normal post-upgrade behaviour only.

## References

- [ADR-007: Stellar Contract Upgrade Strategy & State Migration](./ADR-007-stellar-contract-upgrade-strategy.md)
- [`contracts/crowdfund/src/storage.rs`](../../contracts/crowdfund/src/storage.rs) — key table, version constants, TTL constants
- [`contracts/crowdfund/src/types/domain.rs`](../../contracts/crowdfund/src/types/domain.rs) — `DataKey`
- [`contracts/crowdfund/src/lib.rs`](../../contracts/crowdfund/src/lib.rs) — `version`, `check_version`, `migrate_version`, `get_version_history`
- [`contracts/crowdfund/src/contribute.rs`](../../contracts/crowdfund/src/contribute.rs) and [`views.rs`](../../contracts/crowdfund/src/views.rs) — `ContributorIndex` write/read path
- [`contracts/crowdfund/tests/storage_schema_test.rs`](../../contracts/crowdfund/tests/storage_schema_test.rs) — representative `DataKey` round-trips through the public API, plus symbol-key uniqueness checks
- [`contracts/crowdfund/tests/storage_key_audit.rs`](../../contracts/crowdfund/tests/storage_key_audit.rs) — every `KEY_*` has exactly one table row with a recognised policy; symbols are unique; metadata aliases are allow-listed
- [`contracts/crowdfund/tests/migration_harness.rs`](../../contracts/crowdfund/tests/migration_harness.rs) — seeds a v5 layout and a 4 → 5 history record, runs `migrate_version`, and verifies preserved keys, contribution data, append-only history, the migration event, the admin gate, and `check_version` range handling
- [`contracts/crowdfund/tests/upgrade_tests.rs`](../../contracts/crowdfund/tests/upgrade_tests.rs) — upgrade-surface behaviour: admin auth, state/fee/vesting preservation, lifecycle, refunds, rate limiting, extension voting, and migration scenarios
- [`contracts/crowdfund/tests/upgrade_step_harness.rs`](../../contracts/crowdfund/tests/upgrade_step_harness.rs) — one-test-per-step fixture for `migrate_version`
- [`docs/contract-upgrades.md`](../contract-upgrades.md) (stale; see Consequences)
- Issues #1479, #1554

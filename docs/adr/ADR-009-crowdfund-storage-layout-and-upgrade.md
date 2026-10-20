# ADR-009: Crowdfund Storage Layout and Upgrade Strategy

- **Status:** Proposed
- **Date:** 2026-10-16
- **Deciders:** Smart Contract Engineering Team, Security Maintainers

---

## Context

The crowdfund contract (`contracts/crowdfund`) keeps all campaign state on-chain. Its storage schema is spread across:

- `contracts/crowdfund/src/storage.rs`: symbol-keyed constants (`KEY_GOAL`, `KEY_TOTAL`, `KEY_CONTRACT_VERSION`, `KEY_VERSION_HISTORY`, and about 50 more (53 `KEY_` constants at time of writing)), the `CONTRACT_VERSION` constant, and the TTL constants used for persistent and instance entries.
- `DataKey`, the typed key enum re-exported from `crate::types`, used for per-contributor and per-entity data.
- `migrate_version` in `contracts/crowdfund/src/lib.rs`, which is the only entry point that changes the stored version.

Without a written record, a future change to a key name, a value type, or a version bump could silently strand existing campaigns, which hold contributor funds. ADR-007 sets the high-level upgrade policy (stable contract IDs, state preservation). This ADR records the layout that policy applies to and the concrete migration steps.

### Current facts (verified against code)

- `CONTRACT_VERSION = 6` and `MIN_SUPPORTED_VERSION = 1` in `storage.rs`.
- `migrate_version` (admin-only) reads the stored version, writes `CONTRACT_VERSION`, and appends a `VersionMigration { from_version, to_version, timestamp }` record to `KEY_VERSION_HISTORY` in persistent storage. It emits a `("contract", "migrated")` event. It does not rewrite existing campaign data.
- Each key is a `Symbol` of at most 9 characters (`symbol_short!`). Renaming a key string therefore makes existing data unreachable with no error.
- `metadata_field_key` maps `MetadataField` variants to keys, and a unit test asserts the keys are unique.

## Decision

1. **Keys are part of the storage schema.** A key string is never renamed or reused for a different type. A new field gets a new key. A retired key is documented here and left unread.
2. **Versioning is explicit.** Each schema change bumps `CONTRACT_VERSION`. `MIN_SUPPORTED_VERSION` is raised only when older data can no longer be read, and that change needs its own ADR entry.
3. **Migrations are additive and checked.** `migrate_version` records the transition in `KEY_VERSION_HISTORY`. Any step that rewrites existing values must be a new, tested migration. It must not run silently inside a read path.
4. **Evidence is tests, not prose.** A schema change is accepted only when the tests below pass:
   - `contracts/crowdfund/tests/storage_schema_test.rs`: DataKey variants and key-to-layout mapping stay stable across versions.
   - `contracts/crowdfund/tests/migration_harness.rs`: seeds storage as an older version (v4/v5), runs `migrate_version`, and checks that every seeded key is still readable and unchanged, and that version history keeps old records.
   - `contracts/crowdfund/tests/upgrade_tests.rs`: upgrade-path behavior of the contract.

### Migration steps for a schema change

1. Add or change keys in `storage.rs` following rule 1. Do not change the value type of an existing key.
2. Bump `CONTRACT_VERSION` and add a seeded old-version case to `migration_harness.rs`.
3. If existing values must change, write a migration step that reads old values, writes new values, and leaves unchanged keys untouched. Cover it with a test that seeds the old layout first.
4. Run `cargo test --workspace` and confirm the three test files above pass.
5. Update this ADR's key list and the version notes.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Symbol-keyed constants (chosen for current layout) | Short keys fit Soroban storage cost; keys are greppable constants; existing data is already in this layout | Key names are a silent contract; typos and reuse fail at runtime, not compile time |
| Single typed `DataKey` enum for everything | Compiler checks key use; one place to see all keys | Existing data sits under symbol keys, so moving it means a full migration; enum variants still need the stability rule above |
| Rewrite all data on every version bump | Single layout to reason about | Costly in fees and resource limits; a failed mid-migration state can strand funds |
| Version bump only, no value rewrites (chosen as the default) | Cheap and low risk; `migrate_version` stays small | Only works for additive changes; any breaking change needs a deliberate migration step |
| Proxy or separate storage contract | Upgrades without touching state | Adds a second contract to trust and to address; conflicts with ADR-007's stable-address goal |

## Consequences

**Good:** Contributors can see which keys exist, how versions advance, and which tests guard a change. Key renames and type changes are caught in review against this ADR.

**Bad / trade-offs:** Symbol keys stay easy to misuse, since the compiler cannot check them. Rule 1 depends on reviewers. Breaking changes need an extra migration step and tests, which adds cost to each release.

**Open items:** The rejected-alternative rationale above reflects the design trade-offs visible in the code. The original deciders' reasons are not recorded in the repo. The deciders should confirm or amend that part before this ADR is marked Accepted.

## References

- ADR-007: Stellar Contract Upgrade Strategy & State Migration
- `contracts/crowdfund/src/storage.rs`
- `contracts/crowdfund/src/lib.rs` (`migrate_version`)
- `contracts/crowdfund/tests/storage_schema_test.rs`
- `contracts/crowdfund/tests/migration_harness.rs`
- `contracts/crowdfund/tests/upgrade_tests.rs`
- Issue #1479

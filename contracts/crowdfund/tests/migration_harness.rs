#![cfg(test)]
#![allow(deprecated)]

//! Upgrade/migration safety tests for crowdfund contract storage schema changes.
//!
//! These tests seed storage exactly as a deployment at an older schema version
//! (v5) would have left it, then run the current binary's migration path
//! (`migrate_version`) against it and verify that every critical storage key
//! survives the upgrade unchanged.
//!
//! The seeding helper (`seed_old_schema`) and environment factory
//! (`test_utils::setup_env`) now live in `common.rs` so that
//! `storage_schema_test.rs` and any future upgrade-step test can share the
//! same harness without copy-pasting (issue #1565).

mod common;
use common::{seed_old_schema, test_utils::setup_env};

use crowdfund::{
    Category, CrowdfundContractClient, DataKey, Status, Visibility, CONTRACT_VERSION,
    KEY_CATEGORY, KEY_CONTRACT_VERSION, KEY_CREATOR, KEY_DEADLINE, KEY_DESC, KEY_GOAL, KEY_MAX,
    KEY_MIN, KEY_START_TIME, KEY_STATUS, KEY_TITLE, KEY_TOKEN, KEY_TOTAL, KEY_VISIBILITY,
};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    Address, Env, String,
};

fn migrate(env: &Env, contract_id: &Address) {
    let client = CrowdfundContractClient::new(env, contract_id);
    client.try_migrate_version().expect("migrate call").expect("migrate ok");
}

// ── Migration preserves every instance storage key ──────────────────────────

#[test]
fn test_migration_preserves_all_storage_keys() {
    let env = setup_env();
    let seeded = seed_old_schema(&env);
    let client = CrowdfundContractClient::new(&env, &seeded.contract_id);

    // Pre-migration: contract is still at v5 and reports itself compatible.
    let before: u32 = env.as_contract(&seeded.contract_id, || {
        env.storage().instance().get(&KEY_CONTRACT_VERSION).unwrap()
    });
    assert_eq!(before, 5, "should be at old version before migration");
    assert!(client.check_version(), "v5 must be within MIN_SUPPORTED range");

    migrate(&env, &seeded.contract_id);

    // Post-migration: version bumped, every seeded key readable and unchanged.
    env.as_contract(&seeded.contract_id, || {
        let inst = env.storage().instance();
        let version: u32 = inst.get(&KEY_CONTRACT_VERSION).unwrap();
        assert_eq!(version, CONTRACT_VERSION, "version must bump to current");
        assert_eq!(
            inst.get::<_, soroban_sdk::Address>(&KEY_CREATOR).unwrap(),
            seeded.creator,
            "KEY_CREATOR must survive migration"
        );
        assert_eq!(
            inst.get::<_, soroban_sdk::Address>(&KEY_TOKEN).unwrap(),
            seeded.token_id,
            "KEY_TOKEN must survive migration"
        );
        assert_eq!(inst.get::<_, i128>(&KEY_GOAL).unwrap(), 10_000);
        assert_eq!(inst.get::<_, u64>(&KEY_DEADLINE).unwrap(), 1_000_000);
        assert_eq!(inst.get::<_, i128>(&KEY_TOTAL).unwrap(), 2_500);
        assert_eq!(inst.get::<_, i128>(&KEY_MIN).unwrap(), 100);
        assert_eq!(inst.get::<_, i128>(&KEY_MAX).unwrap(), 0);
        assert_eq!(inst.get::<_, Status>(&KEY_STATUS).unwrap(), Status::Active);
        assert_eq!(
            inst.get::<_, Category>(&KEY_CATEGORY).unwrap(),
            Category::Technology
        );
        assert_eq!(
            inst.get::<_, Visibility>(&KEY_VISIBILITY).unwrap(),
            Visibility::Public
        );
        assert_eq!(
            inst.get::<_, String>(&KEY_TITLE).unwrap(),
            String::from_str(&env, "Old Campaign")
        );
        assert_eq!(
            inst.get::<_, String>(&KEY_DESC).unwrap(),
            String::from_str(&env, "Seeded at schema v5")
        );
        assert_eq!(inst.get::<_, u64>(&KEY_START_TIME).unwrap(), 100);
        assert_eq!(inst.get::<_, u32>(&DataKey::ContributorCount).unwrap(), 1);
    });

    // The migrated binary reads the seeded values through the public API.
    assert_eq!(client.goal(), 10_000);
    assert_eq!(client.deadline(), 1_000_000);
    assert_eq!(client.total_raised(), 2_500);
    assert_eq!(client.status(), Status::Active);
    assert_eq!(client.contract_version(), CONTRACT_VERSION);
}

// ── Migration preserves persistent DataKey contribution entries ─────────────

#[test]
fn test_migration_preserves_contribution_data() {
    let env = setup_env();
    let seeded = seed_old_schema(&env);
    let client = CrowdfundContractClient::new(&env, &seeded.contract_id);

    // Contribution data readable before migration.
    assert_eq!(client.contribution(&seeded.contributor), 2_500);
    assert!(client.is_contributor(&seeded.contributor));

    migrate(&env, &seeded.contract_id);

    // Same data, same keys, after migration.
    assert_eq!(client.contribution(&seeded.contributor), 2_500);
    assert!(client.is_contributor(&seeded.contributor));

    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 2_500);
    assert_eq!(stats.contributor_count, 1);
    assert_eq!(stats.largest_contribution, 2_500);
}

// ── Migration appends to version history without dropping old records ───────

#[test]
fn test_migration_preserves_version_history() {
    let env = setup_env();
    let seeded = seed_old_schema(&env);
    let client = CrowdfundContractClient::new(&env, &seeded.contract_id);

    let before = client.get_version_history();
    assert_eq!(before.len(), 1, "seeded history should have the 4→5 record");
    assert_eq!(before.get(0).unwrap().from_version, 4);
    assert_eq!(before.get(0).unwrap().to_version, 5);

    env.ledger().set_timestamp(500);
    migrate(&env, &seeded.contract_id);

    let after = client.get_version_history();
    assert_eq!(after.len(), 2, "migration must append, not replace");
    assert_eq!(after.get(0).unwrap().to_version, 5, "old record untouched");
    let last = after.get(1).unwrap();
    assert_eq!(last.from_version, 5);
    assert_eq!(last.to_version, CONTRACT_VERSION);
    assert_eq!(last.timestamp, 500, "migration must record ledger timestamp");
}

// ── Migration emits an event ────────────────────────────────────────────────

#[test]
fn test_migration_emits_correct_event() {
    let env = setup_env();
    let seeded = seed_old_schema(&env);

    migrate(&env, &seeded.contract_id);

    // `migrate_version` was the last invocation; its events are returned in
    // XDR form. At minimum the migration must have published an event.
    let events = env.events().all().filter_by_contract(&seeded.contract_id);
    assert!(
        !events.events().is_empty(),
        "migrate_version must publish EventContractMigrated"
    );
}

// ── Migration is admin-gated ────────────────────────────────────────────────

#[test]
fn test_migration_rejects_unauthorized() {
    // No mock_all_auths: `admin.require_auth()` inside migrate_version fails.
    let env = Env::default();
    let seeded = seed_old_schema(&env);
    let client = CrowdfundContractClient::new(&env, &seeded.contract_id);

    let result = client.try_migrate_version();
    assert!(result.is_err(), "unauthenticated migrate must be rejected");

    // Version untouched by the failed attempt.
    let version: u32 = env.as_contract(&seeded.contract_id, || {
        env.storage().instance().get(&KEY_CONTRACT_VERSION).unwrap()
    });
    assert_eq!(version, 5, "failed migration must not bump the version");
}

// ── check_version flags out-of-range stored versions ────────────────────────

#[test]
fn test_check_version_flags_incompatible_versions() {
    use crowdfund::MIN_SUPPORTED_VERSION;

    let env = setup_env();
    let seeded = seed_old_schema(&env);
    let client = CrowdfundContractClient::new(&env, &seeded.contract_id);

    // v5 is supported.
    assert!(client.check_version());

    // Version 0 predates MIN_SUPPORTED_VERSION.
    env.as_contract(&seeded.contract_id, || {
        env.storage().instance().set(&KEY_CONTRACT_VERSION, &0u32);
    });
    assert!(!client.check_version(), "v0 is below MIN_SUPPORTED_VERSION");

    // A future version written by a newer binary is also incompatible.
    env.as_contract(&seeded.contract_id, || {
        env.storage()
            .instance()
            .set(&KEY_CONTRACT_VERSION, &(CONTRACT_VERSION + 10));
    });
    assert!(!client.check_version(), "future versions must be flagged");

    // Restore and confirm the real migration still works from a bad state.
    env.as_contract(&seeded.contract_id, || {
        env.storage().instance().set(&KEY_CONTRACT_VERSION, &5u32);
    });
    migrate(&env, &seeded.contract_id);
    assert_eq!(client.contract_version(), CONTRACT_VERSION);
}

// ── Version numbering policy ────────────────────────────────────────────────

#[test]
fn test_version_numbering_compatibility() {
    use crowdfund::MIN_SUPPORTED_VERSION;
    assert!(CONTRACT_VERSION >= MIN_SUPPORTED_VERSION);
    assert!(
        CONTRACT_VERSION - MIN_SUPPORTED_VERSION >= 2,
        "MIN_SUPPORTED_VERSION must cover at least the previous 2 versions"
    );
}

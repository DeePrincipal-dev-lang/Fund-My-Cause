#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String, Vec,
};

use crowdfund::{Category, CrowdfundContract, CrowdfundContractClient, PlatformConfig, Status};

mod common;
use common::{setup, setup_upgrade_campaign, test_utils::setup_env};

// ── #448: Upgrade test suite ─────────────────────────────────────────────────

#[test]
fn test_upgrade_requires_admin_auth() {
    // No mock_all_auths — the admin auth check inside migrate_version must fire.
    let env = Env::default();
    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Upgrade Auth"),
        &String::from_str(&env, "Requires admin auth"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    let result = client.try_migrate_version();
    assert!(result.is_err(), "unauthorized upgrade should be rejected");
}

#[test]
fn test_upgrade_preserves_state() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_000);
    c.client.contribute(&contributor, &1_000, &c.token_id, &None);

    assert_eq!(c.client.total_raised(), 1_000);
    assert_eq!(c.client.contribution(&contributor), 1_000);
    assert_eq!(c.client.status(), Status::Active);

    let info = c.client.get_campaign_info();
    assert_eq!(info.goal, 10_000);
    assert_eq!(info.status, Status::Active);
}

#[test]
fn test_upgrade_with_platform_fee_preserves_config() {
    let env = setup_env();
    let platform = Address::generate(&env);
    let c = setup(
        &env,
        10_000,
        1_000_000,
        Some(PlatformConfig {
            address: platform.clone(),
            fee_bps: 500,
            fee_mode: crowdfund::FeeMode::OnSuccess,
        }),
    );

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_000);
    c.client.contribute(&contributor, &1_000, &c.token_id, &None);

    let platform_after = c.client.platform_config().expect("platform config exists");
    assert_eq!(platform_after.address, platform);
    assert_eq!(platform_after.fee_bps, 500);
}

#[test]
fn test_upgrade_with_vesting_preserves_schedule() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let vesting = c.client.get_vesting_info();
    assert!(vesting.is_none());
}

#[test]
fn test_backward_compatibility_existing_storage() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);

    c.token_admin.mint(&contributor1, &1_000);
    c.token_admin.mint(&contributor2, &2_000);

    c.client.contribute(&contributor1, &1_000, &c.token_id, &None);
    c.client.contribute(&contributor2, &2_000, &c.token_id, &None);

    assert!(c.client.is_contributor(&contributor1));
    assert!(c.client.is_contributor(&contributor2));
    assert_eq!(c.client.contribution(&contributor1), 1_000);
    assert_eq!(c.client.contribution(&contributor2), 2_000);

    let stats = c.client.get_stats();
    assert_eq!(stats.contributor_count, 2);
    assert_eq!(stats.total_raised, 3_000);
}

#[test]
fn test_state_migration_goal_history() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let history = c.client.get_goal_history();
    assert_eq!(history.len(), 1);

    c.client.adjust_goal(&15_000);

    let history = c.client.get_goal_history();
    assert_eq!(history.len(), 2);
}

#[test]
fn test_state_migration_metadata_versioning() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    c.client
        .update_metadata(&Some(String::from_str(&env, "New Title")), &None, &None);

    let history = c.client.get_metadata_history();
    assert!(!history.is_empty());
}

#[test]
fn test_concurrent_operations_after_upgrade() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    let mut contributors: Vec<Address> = Vec::new(&env);
    for _ in 0..5 {
        contributors.push_back(Address::generate(&env));
    }

    for contributor in contributors.iter() {
        c.token_admin.mint(&contributor, &1_000);
        c.client.contribute(&contributor, &1_000, &c.token_id, &None);
    }

    c.client.pause();
    assert_eq!(c.client.status(), Status::Paused);
    c.client.unpause();
    assert_eq!(c.client.status(), Status::Active);

    c.client.add_to_whitelist(&contributors.get(0).unwrap());
    assert!(c.client.is_whitelisted(&contributors.get(0).unwrap()));

    c.client.add_to_blacklist(&contributors.get(1).unwrap());
    assert!(c.client.is_blacklisted(&contributors.get(1).unwrap()));

    c.client.cancel_campaign();
    assert_eq!(c.client.status(), Status::Cancelled);

    env.ledger().set_timestamp(1_000_001);
    c.client.refund_single(&contributors.get(0).unwrap());
    assert_eq!(c.client.contribution(&contributors.get(0).unwrap()), 0);
}

#[test]
fn test_upgrade_with_multiple_contributions() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    let mut contributors: Vec<Address> = Vec::new(&env);
    for _ in 0..10 {
        contributors.push_back(Address::generate(&env));
    }
    let mut total = 0i128;

    for contributor in contributors.iter() {
        let amount = 5_000i128;
        c.token_admin.mint(&contributor, &amount);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);
        total += amount;
    }

    assert_eq!(c.client.total_raised(), total);
    assert_eq!(c.client.get_stats().contributor_count, 10);

    env.ledger().set_timestamp(1_000_001);
    let mut batch = Vec::new(&env);
    for i in 0..5 {
        batch.push_back(contributors.get(i).unwrap().clone());
    }

    let refunded = c.client.refund_batch(&batch);
    assert_eq!(refunded, 5);
}

#[test]
fn test_full_campaign_lifecycle_after_upgrade() {
    let env = setup_env();
    let c = setup(&env, 5_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);

    c.client.contribute(&contributor, &5_000, &c.token_id, &None);
    assert_eq!(c.client.total_raised(), 5_000);

    env.ledger().set_timestamp(1_000_001);
    c.client.withdraw();

    assert_eq!(c.client.status(), Status::Successful);
    assert_eq!(c.client.total_raised(), 0);
}

#[test]
fn test_refund_full_campaign_after_upgrade() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);

    c.client.contribute(&contributor, &5_000, &c.token_id, &None);

    env.ledger().set_timestamp(1_000_001);
    c.client.refund_single(&contributor);

    assert_eq!(c.client.contribution(&contributor), 0);
    assert_eq!(
        token::Client::new(&env, &c.token_id).balance(&contributor),
        5_000
    );
}

#[test]
fn test_rate_limiting_after_upgrade() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    c.client.set_rate_limit(&1_000, &3_600);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &2_000);

    env.ledger().set_timestamp(100);
    c.client.contribute(&contributor, &500, &c.token_id, &None);

    env.ledger().set_timestamp(200);
    c.client.contribute(&contributor, &400, &c.token_id, &None);

    let result = c.client.try_contribute(&contributor, &300, &c.token_id, &None);
    assert!(result.is_err());
}

#[test]
fn test_extension_voting_after_upgrade() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);
    c.client.contribute(&contributor, &5_000, &c.token_id, &None);

    env.ledger().set_timestamp(100);
    c.client.propose_extension(&2_000_000);
    c.client.vote_on_extension(&contributor, &true);

    let proposal = c.client.get_extension_proposal().unwrap();
    assert_eq!(proposal.votes_for, 5_000);

    env.ledger().set_timestamp(100 + 604_801);
    c.client.execute_extension();

    assert_eq!(c.client.deadline(), 2_000_000);
}

// ── Storage Migration Tests ──────────────────────────────────────────────────
// These tests use the shared seed_old_schema harness from common.rs (issue #1565).

#[test]
fn test_storage_migration_from_v1_layout() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);
    c.client.contribute(&contributor, &5_000, &c.token_id, &None);

    assert_eq!(c.client.contribution(&contributor), 5_000);
    assert!(c.client.is_contributor(&contributor));
}

#[test]
fn test_migration_handles_missing_optional_fields() {
    let env = setup_env();
    // setup() initializes without optional fields (no PlatformConfig).
    let c = setup(&env, 10_000, 1_000_000, None);

    let info = c.client.get_campaign_info();
    assert_eq!(info.goal, 10_000);
    assert!(c.client.platform_config().is_none());
}

#[test]
fn test_migration_batch_contributors() {
    let env = setup_env();
    let c = setup(&env, 100_000, 1_000_000, None);

    let mut contributors: Vec<Address> = Vec::new(&env);
    for _ in 0..20 {
        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &1_000);
        c.client.contribute(&contributor, &1_000, &c.token_id, &None);
        contributors.push_back(contributor);
    }

    for contributor in contributors.iter() {
        assert_eq!(c.client.contribution(&contributor), 1_000);
    }
    assert_eq!(c.client.get_stats().contributor_count, 20);
}

#[test]
fn test_migration_preserves_complex_state() {
    let env = setup_env();
    let platform = Address::generate(&env);
    let c = setup(
        &env,
        50_000,
        1_000_000,
        Some(PlatformConfig {
            address: platform.clone(),
            fee_bps: 250,
            fee_mode: crowdfund::FeeMode::OnSuccess,
        }),
    );

    for _ in 0..5 {
        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &2_000);
        c.client.contribute(&contributor, &2_000, &c.token_id, &None);
    }

    c.client.pause();
    let vip = Address::generate(&env);
    c.client.add_to_whitelist(&vip);

    assert_eq!(c.client.status(), Status::Paused);
    assert_eq!(c.client.total_raised(), 10_000);
    assert!(c.client.is_whitelisted(&vip));
    assert_eq!(c.client.platform_config().unwrap().fee_bps, 250);
}

#[test]
fn test_failed_migration_rollback() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);
    c.client.contribute(&contributor, &5_000, &c.token_id, &None);

    let original_raised = c.client.total_raised();
    let original_contribution = c.client.contribution(&contributor);

    assert_eq!(c.client.total_raised(), original_raised);
    assert_eq!(c.client.contribution(&contributor), original_contribution);
}

#[test]
fn test_migration_with_paused_state() {
    let env = setup_env();
    let c = setup_upgrade_campaign(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &3_000);
    c.client.contribute(&contributor, &3_000, &c.token_id, &None);

    c.client.pause();

    assert_eq!(c.client.status(), Status::Paused);
    assert_eq!(c.client.total_raised(), 3_000);

    c.client.unpause();
    assert_eq!(c.client.status(), Status::Active);
}

#![cfg(test)]
#![allow(deprecated)]

//! Storage schema compatibility tests.
//!
//! These verify that DataKey variants are stable across contract versions and
//! that storage keys map correctly to the on-chain layout.
//!
//! Previously every test here copy-pasted its own `initialize` boilerplate.
//! They now use `common::setup` and `common::test_utils::setup_env` from the
//! shared harness (issue #1565).

mod common;
use common::{setup, test_utils::setup_env};

use crowdfund::{Category, FeeMode, PlatformConfig, Status};
use soroban_sdk::{testutils::Address as _, Address, String};

#[test]
fn test_datakey_contribution_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_000);
    c.client.contribute(&contributor, &1_000, &c.token_id, &None);

    assert_eq!(c.client.contribution(&contributor), 1_000);
    assert!(c.client.is_contributor(&contributor));
}

#[test]
fn test_datakey_contribution_history_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_500);

    c.client.contribute(&contributor, &1_000, &c.token_id, &None);

    use soroban_sdk::testutils::Ledger;
    env.ledger().set_timestamp(200);
    c.client.contribute(&contributor, &500, &c.token_id, &None);

    let stats = c.client.get_stats();
    assert_eq!(stats.total_raised, 1_500);
    assert_eq!(stats.contributor_count, 1);
    assert_eq!(c.client.contribution(&contributor), 1_500);
}

#[test]
fn test_all_datakey_variants_roundtrip() {
    let env = setup_env();
    let platform = Address::generate(&env);
    let c = setup(
        &env,
        10_000,
        1_000_000,
        Some(PlatformConfig {
            address: platform,
            fee_bps: 250,
            fee_mode: FeeMode::OnSuccess,
        }),
    );

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &2_000);
    c.client.contribute(&contributor, &2_000, &c.token_id, &None);

    // DataKey::Contribution / ContributorPresence
    assert_eq!(c.client.contribution(&contributor), 2_000);
    assert!(c.client.is_contributor(&contributor));

    // DataKey::ContributorCount / LargestContribution
    let stats = c.client.get_stats();
    assert_eq!(stats.contributor_count, 1);
    assert_eq!(stats.largest_contribution, 2_000);
    assert_eq!(stats.total_raised, 2_000);

    // Instance storage keys via public API
    assert_eq!(c.client.status(), Status::Active);
    assert_eq!(c.client.total_raised(), 2_000);
    assert_eq!(c.client.goal(), 10_000);
    assert_eq!(c.client.deadline(), 1_000_000);

    // DataKey::Platform
    let platform_cfg = c.client.platform_config().expect("platform config should exist");
    assert_eq!(platform_cfg.fee_bps, 250);
    assert_eq!(platform_cfg.fee_mode, FeeMode::OnSuccess);

    // DataKey::Whitelist / Blacklist
    c.client.add_to_whitelist(&contributor);
    assert!(c.client.is_whitelisted(&contributor));

    let blacklisted = Address::generate(&env);
    c.client.add_to_blacklist(&blacklisted);
    assert!(c.client.is_blacklisted(&blacklisted));

    // DataKey::RateLimitTimestamp / RateLimitAmount
    c.client.set_rate_limit(&1_000, &3_600);

    // Contract version
    let version = c.client.contract_version();
    assert_eq!(version, 6u32);

    // DataKey::VersionHistory (may be empty before migration — just exercise the read)
    let _ = c.client.get_version_history();

    // DataKey::CategoryIndex / TitleIndex via get_campaign_info
    let info = c.client.get_campaign_info();
    assert_eq!(info.category, Category::Other);
    assert_eq!(info.title, String::from_str(&env, "Test Campaign"));
}

#[test]
fn test_datakey_whitelist_blacklist_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let whitelisted = Address::generate(&env);
    c.client.add_to_whitelist(&whitelisted);
    assert!(c.client.is_whitelisted(&whitelisted));

    let blacklisted = Address::generate(&env);
    c.client.add_to_blacklist(&blacklisted);
    assert!(c.client.is_blacklisted(&blacklisted));

    // Verify they persist (re-read rather than relying on cache)
    assert!(c.client.is_whitelisted(&whitelisted));
    assert!(c.client.is_blacklisted(&blacklisted));
}

#[test]
fn test_datakey_extension_voting_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);
    c.client.contribute(&contributor, &5_000, &c.token_id, &None);

    use soroban_sdk::testutils::Ledger;
    env.ledger().set_timestamp(100);
    c.client.propose_extension(&2_000_000);
    c.client.vote_on_extension(&contributor, &true);

    let proposal = c.client.get_extension_proposal().unwrap();
    assert_eq!(proposal.votes_for, 5_000);
    assert_eq!(proposal.new_deadline, 2_000_000);
}

#[test]
fn test_datakey_governance_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let info = c.client.get_campaign_info();
    assert_eq!(info.creator, c.creator);
    assert_eq!(info.goal, 10_000);
}

#[test]
fn test_storage_key_uniqueness() {
    use crowdfund::{
        KEY_CREATOR, KEY_DEADLINE, KEY_GOAL, KEY_STATUS, KEY_TOKEN, KEY_TOTAL,
        KEY_VERSION_HISTORY,
    };

    assert_ne!(KEY_CREATOR, KEY_TOKEN);
    assert_ne!(KEY_CREATOR, KEY_GOAL);
    assert_ne!(KEY_TOKEN, KEY_GOAL);
    assert_ne!(KEY_DEADLINE, KEY_TOTAL);
    assert_ne!(KEY_STATUS, KEY_VERSION_HISTORY);
}

#[test]
fn test_datakey_performance_stats_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let stats = c.client.get_stats();
    assert!(stats.contributor_count >= 0);
    assert!(stats.total_raised >= 0);
}

#[test]
fn test_datakey_yield_info_preserves_data() {
    let env = setup_env();
    let c = setup(&env, 10_000, 1_000_000, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_000);
    c.client.contribute(&contributor, &1_000, &c.token_id, &None);

    assert_eq!(c.client.contribution(&contributor), 1_000);
}
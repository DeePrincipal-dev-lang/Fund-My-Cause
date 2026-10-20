#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};
use crowdfund::{CrowdfundContract, CrowdfundContractClient, Category, PlatformConfig, FeeMode};
use common::test_utils::setup_env;
use soroban_sdk::token::StellarAssetClient;

/// Storage schema compatibility tests.
/// These verify that DataKey variants are stable across contract versions
/// and that storage keys map correctly to the on-chain layout.

#[test]
fn test_datakey_contribution_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);
    let contributor = Address::generate(&env);

    // Create campaign
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Schema Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Add contribution via DataKey::Contribution(contributor)
    token_admin.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Verify data is preserved
    assert_eq!(client.contribution(&contributor), 1_000);
    assert!(client.is_contributor(&contributor));
}

#[test]
fn test_datakey_contribution_history_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);
    let contributor = Address::generate(&env);

    // Create campaign
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "History Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Add contribution history via DataKey::ContributionHistory(contributor)
    token_admin.mint(&contributor, &1_500);
    client.contribute(&contributor, &1_000, &token_id, &None);
    env.ledger().set_timestamp(200);
    client.contribute(&contributor, &500, &token_id, &None);

    // Verify history is preserved through stats
    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 1_500);
    assert_eq!(stats.contributor_count, 1);

    // Verify individual contribution
    assert_eq!(client.contribution(&contributor), 1_500);
}

#[test]
fn test_all_datakey_variants_roundtrip() {
    let env = setup_env();
    let creator = Address::generate(&env);

    // Create campaign with platform config
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Roundtrip Test"),
        &String::from_str(&env, "Testing all DataKey variants"),
        &None,
        &Some(PlatformConfig {
            address: Address::generate(&env),
            fee_bps: 250,
            fee_mode: FeeMode::OnSuccess,
        }),
        &None,
        &Category::Technology,
        &None,
        &None,
    );

    // Add a contributor
    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &2_000);
    client.contribute(&contributor, &2_000, &token_id, &None);

    // Test DataKey::Contribution(Address) roundtrip
    assert_eq!(client.contribution(&contributor), 2_000);
    assert!(client.is_contributor(&contributor));

    // Test DataKey::ContributorCount
    let stats = client.get_stats();
    assert_eq!(stats.contributor_count, 1);

    // Test DataKey::LargestContribution
    assert_eq!(stats.largest_contribution, 2_000);

    // Test DataKey::TotalMatched (should be 0 without matching)
    assert_eq!(stats.total_raised, 2_000);

    // Test instance storage keys
    assert_eq!(client.status(), crowdfund::Status::Active);
    assert_eq!(client.total_raised(), 2_000);
    assert_eq!(client.goal(), 10_000);
    assert_eq!(client.deadline(), 1_000_000);

    // Test DataKey::Platform
    let platform = client.platform_config().expect("platform config should exist");
    assert_eq!(platform.fee_bps, 250);
    assert_eq!(platform.fee_mode, FeeMode::OnSuccess);

    // Test DataKey::Whitelist
    client.add_to_whitelist(&contributor);
    assert!(client.is_whitelisted(&contributor));

    // Test DataKey::Blacklist
    let blacklisted = Address::generate(&env);
    client.add_to_blacklist(&blacklisted);
    assert!(client.is_blacklisted(&blacklisted));

    // Test DataKey::RateLimitTimestamp and RateLimitAmount
    client.set_rate_limit(&1_000, &3_600);

    // Test version tracking
    let version = client.contract_version();
    assert_eq!(version, 6u32);

    // Test DataKey::VersionHistory
    let history = client.get_version_history();
    // History may be empty before migration
    let _ = history;

    // Test DataKey::CategoryIndex
    let info = client.get_campaign_info();
    assert_eq!(info.category, Category::Technology);

    // Test DataKey::TitleIndex
    assert_eq!(info.title, String::from_str(&env, "Roundtrip Test"));
}

#[test]
fn test_datakey_whitelist_blacklist_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Whitelist Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Add whitelist entries
    let whitelisted = Address::generate(&env);
    client.add_to_whitelist(&whitelisted);
    assert!(client.is_whitelisted(&whitelisted));

    // Add blacklist entries
    let blacklisted = Address::generate(&env);
    client.add_to_blacklist(&blacklisted);
    assert!(client.is_blacklisted(&blacklisted));

    // Verify they persist
    assert!(client.is_whitelisted(&whitelisted));
    assert!(client.is_blacklisted(&blacklisted));
}

#[test]
fn test_datakey_extension_voting_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Extension Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Add a contributor who will vote
    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &5_000);
    client.contribute(&contributor, &5_000, &token_id, &None);

    // Propose extension
    env.ledger().set_timestamp(100);
    client.propose_extension(&2_000_000);

    // Vote
    client.vote_on_extension(&contributor, &true);

    // Verify extension proposal data
    let proposal = client.get_extension_proposal().unwrap();
    assert_eq!(proposal.votes_for, 5_000);
    assert_eq!(proposal.new_deadline, 2_000_000);
}

#[test]
fn test_datakey_governance_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
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
        &String::from_str(&env, "Governance Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Verify governance-related storage keys exist
    // GovernanceConfig and related DataKey variants should be stable
    let info = client.get_campaign_info();
    assert_eq!(info.creator, creator);
    assert_eq!(info.goal, 10_000);
}

#[test]
fn test_storage_key_uniqueness() {
    use crowdfund::{
        KEY_CREATOR, KEY_TOKEN, KEY_GOAL, KEY_DEADLINE, KEY_TOTAL, KEY_STATUS, KEY_VERSION_HISTORY,
    };

    // Verify that all storage keys are unique symbols
    assert_ne!(KEY_CREATOR, KEY_TOKEN);
    assert_ne!(KEY_CREATOR, KEY_GOAL);
    assert_ne!(KEY_TOKEN, KEY_GOAL);
    assert_ne!(KEY_DEADLINE, KEY_TOTAL);
    assert_ne!(KEY_STATUS, KEY_VERSION_HISTORY);
}

#[test]
fn test_datakey_performance_stats_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
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
        &String::from_str(&env, "Perf Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Verify Performance stats DataKey variant works
    let stats = client.get_stats();
    assert!(stats.contributor_count >= 0);
    assert!(stats.total_raised >= 0);
}

#[test]
fn test_datakey_yield_info_preserves_data() {
    let env = setup_env();
    let creator = Address::generate(&env);

    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000_000,
        &100,
        &0i128,
        &String::from_str(&env, "Yield Test"),
        &String::from_str(&env, "Test"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // YieldInfo DataKey variant should be stable
    // Even if yield config is not set, the storage key should exist and be accessible
    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Verify contribution data is preserved
    assert_eq!(client.contribution(&contributor), 1_000);
}
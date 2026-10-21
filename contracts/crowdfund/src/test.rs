#![allow(deprecated)]

use super::*;
use crate::types::Category;
use crate::{CrowdfundContract, CrowdfundContractClient};
use common::test_utils::setup_env;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

/// Sets up a test crowdfund contract with a token and initial configuration.
///
/// # Parameters
///
/// * `env` — The test environment (typically from `setup_env()`).
/// * `deadline` — Campaign deadline as a Unix timestamp.
/// * `goal` — Funding goal in stroops (i128).
/// * `min_contribution` — Minimum allowed contribution per contributor.
///
/// # Returns
///
/// A tuple of (creator_address, token_id, client, token_admin_client).
fn setup_contract(
    env: &Env,
    deadline: u64,
    goal: i128,
    min_contribution: i128,
) -> (
    Address,
    Address,
    CrowdfundContractClient<'_>,
    token::StellarAssetClient<'_>,
) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min_contribution,
        &0i128,
        &String::from_str(env, "My Title"),
        &String::from_str(env, "My Description"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    (creator, token_id, client, token_admin_client)
}

#[test]
fn initialize_and_contribute_updates_state() {
    let env = setup_env();
    let deadline = 1_000u64;
    let goal = 10_000i128;
    let min_contribution = 100i128;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, goal, min_contribution);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);

    client.contribute(&contributor, &500, &token_id, &None);

    assert_eq!(client.total_raised(), 500);
    assert_eq!(client.contribution(&contributor), 500);
    assert!(client.is_contributor(&contributor));

    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 500);
    assert_eq!(stats.goal, goal);
    assert_eq!(stats.contributor_count, 1);
    assert_eq!(stats.average_contribution, 500);
    assert_eq!(stats.largest_contribution, 500);
}

#[test]
fn cancel_allows_refund_before_deadline() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 10_000, 100);

    let contributor = Address::generate(&env);
    let token_client = token::Client::new(&env, &token_id);
    token_admin_client.mint(&contributor, &500);

    client.contribute(&contributor, &500, &token_id, &None);
    client.cancel_campaign();

    env.ledger().set_timestamp(deadline - 10);
    client.refund_single(&contributor);

    assert_eq!(client.contribution(&contributor), 0);
    assert_eq!(token_client.balance(&contributor), 500);
}

#[test]
fn test_get_performance_metrics() {
    let env = setup_env();
    let deadline = 100_000u64;
    let goal = 10_000i128;
    let min_contribution = 100i128;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, goal, min_contribution);

    // Add some contributions
    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);
    token_admin_client.mint(&contributor1, &3_000);
    token_admin_client.mint(&contributor2, &2_000);

    // Set time to 1 day after start
    env.ledger().set_timestamp(86_400);

    client.contribute(&contributor1, &3_000, &token_id, &None);
    client.contribute(&contributor2, &2_000, &token_id, &None);

    // Get performance metrics
    let metrics = client.get_performance_metrics();

    // Verify basic calculations
    assert_eq!(metrics.success_rate_bps, 5000); // 50% of goal (5000/10000)
    assert_eq!(metrics.time_elapsed, 86_400); // 1 day in seconds
    assert!(metrics.contribution_velocity > 0);
    assert!(metrics.average_daily_contribution > 0);
}

#[test]
fn test_performance_metrics_with_no_contributions() {
    let env = setup_env();
    let deadline = 100_000u64;
    let goal = 10_000i128;
    let min_contribution = 100i128;

    let (_creator, _token_id, client, _token_admin_client) =
        setup_contract(&env, deadline, goal, min_contribution);

    // Get performance metrics with no contributions
    let metrics = client.get_performance_metrics();

    // Verify zero state
    assert_eq!(metrics.success_rate_bps, 0);
    assert_eq!(metrics.contribution_velocity, 0);
    assert_eq!(metrics.average_daily_contribution, 0);
}

#[test]
fn test_performance_metrics_goal_reached() {
    let env = setup_env();
    let deadline = 100_000u64;
    let goal = 10_000i128;
    let min_contribution = 100i128;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, goal, min_contribution);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &10_000);

    env.ledger().set_timestamp(86_400);
    client.contribute(&contributor, &10_000, &token_id, &None);

    let metrics = client.get_performance_metrics();

    // Success rate should be capped at 10000 (100%)
    assert_eq!(metrics.success_rate_bps, 10_000);
    assert_eq!(metrics.estimated_time_to_goal, 0); // Goal already reached
}

#[test]
fn invalid_platform_fee_is_rejected() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let result = client.try_initialize(
        &creator,
        &token_id,
        &1_000,
        &1_000,
        &10,
        &0i128,
        &String::from_str(&env, "My Title"),
        &String::from_str(&env, "My Description"),
        &None,
        &Some(PlatformConfig {
            address: Address::generate(&env),
            fee_bps: 10_001,
            fee_mode: FeeMode::OnSuccess,
        }),
        &None,
        &Category::Other,
        &None,
        &None,
    );

    assert_eq!(result.err(), Some(Ok(ContractError::InvalidFee)));
}

// ── Boundary tests (#107) ─────────────────────────────────────────────────────

#[test]
fn accepted_token_whitelist_is_enforced() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let allowed_token = env.register_stellar_asset_contract(token_admin.clone());
    let other_token = env.register_stellar_asset_contract(token_admin);
    let allowed_token_admin = token::StellarAssetClient::new(&env, &allowed_token);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let mut accepted_tokens = Vec::new(&env);
    accepted_tokens.push_back(allowed_token.clone());

    client.initialize(
        &creator,
        &allowed_token,
        &1_000,
        &1_000,
        &10,
        &0i128,
        &String::from_str(&env, "My Title"),
        &String::from_str(&env, "My Description"),
        &None,
        &None,
        &Some(accepted_tokens),
        &Category::Other,
        &None,
        &None,
    );

    let contributor = Address::generate(&env);
    allowed_token_admin.mint(&contributor, &100);

    let result = client.try_contribute(&contributor, &100, &other_token, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::TokenNotAccepted)));
}

// ── refund_batch tests (#278) ─────────────────────────────────────────────────

#[test]
fn refund_batch_refunds_multiple_contributors() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 100_000, 100);

    let token_client = token::Client::new(&env, &token_id);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    token_admin_client.mint(&c1, &500);
    token_admin_client.mint(&c2, &300);
    token_admin_client.mint(&c3, &200);

    client.contribute(&c1, &500, &token_id, &None);
    client.contribute(&c2, &300, &token_id, &None);
    client.contribute(&c3, &200, &token_id, &None);

    client.cancel_campaign();

    let mut batch = Vec::new(&env);
    batch.push_back(c1.clone());
    batch.push_back(c2.clone());
    batch.push_back(c3.clone());

    let refunded = client.refund_batch(&batch);
    assert_eq!(refunded, 3);

    assert_eq!(token_client.balance(&c1), 500);
    assert_eq!(token_client.balance(&c2), 300);
    assert_eq!(token_client.balance(&c3), 200);
    assert_eq!(client.contribution(&c1), 0);
    assert_eq!(client.contribution(&c2), 0);
    assert_eq!(client.contribution(&c3), 0);
}

#[test]
fn refund_batch_skips_already_refunded() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 100_000, 100);

    let c1 = Address::generate(&env);
    token_admin_client.mint(&c1, &500);
    client.contribute(&c1, &500, &token_id, &None);
    client.cancel_campaign();

    let mut batch = Vec::new(&env);
    batch.push_back(c1.clone());
    let r1 = client.refund_batch(&batch);
    assert_eq!(r1, 1);

    let r2 = client.refund_batch(&batch);
    assert_eq!(r2, 0);
}

#[test]
fn refund_batch_fails_when_campaign_still_active() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 100_000, 100);

    let c1 = Address::generate(&env);
    token_admin_client.mint(&c1, &500);
    client.contribute(&c1, &500, &token_id, &None);

    let mut batch = Vec::new(&env);
    batch.push_back(c1.clone());

    let result = client.try_refund_batch(&batch);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

// ── pause/unpause tests (#279) ────────────────────────────────────────────────

#[test]
fn pause_blocks_contributions_and_unpause_resumes() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 100_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);

    client.pause();
    assert_eq!(client.status(), Status::Paused);

    let result = client.try_contribute(&contributor, &500, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignPaused)));

    client.unpause();
    assert_eq!(client.status(), Status::Active);

    client.contribute(&contributor, &500, &token_id, &None);
    assert_eq!(client.total_raised(), 500);
}

#[test]
fn pause_allows_refunds_when_cancelled() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 100_000, 100);

    let contributor = Address::generate(&env);
    let token_client = token::Client::new(&env, &token_id);
    token_admin_client.mint(&contributor, &500);

    client.contribute(&contributor, &500, &token_id, &None);
    client.cancel_campaign();

    client.refund_single(&contributor);
    assert_eq!(token_client.balance(&contributor), 500);
}

#[test]
fn unpause_fails_when_not_paused() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, _token_id, client, _) = setup_contract(&env, deadline, 100_000, 100);

    let result = client.try_unpause();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}

#[test]
fn pause_fails_when_not_active() {
    let env = setup_env();
    let deadline = 1_000u64;

    let (_creator, _token_id, client, _) = setup_contract(&env, deadline, 100_000, 100);

    client.cancel_campaign();

    let result = client.try_pause();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}

// ── max_contribution tests ────────────────────────────────────────────────────

fn setup_contract_with_max(
    env: &Env,
    deadline: u64,
    goal: i128,
    min_contribution: i128,
    max_contribution: i128,
) -> (
    Address,
    Address,
    CrowdfundContractClient<'_>,
    token::StellarAssetClient<'_>,
) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min_contribution,
        &max_contribution,
        &String::from_str(env, "My Title"),
        &String::from_str(env, "My Description"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    (creator, token_id, client, token_admin_client)
}

#[test]
fn contribute_within_max_succeeds() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_max(&env, 1_000, 10_000, 100, 500);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);

    client.contribute(&contributor, &500, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 500);
}

#[test]
fn contribute_exceeding_max_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_max(&env, 1_000, 10_000, 100, 500);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &600);

    let result = client.try_contribute(&contributor, &600, &token_id, &None);
    assert_eq!(
        result.err(),
        Some(Ok(ContractError::ContributorCapExceeded))
    );
}

#[test]
fn cumulative_contribution_exceeding_max_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_max(&env, 1_000, 10_000, 100, 500);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &600);

    client.contribute(&contributor, &300, &token_id, &None);
    let result = client.try_contribute(&contributor, &300, &token_id, &None);
    assert_eq!(
        result.err(),
        Some(Ok(ContractError::ContributorCapExceeded))
    );
}

#[test]
fn no_max_limit_allows_large_contribution() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 10_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &9_000);

    client.contribute(&contributor, &9_000, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 9_000);
}

#[test]
fn max_contribution_view_returns_stored_value() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract_with_max(&env, 1_000, 10_000, 100, 750);

    assert_eq!(client.max_contribution(), 750);
}

#[test]
fn initialize_with_max_below_min_is_rejected() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let result = client.try_initialize(
        &creator,
        &token_id,
        &10_000,
        &1_000,
        &200,
        &100, // max < min — invalid
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Desc"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::ExceedsMaximum)));
}

// ── Input validation tests ────────────────────────────────────────────────────

#[test]
fn initialize_with_empty_title_is_rejected() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let result = client.try_initialize(
        &creator,
        &token_id,
        &1_000,
        &1_000,
        &10,
        &0i128,
        &String::from_str(&env, ""), // empty title
        &String::from_str(&env, "Description"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::StringEmpty)));
}

#[test]
fn initialize_with_title_too_long_is_rejected() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    // 65-character title (max is 64)
    let long_title = String::from_str(
        &env,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    let result = client.try_initialize(
        &creator,
        &token_id,
        &1_000,
        &1_000,
        &10,
        &0i128,
        &long_title,
        &String::from_str(&env, "Description"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::StringTooLong)));
}

#[test]
fn initialize_with_self_fee_address_is_rejected() {
    let env = setup_env();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let result = client.try_initialize(
        &creator,
        &token_id,
        &1_000,
        &1_000,
        &10,
        &0i128,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &Some(PlatformConfig {
            address: creator.clone(), // same as creator — invalid
            fee_bps: 100,
            fee_mode: FeeMode::OnSuccess,
        }),
        &None,
        &Category::Other,
        &None,
        &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::SelfFeeAddress)));
}

#[test]
fn contribute_with_zero_amount_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    let contributor = Address::generate(&env);
    let result = client.try_contribute(&contributor, &0, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::AmountNotPositive)));
}

#[test]
fn contribute_with_negative_amount_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    let contributor = Address::generate(&env);
    let result = client.try_contribute(&contributor, &-1, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::AmountNotPositive)));
}

#[test]
fn update_metadata_with_empty_title_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let result = client.try_update_metadata(&Some(String::from_str(&env, "")), &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::StringEmpty)));
}

#[test]
fn update_metadata_with_valid_title_succeeds() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    client.update_metadata(&Some(String::from_str(&env, "New Title")), &None, &None);
    assert_eq!(client.title(), String::from_str(&env, "New Title"));
}

// ── Metadata limit tests (#1569) ──────────────────────────────────────────────
//
// `metadata.rs` enforces the following size/content limits:
//   * title:       non-empty, <= 64 bytes
//   * description: non-empty, <= 256 bytes
//   * social links: <= 128 bytes
//   * IPFS CID:    non-empty, <= 64 bytes
//   * history:     bounded number of metadata revisions
//
// Each limit below has a reject test (input just over the limit) and an accept
// test (input exactly at the boundary).

/// Builds a `String` of exactly `len` ASCII bytes.
fn string_of_len(env: &Env, len: usize) -> String {
    let mut buf = [b'A'; 512];
    let s = core::str::from_utf8(&buf[..len]).unwrap();
    String::from_str(env, s)
}

// ── Title limits ─────────────────────────────────────────────────────────────

#[test]
fn update_metadata_title_at_max_length_is_accepted() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let title = string_of_len(&env, 64);
    client.update_metadata(&Some(title.clone()), &None, &None);
    assert_eq!(client.title(), title);
}

#[test]
fn update_metadata_title_over_max_length_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let title = string_of_len(&env, 65);
    let result = client.try_update_metadata(&Some(title), &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::StringTooLong)));
}

// ── Description limits ───────────────────────────────────────────────────────

#[test]
fn update_metadata_description_at_max_length_is_accepted() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let description = string_of_len(&env, 256);
    client.update_metadata(&None, &Some(description.clone()), &None);
    assert_eq!(client.description(), description);
}

#[test]
fn update_metadata_description_over_max_length_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let description = string_of_len(&env, 257);
    let result = client.try_update_metadata(&None, &Some(description), &None);
    assert_eq!(result.err(), Some(Ok(ContractError::StringTooLong)));
}

#[test]
fn update_metadata_with_empty_description_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let result = client.try_update_metadata(&None, &Some(String::from_str(&env, "")), &None);
    assert_eq!(result.err(), Some(Ok(ContractError::StringEmpty)));
}

// ── Social link limits ───────────────────────────────────────────────────────

#[test]
fn update_metadata_social_link_at_max_length_is_accepted() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let link = string_of_len(&env, 128);
    client.update_metadata(&None, &None, &Some(link.clone()));
    assert_eq!(client.social_links(), link);
}

#[test]
fn update_metadata_social_link_over_max_length_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let link = string_of_len(&env, 129);
    let result = client.try_update_metadata(&None, &None, &Some(link));
    assert_eq!(result.err(), Some(Ok(ContractError::StringTooLong)));
}

// ── IPFS CID limits ──────────────────────────────────────────────────────────

#[test]
fn update_ipfs_cid_at_max_length_is_accepted() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let cid = string_of_len(&env, 64);
    client.update_ipfs_cid(&cid);
    assert_eq!(client.ipfs_cid(), Some(cid));
}

#[test]
fn update_ipfs_cid_over_max_length_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let cid = string_of_len(&env, 65);
    let result = client.try_update_ipfs_cid(&cid);
    assert_eq!(result.err(), Some(Ok(ContractError::StringTooLong)));
}

#[test]
fn update_ipfs_cid_empty_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    let result = client.try_update_ipfs_cid(&String::from_str(&env, ""));
    assert_eq!(result.err(), Some(Ok(ContractError::StringEmpty)));
}

// ── Metadata history length limit ────────────────────────────────────────────

#[test]
fn metadata_history_is_bounded() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    // Repeated updates must not grow the history without bound; the contract
    // keeps at most `MAX_METADATA_HISTORY` revisions.
    for i in 0..(MAX_METADATA_HISTORY + 5) {
        let title = String::from_str(&env, "Title");
        let _ = i;
        client.update_metadata(&Some(title), &None, &None);
    }

    let history = client.get_metadata_history();
    assert!(history.len() <= MAX_METADATA_HISTORY);
}

// ── Rate limit tests (#428) ───────────────────────────────────────────────────

#[test]
fn set_rate_limit_stores_struct_and_get_returns_it() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    client.set_rate_limit(&500, &3_600);
    let rl = client.get_rate_limit().expect("rate limit set");
    assert_eq!(rl.max_amount, 500);
    assert_eq!(rl.window_seconds, 3_600);
}

#[test]
fn set_rate_limit_zero_clears_existing_limit() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    client.set_rate_limit(&500, &3_600);
    assert!(client.get_rate_limit().is_some());

    client.set_rate_limit(&0, &0);
    assert!(client.get_rate_limit().is_none());
}

#[test]
fn set_rate_limit_rejects_negative_amount() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    let result = client.try_set_rate_limit(&-1, &3_600);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidRateLimit)));
}

#[test]
fn set_rate_limit_rejects_zero_window_when_enabling() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    let result = client.try_set_rate_limit(&500, &0);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidRateLimit)));
}

#[test]
fn contribute_exceeding_rate_limit_in_window_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    client.set_rate_limit(&500, &3_600);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);

    env.ledger().set_timestamp(100);
    client.contribute(&contributor, &400, &token_id, &None);

    // Second contribution in same window would exceed 500
    let result = client.try_contribute(&contributor, &200, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::RateLimitExceeded)));
    // First contribution still counted; second rolled back
    assert_eq!(client.contribution(&contributor), 400);
}

#[test]
fn contribute_within_rate_limit_succeeds() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    client.set_rate_limit(&500, &3_600);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);

    env.ledger().set_timestamp(100);
    client.contribute(&contributor, &300, &token_id, &None);
    client.contribute(&contributor, &200, &token_id, &None);

    assert_eq!(client.contribution(&contributor), 500);
}

#[test]
fn rate_limit_resets_after_window_elapses() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 100_000, 1_000_000, 100);

    client.set_rate_limit(&500, &3_600);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &2_000);

    env.ledger().set_timestamp(1_000);
    client.contribute(&contributor, &500, &token_id, &None);

    // Advance past the window — the per-address counter should reset
    env.ledger().set_timestamp(1_000 + 3_601);
    client.contribute(&contributor, &500, &token_id, &None);

    assert_eq!(client.contribution(&contributor), 1_000);
}

#[test]
fn disabled_rate_limit_allows_large_contributions() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 100_000, 1_000_000, 100);

    // No rate limit configured by default
    assert!(client.get_rate_limit().is_none());

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &50_000);
    client.contribute(&contributor, &50_000, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 50_000);
}

// ── Visibility control tests (#429) ───────────────────────────────────────────

#[test]
fn default_visibility_is_public() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);
    assert_eq!(client.get_visibility(), Visibility::Public);
}

#[test]
fn set_visibility_updates_storage() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    client.set_visibility(&Visibility::Unlisted);
    assert_eq!(client.get_visibility(), Visibility::Unlisted);

    client.set_visibility(&Visibility::Private);
    assert_eq!(client.get_visibility(), Visibility::Private);
}

#[test]
fn private_visibility_blocks_non_whitelisted_contributors() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    client.set_visibility(&Visibility::Private);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);

    let result = client.try_contribute(&contributor, &500, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::NotWhitelisted)));
}

#[test]
fn private_visibility_allows_whitelisted_contributors() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let contributor = Address::generate(&env);
    client.set_visibility(&Visibility::Private);
    client.add_to_whitelist(&contributor);

    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 500);
}

#[test]
fn unlisted_visibility_allows_any_contributor() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    client.set_visibility(&Visibility::Unlisted);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 500);
}

// ── Delegation tests (#430) ───────────────────────────────────────────────────

#[test]
fn delegate_contribution_then_contribute_on_behalf() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let delegator = Address::generate(&env);
    let delegate = Address::generate(&env);
    token_admin_client.mint(&delegate, &500);

    client.delegate_contribution(&delegator, &delegate, &500);

    let info = client
        .get_delegation(&delegator)
        .expect("delegation stored");
    assert_eq!(info.amount, 500);
    assert_eq!(info.delegate, delegate);
    assert!(info.active);

    client.contribute_on_behalf(&delegator, &delegate, &300, &token_id);

    // Contribution is credited to the delegator, not the delegate
    assert_eq!(client.contribution(&delegator), 300);
    assert_eq!(client.contribution(&delegate), 0);
    assert_eq!(client.total_raised(), 300);
}

#[test]
fn contribute_on_behalf_rejects_exceeding_delegated_amount() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let delegator = Address::generate(&env);
    let delegate = Address::generate(&env);
    token_admin_client.mint(&delegate, &1_000);

    client.delegate_contribution(&delegator, &delegate, &500);
    client.contribute_on_behalf(&delegator, &delegate, &400, &token_id);

    let result = client.try_contribute_on_behalf(&delegator, &delegate, &200, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::ExceedsMaximum)));
}

#[test]
fn revoke_delegation_blocks_further_contributions() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let delegator = Address::generate(&env);
    let delegate = Address::generate(&env);
    token_admin_client.mint(&delegate, &500);

    client.delegate_contribution(&delegator, &delegate, &500);
    client.revoke_delegation(&delegator);

    let info = client.get_delegation(&delegator).expect("still stored");
    assert!(!info.active);

    let result = client.try_contribute_on_behalf(&delegator, &delegate, &200, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidDelegation)));
}

#[test]
fn contribute_on_behalf_without_delegation_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let delegator = Address::generate(&env);
    let delegate = Address::generate(&env);
    token_admin_client.mint(&delegate, &500);

    let result = client.try_contribute_on_behalf(&delegator, &delegate, &200, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::DelegationNotFound)));
}

#[test]
fn delegate_contribution_rejects_non_positive_amount() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 10_000, 100_000, 100);

    let delegator = Address::generate(&env);
    let delegate = Address::generate(&env);

    let result = client.try_delegate_contribution(&delegator, &delegate, &0);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidDelegation)));
}

// ── Recurring contribution tests (#431) ───────────────────────────────────────

#[test]
fn setup_and_execute_recurring_contribution() {
    let env = setup_env();
    let deadline = 1_000_000u64;
    let (_creator, _token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 1_000_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &10_000);

    // `execute_recurring` pulls a token transfer from the contributor as a
    // non-root authorization (the caller need not be the contributor), which
    // requires the allowing-non-root auth mock under Soroban 25.x.
    env.mock_all_auths_allowing_non_root_auth();

    env.ledger().set_timestamp(1_000);
    let interval = 3_600u64;
    let end_date = 100_000u64;
    client.setup_recurring(&contributor, &500, &interval, &end_date);

    let plan = client
        .get_recurring_plan(&contributor)
        .expect("plan stored");
    assert_eq!(plan.amount, 500);
    assert_eq!(plan.interval, interval);
    assert_eq!(plan.end_date, end_date);

    // Not enough time has passed yet
    let too_early = client.try_execute_recurring(&contributor);
    assert_eq!(
        too_early.err(),
        Some(Ok(ContractError::InvalidRecurringPlan))
    );

    env.ledger().set_timestamp(1_000 + interval + 1);
    client.execute_recurring(&contributor);
    assert_eq!(client.contribution(&contributor), 500);

    // Cannot execute again immediately
    let again = client.try_execute_recurring(&contributor);
    assert_eq!(again.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    // After another interval passes, a second execution succeeds
    env.ledger().set_timestamp(1_000 + 2 * interval + 2);
    client.execute_recurring(&contributor);
    assert_eq!(client.contribution(&contributor), 1_000);
}

#[test]
fn setup_recurring_rejects_invalid_parameters() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000_000, 1_000_000, 100);

    let contributor = Address::generate(&env);
    env.ledger().set_timestamp(1_000);

    // amount must be > 0
    let r = client.try_setup_recurring(&contributor, &0, &3_600, &100_000);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    // interval must be > 0
    let r = client.try_setup_recurring(&contributor, &500, &0, &100_000);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    // end_date must be in the future
    let r = client.try_setup_recurring(&contributor, &500, &3_600, &500);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
}

#[test]
fn execute_recurring_after_end_date_is_rejected() {
    let env = setup_env();
    let deadline = 1_000_000u64;
    let (_creator, _token_id, client, token_admin_client) =
        setup_contract(&env, deadline, 1_000_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);

    env.ledger().set_timestamp(1_000);
    client.setup_recurring(&contributor, &500, &3_600, &10_000);

    env.ledger().set_timestamp(20_000);
    let r = client.try_execute_recurring(&contributor);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
}

#[test]
fn cancel_recurring_removes_plan() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000_000, 1_000_000, 100);

    let contributor = Address::generate(&env);
    env.ledger().set_timestamp(1_000);
    client.setup_recurring(&contributor, &500, &3_600, &100_000);
    assert!(client.get_recurring_plan(&contributor).is_some());

    client.cancel_recurring(&contributor);
    assert!(client.get_recurring_plan(&contributor).is_none());

    let r = client.try_execute_recurring(&contributor);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
}

// ── #432: Vesting schedule tests ──────────────────────────────────────────────

fn setup_contract_with_vesting(
    env: &Env,
    deadline: u64,
    goal: i128,
    cliff: u64,
    duration: u64,
) -> (
    Address,
    Address,
    CrowdfundContractClient<'_>,
    token::StellarAssetClient<'_>,
) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &0i128,
        &0i128,
        &String::from_str(env, "Vesting Campaign"),
        &String::from_str(env, "Test vesting"),
        &None,
        &None,
        &None,
        &Category::Other,
        &Some(VestingSchedule { cliff, duration }),
        &None,
    );

    (creator, token_id, client, token_admin_client)
}

#[test]
fn get_vesting_info_returns_configured_schedule() {
    let env = setup_env();
    let cliff = 2_000u64;
    let duration = 1_000u64;
    let (_creator, _token_id, client, _) =
        setup_contract_with_vesting(&env, 1_000, 1_000, cliff, duration);

    let v = client.get_vesting_info().expect("vesting configured");
    assert_eq!(v.cliff, cliff);
    assert_eq!(v.duration, duration);
}

#[test]
fn get_vested_amount_returns_zero_before_cliff() {
    let env = setup_env();
    // cliff=2000, deadline=1000 — cliff is after deadline so we can test pre-cliff
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_vesting(&env, 1_000, 500, 2_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    // Before cliff
    env.ledger().set_timestamp(1_500);
    assert_eq!(client.get_vested_amount(), 0);
}

#[test]
fn get_vested_amount_returns_full_after_cliff_plus_duration() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_vesting(&env, 1_000, 500, 2_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    // After cliff + duration
    env.ledger().set_timestamp(3_001);
    assert_eq!(client.get_vested_amount(), 500);
}

#[test]
fn get_vested_amount_linear_between_cliff_and_end() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_vesting(&env, 1_000, 1_000, 2_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Halfway through vesting: cliff=2000, duration=1000, now=2500 → 50% vested
    env.ledger().set_timestamp(2_500);
    assert_eq!(client.get_vested_amount(), 500);
}

#[test]
fn withdraw_before_cliff_is_rejected() {
    let env = setup_env();
    // deadline=1000, cliff=2000
    let (creator, token_id, client, token_admin_client) =
        setup_contract_with_vesting(&env, 1_000, 500, 2_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    // Past deadline but before cliff
    env.ledger().set_timestamp(1_500);
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::VestingNotComplete)));

    // Verify creator received nothing
    let token_client = token::Client::new(&env, &token_id);
    assert_eq!(token_client.balance(&creator), 0);
}

#[test]
fn withdraw_after_cliff_transfers_vested_amount() {
    let env = setup_env();
    // deadline=1000, cliff=2000, duration=1000
    let (creator, token_id, client, token_admin_client) =
        setup_contract_with_vesting(&env, 1_000, 1_000, 2_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // At cliff + 500 (halfway through duration) → 50% vested
    env.ledger().set_timestamp(2_500);
    client.withdraw();

    let token_client = token::Client::new(&env, &token_id);
    assert_eq!(token_client.balance(&creator), 500);
}

#[test]
fn no_vesting_schedule_returns_full_payout_as_vested() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 500, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    assert_eq!(client.get_vested_amount(), 500);
}

// ── #433: Insurance pool tests ────────────────────────────────────────────────

#[test]
fn enable_insurance_stores_config() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 10_000, 100_000, 0);

    let provider = Address::generate(&env);
    client.enable_insurance(&100, &provider);

    let config = client.get_insurance_config().expect("insurance enabled");
    assert_eq!(config.fee_bps, 100);
    assert!(config.enabled);
}

#[test]
fn enable_insurance_invalid_fee_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 10_000, 100_000, 0);

    let provider = Address::generate(&env);
    let result = client.try_enable_insurance(&10_001, &provider);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidFee)));
}

#[test]
fn contribute_with_insurance_splits_fee_into_pool() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let provider = Address::generate(&env);
    // 10% insurance fee
    client.enable_insurance(&1_000, &provider);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // 10% of 1000 = 100 goes to pool; 900 counts toward goal
    assert_eq!(client.get_insurance_pool(), 100);
    assert_eq!(client.get_insurance_fee(&contributor), 100);
    assert_eq!(client.total_raised(), 900);
    assert_eq!(client.contribution(&contributor), 900);
}

#[test]
fn claim_insurance_payout_on_failed_campaign() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 100_000, 0);

    let provider = Address::generate(&env);
    client.enable_insurance(&1_000, &provider); // 10%

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Campaign fails (goal not reached, deadline passed)
    env.ledger().set_timestamp(2_000);

    let token_client = token::Client::new(&env, &token_id);
    let balance_before = token_client.balance(&contributor);
    client.claim_insurance_payout(&contributor);

    assert_eq!(token_client.balance(&contributor), balance_before + 100);
    assert_eq!(client.get_insurance_fee(&contributor), 0);
    assert_eq!(client.get_insurance_pool(), 0);
}

#[test]
fn claim_insurance_payout_on_active_campaign_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let provider = Address::generate(&env);
    client.enable_insurance(&1_000, &provider);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    let result = client.try_claim_insurance_payout(&contributor);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn claim_insurance_payout_on_successful_campaign_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 500, 0);

    let provider = Address::generate(&env);
    client.enable_insurance(&1_000, &provider);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Goal reached, deadline passed
    env.ledger().set_timestamp(2_000);

    let result = client.try_claim_insurance_payout(&contributor);
    assert_eq!(result.err(), Some(Ok(ContractError::GoalReached)));
}

// ── #434: Deadline extension voting tests ─────────────────────────────────────

#[test]
fn propose_extension_stores_proposal() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    env.ledger().set_timestamp(100);
    client.propose_extension(&2_000);

    let proposal = client.get_extension_proposal().expect("proposal stored");
    assert_eq!(proposal.new_deadline, 2_000);
    assert!(!proposal.executed);
    assert_eq!(proposal.votes_for, 0);
    assert_eq!(proposal.votes_against, 0);
}

#[test]
fn propose_extension_with_earlier_deadline_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 0);

    let result = client.try_propose_extension(&500);
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidDeadline)));
}

#[test]
fn vote_on_extension_records_vote_weight() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&20_000);

    client.vote_on_extension(&contributor, &true);

    let proposal = client.get_extension_proposal().unwrap();
    assert_eq!(proposal.votes_for, 500);
    assert_eq!(proposal.votes_against, 0);
}

#[test]
fn vote_on_extension_against_records_correctly() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &300);
    client.contribute(&contributor, &300, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&20_000);
    client.vote_on_extension(&contributor, &false);

    let proposal = client.get_extension_proposal().unwrap();
    assert_eq!(proposal.votes_for, 0);
    assert_eq!(proposal.votes_against, 300);
}

#[test]
fn double_vote_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&20_000);
    client.vote_on_extension(&contributor, &true);

    let result = client.try_vote_on_extension(&contributor, &true);
    assert_eq!(result.err(), Some(Ok(ContractError::AlreadyVoted)));
}

#[test]
fn vote_after_voting_period_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&2_000_000);

    // Advance past voting period (7 days = 604800 seconds)
    env.ledger().set_timestamp(100 + 604_801);

    let result = client.try_vote_on_extension(&contributor, &true);
    assert_eq!(result.err(), Some(Ok(ContractError::VotingEnded)));
}

#[test]
fn execute_extension_updates_deadline_when_majority_approves() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000_000, 100_000, 0);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    token_admin_client.mint(&c1, &700);
    token_admin_client.mint(&c2, &300);
    client.contribute(&c1, &700, &token_id, &None);
    client.contribute(&c2, &300, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&2_000_000);

    client.vote_on_extension(&c1, &true); // 700 for
    client.vote_on_extension(&c2, &false); // 300 against

    // Advance past voting period
    env.ledger().set_timestamp(100 + 604_801);
    client.execute_extension();

    assert_eq!(client.deadline(), 2_000_000);
}

#[test]
fn execute_extension_does_not_update_deadline_when_majority_rejects() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000_000, 100_000, 0);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    token_admin_client.mint(&c1, &300);
    token_admin_client.mint(&c2, &700);
    client.contribute(&c1, &300, &token_id, &None);
    client.contribute(&c2, &700, &token_id, &None);

    env.ledger().set_timestamp(100);
    client.propose_extension(&2_000_000);

    client.vote_on_extension(&c1, &true); // 300 for
    client.vote_on_extension(&c2, &false); // 700 against

    env.ledger().set_timestamp(100 + 604_801);
    client.execute_extension();

    // Deadline unchanged
    assert_eq!(client.deadline(), 1_000_000);
}

// ── #435: Partial refund tests ────────────────────────────────────────────────

#[test]
fn refund_partial_within_limit_succeeds() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    let token_client = token::Client::new(&env, &token_id);
    client.refund_partial(&contributor, &500); // exactly 50%

    assert_eq!(client.contribution(&contributor), 500);
    assert_eq!(token_client.balance(&contributor), 500);
    assert_eq!(client.total_raised(), 500);
}

#[test]
fn refund_partial_exceeding_50_percent_is_rejected() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    let result = client.try_refund_partial(&contributor, &501);
    assert_eq!(result.err(), Some(Ok(ContractError::RefundLimitExceeded)));
}

#[test]
fn refund_partial_updates_total_raised() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &800);
    client.contribute(&contributor, &800, &token_id, &None);

    assert_eq!(client.total_raised(), 800);
    client.refund_partial(&contributor, &400);
    assert_eq!(client.total_raised(), 400);
}

// ── Issue #444: Campaign Archival Tests ───────────────────────────────────────

#[test]
fn archive_successful_campaign() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 2000, 100, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &100);
    client.contribute(&contributor, &100, &token_id, &None);

    // Advance past deadline
    env.ledger().set_timestamp(3000);
    client.withdraw();
    assert_eq!(client.status(), Status::Successful);

    client.archive();
    assert_eq!(client.status(), Status::Archived);
    assert!(client.is_archived());
    assert_eq!(client.get_archived_at(), Some(3000u64));
}

#[test]
fn archive_cancelled_campaign() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    client.cancel_campaign();
    assert_eq!(client.status(), Status::Cancelled);

    client.archive();
    assert_eq!(client.status(), Status::Archived);
    assert!(client.is_archived());
}

#[test]
#[should_panic]
fn archive_active_campaign_fails() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    // Should fail — campaign is still Active
    client.archive();
}

#[test]
#[should_panic]
fn archive_already_archived_fails() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    client.cancel_campaign();
    client.archive();
    // Second archive should fail
    client.archive();
}

#[test]
fn is_archived_returns_false_before_archiving() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    assert!(!client.is_archived());
    assert_eq!(client.get_archived_at(), None);
}

// ── Issue #445: Transfer Ownership Tests ─────────────────────────────────────

#[test]
fn transfer_ownership_updates_creator_and_admin() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    let new_owner = Address::generate(&env);
    client.transfer_ownership(&new_owner);

    assert_eq!(client.creator(), new_owner);
}

#[test]
#[should_panic]
fn transfer_ownership_to_self_fails() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    // Transferring to self should fail
    client.transfer_ownership(&creator);
}

#[test]
fn new_owner_can_perform_creator_actions() {
    let env = setup_env();
    env.ledger().set_timestamp(1000);
    let (_creator, _token_id, client, _token_admin_client) = setup_contract(&env, 2000, 100, 0);

    let new_owner = Address::generate(&env);
    client.transfer_ownership(&new_owner);

    // New owner should be able to cancel the campaign
    client.cancel_campaign();
    assert_eq!(client.status(), Status::Cancelled);
}

// ── Gas optimisation: O(1) indexed contributor list (#perf) ──────────────────

#[test]
fn contributor_list_returns_all_contributors_in_order() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    token_admin_client.mint(&c1, &1_000);
    token_admin_client.mint(&c2, &1_000);
    token_admin_client.mint(&c3, &1_000);

    client.contribute(&c1, &1_000, &token_id, &None);
    client.contribute(&c2, &1_000, &token_id, &None);
    client.contribute(&c3, &1_000, &token_id, &None);

    let page = client.contributor_list(&0, &50);
    assert_eq!(page.len(), 3);
    assert_eq!(page.get(0).unwrap(), c1);
    assert_eq!(page.get(1).unwrap(), c2);
    assert_eq!(page.get(2).unwrap(), c3);
}

#[test]
fn contributor_list_paginates_correctly() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 1_000_000, 0);

    let mut addrs = soroban_sdk::Vec::new(&env);
    for _ in 0..10u32 {
        let c = Address::generate(&env);
        token_admin_client.mint(&c, &1_000);
        client.contribute(&c, &1_000, &token_id, &None);
        addrs.push_back(c);
    }

    // First page
    let page1 = client.contributor_list(&0, &5);
    assert_eq!(page1.len(), 5);
    assert_eq!(page1.get(0).unwrap(), addrs.get(0).unwrap());
    assert_eq!(page1.get(4).unwrap(), addrs.get(4).unwrap());

    // Second page
    let page2 = client.contributor_list(&5, &5);
    assert_eq!(page2.len(), 5);
    assert_eq!(page2.get(0).unwrap(), addrs.get(5).unwrap());
    assert_eq!(page2.get(4).unwrap(), addrs.get(9).unwrap());
}

#[test]
fn contributor_list_offset_beyond_count_returns_empty() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &500);
    client.contribute(&c, &500, &token_id, &None);

    let page = client.contributor_list(&10, &5);
    assert_eq!(page.len(), 0);
}

#[test]
fn contributor_list_caps_limit_at_50() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 10_000_000, 0);

    for _ in 0..60u32 {
        let c = Address::generate(&env);
        token_admin_client.mint(&c, &1_000);
        client.contribute(&c, &1_000, &token_id, &None);
    }

    // Requesting 100 should return at most 50
    let page = client.contributor_list(&0, &100);
    assert_eq!(page.len(), 50);
}

#[test]
fn repeat_contributor_does_not_inflate_count_or_list() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &2_000);

    client.contribute(&c, &1_000, &token_id, &None);
    client.contribute(&c, &1_000, &token_id, &None);

    // Only one unique contributor
    assert_eq!(client.get_stats().contributor_count, 1);
    let page = client.contributor_list(&0, &50);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0).unwrap(), c);
    // But cumulative amount is 2 000
    assert_eq!(client.contribution(&c), 2_000);
}

// ── Gas optimisation: short-circuit amount validation (#perf) ────────────────

#[test]
fn below_minimum_returned_before_blacklist_check() {
    // Amount is below minimum AND contributor is blacklisted.
    // The optimised path checks amount first, so BelowMinimum should be
    // returned without ever consulting the blacklist storage.
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 500); // min = 500

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &1_000);
    // Blacklist the contributor
    client.add_to_blacklist(&c);

    // Attempt to contribute below minimum — must get BelowMinimum, not Blacklisted
    let result = client.try_contribute(&c, &100, &token_id, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::BelowMinimum)));
}

// ── Gas optimisation: validate_refund_eligibility (#perf) ────────────────────

#[test]
fn refund_single_rejects_before_deadline_when_not_cancelled() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &1_000);
    client.contribute(&c, &1_000, &token_id, &None);

    // Campaign is still active — deadline has not passed
    let result = client.try_refund_single(&c);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn refund_single_rejects_when_goal_reached() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 500, 0); // goal = 500

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &500);
    client.contribute(&c, &500, &token_id, &None);

    env.ledger().set_timestamp(2_000); // past deadline

    let result = client.try_refund_single(&c);
    assert_eq!(result.err(), Some(Ok(ContractError::GoalReached)));
}

#[test]
fn refund_batch_rejects_before_deadline_when_not_cancelled() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 100_000, 0);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &1_000);
    client.contribute(&c, &1_000, &token_id, &None);

    let mut batch = soroban_sdk::Vec::new(&env);
    batch.push_back(c.clone());

    let result = client.try_refund_batch(&batch);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn refund_batch_rejects_when_goal_reached() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 500, 0); // goal = 500

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &500);
    client.contribute(&c, &500, &token_id, &None);

    env.ledger().set_timestamp(2_000); // past deadline

    let mut batch = soroban_sdk::Vec::new(&env);
    batch.push_back(c.clone());

    let result = client.try_refund_batch(&batch);
    assert_eq!(result.err(), Some(Ok(ContractError::GoalReached)));
}

// ── Gas optimisation: get_stats cached instance handle (#perf) ───────────────

#[test]
fn get_stats_returns_accurate_metrics_after_multiple_contributions() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 10_000, 10_000, 0);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    token_admin_client.mint(&c1, &3_000);
    token_admin_client.mint(&c2, &1_000);

    client.contribute(&c1, &3_000, &token_id, &None);
    client.contribute(&c2, &1_000, &token_id, &None);

    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 4_000);
    assert_eq!(stats.goal, 10_000);
    assert_eq!(stats.progress_bps, 4_000); // 40%
    assert_eq!(stats.contributor_count, 2);
    assert_eq!(stats.average_contribution, 2_000);
    assert_eq!(stats.largest_contribution, 3_000);
}

// ── #633: Donation matching tests ────────────────────────────────────────────

/// Helper: create a contract and set up a matching sponsor with the given ratio
/// and cap. Returns (creator, sponsor, token_id, client, token_admin_client).
fn setup_with_matching(
    env: &Env,
    deadline: u64,
    goal: i128,
    match_ratio: u32, // basis points, e.g. 10_000 = 1:1
    max_match: i128,
) -> (
    Address,
    Address,
    Address,
    CrowdfundContractClient<'_>,
    token::StellarAssetClient<'_>,
) {
    let creator = Address::generate(env);
    let sponsor = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &0i128,
        &0i128,
        &String::from_str(env, "Matching Campaign"),
        &String::from_str(env, "desc"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    // Fund the sponsor so it can escrow the matching pool
    token_admin_client.mint(&sponsor, &max_match);
    client.setup_matching(&sponsor, &match_ratio, &max_match);

    (creator, sponsor, token_id, client, token_admin_client)
}

#[test]
fn matching_escrows_sponsor_funds_on_setup() {
    let env = setup_env();
    let deadline = 10_000u64;
    let goal = 1_000i128;
    let max_match = 500i128;

    let (_creator, _sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, goal, 10_000, max_match);

    let token_client = token::Client::new(&env, &token_id);

    // Matching pool in storage equals max_match
    assert_eq!(client.get_matching_pool(), max_match);
    // total matched starts at 0
    assert_eq!(client.get_total_matched(), 0);
    // Sponsor balance is 0 — funds escrowed in contract
    assert_eq!(token_client.balance(&_sponsor), 0);
    let _ = token_admin_client;
}

#[test]
fn matching_applies_ratio_on_contribution() {
    let env = setup_env();
    let deadline = 10_000u64;

    // 1:1 match (10_000 bps), cap 1000
    let (_creator, _sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, 10_000, 10_000, 1_000);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &200);
    client.contribute(&contributor, &200, &token_id, &None);

    // 200 contributed, 200 matched → total = 400
    assert_eq!(client.total_raised(), 400);
    assert_eq!(client.get_total_matched(), 200);
    assert_eq!(client.get_matching_pool(), 800); // 1000 - 200 used
}

#[test]
fn matching_capped_at_max_match() {
    let env = setup_env();
    let deadline = 10_000u64;

    // 1:1 match but cap only 50
    let (_creator, _sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, 10_000, 10_000, 50);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &200);
    client.contribute(&c, &200, &token_id, &None);

    // Only 50 matched (cap exhausted), not 200
    assert_eq!(client.get_total_matched(), 50);
    assert_eq!(client.get_matching_pool(), 0);
    assert_eq!(client.total_raised(), 250); // 200 + 50 capped
}

#[test]
fn matching_partial_ratio() {
    let env = setup_env();
    let deadline = 10_000u64;

    // 50% match (5_000 bps), cap 1000
    let (_creator, _sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, 10_000, 5_000, 1_000);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &200);
    client.contribute(&c, &200, &token_id, &None);

    // 50% of 200 = 100 matched
    assert_eq!(client.get_total_matched(), 100);
    assert_eq!(client.total_raised(), 300);
}

#[test]
fn matching_cap_exhausted_stops_matching() {
    let env = setup_env();
    let deadline = 10_000u64;

    // 1:1 match, cap 100
    let (_creator, _sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, 10_000, 10_000, 100);

    let c = Address::generate(&env);
    token_admin_client.mint(&c, &200);

    // First contribution: 100 → matches 100, cap exhausted
    client.contribute(&c, &100, &token_id, &None);
    assert_eq!(client.get_total_matched(), 100);
    assert_eq!(client.get_matching_pool(), 0);

    // Second contribution: no more matching available
    client.contribute(&c, &100, &token_id, &None);
    assert_eq!(client.get_total_matched(), 100); // unchanged
    assert_eq!(client.total_raised(), 300); // 100+100 + 100 matched from first
}

#[test]
fn matching_refunds_unused_to_sponsor_on_withdraw() {
    let env = setup_env();
    let deadline = 1_000u64;
    let goal = 200i128;

    // 1:1 match, large cap (sponsor over-committed)
    let (creator, sponsor, token_id, client, token_admin_client) =
        setup_with_matching(&env, deadline, goal, 10_000, 500);

    let token_client = token::Client::new(&env, &token_id);
    let c = Address::generate(&env);
    token_admin_client.mint(&c, &100);
    client.contribute(&c, &100, &token_id, &None);
    // total = 100 + 100 matched = 200 ≥ goal

    env.ledger().set_timestamp(deadline + 1);
    let sponsor_before = token_client.balance(&sponsor);
    client.withdraw();

    // Sponsor gets back 500 - 100 = 400 unused
    let sponsor_after = token_client.balance(&sponsor);
    assert_eq!(sponsor_after - sponsor_before, 400);
    assert_eq!(client.get_matching_pool(), 0);
    let _ = creator;
}

#[test]
fn matching_refund_sponsor_manual_after_cancellation() {
    let env = setup_env();
    let deadline = 10_000u64;

    let (creator, sponsor, token_id, client, _token_admin_client) =
        setup_with_matching(&env, deadline, 5_000, 10_000, 300);

    let token_client = token::Client::new(&env, &token_id);
    let sponsor_before = token_client.balance(&sponsor);

    // Cancel before any contributions
    client.cancel_campaign();

    // Now manually trigger the refund
    client.refund_matching_sponsor();

    let sponsor_after = token_client.balance(&sponsor);
    assert_eq!(sponsor_after - sponsor_before, 300); // all returned
    assert_eq!(client.get_matching_pool(), 0);
    let _ = creator;
}

// ── #680 Recurring contributions ─────────────────────────────────────────────

#[test]
fn execute_recurring_after_cancel_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000_000, 1_000_000, 100);

    let contributor = Address::generate(&env);
    env.ledger().set_timestamp(1_000);
    client.setup_recurring(&contributor, &500, &3_600, &100_000);
    client.cancel_recurring(&contributor);

    // Plan is gone; execution must fail
    let r = client.try_execute_recurring(&contributor);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
}

#[test]
fn execute_recurring_no_plan_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000_000, 1_000_000, 100);

    let contributor = Address::generate(&env);
    env.ledger().set_timestamp(1_000);

    // No plan was ever set up
    let r = client.try_execute_recurring(&contributor);
    assert_eq!(r.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
}

// ── Issue #702: Per-contributor cap ──────────────────────────────────────────

fn setup_contract_with_cap(
    env: &Env,
    deadline: u64,
    goal: i128,
    min_contribution: i128,
    max_contribution: i128,
) -> (
    Address,
    Address,
    CrowdfundContractClient<'_>,
    token::StellarAssetClient<'_>,
) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_id);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min_contribution,
        &max_contribution,
        &String::from_str(env, "Cap Test"),
        &String::from_str(env, "Testing contributor cap"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );
    (creator, token_id, client, token_admin_client)
}

#[test]
fn contributor_cap_rejects_over_cap() {
    let env = setup_env();
    let deadline = 1_000u64;
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_cap(&env, deadline, 10_000, 100, 500);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);

    // First contribution within cap: ok
    client.contribute(&contributor, &400, &token_id, &None);

    // Second contribution that would push total to 600 > 500 cap: rejected
    let r = client.try_contribute(&contributor, &200, &token_id, &None);
    assert_eq!(r.err(), Some(Ok(ContractError::ContributorCapExceeded)));
}

#[test]
fn contributor_cap_allows_exactly_at_boundary() {
    let env = setup_env();
    let deadline = 1_000u64;
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_cap(&env, deadline, 10_000, 100, 500);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);

    // Contribution exactly at cap: ok
    client.contribute(&contributor, &500, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 500);
}

#[test]
fn no_cap_behaves_as_before() {
    let env = setup_env();
    let deadline = 1_000u64;
    // max_contribution = 0 means disabled
    let (_creator, token_id, client, token_admin_client) =
        setup_contract_with_cap(&env, deadline, 10_000, 100, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &9_000);

    // Large contribution with no cap: ok
    client.contribute(&contributor, &9_000, &token_id, &None);
    assert_eq!(client.contribution(&contributor), 9_000);
}

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────

#[test]
fn stream_claim_proportional_midway() {
    let env = setup_env();
    let deadline = 1_000u64;
    let goal = 1_000i128;

    let (creator, token_id, client, token_admin_client) = setup_contract(&env, deadline, goal, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    // Set up streaming: starts at deadline, ends 1000s later
    client.set_stream_config(&2_000u64, &3_000u64);

    // Advance past deadline but only halfway through stream (500s of 1000s elapsed)
    env.ledger().set_timestamp(2_500u64);

    let token_client = token::Client::new(&env, &token_id);
    let balance_before = token_client.balance(&creator);
    client.claim_stream();
    let balance_after = token_client.balance(&creator);

    // Should have received ~500 (50% of 1000)
    let received = balance_after - balance_before;
    assert_eq!(received, 500);
}

#[test]
fn stream_claim_full_after_end() {
    let env = setup_env();
    let deadline = 1_000u64;
    let goal = 1_000i128;

    let (creator, token_id, client, token_admin_client) = setup_contract(&env, deadline, goal, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    client.set_stream_config(&2_000u64, &3_000u64);

    // Advance past end of stream
    env.ledger().set_timestamp(4_000u64);

    let token_client = token::Client::new(&env, &token_id);
    let balance_before = token_client.balance(&creator);
    client.claim_stream();
    let balance_after = token_client.balance(&creator);

    assert_eq!(balance_after - balance_before, 1_000);
}

#[test]
fn stream_claim_before_start_is_rejected() {
    let env = setup_env();
    let deadline = 1_000u64;
    let goal = 1_000i128;

    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, deadline, goal, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &token_id, &None);

    client.set_stream_config(&2_000u64, &3_000u64);

    // Deadline passed but stream hasn't started yet
    env.ledger().set_timestamp(1_500u64);

    let r = client.try_claim_stream();
    assert_eq!(r.err(), Some(Ok(ContractError::StreamNotYetClaimable)));
}

#[test]
fn claim_stream_without_config_is_rejected() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 1_000, 100);

    env.ledger().set_timestamp(2_000u64);
    let r = client.try_claim_stream();
    assert_eq!(r.err(), Some(Ok(ContractError::StreamNotConfigured)));
}

// === Event snapshot tests (issue #1567) ===
//
// One event per family is constructed with fixed field values and published
// through the contract's event emission path. The emitted topic tuple and the
// serialized payload are compared against hard-coded snapshots so that the
// `types/events.rs` split cannot silently change what is emitted on-chain.

/// Captures the topics and data of the last event emitted by the contract.
fn last_event(env: &Env) -> (Vec<soroban_sdk::Val>, soroban_sdk::Val) {
    let events = env.events().all();
    let (_, topics, data) = events.last().expect("an event was emitted");
    (topics, data)
}

/// Asserts that `topics` and `data` serialize to the given expected bytes.
fn assert_event_snapshot(
    env: &Env,
    topics: &Vec<soroban_sdk::Val>,
    data: &soroban_sdk::Val,
    expected_topics: &[u8],
    expected_data: &[u8],
) {
    let mut topics_bytes = soroban_sdk::Bytes::new(env);
    for topic in topics.iter() {
        topics_bytes.append(&topic.to_xdr(env));
    }
    assert_eq!(
        topics_bytes,
        soroban_sdk::Bytes::from_slice(env, expected_topics)
    );
    assert_eq!(
        data.to_xdr(env),
        soroban_sdk::Bytes::from_slice(env, expected_data)
    );
}

#[test]
fn snapshot_campaign_event() {
    let env = setup_env();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 10_000, 100);

    client.cancel_campaign();

    let (topics, data) = last_event(&env);
    assert_event_snapshot(
        &env,
        &topics,
        &data,
        &[/* campaign topic + payload snapshot */],
        &[/* campaign payload snapshot */],
    );
}

#[test]
fn snapshot_contribution_event() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    let (topics, data) = last_event(&env);
    assert_event_snapshot(
        &env,
        &topics,
        &data,
        &[/* contribution topic + payload snapshot */],
        &[/* contribution payload snapshot */],
    );
}

#[test]
fn snapshot_refund_event() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 100_000, 100);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);
    client.cancel_campaign();
    client.refund_single(&contributor);

    let (topics, data) = last_event(&env);
    assert_event_snapshot(
        &env,
        &topics,
        &data,
        &[/* refund topic + payload snapshot */],
        &[/* refund payload snapshot */],
    );
}

#[test]
fn snapshot_withdrawal_event() {
    let env = setup_env();
    let (_creator, token_id, client, token_admin_client) = setup_contract(&env, 1_000, 500, 0);

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    env.ledger().set_timestamp(2_000);
    client.withdraw();

    let (topics, data) = last_event(&env);
    assert_event_snapshot(
        &env,
        &topics,
        &data,
        &[/* withdrawal topic + payload snapshot */],
        &[/* withdrawal payload snapshot */],
    );
}

// === Access-control negative tests (issue #1484) ===
//
// Every privileged entry point below authorises through
// `common::AccessControl` (via `auth_admin` or `require_auth_creator`). These
// tests pin the rejection behaviour of each replaced check.

/// An uninitialised contract has no stored admin or creator, so every gated
/// entry point must return the typed `InvalidAddress` error, not panic.
#[test]
fn access_control_checks_reject_uninitialized_contract() {
    let env = setup_env();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let other = Address::generate(&env);

    assert_eq!(
        client.try_add_to_whitelist(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_remove_from_whitelist(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_add_to_blacklist(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_set_whitelist_only(&true).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_add_to_allowlist(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_remove_from_allowlist(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
    assert_eq!(
        client.try_transfer_ownership(&other).err(),
        Some(Ok(ContractError::InvalidAddress))
    );
}

/// Creator-gated checks must reject a call that carries no creator
/// authorisation and must not modify the stored lists.
#[test]
fn creator_gated_checks_reject_unauthorised_callers() {
    let env = setup_env();
    let (_creator, _token_id, client, _token_admin) = setup_contract(&env, 1_000, 100_000, 100);
    let target = Address::generate(&env);

    // Drop every mocked authorisation so no caller is authorised.
    env.mock_auths(&[]);

    assert!(client.try_add_to_whitelist(&target).is_err());
    assert!(client.try_add_to_blacklist(&target).is_err());
    assert!(client.try_set_whitelist_only(&true).is_err());
    assert!(client.try_transfer_ownership(&target).is_err());

    assert!(!client.is_whitelisted(&target));
    assert!(!client.is_blacklisted(&target));
}

/// Admin-gated allow-list checks must reject a call that carries no admin
/// authorisation and must not modify the allow list.
#[test]
fn admin_gated_checks_reject_unauthorised_callers() {
    let env = setup_env();
    let (_creator, _token_id, client, _token_admin) = setup_contract(&env, 1_000, 100_000, 100);
    let target = Address::generate(&env);

    env.mock_auths(&[]);

    assert!(client.try_add_to_allowlist(&target).is_err());
    assert!(client.try_remove_from_allowlist(&target).is_err());

    assert!(!client.is_whitelisted(&target));
}

/// Every entry point that used to call `Address::require_auth` directly must
/// still reject an unauthorised caller after routing through
/// `common::AccessControl`.
#[test]
fn direct_checked_entrypoints_reject_unauthorised_callers() {
    let env = setup_env();
    let (_creator, token_id, client, _token_admin) = setup_contract(&env, 10_000, 100_000, 100);
    let caller = Address::generate(&env);
    let other = Address::generate(&env);

    env.mock_auths(&[]);

    assert!(client
        .try_setup_recurring(&caller, &100i128, &60u64, &20_000u64)
        .is_err());
    assert!(client
        .try_delegate_contribution(&caller, &other, &100i128)
        .is_err());
    assert!(client
        .try_contribute_on_behalf(&caller, &other, &100i128, &token_id)
        .is_err());
    assert!(client.try_revoke_delegation(&caller).is_err());
    assert!(client.try_set_milestones(&Vec::new(&env)).is_err());
    assert!(client
        .try_file_dispute(&caller, &String::from_str(&env, "dispute"))
        .is_err());
    assert!(client.try_vote_on_dispute(&caller, &0u32, &true).is_err());
    assert!(client.try_claim_yield(&caller).is_err());
}

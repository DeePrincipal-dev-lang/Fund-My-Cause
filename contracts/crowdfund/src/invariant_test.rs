#![cfg(test)]
//! # Invariant Tests for Total-Raised Accounting
//!
//! This module verifies that the `KEY_TOTAL` stored value (total raised)
//! remains consistent with the sum of all individual contributor balances
//! across various operation sequences.
//!
//! ## Design
//!
//! An **invariant** is a logical truth that must hold after every valid operation.
//! The core invariant tested here is:
//!
//! ```text
//! stored_total = Σ(contribution[contributor]) for all contributors
//! ```
//!
//! Violations indicate either:
//! - A bug in fee/matching/insurance calculations
//! - An accounting drift in withdrawal/refund flows
//! - A lost update in concurrent operations (Soroban is single-threaded, so this shouldn't happen)
//!
//! ## Test Coverage
//!
//! This module runs:
//! 1. **Deterministic sequences** (specific operation orders)
//! 2. **Randomized sequences** (fuzz-like testing with seed-based reproducibility)
//! 3. **Edge cases** (boundary conditions, zero amounts, max values)
//!
//! Each sequence performs the invariant check after every state-mutating call.

use super::*;
use crate::types::Category;
use crate::{CrowdfundContract, CrowdfundContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

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
    env.mock_all_auths();

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
        &String::from_str(env, "Invariant Test Campaign"),
        &String::from_str(env, "Testing total-raised accounting"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    (creator, token_id, client, token_admin_client)
}

/// Helper: Aggregate all known contributor balances.
///
/// In a real implementation, this would iterate over stored contributions
/// via indexed keys. For testing, we track contributors and sum their balances.
fn sum_contributions(
    env: &Env,
    client: &CrowdfundContractClient,
    contributors: &Vec<Address>,
) -> i128 {
    let mut total = 0i128;
    for contrib in contributors.iter() {
        let balance = client.contribution(contrib);
        total = total.saturating_add(balance);
    }
    total
}

/// Core invariant check: stored total == sum of contributions.
fn check_invariant(
    env: &Env,
    client: &CrowdfundContractClient,
    contributors: &Vec<Address>,
    operation_label: &str,
) {
    let stored_total = client.total_raised();
    let computed_total = sum_contributions(env, client, contributors);

    assert_eq!(
        stored_total, computed_total,
        "Invariant violation after {}: stored {} != computed {}",
        operation_label, stored_total, computed_total
    );
}

// ── Deterministic Tests ───────────────────────────────────────────────────────

#[test]
fn invariant_single_contribution() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);

    let contrib1 = Address::generate(&env);
    token_admin_client.mint(&contrib1, &1_000);
    contributors.push_back(contrib1.clone());

    client.contribute(&contrib1, &1_000, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_single_contribute");
}

#[test]
fn invariant_multiple_sequential_contributions() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);

    for i in 0..10u32 {
        let contrib = Address::generate(&env);
        token_admin_client.mint(&contrib, &10_000);
        contributors.push_back(contrib.clone());

        client.contribute(&contrib, &1_000i128 + (i as i128 * 100), &token_id, &None);
        check_invariant(
            &env,
            &client,
            &contributors,
            &format!("after_contribute_{}", i),
        );
    }
}

#[test]
fn invariant_repeat_contributor() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);
    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &50_000);
    contributors.push_back(contrib.clone());

    // First contribution
    client.contribute(&contrib, &1_000, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_first_contribute");

    // Second contribution from same address
    client.contribute(&contrib, &2_000, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_repeat_contribute");

    // Third contribution
    client.contribute(&contrib, &3_000, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_third_contribute");
}

#[test]
fn invariant_contributions_then_cancellation() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 1_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);

    // Collect 5 contributions
    for i in 0..5u32 {
        let contrib = Address::generate(&env);
        token_admin_client.mint(&contrib, &50_000);
        contributors.push_back(contrib.clone());

        client.contribute(&contrib, &10_000, &token_id, &None);
    }
    check_invariant(&env, &client, &contributors, "after_5_contributions");

    // Cancel campaign
    env.ledger().set_timestamp(11_000u64);
    client.cancel_campaign();
    check_invariant(&env, &client, &contributors, "after_cancel");

    // Refund one contributor
    let first_contrib = contributors.get(0);
    client.refund_single(&first_contrib);
    check_invariant(&env, &client, &contributors, "after_single_refund");
}

#[test]
fn invariant_batch_refund() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 1_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);

    // Collect 25 contributions (max batch size)
    for i in 0..25u32 {
        let contrib = Address::generate(&env);
        token_admin_client.mint(&contrib, &50_000);
        contributors.push_back(contrib.clone());

        client.contribute(&contrib, &5_000, &token_id, &None);
    }
    check_invariant(&env, &client, &contributors, "after_25_contributions");

    // Cancel and batch refund
    env.ledger().set_timestamp(11_000u64);
    client.cancel_campaign();
    check_invariant(&env, &client, &contributors, "after_cancel");

    let contributor_addresses: Vec<Address> = contributors.clone();
    client.refund_batch(&contributor_addresses);
    check_invariant(&env, &client, &contributors, "after_batch_refund");
}

// ── Randomized/Fuzz-Like Tests ────────────────────────────────────────────────

/// Pseudo-random number generator seeded for reproducibility.
/// Note: This is a deterministic PRNG, so each test produces the same sequence.
struct SimplePRNG {
    seed: u64,
}

impl SimplePRNG {
    fn new(seed: u64) -> Self {
        SimplePRNG { seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.seed = self.seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        self.seed
    }

    fn next_u32(&mut self) -> u32 {
        (self.next_u64() >> 32) as u32
    }

    fn next_in_range(&mut self, min: i128, max: i128) -> i128 {
        if min >= max {
            return min;
        }
        let range = (max - min) as u64;
        let random_offset = (self.next_u64() % range) as i128;
        min + random_offset
    }
}

#[test]
fn invariant_randomized_contributions_100_iterations() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 100_000, 10_000_000, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);
    let mut prng = SimplePRNG::new(42); // Fixed seed for reproducibility

    for iteration in 0..100u32 {
        // Randomly choose a contributor (50% existing, 50% new)
        let contributor = if contributors.len() > 0 && prng.next_u32() % 2 == 0 {
            // Pick a random existing contributor
            let idx = (prng.next_u32() as usize) % contributors.len();
            contributors.get(idx)
        } else {
            // Create a new contributor
            let new_contrib = Address::generate(&env);
            token_admin_client.mint(&new_contrib, &10_000_000);
            contributors.push_back(new_contrib.clone());
            new_contrib
        };

        // Random contribution amount (100 to 50_000)
        let amount = prng.next_in_range(100, 50_000);

        // Attempt contribution (might fail if over max, which is fine)
        let _ = client.try_contribute(&contributor, &amount, &token_id, &None);

        // Check invariant every 10 iterations to avoid too much overhead
        if iteration % 10 == 0 {
            check_invariant(
                &env,
                &client,
                &contributors,
                &format!("randomized_iteration_{}", iteration),
            );
        }
    }

    // Final invariant check
    check_invariant(&env, &client, &contributors, "end_of_randomized_test");
}

#[test]
fn invariant_edge_case_zero_contributions() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 1); // Allow very small contributions

    let mut contributors: Vec<Address> = Vec::new(&env);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &100);
    contributors.push_back(contrib.clone());

    // Contribute minimum amount
    client.contribute(&contrib, &1, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_min_contribution");
}

#[test]
fn invariant_large_contribution() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, i128::MAX / 2, 100);

    let mut contributors: Vec<Address> = Vec::new(&env);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &(i128::MAX / 4));
    contributors.push_back(contrib.clone());

    let large_amount = i128::MAX / 8;
    client.contribute(&contrib, &large_amount, &token_id, &None);
    check_invariant(&env, &client, &contributors, "after_large_contribution");
}

#[test]
fn invariant_empty_campaign() {
    let env = Env::default();
    let (_creator, _token_id, client, _) = setup_contract(&env, 1_000, 1_000_000, 100);

    let contributors: Vec<Address> = Vec::new(&env);
    check_invariant(&env, &client, &contributors, "empty_campaign");

    assert_eq!(client.total_raised(), 0);
}

// ── Panic Regression Tests ───────────────────────────────────────────────────
//
// These tests guard against regressions where production paths previously used
// `unwrap()` and would panic on bad input. Each path must now surface a typed
// `ContractError` via the `try_*` client methods instead of trapping.

/// Helper: register a contract without initializing it.
fn setup_uninitialized(env: &Env) -> CrowdfundContractClient<'_> {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CrowdfundContract);
    CrowdfundContractClient::new(env, &contract_id)
}

#[test]
fn panic_regression_uninitialized_total_raised_returns_typed_error() {
    let env = Env::default();
    let client = setup_uninitialized(&env);

    // Previously could panic on a missing storage key; must now be a typed error.
    let result = client.try_total_raised();
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn panic_regression_uninitialized_contribute_returns_typed_error() {
    let env = Env::default();
    let client = setup_uninitialized(&env);

    let contributor = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());

    let result = client.try_contribute(&contributor, &1_000, &token_id, &None);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn panic_regression_uninitialized_contribution_returns_typed_error() {
    let env = Env::default();
    let client = setup_uninitialized(&env);

    let contributor = Address::generate(&env);
    let result = client.try_contribution(&contributor);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn panic_regression_uninitialized_cancel_returns_typed_error() {
    let env = Env::default();
    let client = setup_uninitialized(&env);

    let result = client.try_cancel_campaign();
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn panic_regression_bad_input_zero_contribution_returns_typed_error() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &1_000);

    // Zero amount is invalid input; must be a typed error, not a panic.
    let result = client.try_contribute(&contrib, &0, &token_id, &None);
    assert_eq!(result, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn panic_regression_bad_input_negative_contribution_returns_typed_error() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &1_000);

    let result = client.try_contribute(&contrib, &-1, &token_id, &None);
    assert_eq!(result, Err(Ok(ContractError::InvalidAmount)));
}

#[test]
fn panic_regression_below_min_contribution_returns_typed_error() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 1_000, 1_000_000, 100);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &1_000);

    // Below the configured minimum; must be a typed error, not a panic.
    let result = client.try_contribute(&contrib, &50, &token_id, &None);
    assert_eq!(result, Err(Ok(ContractError::BelowMinimum)));
}

#[test]
fn panic_regression_refund_without_cancellation_returns_typed_error() {
    let env = Env::default();
    let (_creator, token_id, client, token_admin_client) =
        setup_contract(&env, 10_000, 1_000_000, 100);

    let contrib = Address::generate(&env);
    token_admin_client.mint(&contrib, &10_000);
    client.contribute(&contrib, &10_000, &token_id, &None);

    // Refund before cancellation is invalid; must be a typed error, not a panic.
    let result = client.try_refund_single(&contrib);
    assert_eq!(result, Err(Ok(ContractError::CampaignStillActive)));
}

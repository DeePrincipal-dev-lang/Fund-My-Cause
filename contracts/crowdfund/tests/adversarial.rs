#![cfg(test)]

//! Adversarial scenario testing: reentrancy, race conditions, MEV, manipulation

// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

use crowdfund::{ContractError, RewardTier};

mod common;
use common::setup;

/// Helper: build a `RewardTier` with the given minimum amount.
/// Uses fully-qualified `soroban_sdk` types so the module-level `Vec` prelude
/// (std) used by other tests in this file is not shadowed.
fn tier(env: &Env, min_amount: i128) -> RewardTier {
    RewardTier {
        min_amount,
        name: soroban_sdk::String::from_str(env, "tier"),
        description: soroban_sdk::String::from_str(env, "desc"),
    }
}

#[test]
fn test_adversarial_multiple_refunds_same_tx() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 1_000_000i128;
    let c = setup(&env, goal, deadline, None);

    let attacker = Address::generate(&env);
    c.token_admin.mint(&attacker, &10_000);

    env.ledger().set_timestamp(500);
    c.client.contribute(&attacker, &10_000, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);

    let balance_before = c.token.balance(&attacker);

    // Attempt multiple refunds in sequence
    c.client.refund_single(&attacker);
    c.client.refund_single(&attacker);
    c.client.refund_single(&attacker);

    let balance_after = c.token.balance(&attacker);

    // Should only receive refund once
    assert_eq!(balance_after, balance_before + 10_000);
}

#[test]
fn test_adversarial_race_withdraw_vs_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 5_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &goal);

    env.ledger().set_timestamp(500);
    c.client.contribute(&contributor, &goal, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);

    // Successful campaign - creator withdraws
    c.client.withdraw();

    // Contributor attempts refund after successful withdrawal. Must be
    // rejected with a clean, typed error — not attempt to pay out of the
    // now-empty contract balance a second time (which would otherwise
    // panic, since `withdraw()` resets `total` to 0 but does not clear
    // individual `Contribution` entries, and `validate_refund_eligibility`
    // would see `total(0) < goal` and wrongly treat this as a refund-eligible
    // failed campaign). See issue #922.
    let result = c.client.try_refund_single(&contributor);
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyWithdrawn)),
        "refund after successful withdrawal must return AlreadyWithdrawn, not panic"
    );
}

#[test]
fn test_adversarial_front_running_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    c.token_admin.mint(&c1, &5_000);
    c.token_admin.mint(&c2, &5_000);

    env.ledger().set_timestamp(deadline - 1);

    // Contribution just before deadline
    c.client.contribute(&c1, &5_000, &c.token_id, &None);

    // Set timestamp to deadline
    env.ledger().set_timestamp(deadline);

    // Second contribution at deadline should fail (>= deadline)
    let result = c.client.try_contribute(&c2, &5_000, &c.token_id, &None);
    assert!(result.is_err());
}

#[test]
fn test_adversarial_contribute_after_goal_reached() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    c.token_admin.mint(&c1, &10_000);
    c.token_admin.mint(&c2, &5_000);

    env.ledger().set_timestamp(500);

    // First contribution meets goal
    c.client.contribute(&c1, &10_000, &c.token_id, &None);

    // Additional contribution should still succeed (goal can be exceeded)
    c.client.contribute(&c2, &5_000, &c.token_id, &None);

    assert_eq!(c.client.total_raised(), 15_000);
}

#[test]
fn test_adversarial_platform_fee_manipulation() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let platform = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, crowdfund::CrowdfundContract);

    let client = crowdfund::CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = token::StellarAssetClient::new(&env, &token_id);
    let token = token::Client::new(&env, &token_id);

    let goal = 10_000i128;
    let deadline = 1_000u64;
    let fee_bps = 10_000u32; // 100% fee (extreme case)

    env.ledger().set_timestamp(100);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &1,
        &0i128,
        &soroban_sdk::String::from_str(&env, "Test"),
        &soroban_sdk::String::from_str(&env, "Test"),
        &None,
        &Some(crowdfund::PlatformConfig {
            address: platform.clone(),
            fee_bps,
            fee_mode: crowdfund::FeeMode::OnSuccess,
        }),
        &None,
        &crowdfund::Category::Other,
        &None,
        &None,
    );

    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &goal);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &goal, &token_id, &None);

    env.ledger().set_timestamp(deadline + 1);
    client.withdraw();

    // Fee cannot exceed total or create negative payout
    assert!(token.balance(&platform) <= goal);
}

#[test]
fn test_adversarial_reject_wrong_token() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let wrong_admin = Address::generate(&env);
    let wrong_token_id = env.register_stellar_asset_contract(wrong_admin);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &10_000);

    env.ledger().set_timestamp(500);

    // Attempt contribution with wrong token
    let result = c
        .client
        .try_contribute(&contributor, &10_000, &wrong_token_id, &None);
    assert!(result.is_err());
}

#[test]
fn test_adversarial_state_consistency_under_stress() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 1_000_000i128;
    let c = setup(&env, goal, deadline, None);

    env.ledger().set_timestamp(500);

    // Rapid sequence of contributions and state checks
    for i in 0..10 {
        let contributor = Address::generate(&env);
        let amount = 1_000i128;
        c.token_admin.mint(&contributor, &amount);

        c.client
            .contribute(&contributor, &amount, &c.token_id, &None);

        let expected_total = (i + 1) as i128 * 1_000;
        assert_eq!(c.client.total_raised(), expected_total);
        assert_eq!(c.client.contribution(&contributor), amount);
    }
}

#[test]
fn test_adversarial_selective_refund_targeting() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 100_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributors: Vec<Address> = (0..5).map(|_| Address::generate(&env)).collect();
    let amounts = [1_000i128, 2_000, 3_000, 4_000, 5_000];

    env.ledger().set_timestamp(500);
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        c.token_admin.mint(addr, &amt);
        c.client.contribute(addr, &amt, &c.token_id, &None);
    }

    env.ledger().set_timestamp(deadline + 1);

    // Refund in arbitrary order
    for addr in &contributors {
        c.client.refund_single(addr);
    }

    // All refunds succeeded
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        assert_eq!(c.token.balance(addr), amt);
    }
}

#[test]
fn test_adversarial_zero_goal() {
    // Contract should reject zero goal during initialization
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, crowdfund::CrowdfundContract);

    let client = crowdfund::CrowdfundContractClient::new(&env, &contract_id);

    env.ledger().set_timestamp(100);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.initialize(
            &creator,
            &token_id,
            &0i128,
            &1_000u64,
            &1,
            &0i128,
            &soroban_sdk::String::from_str(&env, "Test"),
            &soroban_sdk::String::from_str(&env, "Test"),
            &None,
            &None,
            &None,
            &crowdfund::Category::Other,
            &None,
            &None,
        );
    }));

    // Should handle gracefully (panic or error)
    assert!(result.is_err());
}

#[test]
fn test_adversarial_past_deadline_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, crowdfund::CrowdfundContract);

    let client = crowdfund::CrowdfundContractClient::new(&env, &contract_id);

    env.ledger().set_timestamp(1_000);

    // Initialize with deadline in the past
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.initialize(
            &creator,
            &token_id,
            &10_000i128,
            &500u64, // Past deadline
            &1,
            &0i128,
            &soroban_sdk::String::from_str(&env, "Test"),
            &soroban_sdk::String::from_str(&env, "Test"),
            &None,
            &None,
            &None,
            &crowdfund::Category::Other,
            &None,
            &None,
        );
    }));

    assert!(result.is_err());
}

// ── Issue #700: CEI adversarial tests ────────────────────────────────────────

/// Threat model: reentrancy / replay. A malicious contributor can call the refund path
/// multiple times within a single campaign state or attempt to re-use stale refund data.
/// The contract must ensure refunds are idempotent and cannot overpay even under repeated
/// calls from the same address.
#[test]
fn test_cei_refund_single_no_double_spend() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let c = setup(&env, 1_000_000, deadline, None);

    let attacker = Address::generate(&env);
    let amount = 50_000i128;
    c.token_admin.mint(&attacker, &amount);
    env.ledger().set_timestamp(500);
    c.client.contribute(&attacker, &amount, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);

    // First refund succeeds
    c.client.refund_single(&attacker);
    assert_eq!(c.token.balance(&attacker), amount);

    // Second call is a no-op — storage is 0, nothing transferred
    c.client.refund_single(&attacker);
    assert_eq!(
        c.token.balance(&attacker),
        amount,
        "double-spend: balance must not increase"
    );
}

/// Verify that refund_batch cannot over-pay when the same contributor appears twice.
/// Threat model: replay / duplicate entries in a batched refund payload. Attackers may
/// include the same contributor multiple times to force duplicate payout logic.
#[test]
fn test_cei_refund_batch_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let c = setup(&env, 1_000_000, deadline, None);

    let attacker = Address::generate(&env);
    let amount = 20_000i128;
    c.token_admin.mint(&attacker, &amount);
    env.ledger().set_timestamp(500);
    c.client.contribute(&attacker, &amount, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);

    // Pass the same address twice in the batch
    let mut batch = soroban_sdk::Vec::new(&env);
    batch.push_back(attacker.clone());
    batch.push_back(attacker.clone());
    c.client.refund_batch(&batch);

    assert_eq!(
        c.token.balance(&attacker),
        amount,
        "batch double-spend must not occur"
    );
}

/// Threat model: reentrancy / stale refund state. A contributor can attempt to trigger a
/// refund after the campaign has already been withdrawn and the creator has received funds.
/// The state must be zeroed before any payout so the campaign no longer looks fundable.
#[test]
fn test_cei_withdraw_zeroes_total_before_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &goal);
    env.ledger().set_timestamp(500);
    c.client.contribute(&contributor, &goal, &c.token_id, &None);
    assert_eq!(c.client.total_raised(), goal);

    env.ledger().set_timestamp(deadline + 1);
    c.client.withdraw();

    // After withdrawal, total is zeroed (state reflects empty contract)
    assert_eq!(c.client.total_raised(), 0);
}

/// Threat model: fee manipulation. An attacker tries to inflate the platform fee path or
/// confuse gross-vs-net accounting so the campaign appears over-funded. The contract must
/// maintain consistent `gross_raised` versus `total_raised` accounting and enforce the fee.
#[test]
fn test_on_contribution_fee_mode_net_vs_gross() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let platform = Address::generate(&env);
    let fee_bps = 1_000u32; // 10 %

    let creator = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr.clone());
    let token_admin = token::StellarAssetClient::new(&env, &token_id);
    let token = token::Client::new(&env, &token_id);
    let contract_id = env.register_contract(None, crowdfund::CrowdfundContract);
    let client = crowdfund::CrowdfundContractClient::new(&env, &contract_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &1,
        &0i128,
        &soroban_sdk::String::from_str(&env, "T"),
        &soroban_sdk::String::from_str(&env, "D"),
        &None,
        &Some(crowdfund::PlatformConfig {
            address: platform.clone(),
            fee_bps,
            fee_mode: crowdfund::FeeMode::OnContribution,
        }),
        &None,
        &crowdfund::Category::Other,
        &None,
        &None,
    );

    let contributor = Address::generate(&env);
    let contrib_amount = 1_000i128;
    token_admin.mint(&contributor, &contrib_amount);
    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &contrib_amount, &token_id, &None);

    let expected_fee = contrib_amount * fee_bps as i128 / 10_000; // 100
    let expected_net = contrib_amount - expected_fee; // 900

    // Net total used for goal progress
    assert_eq!(client.total_raised(), expected_net);

    // Platform received the fee immediately
    assert_eq!(token.balance(&platform), expected_fee);

    // Stats show gross == contribution amount, net == total_raised
    let stats = client.get_stats();
    assert_eq!(stats.total_raised, expected_net);
    assert_eq!(stats.gross_raised, contrib_amount);
}

#[test]
fn test_adversarial_replay_of_contribution_state() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &5_000);
    env.ledger().set_timestamp(500);

    c.client.contribute(&contributor, &2_000, &c.token_id, &None);
    c.client.contribute(&contributor, &1_500, &c.token_id, &None);

    assert_eq!(c.client.contribution(&contributor), 3_500);
    assert_eq!(c.client.total_raised(), 3_500);

    env.ledger().set_timestamp(deadline + 1);
    c.client.cancel_campaign();
    c.client.refund_single(&contributor);

    assert_eq!(c.client.contribution(&contributor), 0);
    assert_eq!(c.token.balance(&contributor), 3_500);
}

// ── Issue #835: previously-panicking paths now return typed errors, not panics ──

/// `set_reward_tiers` previously indexed the caller-supplied `tiers` vector with
/// `.get(i).unwrap()` while validating sort order. Adversarial tier lists
/// (unsorted, duplicate thresholds, zero/negative thresholds, empty) must now
/// surface a typed `ContractError` instead of aborting the transaction.
#[test]
fn test_adversarial_set_reward_tiers_returns_typed_error() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000i128, 1_000u64, None);

    // Empty list is rejected with a typed error, not a panic.
    let empty: soroban_sdk::Vec<RewardTier> = soroban_sdk::Vec::new(&env);
    assert!(c.client.try_set_reward_tiers(&empty).is_err());

    // Descending / unsorted thresholds are rejected.
    let unsorted = soroban_sdk::Vec::from_array(&env, [tier(&env, 100), tier(&env, 50)]);
    assert!(c.client.try_set_reward_tiers(&unsorted).is_err());

    // Duplicate thresholds are rejected.
    let dupes = soroban_sdk::Vec::from_array(&env, [tier(&env, 100), tier(&env, 100)]);
    assert!(c.client.try_set_reward_tiers(&dupes).is_err());

    // Zero / negative thresholds are rejected.
    let non_positive = soroban_sdk::Vec::from_array(&env, [tier(&env, 0)]);
    assert!(c.client.try_set_reward_tiers(&non_positive).is_err());

    // A valid ascending list succeeds.
    let ok = soroban_sdk::Vec::from_array(&env, [tier(&env, 10), tier(&env, 20), tier(&env, 30)]);
    assert!(c.client.try_set_reward_tiers(&ok).is_ok());
}

/// `get_tier_for_amount` iterated the stored tiers with `.get(i).unwrap()`.
/// Edge amounts (0, i128::MAX) and the no-tiers-configured case must resolve
/// without panicking.
#[test]
fn test_adversarial_get_tier_for_amount_never_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000i128, 1_000u64, None);

    // No tiers configured → None, no panic.
    assert!(c.client.get_tier_for_amount(&0).is_none());
    assert!(c.client.get_tier_for_amount(&i128::MAX).is_none());

    let tiers = soroban_sdk::Vec::from_array(&env, [tier(&env, 100), tier(&env, 1_000)]);
    c.client.set_reward_tiers(&tiers);

    // Below all thresholds → None.
    assert!(c.client.get_tier_for_amount(&0).is_none());
    assert!(c.client.get_tier_for_amount(&99).is_none());
    // At/above thresholds → best qualifying tier, no panic on the extreme value.
    assert_eq!(c.client.get_tier_for_amount(&100).unwrap().min_amount, 100);
    assert_eq!(
        c.client.get_tier_for_amount(&i128::MAX).unwrap().min_amount,
        1_000
    );
}

/// `refund_batch` iterated a caller-supplied contributor list with
/// `.get(i).unwrap()`. An adversarial list — oversized (beyond the internal
/// batch cap), duplicate-laden, and containing addresses that never contributed
/// — must complete without panicking and without over-refunding.
#[test]
fn test_adversarial_refund_batch_oversized_and_duplicates() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 1_000_000i128;
    let c = setup(&env, goal, deadline, None);

    // One genuine contributor with a real balance.
    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &10_000);
    env.ledger().set_timestamp(500);
    c.client
        .contribute(&contributor, &10_000, &c.token_id, &None);

    // Cancel so the campaign is refund-eligible.
    c.client.cancel_campaign();

    // Build an adversarial list: 40 entries (> the 25 batch cap), the real
    // contributor duplicated several times, plus never-seen addresses.
    let mut contributors: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(&env);
    for _ in 0..3 {
        contributors.push_back(contributor.clone());
    }
    for _ in 0..40 {
        contributors.push_back(Address::generate(&env));
    }

    let balance_before = c.token.balance(&contributor);
    // Must not panic; returns a typed Ok with the refunded count.
    let refunded = c.client.try_refund_batch(&contributors);
    assert!(refunded.is_ok());

    // The real contributor is refunded exactly once despite the duplicates.
    assert_eq!(c.token.balance(&contributor), balance_before + 10_000);
    // A second batch refunds nothing further (balance already zeroed).
    let _ = c.client.try_refund_batch(&contributors);
    assert_eq!(c.token.balance(&contributor), balance_before + 10_000);
}

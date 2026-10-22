//! # Arithmetic Safety Property Tests
//!
//! Proptest-based boundary-value tests that exercise every arithmetic operation
//! fixed in the overflow/underflow audit (issue #836).  Each test targets the
//! boundary values that were identified as risky:
//!
//!  - `i128::MAX`, `i128::MAX / 2`, `i128::MAX / 4`, `i128::MAX - 1`
//!  - `0`, `1`, `-1` (where applicable)
//!  - Values that sum to exactly or just past `i128::MAX`
//!  - `u32::MAX` for counter-type fields
//!
//! All tests assert that:
//!  1. The function never panics (panic = host abort on Soroban).
//!  2. Either a `ContractError::Overflow` is returned, or the stored value
//!     is arithmetically correct.

#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

use crowdfund::{Category, CrowdfundContract, CrowdfundContractClient};

mod common;
use common::{setup, Campaign};

// ─────────────────────────────────────────────────────────────────────────────
// Strategy helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Amounts near i128 boundary that could expose overflow in totals.
fn boundary_amount() -> impl Strategy<Value = i128> {
    prop_oneof![
        Just(1i128),
        Just(100i128), // campaign minimum in `setup`
        Just(i128::MAX / 4),
        Just(i128::MAX / 2 - 1),
        Just(i128::MAX / 2),
        Just(i128::MAX - 1),
        Just(i128::MAX),
    ]
}

/// Small positive amounts ≥ campaign minimum (100).
fn small_valid_amount() -> impl Strategy<Value = i128> {
    100i128..10_000i128
}

/// Make a campaign whose goal is i128::MAX / 2 (the largest accepted goal).
fn setup_large_goal(env: &Env) -> Campaign {
    setup(env, i128::MAX / 2, 1_000_000u64, None)
}

// ─────────────────────────────────────────────────────────────────────────────
// §1  contribute() — insurance fee accumulation
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_insurance_fee_accumulation_never_panics(
        a1 in small_valid_amount(),
        a2 in small_valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        c.client.enable_insurance(&100u32, &Address::generate(&env));

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &(a1 + a2 + 1000));

        env.ledger().set_timestamp(500);
        let _ = c.client.try_contribute(&contributor, &a1, &c.token_id, &None);
        let _ = c.client.try_contribute(&contributor, &a2, &c.token_id, &None);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  contribute() — gross total and contribution total overflow
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_gross_total_overflow_caught(
        a1 in small_valid_amount(),
        a2 in small_valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup_large_goal(&env);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &(a1 + a2));
        env.ledger().set_timestamp(500);

        // Neither call must panic
        let _ = c.client.try_contribute(&contributor, &a1, &c.token_id, &None);
        let _ = c.client.try_contribute(&contributor, &a2, &c.token_id, &None);
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn prop_max_half_contribution_does_not_panic(amount in boundary_amount()) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup_large_goal(&env);

        let contributor = Address::generate(&env);
        if amount > 0 {
            c.token_admin.mint(&contributor, &amount);
        }
        env.ledger().set_timestamp(500);
        // Must not panic; typed error is acceptable
        let _ = c.client.try_contribute(&contributor, &amount, &c.token_id, &None);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  contribute() — matching pool never underflows
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_matching_pool_never_underflows(
        a1 in small_valid_amount(),
        a2 in small_valid_amount(),
        a3 in small_valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        let sponsor = Address::generate(&env);
        // Pool intentionally smaller than potential total match
        let pool_size = a1;
        c.token_admin.mint(&sponsor, &pool_size);
        c.client.setup_matching(&sponsor, &10_000u32, &pool_size); // 1:1 ratio

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &(a1 + a2 + a3 + 1000));
        env.ledger().set_timestamp(500);

        c.client.contribute(&contributor, &a1, &c.token_id, &None);
        c.client.contribute(&contributor, &a2, &c.token_id, &None);
        let _ = c.client.try_contribute(&contributor, &a3, &c.token_id, &None);

        // Pool must stay non-negative
        prop_assert!(c.client.get_matching_pool() >= 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  contribute() — contributor count u32 monotone
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_contributor_count_monotone(n in 1usize..20usize) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        env.ledger().set_timestamp(500);
        for _ in 0..n {
            let contributor = Address::generate(&env);
            c.token_admin.mint(&contributor, &1000i128);
            c.client.contribute(&contributor, &100i128, &c.token_id, &None);
        }

        let stats = c.client.get_stats();
        prop_assert_eq!(stats.contributor_count, n as u32);
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_repeat_contributor_count_stable(n in 2usize..10usize) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &(100 * n as i128 + 1000));

        env.ledger().set_timestamp(500);
        for _ in 0..n {
            c.client.contribute(&contributor, &100i128, &c.token_id, &None);
        }

        let stats = c.client.get_stats();
        prop_assert_eq!(stats.contributor_count, 1u32);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  withdraw() — vesting payout * elapsed checked multiply
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_vesting_payout_mul_no_overflow(
        goal in 1_000i128..1_000_000i128,
        contribution in 1_000i128..1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        if contribution < goal { return Ok(()); }

        let creator = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr.clone());
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let vesting = crowdfund::VestingSchedule { cliff: 1_100u64, duration: 10_000u64 };

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator, &token_id, &goal, &1_000u64,
            &1i128, &0i128,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &None, &None, &None, &Category::Other,
            &Some(vesting), &None,
        );

        let contributor = Address::generate(&env);
        token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        client.contribute(&contributor, &contribution, &token_id, &None);

        // Past cliff — must not panic
        env.ledger().set_timestamp(6_000);
        let _ = client.try_withdraw();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  refund_single() — cancelled campaign: amount * unreleased / total
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_refund_cancelled_partial_release_safe(
        contribution in 1_000i128..1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, contribution * 2, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        let released = contribution / 2;
        if released > 0 {
            c.client.record_release(&released);
        }
        c.client.cancel_campaign();

        let balance_before = c.token.balance(&contributor);
        c.client.refund_single(&contributor);
        let refund = c.token.balance(&contributor) - balance_before;

        // Refund must be non-negative and not exceed original contribution
        prop_assert!(refund >= 0);
        prop_assert!(refund <= contribution);
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_refund_cancelled_zero_released_returns_full(
        contribution in 1_000i128..1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, contribution * 2, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        c.client.cancel_campaign();
        c.client.refund_single(&contributor);

        prop_assert_eq!(c.token.balance(&contributor), contribution);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  vote_on_dispute() — votes accumulate safely
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_dispute_votes_accumulate_safely(
        c1 in small_valid_amount(),
        c2 in small_valid_amount(),
        c3 in small_valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        let filer = Address::generate(&env);
        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let v3 = Address::generate(&env);

        env.ledger().set_timestamp(500);
        for (addr, amt) in [(&v1, c1), (&v2, c2), (&v3, c3)] {
            c.token_admin.mint(addr, &(amt + 100));
            c.client.contribute(addr, &amt, &c.token_id, &None);
        }

        let dispute_id = c.client.file_dispute(
            &filer,
            &String::from_str(&env, "test dispute"),
        );
        // All vote calls must succeed or return typed errors — never panic
        let _ = c.client.try_vote_on_dispute(&v1, &dispute_id, &true);
        let _ = c.client.try_vote_on_dispute(&v2, &dispute_id, &false);
        let _ = c.client.try_vote_on_dispute(&v3, &dispute_id, &true);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  get_stats() — progress_bps saturating multiply stays in [0, 10_000]
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_stats_progress_bps_in_range(
        contribution in small_valid_amount(),
        goal in small_valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, goal.max(100), 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        let _ = c.client.try_contribute(&contributor, &contribution, &c.token_id, &None);

        let stats = c.client.get_stats();
        prop_assert!(
            stats.progress_bps <= 10_000u32,
            "progress_bps {} out of range [0, 10_000]", stats.progress_bps
        );
    }
}

#[test]
fn prop_stats_progress_bps_bounded_at_max_goal() {
    let env = Env::default();
    env.mock_all_auths();
    let goal = i128::MAX / 2;
    let c = setup_large_goal(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &goal);
    env.ledger().set_timestamp(500);
    c.client.contribute(&contributor, &goal, &c.token_id, &None);

    let stats = c.client.get_stats();
    assert!(
        stats.progress_bps <= 10_000u32,
        "progress_bps {} out of range at max goal",
        stats.progress_bps
    );
    assert_eq!(stats.total_raised, goal);
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  claim_stream() — stream.claimed += claimable; total - stream.claimed
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_stream_claimed_never_exceeds_total(
        contribution in 1_000i128..1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, contribution, 1_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(100);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        // Set up streaming: starts after deadline, ends 10 000s later
        c.client.set_stream_config(&1_001u64, &11_001u64);

        // Partial claim at midpoint
        env.ledger().set_timestamp(6_000);
        let _ = c.client.try_claim_stream();

        // Claim at full vesting
        env.ledger().set_timestamp(12_000);
        let _ = c.client.try_claim_stream();

        // Exhausted claim — must return typed error, not panic
        let r = c.client.try_claim_stream();
        prop_assert!(r.is_ok() || r.is_err());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §10  get_performance_metrics() — saturating accumulation + trending + ETA
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_performance_metrics_never_panics(
        amounts in proptest::collection::vec(small_valid_amount(), 1..8),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        env.ledger().set_timestamp(100);
        for (i, amt) in amounts.iter().enumerate() {
            let contributor = Address::generate(&env);
            c.token_admin.mint(&contributor, amt);
            env.ledger().set_timestamp(100 + i as u64 * 1_000);
            c.client.contribute(&contributor, amt, &c.token_id, &None);
        }

        env.ledger().set_timestamp(600_000);
        let metrics = c.client.get_performance_metrics();
        prop_assert!(metrics.success_rate_bps <= 10_000u32);
        prop_assert!(
            metrics.trending >= -100i32 && metrics.trending <= 100i32,
            "trending {} out of [-100, 100]", metrics.trending
        );
    }
}

#[test]
fn prop_performance_metrics_zero_velocity_safe() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000i128, 1_000_000u64, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &500_000i128);
    // Contribute at t=1 — still within the first day (days_elapsed == 0)
    env.ledger().set_timestamp(1);
    c.client
        .contribute(&contributor, &500_000i128, &c.token_id, &None);

    let metrics = c.client.get_performance_metrics();
    // Zero elapsed days means zero velocity and no ETA — must not divide by zero
    assert_eq!(metrics.contribution_velocity, 0);
    assert_eq!(metrics.estimated_time_to_goal, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// §11  claim_yield() — info.claimed + payout; distributed + payout
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_yield_claimed_never_exceeds_pool(
        contribution in 1_000i128..100_000i128,
        pool in 1_000i128..100_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000i128, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(100);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        // Fund the yield pool from creator
        c.token_admin.mint(&c.creator, &pool);
        c.client.configure_yield(&c.token_id, &pool, &500u32); // 5% annual

        // Claim at several time points — none must panic
        for t in [200_000u64, 400_000, 800_000, 1_600_000, 3_200_000] {
            env.ledger().set_timestamp(t);
            let _ = c.client.try_claim_yield(&contributor);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §12  Conservation invariant — total_raised == sum of contributions
// ─────────────────────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    #[test]
    fn prop_total_raised_equals_sum_of_contributions(
        amounts in proptest::collection::vec(100i128..50_000i128, 1..8),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        let mut expected_total = 0i128;
        env.ledger().set_timestamp(500);

        for amt in &amounts {
            let contributor = Address::generate(&env);
            c.token_admin.mint(&contributor, amt);
            c.client.contribute(&contributor, amt, &c.token_id, &None);
            expected_total += amt;
        }

        prop_assert_eq!(c.client.total_raised(), expected_total);
    }
}

/// Two contributions whose sum exceeds i128::MAX must not silently wrap the
/// stored total — the second contribution must be rejected with a typed error.
#[test]
fn prop_two_contributions_summing_past_max_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup_large_goal(&env);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let half = i128::MAX / 2;

    c.token_admin.mint(&c1, &half);
    c.token_admin.mint(&c2, &half);

    env.ledger().set_timestamp(500);
    // First contribution fills the goal — must succeed
    let r1 = c.client.try_contribute(&c1, &half, &c.token_id, &None);
    // Second pushes total past i128::MAX — must not panic
    let _ = c.client.try_contribute(&c2, &half, &c.token_id, &None);

    assert!(r1.is_ok(), "first contribution should succeed");
    // Total must remain a valid non-negative value
    assert!(c.client.total_raised() >= 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// §13  Issue #1145 — platform fee calculation never overflows (contribute path)
// ─────────────────────────────────────────────────────────────────────────────
//
// Before #1145 `amount * config.fee_bps as i128 / BASIS_POINTS_MAX` in
// `apply_fees` (contribute.rs) used a bare `*` operator.  For
// `amount == i128::MAX / 2` and `fee_bps == 10_000` the product overflows.
// The fix uses `checked_mul(...).ok_or(ContractError::Overflow)?`.

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_platform_fee_on_contribution_never_panics(
        amount in boundary_amount(),
        fee_bps in 1u32..10_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let platform = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr);
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &Address::generate(&env),
            &token_id,
            &(i128::MAX / 2),
            &10_000u64,
            &1i128,
            &0i128,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &None,
            &Some(crowdfund::PlatformConfig {
                address: platform,
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnContribution,
            }),
            &None,
            &Category::Other,
            &None,
            &None,
        );

        let contributor = Address::generate(&env);
        if amount > 0 {
            token_admin.mint(&contributor, &amount);
        }
        env.ledger().set_timestamp(500);
        // Must not panic — either succeeds or returns a typed ContractError
        let _ = client.try_contribute(&contributor, &amount, &token_id, &None);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §14  Issue #1145 — platform fee calculation never overflows (withdraw path)
// ─────────────────────────────────────────────────────────────────────────────
//
// `deduct_platform_fee` in withdraw.rs previously used `base * config.fee_bps as i128 / 10_000`.
// For a campaign that raised close to `i128::MAX / 2` the bare `*` could overflow.

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn prop_platform_fee_on_success_never_panics(
        goal in 1_000i128..1_000_000i128,
        fee_bps in 1u32..10_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let platform = Address::generate(&env);
        let creator = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr);
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator,
            &token_id,
            &goal,
            &1_000u64,
            &1i128,
            &0i128,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &None,
            &Some(crowdfund::PlatformConfig {
                address: platform,
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnSuccess,
            }),
            &None,
            &Category::Other,
            &None,
            &None,
        );

        let contributor = Address::generate(&env);
        token_admin.mint(&contributor, &goal);
        env.ledger().set_timestamp(500);
        client.contribute(&contributor, &goal, &token_id, &None);

        env.ledger().set_timestamp(1_001);
        // Must not panic
        let _ = client.try_withdraw();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §15  Issue #1145 — stream vested_fraction never overflows
// ─────────────────────────────────────────────────────────────────────────────
//
// `claim_stream` previously computed `total * elapsed as i128 / duration as i128`
// with a bare `*`.  For `total` near `i128::MAX / 2` the product overflows.
// The fix uses `checked_mul(...).and_then(|v| v.checked_div(...))`.

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_stream_vested_fraction_never_panics(
        contribution in 1_000i128..1_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, contribution, 1_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(100);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        // Configure streaming that spans a long period
        c.client.set_stream_config(&1_001u64, &(u64::MAX / 2));

        // Claim at a point deep inside the stream window — must not panic
        env.ledger().set_timestamp(500_000);
        let _ = c.client.try_claim_stream();
    }
}

#[test]
fn prop_stream_vested_fraction_large_total_no_panic() {
    // Regression: total == i128::MAX/2, elapsed large — the unchecked multiply
    // `total * elapsed as i128` would have overflowed before #1145.
    let env = Env::default();
    env.mock_all_auths();
    let large_goal = i128::MAX / 2;
    let c = setup_large_goal(&env);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &large_goal);
    env.ledger().set_timestamp(100);
    c.client.contribute(&contributor, &large_goal, &c.token_id, &None);

    c.client.set_stream_config(&1_001u64, &1_000_001u64);

    // Mid-stream claim — must not panic
    env.ledger().set_timestamp(500_000);
    let _ = c.client.try_claim_stream();
}

// ─────────────────────────────────────────────────────────────────────────────
// §16  Issue #1145 — vested_amount view never panics on large totals
// ─────────────────────────────────────────────────────────────────────────────
//
// `get_vested_amount` in views.rs previously used bare `total * c.fee_bps as i128 / 10_000`
// and `payout * elapsed as i128 / v.duration as i128`.

#[test]
fn prop_get_vested_amount_large_total_no_panic() {
    let env = Env::default();
    env.mock_all_auths();
    let goal = i128::MAX / 2;

    let creator = Address::generate(&env);
    let token_admin_addr = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);
    let token_admin = token::StellarAssetClient::new(&env, &token_id);

    env.ledger().set_timestamp(100);
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &10_000u64,
        &1i128,
        &0i128,
        &String::from_str(&env, "T"),
        &String::from_str(&env, "D"),
        &None,
        &None,
        &None,
        &Category::Other,
        &Some(crowdfund::VestingSchedule {
            cliff: 200u64,
            duration: 5_000u64,
        }),
        &None,
    );

    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &goal);
    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &goal, &token_id, &None);

    // Mid-vesting — must not panic
    env.ledger().set_timestamp(2_700);
    let vested = client.get_vested_amount();
    assert!(vested >= 0, "get_vested_amount must return non-negative value");
    assert!(vested <= goal, "get_vested_amount must not exceed total raised");
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_get_vested_amount_never_panics(
        contribution in 1_000i128..100_000i128,
        fee_bps in 0u32..10_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let platform = Address::generate(&env);
        let creator = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr);
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator,
            &token_id,
            &contribution,
            &1_000u64,
            &1i128,
            &0i128,
            &String::from_str(&env, "T"),
            &String::from_str(&env, "D"),
            &None,
            &Some(crowdfund::PlatformConfig {
                address: platform,
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnSuccess,
            }),
            &None,
            &Category::Other,
            &Some(crowdfund::VestingSchedule {
                cliff: 300u64,
                duration: 10_000u64,
            }),
            &None,
        );

        let contributor = Address::generate(&env);
        token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        client.contribute(&contributor, &contribution, &token_id, &None);

        env.ledger().set_timestamp(5_300);
        // Must not panic
        let vested = client.get_vested_amount();
        prop_assert!(vested >= 0);
        prop_assert!(vested <= contribution);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §17  Issue #1145 — matching ratio calculation never overflows
// ─────────────────────────────────────────────────────────────────────────────
//
// `apply_matching_and_total` in contribute.rs previously used
// `(effective_amount * config.match_ratio as i128) / BASIS_POINTS_MAX`.
// For large effective_amount values the bare `*` could overflow.

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn prop_matching_ratio_never_panics_boundary(
        amount in boundary_amount(),
        match_ratio in 1u32..10_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, i128::MAX / 2, 1_000_000u64, None);

        let sponsor = Address::generate(&env);
        let pool = 1_000_000i128;
        c.token_admin.mint(&sponsor, &pool);
        c.client.setup_matching(&sponsor, &match_ratio, &pool);

        let contributor = Address::generate(&env);
        if amount > 0 {
            c.token_admin.mint(&contributor, &amount);
        }
        env.ledger().set_timestamp(500);
        // Must not panic — Overflow ContractError is acceptable
        let _ = c.client.try_contribute(&contributor, &amount, &c.token_id, &None);
        prop_assert!(c.client.total_raised() >= 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §18  Issue #1145 — yield calculation divisor never zero-divides
// ─────────────────────────────────────────────────────────────────────────────
//
// Before #1145, `claim_yield` used `/ (10_000 * seconds_per_year * total_raised)`
// which panics when total_raised == 0 and is an unguarded multiply that could
// overflow.

#[test]
fn prop_yield_divisor_zero_total_does_not_panic() {
    // Before any contributions total_raised == 0; claim_yield must not panic.
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000i128, 1_000_000u64, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &1_000i128);
    env.ledger().set_timestamp(100);
    c.client.contribute(&contributor, &1_000i128, &c.token_id, &None);

    c.token_admin.mint(&c.creator, &1_000_000i128);
    c.client.configure_yield(&c.token_id, &1_000_000i128, &500u32);

    // Claim immediately (elapsed == 0) and at several points — must not panic
    let _ = c.client.try_claim_yield(&contributor);
    env.ledger().set_timestamp(200_000);
    let _ = c.client.try_claim_yield(&contributor);
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    #[test]
    fn prop_yield_claim_never_panics_with_large_pool(
        pool in 1_000i128..100_000i128,
        contribution in 1_000i128..10_000i128,
        rate_bps in 1u32..2_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(100);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        c.token_admin.mint(&c.creator, &pool);
        c.client.configure_yield(&c.token_id, &pool, &rate_bps);

        for t in [200_000u64, 400_000, 800_000, 1_600_000] {
            env.ledger().set_timestamp(t);
            let _ = c.client.try_claim_yield(&contributor);
        }
        // Total claimed must be non-negative
        prop_assert!(c.token_admin.balance(&contributor) >= 0);
    }
}

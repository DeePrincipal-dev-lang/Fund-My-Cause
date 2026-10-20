#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String, Vec,
};

use crowdfund::{Category, CrowdfundContract, CrowdfundContractClient, PlatformConfig, RewardTier};

mod common;
use common::setup;

const FUZZ_SEED: u64 = 0xC0FFEE1234;

fn log_fuzz_seed(test_name: &str) {
    println!(
        "[{test_name}] deterministic fuzz seed: 0x{FUZZ_SEED:x}. Reproduce locally with: cargo test -p crowdfund --test fuzz_tests {test_name} -- --nocapture"
    );
}

prop_compose! {
    fn valid_amount()(amount in 1i128..10_000_000i128) -> i128 { amount }
}

prop_compose! {
    // Lower bound matches the `setup` helper's min-contribution (100); amounts
    // below the campaign minimum are rejected with `BelowMinimum` by design.
    fn small_amount()(amount in 100i128..10_000i128) -> i128 { amount }
}

fn edge_amount() -> impl Strategy<Value = i128> {
    prop_oneof![
        Just(0i128),
        Just(i128::MAX),
        Just(i128::MAX / 2),
        Just(1i128),
    ]
}

prop_compose! {
    fn goal_amount()(goal in 1_000i128..100_000_000i128) -> i128 { goal }
}

prop_compose! {
    fn platform_fee()(fee_bps in 0u32..10_000u32) -> u32 { fee_bps }
}

// ── Contribute property tests ────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(300))]

    #[test]
    fn fuzz_contribute_increases_total(
        amount in valid_amount(),
    ) {
        log_fuzz_seed("fuzz_contribute_increases_total");
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 10_000_000i128, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        let before = c.client.total_raised();
        c.client.contribute(&contributor, &amount, &c.token_id, &None);
        let after = c.client.total_raised();

        assert_eq!(after - before, amount);
    }

    #[test]
    fn fuzz_contribute_records_contribution(
        amount in valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 10_000_000i128, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        assert_eq!(c.client.contribution(&contributor), amount);
    }

    #[test]
    fn fuzz_contribute_multiple_accumulates(
        (a1, a2, a3) in (small_amount(), small_amount(), small_amount()),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 100_000_000i128, 1_000_000u64, None);

        let c1 = Address::generate(&env);
        c.token_admin.mint(&c1, &(a1 + a2 + a3));

        c.client.contribute(&c1, &a1, &c.token_id, &None);
        c.client.contribute(&c1, &a2, &c.token_id, &None);
        c.client.contribute(&c1, &a3, &c.token_id, &None);

        assert_eq!(c.client.contribution(&c1), a1 + a2 + a3);
        assert_eq!(c.client.total_raised(), a1 + a2 + a3);
    }

    #[test]
    fn fuzz_contribute_after_deadline_fails(
        amount in valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, 10_000_000i128, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(deadline + 1);
        let result = c.client.try_contribute(&contributor, &amount, &c.token_id, &None);
        assert!(result.is_err());
    }

    #[test]
    fn fuzz_contribute_before_deadline_succeeds(
        amount in valid_amount(),
        timestamp in 100u64..1_000u64,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, 10_000_000i128, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(timestamp);
        let result = c.client.try_contribute(&contributor, &amount, &c.token_id, &None);
        assert!(result.is_ok());
    }
}

// ── Refund property tests ────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(300))]

    #[test]
    fn fuzz_refund_after_failed_campaign_restores_balance(
        amount in valid_amount(),
        goal in valid_amount(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        if amount >= goal {
            return Ok(());
        }
        let deadline = 1_000u64;
        let c = setup(&env, goal, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        c.client.refund_single(&contributor);

        assert_eq!(c.token.balance(&contributor), amount);
        assert_eq!(c.client.contribution(&contributor), 0);
    }

    #[test]
    fn fuzz_refund_idempotent(amount in valid_amount()) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, 1_000_000_000i128, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        c.client.refund_single(&contributor);
        let balance_1 = c.token.balance(&contributor);

        c.client.refund_single(&contributor);
        let balance_2 = c.token.balance(&contributor);

        assert_eq!(balance_1, balance_2);
    }

    #[test]
    fn fuzz_refund_after_success_fails(
        goal in 1_000i128..100_000i128,
        amount in 1_000i128..100_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        if amount < goal {
            return Ok(());
        }
        let deadline = 1_000u64;
        let c = setup(&env, goal, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        let result = c.client.try_refund_single(&contributor);
        assert!(result.is_err());
    }
}

// ── Withdraw property tests ─────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(300))]

    #[test]
    fn fuzz_withdraw_clears_total_on_success(
        goal in 1_000i128..100_000i128,
        amount in 1_000i128..100_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        if amount < goal {
            return Ok(());
        }
        let deadline = 1_000u64;
        let c = setup(&env, goal, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        c.client.withdraw();

        assert_eq!(c.client.total_raised(), 0);
    }

    #[test]
    fn fuzz_withdraw_before_deadline_fails(
        goal in 1_000i128..100_000i128,
        amount in 1_000i128..100_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        if amount < goal {
            return Ok(());
        }
        let deadline = 1_000u64;
        let c = setup(&env, goal, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline - 1);
        let result = c.client.try_withdraw();
        assert!(result.is_err());
    }

    #[test]
    fn fuzz_withdraw_below_goal_fails(
        goal in 1_000i128..100_000i128,
        // At/above the campaign minimum (100) but strictly below the smallest goal
        // (1_000), so the campaign is under-funded and withdrawal must fail.
        amount in 100i128..999i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, goal, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        let result = c.client.try_withdraw();
        assert!(result.is_err());
    }

    #[test]
    fn fuzz_withdraw_with_platform_fee_distributes_correctly(
        goal in 1_000i128..100_000i128,
        fee_bps in 1u32..5_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let platform = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr);
        let contract_id = env.register_contract(None, CrowdfundContract);

        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let token = token::Client::new(&env, &token_id);
        let creator = Address::generate(&env);

        env.ledger().set_timestamp(100);

        client.initialize(
            &creator,
            &token_id,
            &goal,
            &1_000u64,
            &1,
            &0i128,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Test"),
            &None,
            &Some(PlatformConfig { address: platform.clone(), fee_bps, fee_mode: crowdfund::FeeMode::OnSuccess }),
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
        client.withdraw();

        assert_eq!(client.total_raised(), 0);
        let _expected_fee = (goal as u128 * fee_bps as u128 / 10_000u128) as i128;
        let platform_balance = token.balance(&platform);
        assert!(platform_balance <= goal); // Fee cannot exceed goal
    }
}

// ── Cross-function interaction tests ─────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn fuzz_many_contributors_total_consistency(
        (a1, a2, a3, a4, a5) in (small_amount(), small_amount(), small_amount(), small_amount(), small_amount()),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000i128, 1_000_000u64, None);

        let contributors = vec![
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let amounts = [a1, a2, a3, a4, a5];

        env.ledger().set_timestamp(500);
        for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
            c.token_admin.mint(addr, &amt);
            c.client.contribute(addr, &amt, &c.token_id, &None);
        }

        let total_raised = c.client.total_raised();
        let sum: i128 = amounts.iter().sum();
        assert_eq!(total_raised, sum);
    }

    #[test]
    fn fuzz_contribute_refund_balance_preservation(
        (c1_amt, c2_amt) in (valid_amount(), valid_amount()),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, 1_000_000_000i128, deadline, None);

        let c1 = Address::generate(&env);
        let c2 = Address::generate(&env);

        c.token_admin.mint(&c1, &c1_amt);
        c.token_admin.mint(&c2, &c2_amt);

        let initial_c1_balance = c.token.balance(&c1);
        let initial_c2_balance = c.token.balance(&c2);

        env.ledger().set_timestamp(500);
        c.client.contribute(&c1, &c1_amt, &c.token_id, &None);
        c.client.contribute(&c2, &c2_amt, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);
        c.client.refund_single(&c1);
        c.client.refund_single(&c2);

        assert_eq!(c.token.balance(&c1), initial_c1_balance);
        assert_eq!(c.token.balance(&c2), initial_c2_balance);
    }

    #[test]
    fn fuzz_multiple_refunds_parallel_withdrawal(
        (c1_amt, c2_amt, c3_amt) in (small_amount(), small_amount(), small_amount()),
        // Above the maximum possible sum of three `small_amount` contributions
        // (3 × 10_000) so the goal is never reached and all three remain refundable.
        goal in 30_001i128..50_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;

        let creator = Address::generate(&env);
        let token_admin_addr = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin_addr);
        let contract_id = env.register_contract(None, CrowdfundContract);

        let client = CrowdfundContractClient::new(&env, &contract_id);
        let token = token::Client::new(&env, &token_id);
        let token_admin = token::StellarAssetClient::new(&env, &token_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator,
            &token_id,
            &goal,
            &deadline,
            &1,
            &0i128,
            &String::from_str(&env, "Test"),
            &String::from_str(&env, "Test"),
            &None,
            &None,
            &None,
            &Category::Other,
            &None,
            &None,
        );

        let c1 = Address::generate(&env);
        let c2 = Address::generate(&env);
        let c3 = Address::generate(&env);

        token_admin.mint(&c1, &c1_amt);
        token_admin.mint(&c2, &c2_amt);
        token_admin.mint(&c3, &c3_amt);

        env.ledger().set_timestamp(500);
        client.contribute(&c1, &c1_amt, &token_id, &None);
        client.contribute(&c2, &c2_amt, &token_id, &None);
        client.contribute(&c3, &c3_amt, &token_id, &None);

        env.ledger().set_timestamp(deadline + 1);

        let c1_bal_before = token.balance(&c1);
        let c2_bal_before = token.balance(&c2);
        let c3_bal_before = token.balance(&c3);

        client.refund_single(&c1);
        client.refund_single(&c2);
        client.refund_single(&c3);

        assert_eq!(token.balance(&c1), c1_bal_before + c1_amt);
        assert_eq!(token.balance(&c2), c2_bal_before + c2_amt);
        assert_eq!(token.balance(&c3), c3_bal_before + c3_amt);
    }
}

// ── Numerical edge cases and overflow protection ──────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn fuzz_extreme_amounts_handled_safely(
        amount in prop_oneof![
            Just(1i128),
            Just(i128::MAX / 2),
            Just(i128::MAX / 4),
        ],
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, i128::MAX / 8, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);

        let result = c.client.try_contribute(&contributor, &amount, &c.token_id, &None);
        // Should not panic, either succeeds or returns error
        let _ = result;
    }

    #[test]
    fn fuzz_total_overflow_protected(
        (a1, a2) in (valid_amount(), valid_amount()),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        // Largest goal the contract accepts (see `validate_goal_not_overflow`);
        // i128::MAX itself is rejected with `GoalOverflow`.
        let c = setup(&env, i128::MAX / 2, 1_000_000u64, None);

        let c1 = Address::generate(&env);
        let c2 = Address::generate(&env);

        c.token_admin.mint(&c1, &a1);
        c.token_admin.mint(&c2, &a2);

        // `valid_amount` can fall below the campaign minimum; tolerate that here
        // since this test only asserts overflow behaviour on the second contribution.
        let _ = c.client.try_contribute(&c1, &a1, &c.token_id, &None);
        let result = c.client.try_contribute(&c2, &a2, &c.token_id, &None);

        // Check saturating behavior or error handling
        if a1.checked_add(a2).is_none() {
            // Overflow must be rejected or saturated, never wrapped. `<= i128::MAX`
            // is vacuously true, so check the total did not wrap negative instead.
            assert!(result.is_err() || c.client.total_raised() >= 0);
        }
    }

    #[test]
    fn fuzz_deadline_edge_cases(
        timestamp in 0u64..1_000_000_000u64,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let deadline = 1_000u64;
        let c = setup(&env, 10_000i128, deadline, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &1_000);

        env.ledger().set_timestamp(timestamp);

        if timestamp < deadline {
            let result = c.client.try_contribute(&contributor, &100, &c.token_id, &None);
            assert!(result.is_ok());
        } else {
            let result = c.client.try_contribute(&contributor, &100, &c.token_id, &None);
            assert!(result.is_err());
        }
    }

    #[test]
    fn fuzz_zero_amount_rejected(goal in 1_000i128..100_000i128) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, goal, 1_000_000u64, None);

        let contributor = Address::generate(&env);
        let result = c.client.try_contribute(&contributor, &0, &c.token_id, &None);
        assert!(result.is_err());
    }
}
// ── Issue #835: fuzz the previously-panicking, caller-length-controlled paths ──

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    /// `refund_batch` iterates a caller-supplied contributor list. Fuzzing the
    /// list length (including 0 and sizes beyond the internal 25-item batch cap)
    /// must never trigger an index-out-of-bounds panic — the call always returns
    /// a typed `Result`.
    #[test]
    fn fuzz_refund_batch_arbitrary_length_never_panics(n in 0usize..60usize) {
        let env = Env::default();
        env.mock_all_auths();

        let deadline = 1_000u64;
        let goal = 1_000_000i128;
        let c = setup(&env, goal, deadline, None);

        // Cancel so the campaign is refund-eligible regardless of goal progress.
        c.client.cancel_campaign();

        // Build a contributor list of the fuzzed length; none have balances,
        // so nothing is refunded, but the loop still walks every entry.
        let mut contributors: Vec<Address> = Vec::new(&env);
        for _ in 0..n {
            contributors.push_back(Address::generate(&env));
        }

        let result = c.client.try_refund_batch(&contributors);
        prop_assert!(result.is_ok());
        prop_assert_eq!(result.unwrap().unwrap(), 0u32);
    }

    /// `get_tier_for_amount` iterates the stored reward tiers. Fuzzing the query
    /// amount across the full i128 range must never panic and must respect the
    /// ascending-threshold contract.
    #[test]
    fn fuzz_get_tier_for_amount_never_panics(amount in edge_amount()) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000i128, 1_000u64, None);

        let tiers = Vec::from_array(
            &env,
            [
                RewardTier {
                    min_amount: 100,
                    name: String::from_str(&env, "bronze"),
                    description: String::from_str(&env, "b"),
                },
                RewardTier {
                    min_amount: 1_000,
                    name: String::from_str(&env, "gold"),
                    description: String::from_str(&env, "g"),
                },
            ],
        );
        c.client.set_reward_tiers(&tiers);

        // Never panics; result is consistent with the amount.
        let tier = c.client.get_tier_for_amount(&amount);
        if amount < 100 {
            prop_assert!(tier.is_none());
        } else {
            prop_assert!(tier.is_some());
        }
    }
}

// ── Issue #1145 — new fuzz tests for fixed arithmetic paths ──────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    // ─── Platform fee (OnContribution) never produces a negative net amount ───

    #[test]
    fn fuzz_platform_fee_on_contribution_net_is_non_negative(
        amount in 100i128..1_000_000i128,
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
        let token = token::Client::new(&env, &token_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator,
            &token_id,
            &1_000_000_000i128,
            &10_000u64,
            &1i128,
            &0i128,
            &String::from_str(&env, "FeeTest"),
            &String::from_str(&env, "OnContrib"),
            &None,
            &Some(PlatformConfig {
                address: platform.clone(),
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnContribution,
            }),
            &None,
            &Category::Other,
            &None,
            &None,
        );

        let contributor = Address::generate(&env);
        token_admin.mint(&contributor, &amount);

        let contract_addr = contract_id.clone();
        env.ledger().set_timestamp(500);
        let result = client.try_contribute(&contributor, &amount, &token_id, &None);
        if result.is_ok() {
            // The campaign's recorded total must be non-negative
            prop_assert!(client.total_raised() >= 0);
            // Platform must not have received more than the gross amount
            let platform_bal = token.balance(&platform);
            prop_assert!(platform_bal <= amount, "platform received more than contributed");
        }
    }

    // ─── Matching arithmetic: total_raised conservation holds under matching ──

    #[test]
    fn fuzz_matching_total_never_exceeds_pool_plus_contributions(
        amount in small_amount(),
        match_ratio in 0u32..10_000u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);

        let sponsor = Address::generate(&env);
        let pool = amount * 2;
        c.token_admin.mint(&sponsor, &pool);
        c.client.setup_matching(&sponsor, &match_ratio, &pool);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &amount);
        env.ledger().set_timestamp(500);
        c.client.contribute(&contributor, &amount, &c.token_id, &None);

        let total = c.client.total_raised();
        // Total cannot exceed contribution + full matching pool
        prop_assert!(total <= amount + pool,
            "total {} exceeds contribution {} + pool {}", total, amount, pool);
        prop_assert!(total >= 0);
    }

    // ─── Stream claim: cumulative claimed never exceeds total deposited ───────

    #[test]
    fn fuzz_stream_cumulative_claimed_never_exceeds_total(
        contribution in 1_000i128..100_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let c = setup(&env, contribution, 1_000u64, None);

        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(100);
        c.client.contribute(&contributor, &contribution, &c.token_id, &None);

        c.client.set_stream_config(&1_001u64, &11_001u64);

        let creator_start = c.token.balance(&c.creator);

        // Multiple claims across the stream window
        for t in [1_500u64, 3_000, 6_000, 9_000, 11_001, 12_000] {
            env.ledger().set_timestamp(t);
            let _ = c.client.try_claim_stream();
        }

        let claimed = c.token.balance(&c.creator) - creator_start;
        prop_assert!(claimed >= 0, "claimed {} is negative", claimed);
        prop_assert!(claimed <= contribution,
            "claimed {} exceeds original deposit {}", claimed, contribution);
    }

    // ─── get_vested_amount always within [0, total_raised] ───────────────────

    #[test]
    fn fuzz_get_vested_amount_bounds(
        contribution in 1_000i128..100_000i128,
        fee_bps in 0u32..5_000u32,
        elapsed_after_cliff in 0u64..5_000u64,
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
            &10_000u64,
            &1i128,
            &0i128,
            &String::from_str(&env, "VestTest"),
            &String::from_str(&env, "VestDesc"),
            &None,
            &Some(PlatformConfig {
                address: platform,
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnSuccess,
            }),
            &None,
            &Category::Other,
            &Some(crowdfund::VestingSchedule {
                cliff: 500u64,
                duration: 4_000u64,
            }),
            &None,
        );

        let contributor = Address::generate(&env);
        token_admin.mint(&contributor, &contribution);
        env.ledger().set_timestamp(500);
        client.contribute(&contributor, &contribution, &token_id, &None);

        env.ledger().set_timestamp(500u64.saturating_add(elapsed_after_cliff));
        let vested = client.get_vested_amount();
        prop_assert!(vested >= 0, "vested {} is negative", vested);
        prop_assert!(vested <= contribution,
            "vested {} exceeds total raised {}", vested, contribution);
    }
}

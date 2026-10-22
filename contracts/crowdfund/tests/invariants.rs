#![cfg(test)]

//! Invariant testing: properties that must always hold true

mod common;

use crate::common::setup;
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

#[test]
fn test_invariant_total_raised_matches_sum_of_contributions() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributors: Vec<Address> = (0..4).map(|_| Address::generate(&env)).collect();
    let amounts = [1_000i128, 2_000, 1_500, 500];

    env.ledger().set_timestamp(500);
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        c.token_admin.mint(addr, &amt);
        c.client.contribute(addr, &amt, &c.token_id, &None);
    }

    let expected_total: i128 = amounts.iter().sum();
    assert_eq!(c.client.total_raised(), expected_total);

    let reported_sum: i128 = contributors
        .iter()
        .map(|addr| c.client.contribution(addr))
        .sum();
    assert_eq!(reported_sum, expected_total);
    assert_eq!(reported_sum, c.client.total_raised());
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn test_invariant_total_raised_never_negative(
        amounts in prop::collection::vec(1i128..10_000i128, 1..20),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        env.ledger().set_timestamp(500);

        for amt in &amounts {
            let contrib = Address::generate(&env);
            c.token_admin.mint(&contrib, amt);
            let _ = c.client.try_contribute(&contrib, amt, &c.token_id, &None);
        }

        let total = c.client.total_raised();
        assert!(total >= 0, "total_raised must never be negative");
    }

    #[test]
    fn test_invariant_individual_contribution_never_negative(
        amounts in prop::collection::vec(1i128..10_000i128, 1..20),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        env.ledger().set_timestamp(500);

        let contributors: Vec<Address> = (0..amounts.len())
            .map(|_| Address::generate(&env))
            .collect();

        for (contrib, &amt) in contributors.iter().zip(amounts.iter()) {
            c.token_admin.mint(contrib, &amt);
            let _ = c.client.try_contribute(contrib, &amt, &c.token_id, &None);
        }

        for contrib in &contributors {
            let contribution = c.client.contribution(contrib);
            assert!(contribution >= 0, "Individual contribution must never be negative");
        }
    }
}

#[test]
fn test_invariant_contribution_zero_after_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 5_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributor = Address::generate(&env);
    let amount = 2_500i128;

    env.ledger().set_timestamp(500);
    c.token_admin.mint(&contributor, &amount);
    c.client
        .contribute(&contributor, &amount, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);
    assert!(c.client.try_withdraw().is_err());

    c.client.refund_single(&contributor);
    assert_eq!(c.client.contribution(&contributor), 0);
    assert_eq!(c.token.balance(&c.contract_id), 0);
}

#[test]
fn test_invariant_no_double_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 5_000i128;
    let c = setup(&env, goal, deadline, None);

    let contributor = Address::generate(&env);
    let amount = 1_200i128;

    env.ledger().set_timestamp(500);
    c.token_admin.mint(&contributor, &amount);
    c.client
        .contribute(&contributor, &amount, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);
    assert!(c.client.try_withdraw().is_err());

    let before_balance = c.token.balance(&contributor);
    c.client.refund_single(&contributor);
    let after_first = c.token.balance(&contributor);
    c.client.refund_single(&contributor);
    let after_second = c.token.balance(&contributor);

    assert_eq!(after_second, after_first);
    assert_eq!(after_first, before_balance + amount);
    assert_eq!(c.client.contribution(&contributor), 0);
}

#[test]
fn test_invariant_contract_balance_zero_after_successful_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 3_000i128;
    let platform_addr = Address::generate(&env);
    let fee_bps = 200u32;

    let c = setup(
        &env,
        goal,
        deadline,
        Some(crowdfund::PlatformConfig {
            address: platform_addr.clone(),
            fee_bps,
            fee_mode: crowdfund::FeeMode::OnSuccess,
        }),
    );

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &goal);
    env.ledger().set_timestamp(500);
    c.client.contribute(&contributor, &goal, &c.token_id, &None);

    env.ledger().set_timestamp(deadline + 1);
    c.client.withdraw();

    assert_eq!(c.token.balance(&c.contract_id), 0);
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    #[test]
    fn test_invariant_total_equals_sum_after_random_ops(
        amounts in prop::collection::vec(1i128..50_000i128, 1..15),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        env.ledger().set_timestamp(500);

        let mut contributors = Vec::new();
        for &amt in &amounts {
            let contrib = Address::generate(&env);
            contributors.push(contrib.clone());
            c.token_admin.mint(&contrib, &amt);
            let _ = c.client.try_contribute(&contrib, &amt, &c.token_id, &None);
        }

        let total = c.client.total_raised();
        let sum: i128 = contributors
            .iter()
            .map(|addr| c.client.contribution(addr))
            .sum();

        assert_eq!(total, sum);
    }

    #[test]
    fn test_invariant_no_funds_lost_before_deadline(
        amounts in prop::collection::vec(1i128..50_000i128, 1..15),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let c = setup(&env, 1_000_000_000i128, 1_000_000u64, None);
        env.ledger().set_timestamp(500);

        let mut sum: i128 = 0;
        for &amt in &amounts {
            let contrib = Address::generate(&env);
            c.token_admin.mint(&contrib, &amt);
            if c.client.try_contribute(&contrib, &amt, &c.token_id, &None).is_ok() {
                sum += amt;
            }
        }

        let contract_balance = c.token.balance(&c.contract_id);
        assert!(contract_balance >= sum);
    }
}

// ── Issue #723 – Fund Conservation property tests ─────────────────────────────
//
// Invariant: total_refunds + withdrawal_amount + fees_collected
//            NEVER exceed total_contributions received.
//
// We test this over random contribution / refund sequences, including
// sequences where the goal is NOT met (refund path) and where it IS met
// (withdraw path with and without a platform fee).

proptest! {
    #![proptest_config(ProptestConfig::with_cases(150))]

    /// Core conservation law – failed campaign path:
    /// sum(refunds) == sum(contributions) and contract ends at zero balance.
    #[test]
    fn prop_conservation_refunds_equal_contributions_on_failed_campaign(
        amounts in prop::collection::vec(100i128..5_000i128, 1..10),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        // Set a goal higher than anything the random amounts can reach so the
        // campaign always fails.
        let total: i128 = amounts.iter().sum();
        let goal = total + 1_000_000;
        let deadline = 1_000u64;

        let c = setup(&env, goal, deadline, None);
        env.ledger().set_timestamp(500);

        let contributors: std::vec::Vec<Address> = (0..amounts.len())
            .map(|_| Address::generate(&env))
            .collect();

        let mut contributed: i128 = 0;
        for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
            c.token_admin.mint(addr, &amt);
            if c.client.try_contribute(addr, &amt, &c.token_id, &None).is_ok() {
                contributed += amt;
            }
        }

        // Advance past deadline – campaign failed
        env.ledger().set_timestamp(deadline + 1);

        // Each contributor claims their refund
        let mut refunded: i128 = 0;
        for addr in &contributors {
            let before = c.token.balance(addr);
            c.client.refund_single(addr);
            let after = c.token.balance(addr);
            refunded += after - before;
        }

        // Conservation: every token returned
        assert_eq!(
            refunded, contributed,
            "total refunded ({}) must equal total contributed ({})",
            refunded, contributed
        );

        // Contract holds zero tokens after all refunds
        assert_eq!(
            c.token.balance(&c.contract_id),
            0,
            "contract must be empty after all refunds"
        );
    }

    /// Core conservation law – successful campaign path (no fee):
    /// creator withdrawal == total contributions.
    #[test]
    fn prop_conservation_withdrawal_equals_contributions_no_fee(
        amounts in prop::collection::vec(1_000i128..10_000i128, 1..8),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let total: i128 = amounts.iter().sum();
        let goal = total / 2 + 1; // ensure goal is reachable
        let deadline = 1_000u64;

        let c = setup(&env, goal, deadline, None);
        env.ledger().set_timestamp(500);

        let mut contributed: i128 = 0;
        for &amt in &amounts {
            let addr = Address::generate(&env);
            c.token_admin.mint(&addr, &amt);
            if c.client.try_contribute(&addr, &amt, &c.token_id, &None).is_ok() {
                contributed += amt;
            }
        }

        env.ledger().set_timestamp(deadline + 1);

        let creator_before = c.token.balance(&c.creator);
        let _ = c.client.try_withdraw();
        let creator_after = c.token.balance(&c.creator);

        // Creator received exactly what was contributed (no fee)
        assert_eq!(
            creator_after - creator_before,
            contributed,
            "creator must receive all contributions when no platform fee"
        );
        assert_eq!(c.token.balance(&c.contract_id), 0);
    }

    /// Conservation with platform fee:
    /// creator_payout + fee_collected == total_contributions.
    #[test]
    fn prop_conservation_withdrawal_with_fee_sums_to_contributions(
        amounts in prop::collection::vec(1_000i128..10_000i128, 1..8),
        fee_bps in 1u32..2_000u32,   // 0.01 % – 20 %
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let total: i128 = amounts.iter().sum();
        let goal = total / 2 + 1;
        let deadline = 1_000u64;
        let platform_addr = Address::generate(&env);

        let c = setup(
            &env,
            goal,
            deadline,
            Some(crowdfund::PlatformConfig {
                address: platform_addr.clone(),
                fee_bps,
                fee_mode: crowdfund::FeeMode::OnSuccess,
            }),
        );
        env.ledger().set_timestamp(500);

        let mut contributed: i128 = 0;
        for &amt in &amounts {
            let addr = Address::generate(&env);
            c.token_admin.mint(&addr, &amt);
            if c.client.try_contribute(&addr, &amt, &c.token_id, &None).is_ok() {
                contributed += amt;
            }
        }

        env.ledger().set_timestamp(deadline + 1);

        let creator_before  = c.token.balance(&c.creator);
        let platform_before = c.token.balance(&platform_addr);

        let _ = c.client.try_withdraw();

        let creator_received  = c.token.balance(&c.creator)       - creator_before;
        let platform_received = c.token.balance(&platform_addr)   - platform_before;

        // Invariant: creator + fee == contributed (conservation)
        assert_eq!(
            creator_received + platform_received,
            contributed,
            "creator ({}) + fee ({}) must equal contributions ({})",
            creator_received, platform_received, contributed
        );
        assert_eq!(c.token.balance(&c.contract_id), 0);
    }

    /// Replay idempotency – processing the same refund twice must not
    /// return more tokens than were contributed.
    #[test]
    fn prop_conservation_double_refund_does_not_exceed_contribution(
        amount in 500i128..20_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let goal = amount * 10; // campaign will always fail
        let deadline = 1_000u64;

        let c = setup(&env, goal, deadline, None);
        env.ledger().set_timestamp(500);

        let addr = Address::generate(&env);
        c.token_admin.mint(&addr, &amount);
        c.client.contribute(&addr, &amount, &c.token_id, &None);

        env.ledger().set_timestamp(deadline + 1);

        let balance_before = c.token.balance(&addr);
        c.client.refund_single(&addr);
        c.client.refund_single(&addr); // second call must be a no-op

        let balance_after = c.token.balance(&addr);
        let returned = balance_after - balance_before;

        assert_eq!(
            returned, amount,
            "double refund must not return more than original contribution"
        );
    }

    /// Partial refund sequence: after any subset of contributors refund,
    /// contract_balance == sum of contributions NOT yet refunded.
    #[test]
    fn prop_conservation_partial_refunds_balance_tracks_remaining(
        amounts in prop::collection::vec(200i128..8_000i128, 2..8),
        // bitmask: which contributors refund in the first wave
        refund_mask in 0u8..255u8,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let total: i128 = amounts.iter().sum();
        let goal = total + 1_000_000; // always fail
        let deadline = 1_000u64;

        let c = setup(&env, goal, deadline, None);
        env.ledger().set_timestamp(500);

        let contributors: std::vec::Vec<(Address, i128)> = amounts
            .iter()
            .map(|&amt| {
                let addr = Address::generate(&env);
                c.token_admin.mint(&addr, &amt);
                c.client.contribute(&addr, &amt, &c.token_id, &None);
                (addr, amt)
            })
            .collect();

        env.ledger().set_timestamp(deadline + 1);

        let mut remaining: i128 = total;
        for (i, (addr, amt)) in contributors.iter().enumerate() {
            if (refund_mask >> (i % 8)) & 1 == 1 {
                c.client.refund_single(addr);
                remaining -= amt;
            }
        }

        let contract_balance = c.token.balance(&c.contract_id);
        assert_eq!(
            contract_balance, remaining,
            "contract balance must equal unrefunded contributions"
        );
    }
}

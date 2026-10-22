#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crowdfund::PlatformConfig;

mod common;
use common::setup;

// ── full lifecycle: 5 contributors → deadline passes → creator withdraws ─────

#[test]
fn test_full_lifecycle_success_with_platform_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 5_000i128;
    let platform_addr = Address::generate(&env);
    let fee_bps = 250u32; // 2.5 %

    let c = setup(
        &env,
        goal,
        deadline,
        Some(PlatformConfig {
            address: platform_addr.clone(),
            fee_bps,
            fee_mode: crowdfund::FeeMode::OnSuccess,
        }),
    );

    let contributors: Vec<Address> = (0..5).map(|_| Address::generate(&env)).collect();
    let amounts = [1_000i128, 1_000, 1_000, 1_000, 1_000];

    env.ledger().set_timestamp(500);
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        c.token_admin.mint(addr, &amt);
        c.client.contribute(addr, &amt, &c.token_id, &None);
    }

    // Goal reached
    assert_eq!(c.client.total_raised(), goal);
    let stats = c.client.get_stats();
    assert_eq!(stats.progress_bps, 10_000);
    assert_eq!(stats.contributor_count, 5);

    // Advance past deadline
    env.ledger().set_timestamp(deadline + 1);

    let creator_before = c.token.balance(&c.creator);
    let platform_before = c.token.balance(&platform_addr);

    c.client.withdraw();

    // ── balance assertions ────────────────────────────────────────────────────
    let fee = goal * fee_bps as i128 / 10_000; // 125
    let payout = goal - fee; // 4_875

    assert_eq!(c.token.balance(&c.creator), creator_before + payout);
    assert_eq!(c.token.balance(&platform_addr), platform_before + fee);
    assert_eq!(c.token.balance(&c.contract_id), 0);

    // ── post-withdraw state ───────────────────────────────────────────────────
    assert_eq!(c.client.total_raised(), 0);

    // Contributor storage is not zeroed by withdraw (only by refund_single).
    // Verify the 5 contributions are still recorded (non-zero) in persistent storage.
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        assert_eq!(c.client.contribution(addr), amt);
    }
}

// ── goal not met → all 5 contributors claim refunds → contract empty ──────────

#[test]
fn test_full_lifecycle_refund_path() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;

    let c = setup(&env, goal, deadline, None);

    let contributors: Vec<Address> = (0..5).map(|_| Address::generate(&env)).collect();
    let amounts = [500i128, 800, 1_200, 600, 900]; // total = 4_000 < goal

    env.ledger().set_timestamp(500);
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        c.token_admin.mint(addr, &amt);
        c.client.contribute(addr, &amt, &c.token_id, &None);
    }

    assert_eq!(c.client.total_raised(), 4_000);

    // Advance past deadline — withdraw must fail (goal not met)
    env.ledger().set_timestamp(deadline + 1);
    assert!(c.client.try_withdraw().is_err());

    // Each contributor claims their refund
    let balances_before: Vec<i128> = contributors
        .iter()
        .map(|addr| c.token.balance(addr))
        .collect();

    for addr in &contributors {
        c.client.refund_single(addr);
    }

    // ── verify each contributor recovered their exact amount ──────────────────
    for (i, (addr, &amt)) in contributors.iter().zip(amounts.iter()).enumerate() {
        assert_eq!(c.token.balance(addr), balances_before[i] + amt);
        assert_eq!(c.client.contribution(addr), 0); // storage zeroed
    }

    // Contract holds nothing
    assert_eq!(c.token.balance(&c.contract_id), 0);
}

#[test]
fn test_pull_based_refund_model_multiple_contributors_goal_not_met() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let goal = 10_000i128;

    let c = setup(&env, goal, deadline, None);

    let contributors: Vec<Address> = (0..10).map(|_| Address::generate(&env)).collect();
    let amounts = [100i128, 200, 300, 400, 500, 600, 700, 800, 900, 1_000]; // total = 5_500 < goal

    env.ledger().set_timestamp(500);
    for (addr, &amt) in contributors.iter().zip(amounts.iter()) {
        c.token_admin.mint(addr, &amt);
        c.client.contribute(addr, &amt, &c.token_id, &None);
    }

    assert_eq!(c.client.total_raised(), 5_500);

    // Advance past deadline — withdraw must fail (goal not met)
    env.ledger().set_timestamp(deadline + 1);
    assert!(c.client.try_withdraw().is_err());

    // Each contributor claims their refund (and cannot claim twice)
    let balances_before: Vec<i128> = contributors
        .iter()
        .map(|addr| c.token.balance(addr))
        .collect();

    for (i, (addr, &amt)) in contributors.iter().zip(amounts.iter()).enumerate() {
        c.client.refund_single(addr);
        assert_eq!(c.token.balance(addr), balances_before[i] + amt);
        assert_eq!(c.client.contribution(addr), 0); // storage zeroed

        let after_first = c.token.balance(addr);
        c.client.refund_single(addr);
        assert_eq!(c.token.balance(addr), after_first); // no double payout
    }

    // total_raised is not modified by refunds in the pull-based model
    assert_eq!(c.client.total_raised(), 5_500);

    // Contract holds nothing
    assert_eq!(c.token.balance(&c.contract_id), 0);
}

//! Branch coverage for the refund and withdraw guards (#1456, #1531).
//!
//! Each test drives one guard in `src/refund.rs` or `src/withdraw.rs` that the
//! happy-path suites do not reach, and asserts the typed error it returns.

#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, Vec};

use crowdfund::{ContractError, CrowdfundContract, CrowdfundContractClient};

mod common;
use common::{fund, setup};

const DEADLINE: u64 = 1_000;

// ── refund_single guards ──────────────────────────────────────────────────────

#[test]
fn refund_single_before_deadline_with_open_campaign_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    let contributor = fund(&env, &c, 1_000);

    let res = c.client.try_refund_single(&contributor);
    assert!(
        res.is_err(),
        "refund must not succeed while the campaign is still open"
    );
    assert_eq!(
        c.client.total_raised(),
        1_000,
        "a rejected refund must not move funds"
    );
}

#[test]
fn refund_single_after_successful_withdraw_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    let contributor = fund(&env, &c, 1_000);

    env.ledger().set_timestamp(DEADLINE + 1);
    c.client.withdraw();

    assert_eq!(
        c.client.try_refund_single(&contributor),
        Err(Ok(ContractError::AlreadyWithdrawn))
    );
}

/// A contributor with a zero balance must not trigger a transfer but the
/// call must succeed (exercises the `amount > 0` early-exit in refund_single).
#[test]
fn refund_single_non_contributor_is_noop() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100_000, DEADLINE, None);

    // Create a backer so the goal is still open after deadline.
    env.ledger().set_timestamp(500);
    fund(&env, &c, 100);

    env.ledger().set_timestamp(DEADLINE + 1);

    let non_contributor = Address::generate(&env);
    // Must not error even though this address never contributed.
    c.client.refund_single(&non_contributor);
    assert_eq!(c.client.contribution(&non_contributor), 0);
}

/// When a campaign is cancelled after `record_release` records a partial
/// payout, each refund must return only the unreleased portion.
/// This exercises the `released > 0 && total > 0` branch in refund_single.
#[test]
fn refund_single_cancelled_with_partial_release_returns_unreleased_portion() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    let contributor = fund(&env, &c, 1_000);

    // Simulate that 500 has been released to the creator already.
    c.client.record_release(&500);

    c.client.cancel_campaign();

    let before = c.token.balance(&contributor);
    c.client.refund_single(&contributor);
    let after = c.token.balance(&contributor);

    // Contributor should receive only the unreleased 50 %.
    assert_eq!(after - before, 500, "only unreleased portion should be refunded");
    assert_eq!(c.client.contribution(&contributor), 0);
}

// ── refund_batch guards ───────────────────────────────────────────────────────

/// refund_batch on an uninitialized contract must return NotActive.
#[test]
fn refund_batch_on_uninitialised_contract_returns_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let mut batch: Vec<Address> = Vec::new(&env);
    batch.push_back(Address::generate(&env));

    assert_eq!(
        client.try_refund_batch(&batch),
        Err(Ok(ContractError::NotActive))
    );
}

/// refund_batch after a successful withdrawal must return AlreadyWithdrawn.
#[test]
fn refund_batch_after_withdraw_returns_already_withdrawn() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    let contributor = fund(&env, &c, 1_000);

    env.ledger().set_timestamp(DEADLINE + 1);
    c.client.withdraw();

    let mut batch: Vec<Address> = Vec::new(&env);
    batch.push_back(contributor);

    assert_eq!(
        c.client.try_refund_batch(&batch),
        Err(Ok(ContractError::AlreadyWithdrawn))
    );
}

// ── withdraw guards ───────────────────────────────────────────────────────────

#[test]
fn withdraw_twice_is_rejected_as_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    fund(&env, &c, 1_000);

    env.ledger().set_timestamp(DEADLINE + 1);
    c.client.withdraw();

    assert_eq!(c.client.try_withdraw(), Err(Ok(ContractError::NotActive)));
}

#[test]
fn withdraw_before_deadline_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    fund(&env, &c, 1_000);

    assert!(
        c.client.try_withdraw().is_err(),
        "creator must not withdraw while the campaign is still open"
    );
    assert_eq!(
        c.client.total_raised(),
        1_000,
        "a rejected withdraw must not move funds"
    );
}

/// Withdraw when total raised is below the goal must return GoalNotReached.
#[test]
fn withdraw_when_goal_not_reached_returns_goal_not_reached() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    fund(&env, &c, 100);

    env.ledger().set_timestamp(DEADLINE + 1);
    assert_eq!(
        c.client.try_withdraw(),
        Err(Ok(ContractError::GoalNotReached))
    );
}

/// Withdraw on a cancelled campaign must return NotActive.
#[test]
fn withdraw_on_cancelled_campaign_returns_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000, DEADLINE, None);

    env.ledger().set_timestamp(500);
    fund(&env, &c, 1_000);
    c.client.cancel_campaign();

    env.ledger().set_timestamp(DEADLINE + 1);
    assert_eq!(c.client.try_withdraw(), Err(Ok(ContractError::NotActive)));
}

/// When a soft_cap is configured withdraw succeeds as soon as total >= soft_cap,
/// even if the hard goal has not been reached.
#[test]
fn withdraw_succeeds_when_soft_cap_is_met_but_hard_goal_is_not() {
    let env = Env::default();
    env.mock_all_auths();
    let hard_goal = 10_000i128;
    let soft_cap = 500i128;
    let c = setup(&env, hard_goal, DEADLINE, None);

    c.client.set_caps(&soft_cap, &0);

    env.ledger().set_timestamp(500);
    fund(&env, &c, soft_cap);

    env.ledger().set_timestamp(DEADLINE + 1);
    // Must succeed because total (500) >= soft_cap (500).
    c.client.withdraw();
    assert_eq!(c.client.status(), crowdfund::Status::Successful);
}

// ── record_release / released_amount ─────────────────────────────────────────

/// record_release with zero amount must return AmountNotPositive.
#[test]
fn record_release_zero_amount_returns_error() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, DEADLINE, None);

    assert_eq!(
        c.client.try_record_release(&0),
        Err(Ok(ContractError::AmountNotPositive))
    );
}

/// released_amount starts at zero on a fresh contract.
#[test]
fn released_amount_starts_at_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, DEADLINE, None);

    assert_eq!(c.client.released_amount(), 0);
}

/// record_release accumulates across multiple calls.
#[test]
fn record_release_accumulates_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, DEADLINE, None);

    c.client.record_release(&300);
    c.client.record_release(&200);

    assert_eq!(c.client.released_amount(), 500);
}

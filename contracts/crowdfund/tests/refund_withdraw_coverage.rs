//! Branch coverage for the refund and withdraw guards (#1456).
//!
//! Each test drives one guard in `src/refund.rs` or `src/withdraw.rs` that the
//! happy-path suites do not reach, and asserts the typed error it returns.

#![cfg(test)]

use soroban_sdk::{testutils::Ledger, Env};

use crowdfund::ContractError;

mod common;
use common::{fund, setup};

const DEADLINE: u64 = 1_000;

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

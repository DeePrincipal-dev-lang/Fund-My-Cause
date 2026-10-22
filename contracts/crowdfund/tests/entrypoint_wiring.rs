//! Entrypoint wiring checks for the lib.rs dispatcher split (#1453).
//!
//! The contract's public ABI must stay the same while `lib.rs` is split into
//! domain modules. These tests call one entrypoint from each domain group
//! through the generated client and assert the typed result, so a dropped or
//! mis-wired export fails here rather than only at deploy time.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crowdfund::ContractError;

mod common;
use common::setup;

const DEADLINE: u64 = 1_000;

#[test]
fn views_group_is_wired_on_a_fresh_campaign() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, DEADLINE, None);

    assert_eq!(c.client.total_raised(), 0);
    let stranger = Address::generate(&env);
    assert_eq!(c.client.contribution(&stranger), 0);
    assert_eq!(c.client.get_stats().contributor_count, 0);
}

#[test]
fn contribute_group_is_wired() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, DEADLINE, None);

    let contributor = Address::generate(&env);
    c.token_admin.mint(&contributor, &500);
    c.client.contribute(&contributor, &500, &c.token_id, &None);

    assert_eq!(c.client.total_raised(), 500);
    assert_eq!(c.client.contribution(&contributor), 500);
}

#[test]
fn refund_group_is_wired() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, DEADLINE, None);

    let stranger = Address::generate(&env);
    assert!(
        c.client.try_refund_single(&stranger).is_err(),
        "refund_single must be exported and reject a non-contributor"
    );
}

#[test]
fn withdraw_group_is_wired() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, DEADLINE, None);

    // Campaign is still open, so the withdraw entrypoint must refuse.
    assert!(c.client.try_withdraw().is_err());
    assert_ne!(
        c.client.try_withdraw(),
        Err(Ok(ContractError::AlreadyWithdrawn)),
        "withdraw must not report a completed payout before one happened"
    );
}

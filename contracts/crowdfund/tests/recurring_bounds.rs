//! Boundary tests for recurring-plan inputs (issue #1487).
//!
//! `validate_recurring_plan` enforces three rules: `amount > 0`, `interval > 0`
//! and `end_date > now`. These tests sit on each side of every rule, plus the
//! top of the numeric range, so a change to any of them shows up here.

#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crowdfund::ContractError;

mod common;
use common::setup;

const NOW: u64 = 1_000;

fn campaign_at_now(env: &Env) -> (common::Campaign<'_>, Address) {
    env.ledger().set_timestamp(NOW);
    let campaign = setup(env, 1_000_000, 10_000, None);
    let contributor = Address::generate(env);
    (campaign, contributor)
}

#[test]
fn amount_boundary_zero_rejected_one_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);
    let client = &campaign.client;

    let below = client.try_setup_recurring(&contributor, &-1, &60, &(NOW + 100));
    assert_eq!(below.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    let zero = client.try_setup_recurring(&contributor, &0, &60, &(NOW + 100));
    assert_eq!(zero.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    client.setup_recurring(&contributor, &1, &60, &(NOW + 100));
    assert_eq!(client.get_recurring_plan(&contributor).unwrap().amount, 1);
}

#[test]
fn amount_upper_bound_i128_max_is_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);

    campaign
        .client
        .setup_recurring(&contributor, &i128::MAX, &60, &(NOW + 100));
    assert_eq!(
        campaign
            .client
            .get_recurring_plan(&contributor)
            .unwrap()
            .amount,
        i128::MAX
    );
}

#[test]
fn interval_boundary_zero_rejected_one_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);
    let client = &campaign.client;

    let zero = client.try_setup_recurring(&contributor, &100, &0, &(NOW + 100));
    assert_eq!(zero.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    client.setup_recurring(&contributor, &100, &1, &(NOW + 100));
    assert_eq!(client.get_recurring_plan(&contributor).unwrap().interval, 1);
}

#[test]
fn interval_upper_bound_u64_max_is_accepted_at_setup() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);

    campaign
        .client
        .setup_recurring(&contributor, &100, &u64::MAX, &(NOW + 100));
    assert_eq!(
        campaign
            .client
            .get_recurring_plan(&contributor)
            .unwrap()
            .interval,
        u64::MAX
    );
}

#[test]
fn end_date_boundary_equal_to_now_rejected_now_plus_one_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);
    let client = &campaign.client;

    let equal = client.try_setup_recurring(&contributor, &100, &60, &NOW);
    assert_eq!(equal.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    let before = client.try_setup_recurring(&contributor, &100, &60, &(NOW - 1));
    assert_eq!(before.err(), Some(Ok(ContractError::InvalidRecurringPlan)));

    client.setup_recurring(&contributor, &100, &60, &(NOW + 1));
    assert_eq!(
        client.get_recurring_plan(&contributor).unwrap().end_date,
        NOW + 1
    );
}

#[test]
fn end_date_upper_bound_u64_max_is_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);

    campaign
        .client
        .setup_recurring(&contributor, &100, &60, &u64::MAX);
    assert_eq!(
        campaign
            .client
            .get_recurring_plan(&contributor)
            .unwrap()
            .end_date,
        u64::MAX
    );
}

#[test]
fn rejected_setup_stores_no_plan() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);

    let r = campaign
        .client
        .try_setup_recurring(&contributor, &0, &60, &(NOW + 100));
    assert!(r.is_err());
    assert!(campaign.client.get_recurring_plan(&contributor).is_none());
}

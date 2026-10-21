//! Boundary tests for recurring-plan inputs (issues #1487, #1562).
//!
//! `validate_recurring_plan` bounds the amount, interval, execution count and
//! start/end ordering. These tests sit on each side of every bound.

#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crowdfund::{ContractError, MAX_RECURRING_EXECUTIONS, MAX_RECURRING_INTERVAL};

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
fn interval_upper_bound_max_accepted_max_plus_one_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);
    let client = &campaign.client;

    client.setup_recurring(&contributor, &100, &MAX_RECURRING_INTERVAL, &(NOW + 100));
    assert_eq!(
        client.get_recurring_plan(&contributor).unwrap().interval,
        MAX_RECURRING_INTERVAL
    );

    let too_large = client.try_setup_recurring(
        &contributor,
        &100,
        &(MAX_RECURRING_INTERVAL + 1),
        &(NOW + 100),
    );
    assert_eq!(
        too_large.err(),
        Some(Ok(ContractError::InvalidRecurringPlan))
    );
}

#[test]
fn execution_count_max_accepted_max_plus_one_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);
    let client = &campaign.client;

    client.setup_recurring(&contributor, &100, &1, &(NOW + MAX_RECURRING_EXECUTIONS));

    let too_many = client.try_setup_recurring(
        &contributor,
        &100,
        &1,
        &(NOW + MAX_RECURRING_EXECUTIONS + 1),
    );
    assert_eq!(
        too_many.err(),
        Some(Ok(ContractError::InvalidRecurringPlan))
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
fn end_date_that_schedules_too_many_executions_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (campaign, contributor) = campaign_at_now(&env);

    let too_far = campaign
        .client
        .try_setup_recurring(&contributor, &100, &60, &u64::MAX);
    assert_eq!(too_far.err(), Some(Ok(ContractError::InvalidRecurringPlan)));
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

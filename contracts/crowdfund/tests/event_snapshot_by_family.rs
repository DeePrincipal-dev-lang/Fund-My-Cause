#![cfg(test)]
#![allow(deprecated)]

//! Snapshot tests: one emitted event per event family (issue #1492).
//!
//! Families covered: contribution, refund, withdrawal and campaign lifecycle.
//! Each test pins the topic pair and the decoded payload, so the emitted
//! topics and payloads must stay byte-identical across the events split.

use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    Address, Env, Symbol, TryFromVal, Val,
};

use crowdfund::{
    EventCancelled, EventContributed, EventRefunded, EventWithdrawn, EVENT_SCHEMA_VERSION,
};

mod common;
use common::setup;

/// Returns the data payload of the first event from `contract_id` whose
/// topics are `(ns, name)`. Panics if no such event was emitted.
fn event_data(env: &Env, contract_id: &Address, ns: &str, name: &str) -> Val {
    let ns = Symbol::new(env, ns);
    let name = Symbol::new(env, name);
    env.events()
        .all()
        .iter()
        .find_map(|(addr, topics, data)| {
            if addr != *contract_id || topics.len() != 2 {
                return None;
            }
            let t0 = Symbol::try_from_val(env, &topics.get(0).unwrap()).ok()?;
            let t1 = Symbol::try_from_val(env, &topics.get(1).unwrap()).ok()?;
            (t0 == ns && t1 == name).then_some(data)
        })
        .unwrap_or_else(|| panic!("event ({:?}, {:?}) not emitted", ns, name))
}

#[test]
fn contribution_family_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, 1_000, None);
    let contributor = Address::generate(&env);

    env.ledger().set_timestamp(500);
    c.token_admin.mint(&contributor, &1_000);
    c.client
        .contribute(&contributor, &1_000, &c.token_id, &None);

    let data = event_data(&env, &c.contract_id, "crowdfund", "contributed");
    let ev = EventContributed::try_from_val(&env, &data).unwrap();
    assert_eq!(ev.contributor, contributor);
    assert_eq!(ev.amount, 1_000);
    assert_eq!(ev.new_total, 1_000);
    assert_eq!(ev.matched_amount, 0);
    assert_eq!(ev.schema_version, EVENT_SCHEMA_VERSION);
}

#[test]
fn refund_family_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1_000u64;
    let c = setup(&env, 10_000, deadline, None);
    let contributor = Address::generate(&env);

    env.ledger().set_timestamp(500);
    c.token_admin.mint(&contributor, &1_000);
    c.client
        .contribute(&contributor, &1_000, &c.token_id, &None);

    // Goal not met after the deadline, so the contributor can claim a refund.
    env.ledger().set_timestamp(deadline + 1);
    c.client.refund_single(&contributor);

    let data = event_data(&env, &c.contract_id, "crowdfund", "refunded");
    let ev = EventRefunded::try_from_val(&env, &data).unwrap();
    assert_eq!(ev.contributor, contributor);
    assert_eq!(ev.amount, 1_000);
    assert_eq!(ev.schema_version, EVENT_SCHEMA_VERSION);
}

#[test]
fn withdrawal_family_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1_000u64;
    let goal = 5_000i128;
    let c = setup(&env, goal, deadline, None);

    env.ledger().set_timestamp(500);
    for _ in 0..5 {
        let contributor = Address::generate(&env);
        c.token_admin.mint(&contributor, &1_000);
        c.client
            .contribute(&contributor, &1_000, &c.token_id, &None);
    }

    env.ledger().set_timestamp(deadline + 1);
    c.client.withdraw();

    let data = event_data(&env, &c.contract_id, "crowdfund", "withdrawn");
    let ev = EventWithdrawn::try_from_val(&env, &data).unwrap();
    assert_eq!(ev.creator, c.creator);
    assert_eq!(ev.total, goal);
    assert_eq!(ev.fee, 0);
    assert_eq!(ev.payout, goal);
    assert_eq!(ev.schema_version, EVENT_SCHEMA_VERSION);
}

#[test]
fn campaign_lifecycle_family_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 10_000, 1_000, None);

    env.ledger().set_timestamp(100);
    c.client.cancel_campaign();

    let data = event_data(&env, &c.contract_id, "crowdfund", "cancelled");
    let ev = EventCancelled::try_from_val(&env, &data).unwrap();
    assert_eq!(ev.creator, c.creator);
    assert_eq!(ev.total_raised, 0);
}

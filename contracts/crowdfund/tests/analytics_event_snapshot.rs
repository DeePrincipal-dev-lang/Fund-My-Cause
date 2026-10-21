#![cfg(test)]
#![allow(deprecated)]

//! Payload snapshot tests for the analytics events emitted by `validate_state`
//! (issues #1489 and #1564). Emissions are routed through `CrowdfundEvents`;
//! these tests pin the topics and payloads that indexers consume, so any change
//! to event names or fields fails here first.

use soroban_sdk::{
    testutils::{Events as _, Ledger},
    Address, Env, Symbol, TryFromVal, Val,
};

use crowdfund::{EventInvariantViolated, EventStateValidated, KEY_GOAL};

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
fn validate_state_healthy_emits_state_validated_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, 1_000, None);

    env.ledger().set_timestamp(250);
    let result = c.client.validate_state();
    assert!(result.valid);

    let data = event_data(&env, &c.contract_id, "contract", "state_validated");
    let ev = EventStateValidated::try_from_val(&env, &data).unwrap();
    assert!(ev.valid);
    assert_eq!(ev.checks_passed, 5);
    assert_eq!(ev.checks_failed, 0);
    assert_eq!(ev.timestamp, 250);
}

#[test]
fn validate_state_violation_emits_invariant_and_summary_snapshot() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 5_000, 1_000, None);

    // Corrupt the stored goal so invariant 2 (goal > 0) is violated.
    env.as_contract(&c.contract_id, || {
        env.storage().instance().set(&KEY_GOAL, &0i128);
    });

    env.ledger().set_timestamp(250);
    let result = c.client.validate_state();
    assert!(!result.valid);
    assert_eq!(result.checks_failed, 1);

    let violated = event_data(&env, &c.contract_id, "contract", "invariant_violated");
    let ev = EventInvariantViolated::try_from_val(&env, &violated).unwrap();
    assert_eq!(ev.invariant_id, 2);
    assert_eq!(ev.timestamp, 250);

    let summary = event_data(&env, &c.contract_id, "contract", "state_validated");
    let ev = EventStateValidated::try_from_val(&env, &summary).unwrap();
    assert!(!ev.valid);
    assert_eq!(ev.checks_passed, 4);
    assert_eq!(ev.checks_failed, 1);
    assert_eq!(ev.timestamp, 250);
}

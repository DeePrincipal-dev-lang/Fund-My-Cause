//! Gas regression test for the combined campaign view (issue #1561).
//!
//! The snapshot must cost less than calling the individual header getters,
//! because it reads the same instance entry once and returns all fields in a
//! single cross-contract invocation. Metering is taken from the invocation
//! resources recorded by the Soroban host.

#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::Env;

mod common;
use common::setup;

fn instructions(env: &Env) -> i64 {
    env.cost_estimate().resources().instructions
}

#[test]
fn campaign_snapshot_uses_fewer_resources_than_individual_getters() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    // Warm the instance entry so the comparison measures invocation overhead,
    // not the first cold storage read.
    let _ = client.get_campaign_info();

    let _ = client.get_campaign_snapshot();
    let snapshot_instructions = instructions(&env);

    let _ = client.creator();
    let creator_instructions = instructions(&env);

    let _ = client.status();
    let status_instructions = instructions(&env);

    let _ = client.total_raised();
    let total_instructions = instructions(&env);

    let separate_instructions = creator_instructions
        .saturating_add(status_instructions)
        .saturating_add(total_instructions);
    assert!(
        snapshot_instructions < separate_instructions,
        "snapshot used {snapshot_instructions} instructions vs {separate_instructions} for three getters"
    );
}

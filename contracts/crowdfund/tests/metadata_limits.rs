#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

//! Negative and boundary tests for campaign metadata limits (issue #1494).
//!
//! Every limit enforced in `metadata.rs` gets a reject case just over the limit and an
//! accept case at the limit:
//!
//! | Field        | Limit                                  | Error                |
//! |--------------|----------------------------------------|----------------------|
//! | title        | 1..=64 characters                      | StringEmpty / StringTooLong |
//! | description  | 1..=512 characters                     | StringEmpty / StringTooLong |
//! | IPFS CID     | 46 (v0) or 59..  (v1) characters       | InvalidInput         |
//!
//! `social_links` has no length limit in `update_metadata`, so there is nothing to reject.

use crowdfund::ContractError;
use soroban_sdk::{Env, String};

mod common;
use common::{setup, Campaign};

const DEADLINE: u64 = 10_000;

fn active_campaign(env: &Env) -> Campaign<'_> {
    env.mock_all_auths();
    setup(env, 1_000, DEADLINE, None)
}

fn text(env: &Env, len: usize) -> String {
    String::from_str(env, &"a".repeat(len))
}

// ── title: 1..=64 ────────────────────────────────────────────────────────────

#[test]
fn title_at_the_64_character_limit_is_accepted() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&Some(text(&env, 64)), &None, &None);
    assert!(matches!(result, Ok(Ok(()))));
}

#[test]
fn title_one_over_the_limit_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&Some(text(&env, 65)), &None, &None);
    assert!(matches!(result, Err(Ok(ContractError::StringTooLong))));
}

#[test]
fn empty_title_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&Some(text(&env, 0)), &None, &None);
    assert!(matches!(result, Err(Ok(ContractError::StringEmpty))));
}

// ── description: 1..=512 ────────────────────────────────────────────────────

#[test]
fn description_at_the_512_character_limit_is_accepted() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&None, &Some(text(&env, 512)), &None);
    assert!(matches!(result, Ok(Ok(()))));
}

#[test]
fn description_one_over_the_limit_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&None, &Some(text(&env, 513)), &None);
    assert!(matches!(result, Err(Ok(ContractError::StringTooLong))));
}

#[test]
fn empty_description_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_metadata(&None, &Some(text(&env, 0)), &None);
    assert!(matches!(result, Err(Ok(ContractError::StringEmpty))));
}

#[test]
fn a_rejected_update_leaves_the_stored_title_unchanged() {
    let env = Env::default();
    let c = active_campaign(&env);
    c.client
        .update_metadata(&Some(text(&env, 10)), &None, &None);

    let _ = c.client.try_update_metadata(&Some(text(&env, 65)), &None, &None);

    // The accepted 10-character title is still the one in the history.
    let history = c.client.get_metadata_history();
    assert_eq!(history.get(history.len() - 1).unwrap().title.len(), 10);
}

// ── IPFS CID: v0 is exactly 46, v1 is 59 or more ───────────────────────────

#[test]
fn cid_v0_length_is_accepted() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_ipfs_cid(&text(&env, 46));
    assert!(matches!(result, Ok(Ok(()))));
}

#[test]
fn cid_v1_minimum_length_is_accepted() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_ipfs_cid(&text(&env, 59));
    assert!(matches!(result, Ok(Ok(()))));
}

#[test]
fn cid_just_below_v1_minimum_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_ipfs_cid(&text(&env, 58));
    assert!(matches!(result, Err(Ok(ContractError::InvalidInput))));
}

#[test]
fn cid_between_v0_and_v1_lengths_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_ipfs_cid(&text(&env, 47));
    assert!(matches!(result, Err(Ok(ContractError::InvalidInput))));
}

#[test]
fn cid_one_under_v0_length_is_rejected() {
    let env = Env::default();
    let c = active_campaign(&env);

    let result = c.client.try_update_ipfs_cid(&text(&env, 45));
    assert!(matches!(result, Err(Ok(ContractError::InvalidInput))));
}

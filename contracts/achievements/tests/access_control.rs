//! # Achievements Access Control Integration Tests
//!
//! Mirrors `registry/tests/access_control.rs`'s style: authorized callers
//! succeed, unauthorized callers are rejected, read-only queries need no auth.
//!
//! Soroban's test harness makes "authorized" trivial via `mock_all_auths()`,
//! but that mock is a blanket, environment-wide setting — it doesn't turn
//! back off on its own. To test genuine rejection, tests here call
//! `env.set_auths(&[])` first, which (per `Env::set_auths`'s docs) disables
//! any active mocking and requires real signatures for any subsequent
//! `require_auth()` — since none are provided, those calls panic.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, String};

use ::common::test_utils::setup_env;
use achievements::ContractError;
use common::deploy_and_init;

// ── initialize() ──────────────────────────────────────────────────────────

#[test]
fn double_initialize_is_rejected() {
    let env = setup_env();
    let (client, admin, platform) = deploy_and_init(&env);

    let result = client.try_initialize(&admin, &platform);
    assert_eq!(result, Err(Ok(ContractError::AlreadyInitialized)));
}

// ── award_user_points() — admin-only (common::AccessControl) ───────────────

#[test]
fn award_user_points_succeeds_for_admin() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let total = client.award_user_points(&user, &25);
    assert_eq!(total, 25);
    assert_eq!(client.get_points(&user), 25);
}

#[test]
#[should_panic]
fn award_user_points_without_admin_auth_panics() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    env.set_auths(&[]);
    client.award_user_points(&user, &25);
}

// ── self-auth requirement on user-facing entry points ──────────────────────

#[test]
fn unlock_achievement_requires_matching_user_auth() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // Type 2 is self-unlockable. Types 1, 3, 4 and 7 are auto-only and are
    // rejected before the auth this test is checking for can be observed.
    client.unlock_achievement(&user, &2, &String::from_str(&env, "meta"));

    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == user));
}

#[test]
#[should_panic]
fn unlock_achievement_without_user_auth_panics() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    env.set_auths(&[]);
    client.unlock_achievement(&user, &1, &String::from_str(&env, "meta"));
}

#[test]
#[should_panic]
fn record_contribution_without_user_auth_panics() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    env.set_auths(&[]);
    client.record_contribution(&user, &String::from_str(&env, "campaign-1"), &1_000_000);
}

#[test]
#[should_panic]
fn record_referral_without_referrer_auth_panics() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let referrer = Address::generate(&env);
    let referee = Address::generate(&env);

    env.set_auths(&[]);
    client.record_referral(&referrer, &referee);
}

#[test]
#[should_panic]
fn update_streak_without_user_auth_panics() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    env.set_auths(&[]);
    client.update_streak(&user);
}

// ── Read-only queries — no auth required ────────────────────────────────────

#[test]
fn get_points_and_level_require_no_auth() {
    let env = setup_env();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // No mock_all_auths(), no set_auths() — plain reads must not panic.
    assert_eq!(client.get_points(&user), 0);
    assert_eq!(client.get_level(&user), 1);
    assert_eq!(client.get_achievements(&user).len(), 0);
}

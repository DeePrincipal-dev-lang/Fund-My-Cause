//! Adversarial / exploit-attempt scenarios for the achievements contract.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use achievements::ContractError;
use common::deploy_and_init;

/// An attacker without admin authorization tries to call the admin-only
/// `award_user_points` to inflate their own leaderboard/points standing.
/// Must be rejected at the host auth layer before any state changes.
#[test]
#[should_panic]
fn unauthorized_score_inflation_via_award_user_points_is_rejected() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let attacker = Address::generate(&env);

    // No admin authorization provided for this call.
    env.set_auths(&[]);
    client.award_user_points(&attacker, &1_000_000);
}

/// An attacker repeatedly calls `unlock_achievement` for the same
/// achievement type, hoping to farm points and duplicate leaderboard credit.
/// The duplicate-unlock guard must block every call after the first.
#[test]
fn repeated_unlock_attempts_cannot_farm_points() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth, so mock before it.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let attacker = Address::generate(&env);

    client.unlock_achievement(&attacker, &2, &String::from_str(&env, "meta"));
    assert_eq!(client.get_points(&attacker), 150);

    for _ in 0..10 {
        let result = client.try_unlock_achievement(&attacker, &2, &String::from_str(&env, "meta"));
        assert_eq!(result, Err(Ok(ContractError::AchievementAlreadyUnlocked)));
    }

    // No change after 10 farming attempts.
    assert_eq!(client.get_points(&attacker), 150);
    assert_eq!(client.get_achievements(&attacker).len(), 1);
    assert_eq!(client.get_rank(&attacker, &3), 1);
}

/// An attacker tries to unlock an out-of-range achievement type to probe for
/// undefined behavior (e.g. an unchecked array/points-table access).
#[test]
fn out_of_range_achievement_type_is_rejected_not_undefined() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth, so mock before it.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let attacker = Address::generate(&env);

    for bogus_type in [0u32, 14, 1_000_000] {
        let result =
            client.try_unlock_achievement(&attacker, &bogus_type, &String::from_str(&env, "x"));
        assert_eq!(result, Err(Ok(ContractError::InvalidAchievementType)));
    }
    assert_eq!(client.get_points(&attacker), 0);
}

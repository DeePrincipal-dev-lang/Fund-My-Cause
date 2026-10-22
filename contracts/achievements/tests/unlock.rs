//! Achievement unlock lifecycle: happy path, validation, and duplicate-unlock
//! prevention.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use achievements::ContractError;
use common::deploy_and_init;

#[test]
fn unlock_achievement_succeeds_and_stores_nft() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let nft = client.unlock_achievement(&user, &11, &String::from_str(&env, "early bird"));

    assert_eq!(nft.user, user);
    assert_eq!(nft.achievement_type, 11);

    let achievements = client.get_achievements(&user);
    assert_eq!(achievements.len(), 1);
    assert_eq!(achievements.get(0).unwrap().achievement_type, 11);

    // Points from get_achievement_points(11) == 75.
    assert_eq!(client.get_points(&user), 75);
}

#[test]
fn unlock_achievement_requires_user_auth() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    client.unlock_achievement(&user, &2, &String::from_str(&env, "meta"));

    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == user);
    assert!(found, "user address should appear in recorded auths");
}

#[test]
fn unlock_achievement_rejects_invalid_type() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result = client.try_unlock_achievement(&user, &0, &String::from_str(&env, "meta"));
    assert_eq!(result, Err(Ok(ContractError::InvalidAchievementType)));

    let result = client.try_unlock_achievement(&user, &14, &String::from_str(&env, "meta"));
    assert_eq!(result, Err(Ok(ContractError::InvalidAchievementType)));
}

#[test]
fn duplicate_unlock_is_rejected_and_does_not_double_award() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    client.unlock_achievement(&user, &2, &String::from_str(&env, "meta"));
    assert_eq!(client.get_points(&user), 150);

    let result = client.try_unlock_achievement(&user, &2, &String::from_str(&env, "meta again"));
    assert_eq!(result, Err(Ok(ContractError::AchievementAlreadyUnlocked)));

    // Points must be unchanged — no double award.
    assert_eq!(client.get_points(&user), 150);
    assert_eq!(client.get_achievements(&user).len(), 1);
}

#[test]
fn unlocking_different_types_accumulates_points_and_achievements() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    client.unlock_achievement(&user, &11, &String::from_str(&env, "a")); // 75 pts
    client.unlock_achievement(&user, &2, &String::from_str(&env, "b")); // 150 pts

    assert_eq!(client.get_points(&user), 225);
    assert_eq!(client.get_achievements(&user).len(), 2);
}

//! Leaderboard ranking correctness through the deployed contract, including a
//! property test across a range of score distributions.

#![cfg(test)]

mod common;

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

use achievements::ContractError;
use common::deploy_and_init;

/// `LeaderboardType::Achievements` — see `contracts/achievements/src/types.rs`.
const ACHIEVEMENTS_LEADERBOARD: u32 = 3;

#[test]
fn leaderboard_and_rank_reflect_relative_scores() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let low = Address::generate(&env);
    let mid = Address::generate(&env);
    let high = Address::generate(&env);

    client.unlock_achievement(&low, &11, &String::from_str(&env, "")); // 75 pts
    client.unlock_achievement(&mid, &2, &String::from_str(&env, "")); // 150 pts
    client.unlock_achievement(&high, &13, &String::from_str(&env, "")); // 600 pts

    let entries = client.get_leaderboard_entries(&ACHIEVEMENTS_LEADERBOARD, &10);
    assert_eq!(entries.len(), 3);
    assert_eq!(entries.get(0).unwrap().user, high);
    assert_eq!(entries.get(0).unwrap().score, 600);
    assert_eq!(entries.get(1).unwrap().user, mid);
    assert_eq!(entries.get(1).unwrap().score, 150);
    assert_eq!(entries.get(2).unwrap().user, low);
    assert_eq!(entries.get(2).unwrap().score, 75);

    assert_eq!(client.get_rank(&high, &ACHIEVEMENTS_LEADERBOARD), 1);
    assert_eq!(client.get_rank(&mid, &ACHIEVEMENTS_LEADERBOARD), 2);
    assert_eq!(client.get_rank(&low, &ACHIEVEMENTS_LEADERBOARD), 3);
}

#[test]
fn leaderboard_limit_truncates_results() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    for achievement_type in [11u32, 2, 5, 13] {
        let user = Address::generate(&env);
        client.unlock_achievement(&user, &achievement_type, &String::from_str(&env, ""));
    }

    let entries = client.get_leaderboard_entries(&ACHIEVEMENTS_LEADERBOARD, &2);
    assert_eq!(entries.len(), 2);
    // Highest-value achievement unlocked was type 13 (600 pts).
    assert_eq!(entries.get(0).unwrap().score, 600);
}

#[test]
fn rank_for_user_with_no_achievements_is_not_found() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result = client.try_get_rank(&user, &ACHIEVEMENTS_LEADERBOARD);
    assert_eq!(result, Err(Ok(ContractError::UserNotFound)));
}

#[test]
fn invalid_leaderboard_type_is_rejected() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result = client.try_get_rank(&user, &99);
    assert_eq!(result, Err(Ok(ContractError::InvalidLeaderboardType)));

    let result = client.try_get_leaderboard_entries(&99, &10);
    assert_eq!(result, Err(Ok(ContractError::InvalidLeaderboardType)));
}

/// Achievement types that `unlock_achievement` accepts directly. Types 1, 3, 4
/// and 7 unlock only through on-chain activity thresholds.
const SELF_UNLOCKABLE: [u32; 9] = [2, 5, 6, 8, 9, 10, 11, 12, 13];

proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]

    /// For a random assignment of achievement-type subsets to a handful of
    /// users (each ending up with a different, unpredictable point total),
    /// the leaderboard must stay sorted descending by score and every user's
    /// reported rank must match their position — i.e. rank correctness holds
    /// across a range of score distributions, not just a hand-picked example.
    #[test]
    fn prop_leaderboard_rank_matches_sorted_scores(
        subsets in prop::collection::vec(
            prop::collection::btree_set(prop::sample::select(SELF_UNLOCKABLE.to_vec()), 1..=6),
            2..=5,
        ),
    ) {
        let env = Env::default();
        // deploy_and_init calls `initialize`, which requires auth.
        env.mock_all_auths();
        let (client, _admin, _platform) = deploy_and_init(&env);
            let mut scored: Vec<(Address, u32)> = Vec::new();
        for subset in subsets {
            let user = Address::generate(&env);
            for achievement_type in &subset {
                client.unlock_achievement(&user, achievement_type, &String::from_str(&env, ""));
            }
            let points = client.get_points(&user);
            scored.push((user, points));
        }

        // Stable descending sort: matches the contract's own tie-breaking,
        // which keeps earlier-inserted entries ahead of later ties.
        scored.sort_by(|a, b| b.1.cmp(&a.1));

        let entries = client.get_leaderboard_entries(&ACHIEVEMENTS_LEADERBOARD, &(scored.len() as u32));
        prop_assert_eq!(entries.len() as usize, scored.len());

        for (i, (user, points)) in scored.iter().enumerate() {
            let entry = entries.get(i as u32).unwrap();
            prop_assert_eq!(&entry.user, user);
            prop_assert_eq!(entry.score, *points);
            prop_assert_eq!(client.get_rank(user, &ACHIEVEMENTS_LEADERBOARD), (i as u32) + 1);
        }
    }
}

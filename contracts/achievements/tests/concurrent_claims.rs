//! # Concurrent claim attempts and eligibility edge-case tests
//!
//! Issue #951 — gaps identified after the #855 CI wiring work.
//!
//! ## What is tested here
//!
//! 1. **Concurrent / duplicate claim simulation** — two "simultaneous" calls
//!    to `unlock_achievement` (or `record_contribution`) by the same account
//!    for the same achievement.  Soroban executes transactions sequentially
//!    on the ledger, so "concurrent" in practice means the second call arrives
//!    while the first is still in the submission queue.  The contract must
//!    ensure exactly one claim succeeds and the second is cleanly rejected with
//!    `AchievementAlreadyUnlocked` — no double-award, no panic.
//!
//! 2. **Eligibility boundary conditions** — each auto-tracked achievement type
//!    is tested at exactly the threshold (first crossing), just below (should
//!    NOT unlock), and just above (should unlock and be idempotent thereafter).
//!
//! 3. **Never-eligible claim attempts** — accounts that have no activity at
//!    all trying to claim auto-tracked achievements must be rejected.
//!
//! ## CI wiring note
//!
//! These tests live in `contracts/achievements/tests/` alongside the existing
//! test modules.  Rust's test harness discovers `#[test]` functions in any
//! `tests/*.rs` file referenced from `tests/` without extra configuration —
//! `cargo test -p achievements` picks them up automatically.

#![cfg(test)]

mod common;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use achievements::ContractError;
use common::deploy_and_init;

// ─────────────────────────────────────────────────────────────────────────────
// Constants mirroring the private thresholds in contracts/achievements/src/lib.rs
// ─────────────────────────────────────────────────────────────────────────────

/// Type 1 — First Contribution (auto-tracked, threshold: 1 contribution)
const FIRST_CONTRIBUTION: u32 = 1;
/// Type 3 — Mega Donor (auto-tracked, threshold: 1_000_000_000 stroops total)
const MEGA_DONOR: u32 = 3;
/// Type 4 — Consistent Contributor (auto-tracked, threshold: 5 contributions)
const CONSISTENT_CONTRIBUTOR: u32 = 4;
/// Type 7 — Referral Champion (auto-tracked, threshold: 3 referrals)
const REFERRAL_CHAMPION: u32 = 7;

/// 1 XLM in stroops
const ONE_XLM: i128 = 10_000_000;
/// 1 000 XLM — the Mega Donor threshold (1_000_000_000 stroops)
const MEGA_DONOR_THRESHOLD: i128 = 1_000_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Concurrent / duplicate claim simulation
// ─────────────────────────────────────────────────────────────────────────────

/// Two back-to-back `unlock_achievement` calls for a self-declarable
/// achievement (type 2 — Super Supporter) by the same user.
///
/// The first must succeed; the second must return
/// `AchievementAlreadyUnlocked`.  Points must be awarded exactly once (150).
#[test]
fn self_declarable_duplicate_unlock_only_awards_once() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // First call — must succeed.
    let nft = client.unlock_achievement(&user, &2, &String::from_str(&env, "meta"));
    assert_eq!(nft.achievement_type, 2);
    assert_eq!(client.get_points(&user), 150);

    // Second call (simulates concurrent submission that arrives after first
    // commits) — must be cleanly rejected.
    let second = client.try_unlock_achievement(&user, &2, &String::from_str(&env, "meta2"));
    assert_eq!(second, Err(Ok(ContractError::AchievementAlreadyUnlocked)));

    // Exactly one achievement record; points unchanged.
    assert_eq!(client.get_achievements(&user).len(), 1);
    assert_eq!(client.get_points(&user), 150);
}

/// Two back-to-back `record_contribution` calls that both cross the
/// FIRST_CONTRIBUTION threshold.  The auto-unlock helper (`try_auto_unlock`)
/// is idempotent — it silently no-ops on the second call rather than
/// double-awarding or panicking.
#[test]
fn concurrent_first_contribution_auto_unlock_is_idempotent() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // First contribution unlocks FIRST_CONTRIBUTION (50 pts) and adds contribution
    // points (1 pt per 1 000 000 stroops, so 10 pts for ONE_XLM).
    client.record_contribution(&user, &String::from_str(&env, "c1"), &ONE_XLM);
    let points_after_first = client.get_points(&user);
    let achievements_after_first = client.get_achievements(&user).len();

    assert_eq!(
        achievements_after_first, 1,
        "FIRST_CONTRIBUTION must be auto-unlocked on first contribution"
    );
    // 50 pts (achievement) + 10 pts (contribution points for 1 XLM)
    assert_eq!(points_after_first, 60);

    // Second contribution — FIRST_CONTRIBUTION is already unlocked; must NOT
    // be re-awarded.  Only contribution points for this call are added.
    client.record_contribution(&user, &String::from_str(&env, "c2"), &ONE_XLM);

    let achievements_after_second = client.get_achievements(&user).len();
    assert_eq!(
        achievements_after_second, 1,
        "No new achievement should unlock on the second contribution"
    );

    // Points: previous + 10 contribution points for the second 1 XLM.
    let points_after_second = client.get_points(&user);
    assert_eq!(points_after_second, points_after_first + 10);
}

/// Concurrent duplicate `record_referral` calls at the REFERRAL_CHAMPION
/// threshold (3 referrals).  If the third and a hypothetical fourth call
/// arrive "simultaneously", the fourth must be a clean no-op for the
/// Referral Champion badge.
#[test]
fn concurrent_referral_champion_auto_unlock_is_idempotent() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let referrer = Address::generate(&env);

    // Record 3 referrals to trigger the threshold.
    for _ in 0..3 {
        let referee = Address::generate(&env);
        client.record_referral(&referrer, &referee);
    }

    let achievements = client.get_achievements(&referrer);
    let champion_count = achievements
        .iter()
        .filter(|a| a.achievement_type == REFERRAL_CHAMPION)
        .count();
    assert_eq!(
        champion_count, 1,
        "REFERRAL_CHAMPION should be unlocked exactly once after 3 referrals"
    );

    let points_at_3 = client.get_points(&referrer);

    // Fourth referral — threshold already passed; try_auto_unlock must no-op.
    let referee4 = Address::generate(&env);
    client.record_referral(&referrer, &referee4);

    let achievements_after_4 = client.get_achievements(&referrer);
    let champion_count_after_4 = achievements_after_4
        .iter()
        .filter(|a| a.achievement_type == REFERRAL_CHAMPION)
        .count();
    assert_eq!(
        champion_count_after_4, 1,
        "No second REFERRAL_CHAMPION badge after the 4th referral"
    );

    // Only referral points (50) added for the 4th referral; no badge re-award.
    assert_eq!(client.get_points(&referrer), points_at_3 + 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Eligibility boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

// ── FIRST_CONTRIBUTION (type 1) ───────────────────────────────────────────

/// Exactly at threshold (1 contribution) — must unlock.
#[test]
fn first_contribution_unlocks_at_exactly_1_contribution() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    client.record_contribution(&user, &String::from_str(&env, "c1"), &ONE_XLM);

    let has = client
        .get_achievements(&user)
        .iter()
        .any(|a| a.achievement_type == FIRST_CONTRIBUTION);
    assert!(
        has,
        "FIRST_CONTRIBUTION must be awarded after exactly 1 contribution"
    );
}

/// Just below threshold (0 contributions) — must NOT unlock.
/// We verify this by checking a fresh account has no FIRST_CONTRIBUTION.
#[test]
fn first_contribution_not_awarded_before_any_contribution() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // No calls — brand-new account.
    let achievements = client.get_achievements(&user);
    let has = achievements
        .iter()
        .any(|a| a.achievement_type == FIRST_CONTRIBUTION);
    assert!(
        !has,
        "FIRST_CONTRIBUTION must not be pre-awarded with zero contributions"
    );
    assert_eq!(client.get_points(&user), 0);
}

// ── CONSISTENT_CONTRIBUTOR (type 4) ──────────────────────────────────────

/// Just below threshold (4 contributions) — must NOT unlock type 4.
#[test]
fn consistent_contributor_not_awarded_at_4_contributions() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    for i in 0..4 {
        let campaign = format!("c{i}");
        client.record_contribution(&user, &String::from_str(&env, &campaign), &ONE_XLM);
    }

    let has = client
        .get_achievements(&user)
        .iter()
        .any(|a| a.achievement_type == CONSISTENT_CONTRIBUTOR);
    assert!(
        !has,
        "CONSISTENT_CONTRIBUTOR must NOT be awarded before 5 contributions"
    );
}

/// Exactly at threshold (5 contributions) — must unlock type 4.
#[test]
fn consistent_contributor_awarded_at_exactly_5_contributions() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    for i in 0..5 {
        let campaign = format!("c{i}");
        client.record_contribution(&user, &String::from_str(&env, &campaign), &ONE_XLM);
    }

    let has = client
        .get_achievements(&user)
        .iter()
        .any(|a| a.achievement_type == CONSISTENT_CONTRIBUTOR);
    assert!(
        has,
        "CONSISTENT_CONTRIBUTOR must be awarded at exactly 5 contributions"
    );
}

/// Just above threshold (6 contributions) — already awarded; idempotent.
#[test]
fn consistent_contributor_not_double_awarded_above_threshold() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    for i in 0..6 {
        let campaign = format!("c{i}");
        client.record_contribution(&user, &String::from_str(&env, &campaign), &ONE_XLM);
    }

    let count = client
        .get_achievements(&user)
        .iter()
        .filter(|a| a.achievement_type == CONSISTENT_CONTRIBUTOR)
        .count();
    assert_eq!(
        count, 1,
        "CONSISTENT_CONTRIBUTOR must appear exactly once after 6 contributions"
    );
}

// ── MEGA_DONOR (type 3) ────────────────────────────────────────────────────

/// Just below threshold (999_999_999 stroops) — must NOT unlock type 3.
#[test]
fn mega_donor_not_awarded_just_below_threshold() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // One contribution of threshold - 1 stroop.
    client.record_contribution(
        &user,
        &String::from_str(&env, "c1"),
        &(MEGA_DONOR_THRESHOLD - 1),
    );

    let has = client
        .get_achievements(&user)
        .iter()
        .any(|a| a.achievement_type == MEGA_DONOR);
    assert!(
        !has,
        "MEGA_DONOR must NOT be awarded at {} stroops (one below threshold)",
        MEGA_DONOR_THRESHOLD - 1
    );
}

/// Exactly at threshold (1_000_000_000 stroops) — must unlock type 3.
#[test]
fn mega_donor_awarded_at_exactly_threshold() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    client.record_contribution(&user, &String::from_str(&env, "c1"), &MEGA_DONOR_THRESHOLD);

    let has = client
        .get_achievements(&user)
        .iter()
        .any(|a| a.achievement_type == MEGA_DONOR);
    assert!(
        has,
        "MEGA_DONOR must be awarded at exactly {} stroops",
        MEGA_DONOR_THRESHOLD
    );
}

/// Just above threshold (1_000_000_001 stroops spread across two
/// contributions) — already awarded; idempotent.
#[test]
fn mega_donor_not_double_awarded_above_threshold() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    // Two contributions that together exceed the threshold.
    client.record_contribution(&user, &String::from_str(&env, "c1"), &MEGA_DONOR_THRESHOLD);
    client.record_contribution(&user, &String::from_str(&env, "c2"), &ONE_XLM);

    let count = client
        .get_achievements(&user)
        .iter()
        .filter(|a| a.achievement_type == MEGA_DONOR)
        .count();
    assert_eq!(
        count, 1,
        "MEGA_DONOR must appear exactly once even when total exceeds threshold"
    );
}

// ── REFERRAL_CHAMPION (type 7) ────────────────────────────────────────────

/// Just below threshold (2 referrals) — must NOT unlock type 7.
#[test]
fn referral_champion_not_awarded_at_2_referrals() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let referrer = Address::generate(&env);

    for _ in 0..2 {
        let referee = Address::generate(&env);
        client.record_referral(&referrer, &referee);
    }

    let has = client
        .get_achievements(&referrer)
        .iter()
        .any(|a| a.achievement_type == REFERRAL_CHAMPION);
    assert!(
        !has,
        "REFERRAL_CHAMPION must NOT be awarded before 3 referrals"
    );
}

/// Exactly at threshold (3 referrals) — must unlock type 7.
#[test]
fn referral_champion_awarded_at_exactly_3_referrals() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let referrer = Address::generate(&env);

    for _ in 0..3 {
        let referee = Address::generate(&env);
        client.record_referral(&referrer, &referee);
    }

    let has = client
        .get_achievements(&referrer)
        .iter()
        .any(|a| a.achievement_type == REFERRAL_CHAMPION);
    assert!(
        has,
        "REFERRAL_CHAMPION must be awarded at exactly 3 referrals"
    );
}

/// Just above threshold (4 referrals) — already awarded; idempotent.
#[test]
fn referral_champion_not_double_awarded_above_threshold() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let referrer = Address::generate(&env);

    for _ in 0..4 {
        let referee = Address::generate(&env);
        client.record_referral(&referrer, &referee);
    }

    let count = client
        .get_achievements(&referrer)
        .iter()
        .filter(|a| a.achievement_type == REFERRAL_CHAMPION)
        .count();
    assert_eq!(
        count, 1,
        "REFERRAL_CHAMPION must appear exactly once after 4 referrals"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Never-eligible claim attempts — auto-tracked types via manual entry point
// ─────────────────────────────────────────────────────────────────────────────

/// A user who has never contributed attempts to manually claim
/// FIRST_CONTRIBUTION (type 1) via `unlock_achievement`.
/// Must be rejected with `AchievementNotSelfUnlockable` — not
/// `AchievementAlreadyUnlocked`, which would wrongly imply it was earned.
#[test]
fn never_eligible_cannot_manually_claim_first_contribution() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result =
        client.try_unlock_achievement(&user, &FIRST_CONTRIBUTION, &String::from_str(&env, ""));
    assert_eq!(
        result,
        Err(Ok(ContractError::AchievementNotSelfUnlockable)),
        "Manually claiming an auto-tracked achievement must return AchievementNotSelfUnlockable"
    );

    // No state change.
    assert_eq!(client.get_achievements(&user).len(), 0);
    assert_eq!(client.get_points(&user), 0);
}

/// A user who has never donated attempts to manually claim
/// MEGA_DONOR (type 3) via `unlock_achievement`.
#[test]
fn never_eligible_cannot_manually_claim_mega_donor() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result = client.try_unlock_achievement(&user, &MEGA_DONOR, &String::from_str(&env, ""));
    assert_eq!(result, Err(Ok(ContractError::AchievementNotSelfUnlockable)));
    assert_eq!(client.get_points(&user), 0);
}

/// A user who has contributed only 4 times attempts to manually claim
/// CONSISTENT_CONTRIBUTOR (type 4) — should not be allowed even if they
/// are one contribution short of the threshold.
#[test]
fn below_threshold_user_cannot_manually_claim_consistent_contributor() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    for i in 0..4 {
        let campaign = format!("c{i}");
        client.record_contribution(&user, &String::from_str(&env, &campaign), &ONE_XLM);
    }

    // Manual claim attempt while below the 5-contribution threshold.
    let result =
        client.try_unlock_achievement(&user, &CONSISTENT_CONTRIBUTOR, &String::from_str(&env, ""));
    assert_eq!(
        result,
        Err(Ok(ContractError::AchievementNotSelfUnlockable)),
        "CONSISTENT_CONTRIBUTOR is auto-tracked and must reject manual unlock regardless of progress"
    );
}

/// A user who has referred nobody attempts to manually claim
/// REFERRAL_CHAMPION (type 7).
#[test]
fn never_eligible_cannot_manually_claim_referral_champion() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    let result =
        client.try_unlock_achievement(&user, &REFERRAL_CHAMPION, &String::from_str(&env, ""));
    assert_eq!(result, Err(Ok(ContractError::AchievementNotSelfUnlockable)));
    assert_eq!(client.get_achievements(&user).len(), 0);
}

/// All four auto-tracked types (1, 3, 4, 7) are explicitly blocked from
/// manual unlock.  This single test iterates over all of them to guard
/// against future regressions where one type is accidentally removed from
/// the `is_auto_only_achievement` check.
#[test]
fn all_auto_tracked_types_reject_manual_unlock() {
    let env = Env::default();
    // deploy_and_init calls `initialize`, which requires auth.
    env.mock_all_auths();
    let (client, _admin, _platform) = deploy_and_init(&env);
    let user = Address::generate(&env);

    for auto_type in [
        FIRST_CONTRIBUTION,
        MEGA_DONOR,
        CONSISTENT_CONTRIBUTOR,
        REFERRAL_CHAMPION,
    ] {
        let result = client.try_unlock_achievement(&user, &auto_type, &String::from_str(&env, ""));
        assert_eq!(
            result,
            Err(Ok(ContractError::AchievementNotSelfUnlockable)),
            "Type {auto_type} must be rejected as AchievementNotSelfUnlockable"
        );
    }

    // No achievements or points awarded by any of the rejected calls.
    assert_eq!(client.get_achievements(&user).len(), 0);
    assert_eq!(client.get_points(&user), 0);
}

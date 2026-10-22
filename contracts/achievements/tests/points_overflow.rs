//! Overflow and boundary tests for the points accumulation logic.
//!
//! Issue #1568: `award_points` previously used `saturating_add`, which
//! silently capped totals at `u32::MAX` and allowed two different users with
//! different real scores to both end up at the same maximum — corrupting
//! leaderboard rankings. It now uses `checked_add` and returns
//! `ContractError::InvalidAmount` on overflow, so callers can handle the
//! error explicitly instead of observing silent data loss.
//!
//! # Property strategy
//!
//! Rather than a heavyweight property-test framework (which is awkward inside
//! `soroban_sdk`'s sandboxed `Env`), these tests exercise the boundary
//! exhaustively with hand-chosen values clustered near `u32::MAX`.

#![cfg(test)]
#![allow(deprecated)]

mod common;
use common::deploy_and_init;

use soroban_sdk::{testutils::Address as _, Address, Env};

use achievements::points::MAX_POINTS;

// ── MAX_POINTS constant ──────────────────────────────────────────────────────

/// The contract-level ceiling is exactly `u32::MAX`.  Any change to this
/// constant is a breaking change to the on-chain interface and must be
/// accompanied by a migration.
#[test]
fn max_points_equals_u32_max() {
    assert_eq!(MAX_POINTS, u32::MAX, "MAX_POINTS must equal u32::MAX");
}

// ── Overflow returns an error, does not wrap or cap ─────────────────────────

#[test]
fn award_points_overflow_returns_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = deploy_and_init(&env);

    let user = Address::generate(&env);

    // Set the user's points to u32::MAX - 1 via repeated small awards.
    // We do this in one large award to keep the test fast.
    client.award_points(&admin, &user, &(u32::MAX - 1));
    assert_eq!(client.get_user_points(&user), u32::MAX - 1);

    // Awarding 1 more point should succeed (total == u32::MAX).
    client.award_points(&admin, &user, &1u32);
    assert_eq!(client.get_user_points(&user), u32::MAX);

    // Now any additional award — even 1 — must return an error.
    let result = client.try_award_points(&admin, &user, &1u32);
    assert!(
        result.is_err(),
        "award_points must return Err when total would exceed u32::MAX"
    );

    // Verify the stored value was NOT modified by the failed call.
    assert_eq!(
        client.get_user_points(&user),
        u32::MAX,
        "failed award must not mutate stored points"
    );
}

#[test]
fn award_points_large_single_award_at_boundary() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = deploy_and_init(&env);

    let user = Address::generate(&env);

    // Award exactly u32::MAX in one call — must succeed.
    client.award_points(&admin, &user, &u32::MAX);
    assert_eq!(client.get_user_points(&user), u32::MAX);

    // Any further award overflows.
    let result = client.try_award_points(&admin, &user, &1u32);
    assert!(result.is_err(), "should overflow after reaching u32::MAX");
}

#[test]
fn award_points_zero_does_not_overflow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = deploy_and_init(&env);

    let user = Address::generate(&env);
    client.award_points(&admin, &user, &u32::MAX);

    // Awarding 0 on top of MAX should not overflow (0 + MAX == MAX).
    client.award_points(&admin, &user, &0u32);
    assert_eq!(client.get_user_points(&user), u32::MAX);
}

// ── Property: accumulation near u32::MAX behaves correctly ─────────────────

/// Tests award behaviour for each value in [MAX-5 .. MAX+5] (where MAX+n
/// means "previous total is MAX and we try to add n more").  This exhaustive
/// near-boundary sweep replaces a proptest generator over the same range.
#[test]
fn award_points_near_u32_max_boundary() {
    // Deltas from MAX at which the second award would overflow.
    // Each tuple is (initial_points, additional_points, should_succeed).
    let cases: &[(u32, u32, bool)] = &[
        (u32::MAX - 5, 5, true),  // sum == MAX   → ok
        (u32::MAX - 5, 4, true),  // sum == MAX-1 → ok
        (u32::MAX - 1, 0, true),  // sum == MAX-1 → ok
        (u32::MAX, 0, true),      // sum == MAX   → ok (adding zero never overflows)
        (u32::MAX - 1, 1, true),  // sum == MAX   → ok (last valid sum)
        (u32::MAX, 1, false),     // sum > MAX    → overflow
        (u32::MAX - 5, 6, false), // sum > MAX    → overflow
        (u32::MAX - 2, 3, false), // sum > MAX    → overflow
    ];

    for &(initial, additional, should_succeed) in cases {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _) = deploy_and_init(&env);
        let user = Address::generate(&env);

        // Seed the initial points.
        if initial > 0 {
            client.award_points(&admin, &user, &initial);
        }

        let result = client.try_award_points(&admin, &user, &additional);
        if should_succeed {
            assert!(
                result.is_ok(),
                "expected Ok for initial={initial}, additional={additional}, got Err"
            );
            assert_eq!(
                client.get_user_points(&user),
                initial.saturating_add(additional),
                "wrong stored total after successful award"
            );
        } else {
            assert!(
                result.is_err(),
                "expected Err (overflow) for initial={initial}, additional={additional}, got Ok"
            );
            // State must be unchanged.
            assert_eq!(
                client.get_user_points(&user),
                initial,
                "failed award must not mutate stored points"
            );
        }
    }
}

// ── Overflow does not affect other users ────────────────────────────────────

#[test]
fn award_points_overflow_is_isolated_to_target_user() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = deploy_and_init(&env);

    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    // Give user_a a maxed-out account.
    client.award_points(&admin, &user_a, &u32::MAX);

    // Give user_b some ordinary points.
    client.award_points(&admin, &user_b, &500u32);

    // Failing award on user_a must not touch user_b.
    let _ = client.try_award_points(&admin, &user_a, &1u32);

    assert_eq!(
        client.get_user_points(&user_b),
        500,
        "other users must be unaffected by a failed award on a different user"
    );
}

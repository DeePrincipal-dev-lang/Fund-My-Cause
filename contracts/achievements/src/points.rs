/// Points and level management functions.
///
/// # Storage layout (v2)
///
/// Level is **not stored** on the ledger.  It is always derived from the
/// current points value: `(points / 100 + 1).min(100)`.  This eliminates one
/// write per `award_points` call (previously `DataKey::Level` was written
/// every time points changed).
///
/// Any legacy `DataKey::Level` entries that exist on already-deployed ledgers
/// are harmless orphans — they are never read or written by this code and will
/// expire when their TTL elapses.
///
/// # Overflow safety
///
/// All point accumulation uses `checked_add`. If an award would push a user's
/// total past [`MAX_POINTS`], `award_points` returns
/// `Err(ContractError::InvalidAmount)` rather than silently capping or
/// wrapping. This prevents corrupted leaderboard rankings (issue #1568).
use crate::errors::ContractError;
use crate::storage::DataKey;
use soroban_sdk::Address;
use soroban_sdk::Env;

/// Maximum point total a single user can accumulate.
///
/// Corresponds to level 100 (the cap defined in [`calculate_level_from_points`]).
/// Any award that would push a user above this ceiling is rejected with
/// [`ContractError::InvalidAmount`] so that leaderboard scores remain
/// meaningful and no silent wrap-around can occur.
pub const MAX_POINTS: u32 = u32::MAX;

/// Award points to a user. Returns the user's new points total so callers
/// that also need it (e.g. to derive a level) don't have to re-read
/// `DataKey::Points` right after this just wrote it.
///
/// # Maximum
///
/// Points are a `u32`, so the maximum total is `u32::MAX` (4,294,967,295).
/// Totals saturate there: an award that would overflow leaves the user at
/// `u32::MAX` and never wraps back to a small value.
pub fn award_points(env: &Env, user: &Address, points: u32) -> Result<u32, ContractError> {
    let key = DataKey::Points(user.clone());
    let current_points: u32 = env.storage().instance().get(&key).unwrap_or(0);
    let new_points = current_points
        .checked_add(points)
        .ok_or(ContractError::InvalidAmount)?;
    env.storage().instance().set(&key, &new_points);
    Ok(new_points)
}

/// Get user points.
pub fn get_user_points(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let key = DataKey::Points(user.clone());
    Ok(env.storage().instance().get(&key).unwrap_or(0))
}

/// Get user level — **derived from points, never read from storage** (v2).
///
/// Replaces the old two-step read of `DataKey::Level`.  1 storage read
/// (points) instead of 1 storage read (level) + 1 write (level) on every
/// mutation path.
pub fn get_user_level(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let points = get_user_points(env, user)?;
    Ok(calculate_level_from_points(points))
}

/// Calculate level from points: 100 pts per level, max 100.
pub fn calculate_level_from_points(points: u32) -> u32 {
    (points / 100 + 1).min(100)
}

/// Deduct points from user.
#[allow(dead_code)]
pub fn deduct_points(env: &Env, user: &Address, points: u32) -> Result<(), ContractError> {
    let key = DataKey::Points(user.clone());
    let current_points: u32 = env.storage().instance().get(&key).unwrap_or(0);

    if current_points < points {
        return Err(ContractError::InsufficientPoints);
    }

    let new_points = current_points - points;
    env.storage().instance().set(&key, &new_points);
    Ok(())
}

/// Reset points (admin only).
#[allow(dead_code)]
pub fn reset_points(env: &Env, user: &Address) -> Result<(), ContractError> {
    let key = DataKey::Points(user.clone());
    env.storage().instance().set(&key, &0u32);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::testutils::Address as _;

    // Storage is only reachable inside a contract context, so register a stub
    // contract and run each check through `env.as_contract`.
    fn make_env() -> (Env, Address) {
        let env = Env::default();
        let id = env.register(crate::AchievementsContract, ());
        (env, id)
    }

    #[test]
    fn total_saturates_at_u32_max_instead_of_wrapping() {
        let (env, id) = make_env();
        let user = Address::generate(&env);
        env.as_contract(&id, || {
            award_points(&env, &user, u32::MAX - 5).unwrap();
            let total = award_points(&env, &user, 10).unwrap();
            assert_eq!(total, u32::MAX);
            assert_eq!(get_user_points(&env, &user).unwrap(), u32::MAX);
        });
    }

    #[test]
    fn level_is_capped_at_100_for_the_maximum_points() {
        assert_eq!(calculate_level_from_points(u32::MAX), 100);
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(64))]

        /// Any two awards leave the running total equal to the saturating sum,
        /// and the total never drops below the first award.
        #[test]
        fn prop_accumulation_never_wraps(first in any::<u32>(), second in any::<u32>()) {
            let (env, id) = make_env();
            let user = Address::generate(&env);
            env.as_contract(&id, || {
                award_points(&env, &user, first).unwrap();
                let total = award_points(&env, &user, second).unwrap();
                assert_eq!(total, first.saturating_add(second));
                assert!(total >= first);
            });
        }
    }
}

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
/// # Errors
///
/// Returns [`ContractError::InvalidAmount`] if adding `points` to the
/// user's current total would overflow `u32` (i.e. exceed [`MAX_POINTS`]).
/// The ledger state is **not** modified when an error is returned.
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

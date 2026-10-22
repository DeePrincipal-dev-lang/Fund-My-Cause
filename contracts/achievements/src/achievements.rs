/// Achievement management functions.
///
/// # Storage layout (v2)
///
/// Achievements are now stored as [`AchievementRecord`] (compact) rather than
/// the old [`AchievementNFT`] (fat).  Fields removed from storage:
///
/// * `user`   — already encoded in `DataKey::Achievement(user, type)`.
/// * `nft_id` — deterministically derivable from `(user, type)`; re-computed
///   at read time by `crate::generate_nft_id`.
///
/// Savings: **≈108 bytes per achievement entry** (44-byte Address + 64-byte
/// hex string).
///
/// # Backwards-compatibility
///
/// Any entry written by the v1 contract that is still alive on ledger stores
/// the full `AchievementNFT`.  [`read_achievement_entry`] tries to decode the
/// value as `AchievementRecord` first; if that fails it falls back to
/// `AchievementNFT` and strips the redundant fields.  This transparent
/// migration means no explicit migration transaction is needed.
use crate::errors::ContractError;
use crate::storage::DataKey;
use crate::types::{AchievementNFT, AchievementRecord};
use soroban_sdk::{Address, Env, Vec};

/// Read the stored entry for `(user, achievement_type)` and return it as an
/// `AchievementRecord`, regardless of whether it was written by v1 or v2 code.
///
/// * **v2 entry** — stored as `AchievementRecord`; returned directly.
/// * **v1 entry** — stored as `AchievementNFT`; the redundant `user` and
///   `nft_id` fields are stripped and a compact record is returned.
/// * **missing** — returns `None`.
fn read_achievement_entry(
    env: &Env,
    user: &Address,
    achievement_type: u32,
) -> Option<AchievementRecord> {
    let key = DataKey::Achievement(user.clone(), achievement_type);

    // Try the v2 compact record first.
    if let Some(record) = env.storage().instance().get::<_, AchievementRecord>(&key) {
        return Some(record);
    }

    // Fall back to the v1 fat struct (legacy deployed state).
    if let Some(nft) = env.storage().instance().get::<_, AchievementNFT>(&key) {
        return Some(AchievementRecord {
            achievement_type: nft.achievement_type,
            unlocked_at: nft.unlocked_at,
            metadata: nft.metadata,
        });
    }

    None
}

/// Reconstruct the public [`AchievementNFT`] from a compact record + key
/// components.  `nft_id` is re-derived via `crate::generate_nft_id` — it is
/// never stored on ledger in v2.
fn record_to_nft(env: &Env, user: &Address, record: AchievementRecord) -> AchievementNFT {
    AchievementNFT {
        nft_id: crate::generate_nft_id(env, user, record.achievement_type),
        user: user.clone(),
        achievement_type: record.achievement_type,
        unlocked_at: record.unlocked_at,
        metadata: record.metadata,
    }
}

/// Get all achievements for a user as the public `AchievementNFT` type.
pub fn get_user_achievements(
    env: &Env,
    user: &Address,
) -> Result<Vec<AchievementNFT>, ContractError> {
    let mut achievements = Vec::new(env);

    for achievement_type in 1..=13u32 {
        if let Some(record) = read_achievement_entry(env, user, achievement_type) {
            achievements.push_back(record_to_nft(env, user, record));
        }
    }

    Ok(achievements)
}

/// Check if user has a specific achievement (O(1) key presence check).
pub fn has_achievement(
    env: &Env,
    user: &Address,
    achievement_type: u32,
) -> Result<bool, ContractError> {
    let key = DataKey::Achievement(user.clone(), achievement_type);
    Ok(env.storage().instance().has(&key))
}

/// Get achievement unlock timestamp.
#[allow(dead_code)]
pub fn get_achievement_unlock_time(
    env: &Env,
    user: &Address,
    achievement_type: u32,
) -> Result<u64, ContractError> {
    read_achievement_entry(env, user, achievement_type)
        .map(|r| r.unlocked_at)
        .ok_or(ContractError::KeyNotFound)
}

/// Get all users with a specific achievement.
#[allow(dead_code)]
pub fn get_achievement_holders(
    env: &Env,
    _achievement_type: u32,
) -> Result<Vec<Address>, ContractError> {
    // Would need a reverse index — out of scope.  Return empty.
    Ok(Vec::new(env))
}

/// Count achievements for a user.
pub fn count_achievements(env: &Env, user: &Address) -> Result<u32, ContractError> {
    let achievements = get_user_achievements(env, user)?;
    Ok(achievements.len())
}

/// Store a compact [`AchievementRecord`] for `(user, achievement_type)`.
///
/// Called by `lib.rs::store_achievement`; replaces the old call that stored
/// the full `AchievementNFT`.
pub fn store_achievement_record(
    env: &Env,
    user: &Address,
    achievement_type: u32,
    unlocked_at: u64,
    metadata: soroban_sdk::String,
) -> Result<(), ContractError> {
    let key = DataKey::Achievement(user.clone(), achievement_type);
    let record = AchievementRecord {
        achievement_type,
        unlocked_at,
        metadata,
    };
    env.storage().instance().set(&key, &record);
    Ok(())
}

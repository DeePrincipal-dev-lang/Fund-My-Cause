//! # Fund-My-Cause Achievements Contract
//!
//! A Soroban smart contract for managing user achievements, NFT badges, and gamification
//! on the Fund My Cause platform.
//!
//! ## Overview
//!
//! The achievements contract tracks user progress and awards NFT badges for:
//! - Contribution milestones
//! - Social engagement
//! - Referral success
//! - Community support
//! - Campaign goals reached
//!
//! ## Features
//!
//! - **Achievement System** - 12+ unique achievements with tiers (common, uncommon, rare, epic, legendary)
//! - **NFT Badges** - Mint NFTs for achievement milestones
//! - **Points System** - Award points for activities (achievements, contributions, referrals)
//! - **Leaderboards** - Track top contributors, referrers, and achievement collectors
//! - **Contribution Streaks** - Reward consecutive daily contributions
//! - **Level System** - Progress from level 1-100 based on points
//! - **Referral Tracking** - Monitor referral success and rewards
//! - **Challenge Tracking** - Track participation in limited-time challenges
//! - **Audit Trail** - Complete history of achievement unlocks
//!
//! ## Achievement State Machine
//!
//! Each `(user, achievement_type)` pair has exactly two states:
//!
//! ```text
//!   [Locked] --unlock--> [Unlocked]
//! ```
//!
//! - **Locked**: no `DataKey::Achievement(user, achievement_type)` entry exists.
//!   `has_achievement` returns `false`.
//! - **Unlocked**: an `AchievementRecord` is stored under that key (points
//!   already awarded, leaderboard entry already posted, `unlocked` event
//!   already published). This is terminal — there is no further "claimed"
//!   state or reversal; `Unlocked` is permanent for the life of the contract.
//!
//! There is no separate "eligible" state stored on-chain: eligibility is
//! evaluated at call time, not persisted.
//!
//! **Transitions in are gated by achievement type:**
//!
//! - Types `{2, 5, 6, 8, 9, 10, 11, 12, 13}` ("self-declared") — transition
//!   Locked → Unlocked via [`AchievementsContract::unlock_achievement`],
//!   callable directly by the user. Eligibility for these is enforced
//!   off-chain (e.g. by the platform deciding when to let a user submit the
//!   call); the contract itself only checks the type is valid and not
//!   already unlocked.
//! - Types `{1, 3, 4, 7}` ("auto-tracked": First Contribution, Mega Donor,
//!   Consistent Contributor, Referral Champion) — transition Locked →
//!   Unlocked *only* via the internal `try_auto_unlock` helper, invoked from
//!   [`AchievementsContract::record_contribution`] /
//!   [`AchievementsContract::record_referral`] once the on-chain counters
//!   they read (`ContributionCount`, `ContributionTotal`, `ReferralCount`)
//!   cross the relevant threshold. `unlock_achievement` explicitly **rejects**
//!   these four types with `AchievementNotSelfUnlockable` — see the fix note
//!   below.
//!
//! **Illegal transitions rejected:**
//! - Unlocked → Unlocked (re-unlocking) → `AchievementAlreadyUnlocked`.
//! - Locked → Unlocked for an out-of-range type → `InvalidAchievementType`.
//! - Locked → Unlocked for an auto-tracked type via the manual entry point →
//!   `AchievementNotSelfUnlockable`.
//!
//! **Design/implementation mismatch found and fixed (#928):** prior to this
//! fix, `unlock_achievement` had no gate on achievement type beyond range
//! validation, so any user could call
//! `unlock_achievement(user, 1 /* First Contribution */, "")` — or type 3, 4,
//! 7 — immediately after initialization, without ever having contributed or
//! referred anyone, and be credited the full points/leaderboard/NFT for it.
//! That let the four auto-tracked achievements bypass the on-chain activity
//! they're supposed to certify. Fixed by rejecting those four types in
//! `unlock_achievement`.

#![no_std]
// The SDK deprecated `Events::publish` in favour of the `#[contractevent]` macro.
// Migrating changes how events are encoded on the wire, so it is a behaviour change
// for every off-chain consumer, not a lint cleanup, and is tracked separately.
#![allow(deprecated)]

mod achievements;
mod errors;
mod events;
mod leaderboard;
mod points;
mod storage;
mod types;
mod validation;

pub use achievements::{get_user_achievements, has_achievement};
pub use errors::ContractError;
pub use events::*;
pub use leaderboard::{add_leaderboard_entry, get_leaderboard};
pub use points::{award_points, get_user_level, get_user_points};
pub use storage::*;
pub use types::*;
pub use validation::*;

use common::{AccessControl, CommonError, EventEmitter, EVENT_SCHEMA_VERSION};
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec};

/// Main achievement contract
#[contract]
pub struct AchievementsContract;

// `env.events().publish(...)` is deprecated in favor of `#[contractevent]`
// typed events; migrating the event system is out of scope here (see the
// still-unused typed event structs in `events.rs`), so the existing
// tuple-based publish calls are kept and the deprecation warning suppressed.
#[allow(deprecated)]
#[contractimpl]
impl AchievementsContract {
    /// Initializes the achievements contract with admin and platform addresses.
    ///
    /// Must be called exactly once immediately after contract deployment.
    /// Subsequent calls return an error.
    ///
    /// # Parameters
    ///
    /// * `admin` — The address authorized to call admin-only functions like `award_user_points`.
    /// * `platform_address` — The platform address for event tracking and auditing.
    ///
    /// # Errors
    ///
    /// * [`ContractError::AlreadyInitialized`] (mapped from `CommonError::AlreadyInitialized`) if the contract has already been initialized.
    pub fn initialize(
        env: Env,
        admin: Address,
        platform_address: Address,
    ) -> Result<(), ContractError> {
        AccessControl::require_role_auth(&admin);

        if env.storage().instance().has(&storage::KEY_ADMIN) {
            return Err(CommonError::AlreadyInitialized.into());
        }

        env.storage().instance().set(&storage::KEY_ADMIN, &admin);
        env.storage()
            .instance()
            .set(&storage::KEY_PLATFORM, &platform_address);

        env.events().publish(
            ("achievements", "initialized"),
            EventInitialized {
                admin: admin.clone(),
                platform_address,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        Ok(())
    }

    /// Unlocks an achievement for a user and awards associated points.
    ///
    /// Stores the achievement NFT, awards points based on achievement type,
    /// updates the user's level, and adds an entry to the achievements leaderboard.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user unlocking the achievement. Must sign the transaction.
    /// * `achievement_type` — A u32 identifier for the achievement type (1-13). See error for invalid types.
    /// * `metadata` — Optional string metadata associated with the achievement unlock (e.g., campaign ID).
    ///
    /// # Return Value
    ///
    /// Returns the newly created [`AchievementNFT`] with populated fields including
    /// the derived `nft_id` (hash-based), user address, achievement type, unlock timestamp, and metadata.
    ///
    /// # Errors
    ///
    /// * [`ContractError::InvalidAchievementType`] if `achievement_type` is not in the range 1-13.
    /// * [`ContractError::AchievementAlreadyUnlocked`] if the user has already unlocked this achievement type.
    pub fn unlock_achievement(
        env: Env,
        user: Address,
        achievement_type: u32,
        metadata: String,
    ) -> Result<AchievementNFT, ContractError> {
        user.require_auth();

        validate_achievement_type(achievement_type)?;

        if is_auto_only_achievement(achievement_type) {
            return Err(ContractError::AchievementNotSelfUnlockable);
        }

        if has_achievement(&env, &user, achievement_type)? {
            return Err(ContractError::AchievementAlreadyUnlocked);
        }

        do_unlock(&env, &user, achievement_type, metadata)
    }

    /// Retrieves all achievements unlocked by a user.
    ///
    /// Reconstructs the full [`AchievementNFT`] entries for each achievement
    /// the user has unlocked, deriving the `nft_id` from the stored achievement data.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user whose achievements to retrieve.
    ///
    /// # Return Value
    ///
    /// Returns a vector of [`AchievementNFT`] structs, one per unlocked achievement.
    /// Empty vector if the user has not unlocked any achievements.
    ///
    /// # Errors
    ///
    /// May return an error if internal storage operations fail (unlikely in normal operation).
    pub fn get_achievements(env: Env, user: Address) -> Result<Vec<AchievementNFT>, ContractError> {
        get_user_achievements(&env, &user)
    }

    /// Retrieves the top leaderboard entries for a given leaderboard type.
    ///
    /// Leaderboard type 0 = Points, 1 = Achievements, 2 = Referrals.
    /// Entries are returned in descending order by score.
    ///
    /// # Parameters
    ///
    /// * `leaderboard_type` — The u32 type identifier: 0 (Points), 1 (Achievements), or 2 (Referrals).
    /// * `limit` — Maximum number of top entries to return (as u32).
    ///
    /// # Return Value
    ///
    /// Returns a vector of [`LeaderboardEntry`] structs, sorted by score descending,
    /// with at most `limit` entries.
    ///
    /// # Errors
    ///
    /// * [`ContractError::InvalidLeaderboardType`] if `leaderboard_type` is not 0, 1, or 2.
    pub fn get_leaderboard_entries(
        env: Env,
        leaderboard_type: u32,
        limit: u32,
    ) -> Result<Vec<LeaderboardEntry>, ContractError> {
        get_leaderboard(
            &env,
            validate_leaderboard_type(leaderboard_type)?,
            limit as usize,
        )
    }

    /// Retrieves a user's rank on a specific leaderboard (1-based ranking).
    ///
    /// Leaderboard type 0 = Points, 1 = Achievements, 2 = Referrals.
    /// Rank 1 is the highest score, rank 2 is second-highest, etc.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user whose rank to retrieve.
    /// * `leaderboard_type` — The u32 type identifier: 0 (Points), 1 (Achievements), or 2 (Referrals).
    ///
    /// # Return Value
    ///
    /// Returns the user's 1-based rank (u32) on the specified leaderboard.
    ///
    /// # Errors
    ///
    /// * [`ContractError::InvalidLeaderboardType`] if `leaderboard_type` is not 0, 1, or 2.
    /// * [`ContractError::UserNotFound`] if the user has no entry on that leaderboard.
    pub fn get_rank(env: Env, user: Address, leaderboard_type: u32) -> Result<u32, ContractError> {
        leaderboard::get_user_rank(&env, &user, validate_leaderboard_type(leaderboard_type)?)
    }

    /// Retrieves the total accumulated points for a user.
    ///
    /// Points are earned through achievement unlocks, contributions, referrals, and streaks.
    /// Used to calculate the user's level (level = points / 100 + 1, capped at 100).
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user whose points to retrieve.
    ///
    /// # Return Value
    ///
    /// Returns the user's total accumulated points as a u32.
    /// Returns 0 if the user has no points record.
    ///
    /// # Errors
    ///
    /// May return an error if internal storage operations fail (unlikely in normal operation).
    pub fn get_points(env: Env, user: Address) -> Result<u32, ContractError> {
        get_user_points(&env, &user)
    }

    /// Retrieves the user's current level based on accumulated points.
    ///
    /// Level is calculated from points as: `level = min((points / 100) + 1, 100)`.
    /// The level is derived dynamically from points on every read; no separate
    /// Level storage entry is maintained after #920.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user whose level to retrieve.
    ///
    /// # Return Value
    ///
    /// Returns the user's level as a u32 in the range 1-100.
    /// Returns 1 if the user has no points record.
    ///
    /// # Errors
    ///
    /// May return an error if internal storage operations fail (unlikely in normal operation).
    pub fn get_level(env: Env, user: Address) -> Result<u32, ContractError> {
        get_user_level(&env, &user)
    }

    /// Awards points to a user. Admin-only operation.
    ///
    /// Adds the specified points to the user's total, updates their level accordingly,
    /// and publishes a "points_awarded" event.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user to award points to.
    /// * `points` — The number of points to award (u32).
    ///
    /// # Return Value
    ///
    /// Returns the user's new total points after the award.
    ///
    /// # Errors
    ///
    /// * [`ContractError::Unauthorized`] if the caller is not the admin address set during initialization.
    pub fn award_user_points(env: Env, user: Address, points: u32) -> Result<u32, ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&storage::KEY_ADMIN)
            .ok_or(ContractError::Unauthorized)?;
        AccessControl::require_role_auth(&admin);

        let total_points = award_points(&env, &user, points)?;
        update_level(total_points);

        env.events().publish(
            ("achievements", "points_awarded"),
            EventPointsAwarded {
                user: user.clone(),
                points,
                total_points,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );
        EventEmitter::achievement_points_awarded(&env, user, points, total_points);

        Ok(total_points)
    }

    /// Records a user contribution and evaluates contribution-based achievements.
    ///
    /// Stores the contribution, awards points based on amount, updates level,
    /// and automatically unlocks achievements like "First Contribution",
    /// "Consistent Contributor", and "Mega Donor" when milestones are reached.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user making the contribution. Must sign the transaction.
    /// * `campaign_id` — A string identifier for the campaign receiving the contribution.
    /// * `amount` — The contribution amount in stroops (i128). Must be positive.
    ///   Points awarded = `(amount / 1,000,000).clamp(1, 1000)`.
    ///
    /// # Return Value
    ///
    /// Returns `Ok(())` on success.
    ///
    /// # Errors
    ///
    /// * [`ContractError::InvalidAmount`] if `amount` is not positive.
    pub fn record_contribution(
        env: Env,
        user: Address,
        campaign_id: String,
        amount: i128,
    ) -> Result<(), ContractError> {
        user.require_auth();

        validate_amount(amount)?;

        store_contribution(&env, &user, &campaign_id, amount)?;
        let (new_count, new_total) = increment_contribution_stats(&env, &user, amount)?;

        let points = calculate_contribution_points(amount);
        let total_points = award_points(&env, &user, points)?;
        update_level(total_points);

        check_contribution_achievements(&env, &user, new_count, new_total)?;

        env.events().publish(
            ("achievements", "contribution_recorded"),
            EventContributionRecorded {
                user,
                campaign_id,
                amount,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        Ok(())
    }

    /// Records a successful referral and evaluates referral-based achievements.
    ///
    /// Stores the referral relationship, awards fixed points (50) to the referrer,
    /// updates their level, and automatically unlocks "Referral Champion" achievement
    /// once the referrer reaches 3 successful referrals.
    ///
    /// # Parameters
    ///
    /// * `referrer` — The address of the user who made the referral. Must sign the transaction.
    /// * `referee` — The address of the user being referred.
    ///
    /// # Return Value
    ///
    /// Returns `Ok(())` on success.
    ///
    /// # Errors
    ///
    /// May return an error if internal storage operations fail (unlikely in normal operation).
    pub fn record_referral(
        env: Env,
        referrer: Address,
        referee: Address,
    ) -> Result<(), ContractError> {
        referrer.require_auth();

        const REFERRAL_POINTS: u32 = 50;

        store_referral(&env, &referrer, &referee)?;
        let new_count = increment_referral_count(&env, &referrer)?;

        let total_points = award_points(&env, &referrer, REFERRAL_POINTS)?;
        update_level(total_points);

        check_referral_achievements(&env, &referrer, new_count)?;

        env.events().publish(
            ("achievements", "referral_recorded"),
            EventReferralRecorded {
                referrer,
                referee,
                points_earned: REFERRAL_POINTS,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        Ok(())
    }

    /// Updates the user's contribution streak counter.
    ///
    /// If this is the first contribution tracked or the last contribution was
    /// more than 1 day ago, resets the streak to 1. If the last contribution
    /// was within 1 day, increments the current streak. Every 7-day milestone
    /// awards a 100-point bonus.
    ///
    /// # Parameters
    ///
    /// * `user` — The address of the user whose streak to update. Must sign the transaction.
    ///
    /// # Return Value
    ///
    /// Returns the user's new streak count (u32).
    ///
    /// # Errors
    ///
    /// May return an error if internal storage operations fail (unlikely in normal operation).
    pub fn update_streak(env: Env, user: Address) -> Result<u32, ContractError> {
        user.require_auth();

        let current_time = env.ledger().timestamp();
        let last_contribution_key = DataKey::LastContribution(user.clone());
        let streak_key = DataKey::Streak(user.clone());

        let last_contribution: Option<u64> = env.storage().instance().get(&last_contribution_key);
        let current_streak: u32 = env.storage().instance().get(&streak_key).unwrap_or(0);

        let new_streak = if let Some(last_time) = last_contribution {
            let days_since = (current_time - last_time) / 86400;
            if days_since <= 1 {
                current_streak + 1
            } else {
                1
            }
        } else {
            1
        };

        env.storage()
            .instance()
            .set(&last_contribution_key, &current_time);
        env.storage().instance().set(&streak_key, &new_streak);

        if new_streak > 0 && new_streak % 7 == 0 {
            let total_points = award_points(&env, &user, 100)?; // Bonus for 7-day streak
            update_level(total_points);
        }

        env.events().publish(
            ("achievements", "streak_updated"),
            EventStreakUpdated {
                user,
                new_streak,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );

        Ok(new_streak)
    }
}

// ── Helper Functions ────────────────────────────────────────────────────────

/// Achievement type thresholds for the two auto-unlock checks below. Names
/// match the `get_achievement_points` table.
const FIRST_CONTRIBUTION_TYPE: u32 = 1;
const CONSISTENT_CONTRIBUTOR_TYPE: u32 = 4;
const CONSISTENT_CONTRIBUTOR_COUNT: u32 = 5;
const MEGA_DONOR_TYPE: u32 = 3;
const MEGA_DONOR_TOTAL: i128 = 1_000_000_000;
const REFERRAL_CHAMPION_TYPE: u32 = 7;
const REFERRAL_CHAMPION_COUNT: u32 = 3;

/// Achievement types that may only be unlocked by [`try_auto_unlock`] once
/// their on-chain activity threshold is crossed — never directly via
/// [`AchievementsContract::unlock_achievement`]. See the state-machine
/// doc-comment at the top of this file.
fn is_auto_only_achievement(achievement_type: u32) -> bool {
    matches!(
        achievement_type,
        FIRST_CONTRIBUTION_TYPE
            | MEGA_DONOR_TYPE
            | CONSISTENT_CONTRIBUTOR_TYPE
            | REFERRAL_CHAMPION_TYPE
    )
}

/// Perform the shared "unlock" side effects: store the NFT, award points,
/// refresh the user's level, push a leaderboard entry, and publish an event.
/// Callers are responsible for checking `has_achievement` first.
#[allow(deprecated)]
fn do_unlock(
    env: &Env,
    user: &Address,
    achievement_type: u32,
    metadata: String,
) -> Result<AchievementNFT, ContractError> {
    let unlocked_at = env.ledger().timestamp();

    // Store compact record (v2) — no `user` or `nft_id` on ledger.
    store_achievement(env, user, achievement_type, unlocked_at, metadata.clone())?;

    let points = get_achievement_points(achievement_type);
    let total_points = award_points(env, user, points)?;
    // update_level is a pure derivation from the points total we already have
    // in hand — no separate Points re-read, no Level write.
    let new_level = update_level(total_points);

    add_leaderboard_entry(env, user, points, LeaderboardType::Achievements)?;

    env.events().publish(
        ("achievements", "unlocked"),
        EventUnlocked {
            user: user.clone(),
            achievement_type,
            points_earned: points,
            new_level,
            schema_version: EVENT_SCHEMA_VERSION,
        },
    );
    // Also emit via the shared cross-contract event schema (contracts/common)
    // so services/indexer can parse achievement events the same way it
    // parses crowdfund/registry/qf events.
    EventEmitter::achievement_unlocked(env, user.clone(), achievement_type, points);

    // Reconstruct full public NFT (nft_id derived, not read from ledger).
    let nft = AchievementNFT {
        user: user.clone(),
        achievement_type,
        unlocked_at,
        metadata,
        nft_id: generate_nft_id(env, user, achievement_type),
    };
    Ok(nft)
}

/// Unlock `achievement_type` for `user` if not already unlocked; a no-op
/// otherwise. Used by the automatic contribution/referral achievement checks,
/// which must never fail or double-award just because a milestone was
/// already reached.
fn try_auto_unlock(env: &Env, user: &Address, achievement_type: u32) -> Result<(), ContractError> {
    if has_achievement(env, user, achievement_type)? {
        return Ok(());
    }
    do_unlock(env, user, achievement_type, String::from_str(env, ""))?;
    Ok(())
}

/// Derives a level from an already-known points total (e.g. just returned by
/// [`award_points`]) — no storage read, since the caller already has the
/// current total in hand.
fn update_level(points: u32) -> u32 {
    points::calculate_level_from_points(points)
}

/// Generate a unique NFT id by hashing the user's address and achievement
/// type, hex-encoded. Purely informational metadata — achievements are
/// looked up by `(user, achievement_type)`, not by this id.
fn generate_nft_id(env: &Env, user: &Address, achievement_type: u32) -> String {
    let mut data: Bytes = user.to_string().to_bytes();
    data.extend_from_array(&achievement_type.to_be_bytes());

    let hash = env.crypto().keccak256(&data);
    let raw: [u8; 32] = hash.into();

    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut hex_buf = [0u8; 64];
    for (i, byte) in raw.iter().enumerate() {
        hex_buf[i * 2] = HEX[(byte >> 4) as usize];
        hex_buf[i * 2 + 1] = HEX[(byte & 0x0f) as usize];
    }

    let hex_str = core::str::from_utf8(&hex_buf)
        .unwrap_or("0000000000000000000000000000000000000000000000000000000000000000");
    String::from_str(env, hex_str)
}

/// Store achievement as a compact [`AchievementRecord`] (v2 layout).
fn store_achievement(
    env: &Env,
    user: &Address,
    achievement_type: u32,
    unlocked_at: u64,
    metadata: String,
) -> Result<(), ContractError> {
    achievements::store_achievement_record(env, user, achievement_type, unlocked_at, metadata)
}

/// Get achievement points based on type
fn get_achievement_points(achievement_type: u32) -> u32 {
    match achievement_type {
        1 => 50,   // First Contribution
        2 => 150,  // Super Supporter
        3 => 300,  // Mega Donor
        4 => 200,  // Consistent Contributor
        5 => 100,  // Social Butterfly
        6 => 250,  // Viral Sharer
        7 => 400,  // Referral Champion
        8 => 100,  // Campaign Completionist
        9 => 200,  // Milestone Hunter
        10 => 350, // Community Supporter
        11 => 75,  // Early Bird
        12 => 500, // Goal Crusher
        13 => 600, // Trending Backer
        _ => 50,
    }
}

/// Calculate contribution points
fn calculate_contribution_points(amount: i128) -> u32 {
    // 1 point per stroop (0.0000001 XLM)
    ((amount / 1_000_000) as u32).clamp(1, 1000)
}

/// Store contribution record
fn store_contribution(
    env: &Env,
    user: &Address,
    campaign_id: &String,
    amount: i128,
) -> Result<(), ContractError> {
    let key = DataKey::Contribution(user.clone(), campaign_id.clone());
    env.storage().instance().set(&key, &amount);
    Ok(())
}

/// Increment the aggregate contribution count/total, returning the new
/// `(count, total)` so [`check_contribution_achievements`] can use them
/// directly instead of re-reading `DataKey::ContributionCount`/`ContributionTotal`
/// right after this just wrote them.
fn increment_contribution_stats(
    env: &Env,
    user: &Address,
    amount: i128,
) -> Result<(u32, i128), ContractError> {
    let count_key = DataKey::ContributionCount(user.clone());
    let count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
    let new_count = count.saturating_add(1);
    env.storage().instance().set(&count_key, &new_count);

    let total_key = DataKey::ContributionTotal(user.clone());
    let total: i128 = env.storage().instance().get(&total_key).unwrap_or(0);
    let new_total = total.saturating_add(amount);
    env.storage().instance().set(&total_key, &new_total);

    Ok((new_count, new_total))
}

/// Store referral record
fn store_referral(env: &Env, referrer: &Address, referee: &Address) -> Result<(), ContractError> {
    let key = DataKey::Referral(referrer.clone(), referee.clone());
    let timestamp = env.ledger().timestamp();
    env.storage().instance().set(&key, &timestamp);
    Ok(())
}

/// Increment the referral count, returning the new count so
/// [`check_referral_achievements`] can use it directly instead of re-reading
/// `DataKey::ReferralCount` right after this just wrote it.
fn increment_referral_count(env: &Env, referrer: &Address) -> Result<u32, ContractError> {
    let key = DataKey::ReferralCount(referrer.clone());
    let count: u32 = env.storage().instance().get(&key).unwrap_or(0);
    let new_count = count.saturating_add(1);
    env.storage().instance().set(&key, &new_count);
    Ok(new_count)
}

/// Check for contribution-based achievements: unlocks "First Contribution" on
/// the first recorded contribution, "Consistent Contributor" once the user
/// has contributed `CONSISTENT_CONTRIBUTOR_COUNT` times, and "Mega Donor"
/// once their cumulative contribution total reaches `MEGA_DONOR_TOTAL`.
fn check_contribution_achievements(
    env: &Env,
    user: &Address,
    count: u32,
    total: i128,
) -> Result<(), ContractError> {
    if count >= 1 {
        try_auto_unlock(env, user, FIRST_CONTRIBUTION_TYPE)?;
    }
    if count >= CONSISTENT_CONTRIBUTOR_COUNT {
        try_auto_unlock(env, user, CONSISTENT_CONTRIBUTOR_TYPE)?;
    }
    if total >= MEGA_DONOR_TOTAL {
        try_auto_unlock(env, user, MEGA_DONOR_TYPE)?;
    }

    Ok(())
}

/// Check for referral-based achievements: unlocks "Referral Champion" once
/// the referrer has `REFERRAL_CHAMPION_COUNT` successful referrals.
fn check_referral_achievements(
    env: &Env,
    referrer: &Address,
    count: u32,
) -> Result<(), ContractError> {
    if count >= REFERRAL_CHAMPION_COUNT {
        try_auto_unlock(env, referrer, REFERRAL_CHAMPION_TYPE)?;
    }

    Ok(())
}

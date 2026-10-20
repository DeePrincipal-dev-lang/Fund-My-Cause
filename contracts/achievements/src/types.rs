/// Type definitions for the achievements contract
use soroban_sdk::{contracttype, Address, String};

// ── Stored type (v2 compact) ─────────────────────────────────────────────────

/// **v2 compact storage record** for a single unlocked achievement.
///
/// Stored under `DataKey::Achievement(user, achievement_type)`.
///
/// Fields present in the old `AchievementNFT` that are **not** stored here:
///
/// * `user` — already encoded in the storage key; re-attached at read time.
/// * `nft_id` — a 64-byte hex string deterministically derivable from
///   `(user, achievement_type)` via `generate_nft_id`; re-computed at read time.
///
/// This saves roughly **44 + 64 = ~108 bytes per achievement entry** on the
/// ledger while preserving the full public `AchievementNFT` API surface.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct AchievementRecord {
    /// Achievement type (1-13, mirrors the key but kept for self-description).
    pub achievement_type: u32,
    /// Timestamp when achievement was unlocked (Unix timestamp).
    pub unlocked_at: u64,
    /// Additional metadata about the achievement.
    pub metadata: String,
}

// ── Public / returned types ───────────────────────────────────────────────────

/// Achievement NFT structure — the **public return type** for achievement
/// queries.  Constructed on-the-fly from an [`AchievementRecord`] plus the
/// key components (`user`, `achievement_type`) that are available at call sites.
///
/// This type is **not stored on the ledger in v2**.  Any v1 entries that used
/// to store the full struct are transparently handled by the legacy-read path
/// in `achievements::read_achievement_entry`.
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct AchievementNFT {
    /// User address who earned the achievement
    pub user: Address,
    /// Achievement type (1-13, representing different achievements)
    pub achievement_type: u32,
    /// Timestamp when achievement was unlocked (Unix timestamp)
    pub unlocked_at: u64,
    /// Additional metadata about the achievement
    pub metadata: String,
    /// Unique NFT identifier (derived from (user, achievement_type) at read time)
    pub nft_id: String,
}

/// Leaderboard entry
#[derive(Clone, Debug)]
#[contracttype]
pub struct LeaderboardEntry {
    /// User address
    pub user: Address,
    /// Current rank
    pub rank: u32,
    /// Total points/score
    pub score: u32,
    /// Achievement count
    pub achievements: u32,
    /// User level
    pub level: u32,
    /// Timestamp of last update
    pub updated_at: u64,
}

/// Leaderboard type enumeration
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum LeaderboardType {
    /// Points-based leaderboard
    Points = 1,
    /// Contributions-based leaderboard
    Contributions = 2,
    /// Achievements-based leaderboard
    Achievements = 3,
    /// Referrals-based leaderboard
    Referrals = 4,
}

/// User gamification profile
#[derive(Clone, Debug)]
#[contracttype]
pub struct UserProfile {
    /// User address
    pub user: Address,
    /// Total points earned
    pub total_points: u32,
    /// Current level (1-100)
    pub level: u32,
    /// Number of achievements unlocked
    pub achievements_count: u32,
    /// Current contribution streak (days)
    pub streak: u32,
    /// Total contributions made
    pub contribution_count: u32,
    /// Total referrals successful
    pub referral_count: u32,
    /// Last contribution timestamp
    pub last_contribution_at: u64,
    /// Profile created timestamp
    pub created_at: u64,
}

/// Achievement definition
#[derive(Clone, Debug)]
#[contracttype]
pub struct AchievementDefinition {
    /// Achievement type ID (1-13)
    pub id: u32,
    /// Achievement name
    pub name: String,
    /// Achievement description
    pub description: String,
    /// Points awarded when unlocked
    pub points: u32,
    /// Tier level (1-5: common, uncommon, rare, epic, legendary)
    pub tier: u32,
    /// Icon or emoji
    pub icon: String,
    /// Whether it can be minted as NFT
    pub is_nft: bool,
}

/// Contribution record
#[derive(Clone, Debug)]
#[contracttype]
pub struct ContributionRecord {
    /// User address
    pub user: Address,
    /// Campaign ID
    pub campaign_id: String,
    /// Contribution amount in stroops
    pub amount: i128,
    /// Timestamp of contribution
    pub timestamp: u64,
}

/// Referral record
#[derive(Clone, Debug)]
#[contracttype]
pub struct ReferralRecord {
    /// Referrer address
    pub referrer: Address,
    /// Referee address
    pub referee: Address,
    /// Timestamp when referral was recorded
    pub timestamp: u64,
    /// Whether the referee made a contribution
    pub referee_contributed: bool,
    /// Reward amount earned
    pub reward: i128,
}

/// Challenge entry
#[derive(Clone, Debug)]
#[contracttype]
pub struct Challenge {
    /// Challenge ID
    pub id: String,
    /// Challenge name
    pub name: String,
    /// Start timestamp
    pub start_at: u64,
    /// End timestamp
    pub end_at: u64,
    /// Target goal
    pub target: i128,
    /// Reward pool
    pub reward_pool: i128,
    /// Current progress
    pub current_progress: i128,
    /// Number of participants
    pub participants: u32,
}

/// Challenge participation record
#[derive(Clone, Debug)]
#[contracttype]
pub struct ChallengeEntry {
    /// Challenge ID
    pub challenge_id: String,
    /// User address
    pub user: Address,
    /// User's contribution to challenge
    pub contribution: i128,
    /// Rank in challenge
    pub rank: u32,
    /// Reward earned
    pub reward: i128,
}

/// Rarity tier enumeration
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum RarityTier {
    /// Common (tier 1) - 50 points
    Common = 1,
    /// Uncommon (tier 2) - 100 points
    Uncommon = 2,
    /// Rare (tier 3) - 200 points
    Rare = 3,
    /// Epic (tier 4) - 400 points
    Epic = 4,
    /// Legendary (tier 5) - 600+ points
    Legendary = 5,
}

/// Activity type for tracking
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum ActivityType {
    /// Achievement unlocked
    AchievementUnlocked = 1,
    /// Contribution made
    ContributionMade = 2,
    /// Referral successful
    ReferralSuccessful = 3,
    /// Level up
    LevelUp = 4,
    /// Streak milestone reached
    StreakMilestone = 5,
    /// Challenge completed
    ChallengeCompleted = 6,
}

/// Activity log entry
#[derive(Clone, Debug)]
#[contracttype]
pub struct ActivityLog {
    /// Activity type
    pub activity_type: u32,
    /// User address
    pub user: Address,
    /// Activity description
    pub description: String,
    /// Points awarded
    pub points_awarded: u32,
    /// Timestamp
    pub timestamp: u64,
}

//! Shared base error variants for Fund-My-Cause Soroban contracts.

use soroban_sdk::contracterror;

/// Base error variants shared by every Fund-My-Cause contract.
///
/// Each contract keeps its own `#[contracterror] ContractError` (so its
/// domain-specific variants and existing on-chain discriminants stay
/// undisturbed) and implements `From<CommonError> for ContractError` to fold
/// these shared cases into its own error space. See the crate README for the
/// rationale.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    /// Caller is not authorized to perform this operation.
    Unauthorized = 1,
    /// Requested item was not found.
    NotFound = 2,
    /// Provided input failed validation.
    InvalidInput = 3,
    /// Contract or resource has already been initialized.
    AlreadyInitialized = 4,
    /// Resource already exists.
    AlreadyExists = 5,
    /// Contract has not been initialised yet; required storage key is absent.
    NotInitialized = 6,
    /// Operation blocked because the contract is paused.
    Paused = 7,
    /// Arithmetic overflow detected.
    Overflow = 8,
}

/// Error codes for the achievements contract.
///
/// The definition lives here so the achievements contract and `common` share a
/// single source of truth for its on-chain discriminants. `achievements` simply
/// re-exports this enum as `ContractError`; the numeric values are part of the
/// contract ABI and must not change.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AchievementsError {
    /// Contract is already initialized
    AlreadyInitialized = 1,
    /// Unauthorized access
    Unauthorized = 2,
    /// Achievement type is invalid
    InvalidAchievementType = 3,
    /// User not found
    UserNotFound = 4,
    /// Achievement already unlocked
    AchievementAlreadyUnlocked = 5,
    /// Invalid amount provided
    InvalidAmount = 6,
    /// Leaderboard type is invalid
    InvalidLeaderboardType = 7,
    /// Challenge not found
    ChallengeNotFound = 8,
    /// Challenge not active
    ChallengeNotActive = 9,
    /// User already joined challenge
    AlreadyJoinedChallenge = 10,
    /// Insufficient points
    InsufficientPoints = 11,
    /// Storage key not found
    KeyNotFound = 12,
    /// Invalid metadata
    InvalidMetadata = 13,
    /// Referral not found
    ReferralNotFound = 14,
    /// Contribution record not found
    ContributionNotFound = 15,
    /// Streak update failed
    StreakUpdateFailed = 16,
    /// Achievement type is auto-unlocked by on-chain activity tracking and
    /// cannot be claimed directly through `unlock_achievement`.
    AchievementNotSelfUnlockable = 17,
}

impl From<CommonError> for AchievementsError {
    /// Folds the shared [`CommonError`] variants into the achievements error
    /// space. Only `Unauthorized` and `AlreadyInitialized` have a faithful
    /// equivalent; the rest map to the closest domain-specific variant.
    fn from(err: CommonError) -> Self {
        match err {
            CommonError::Unauthorized => AchievementsError::Unauthorized,
            CommonError::AlreadyInitialized => AchievementsError::AlreadyInitialized,
            CommonError::NotFound => AchievementsError::KeyNotFound,
            CommonError::InvalidInput => AchievementsError::InvalidMetadata,
            CommonError::AlreadyExists => AchievementsError::AchievementAlreadyUnlocked,
            // "Not initialised" has no dedicated variant here; the closest
            // generic is `KeyNotFound` (a required storage key is absent).
            CommonError::NotInitialized => AchievementsError::KeyNotFound,
            CommonError::Paused => AchievementsError::ChallengeNotActive,
            CommonError::Overflow => AchievementsError::InvalidAmount,
        }
    }
}

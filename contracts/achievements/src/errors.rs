/// Error types for the achievements contract
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum ContractError {
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

impl From<common::CommonError> for ContractError {
    /// Folds the shared [`common::CommonError`] variants into this
    /// contract's own error space. Only `Unauthorized` and
    /// `AlreadyInitialized` have a faithful equivalent here; the rest have
    /// no single accurate match against this contract's more specific
    /// variants (e.g. `UserNotFound`/`ChallengeNotFound`/... rather than one
    /// generic `NotFound`) and are mapped to the closest existing variant.
    fn from(err: common::CommonError) -> Self {
        match err {
            common::CommonError::Unauthorized => ContractError::Unauthorized,
            common::CommonError::AlreadyInitialized => ContractError::AlreadyInitialized,
            common::CommonError::NotFound => ContractError::KeyNotFound,
            common::CommonError::InvalidInput => ContractError::InvalidMetadata,
            common::CommonError::AlreadyExists => ContractError::AchievementAlreadyUnlocked,
            common::CommonError::NotInitialized => ContractError::KeyNotFound,
            // "Not initialised" has no dedicated variant here; the closest
            // generic is `KeyNotFound` (a required storage key is absent).
            common::CommonError::NotInitialized => ContractError::KeyNotFound,
            common::CommonError::Paused => ContractError::ChallengeNotActive,
            common::CommonError::Overflow => ContractError::InvalidAmount,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ContractError;
    use common::CommonError;

    /// On-chain error codes are part of the contract interface and must not
    /// change when the shared error definitions are consolidated (#1482).
    #[test]
    fn error_codes_are_pinned() {
        assert_eq!(ContractError::AlreadyInitialized as u32, 1);
        assert_eq!(ContractError::Unauthorized as u32, 2);
        assert_eq!(ContractError::InvalidAchievementType as u32, 3);
        assert_eq!(ContractError::UserNotFound as u32, 4);
        assert_eq!(ContractError::AchievementAlreadyUnlocked as u32, 5);
        assert_eq!(ContractError::InvalidAmount as u32, 6);
        assert_eq!(ContractError::InvalidLeaderboardType as u32, 7);
        assert_eq!(ContractError::ChallengeNotFound as u32, 8);
        assert_eq!(ContractError::ChallengeNotActive as u32, 9);
        assert_eq!(ContractError::AlreadyJoinedChallenge as u32, 10);
        assert_eq!(ContractError::InsufficientPoints as u32, 11);
        assert_eq!(ContractError::KeyNotFound as u32, 12);
        assert_eq!(ContractError::InvalidMetadata as u32, 13);
        assert_eq!(ContractError::ReferralNotFound as u32, 14);
        assert_eq!(ContractError::ContributionNotFound as u32, 15);
        assert_eq!(ContractError::StreakUpdateFailed as u32, 16);
        assert_eq!(ContractError::AchievementNotSelfUnlockable as u32, 17);
    }

    /// Every shared `CommonError` variant folds into the expected local variant.
    #[test]
    fn common_errors_map_to_expected_variants() {
        assert_eq!(
            ContractError::from(CommonError::Unauthorized),
            ContractError::Unauthorized
        );
        assert_eq!(
            ContractError::from(CommonError::AlreadyInitialized),
            ContractError::AlreadyInitialized
        );
        assert_eq!(
            ContractError::from(CommonError::NotFound),
            ContractError::KeyNotFound
        );
        assert_eq!(
            ContractError::from(CommonError::InvalidInput),
            ContractError::InvalidMetadata
        );
        assert_eq!(
            ContractError::from(CommonError::AlreadyExists),
            ContractError::AchievementAlreadyUnlocked
        );
        assert_eq!(
            ContractError::from(CommonError::NotInitialized),
            ContractError::KeyNotFound
        );
        assert_eq!(
            ContractError::from(CommonError::Paused),
            ContractError::ChallengeNotActive
        );
        assert_eq!(
            ContractError::from(CommonError::Overflow),
            ContractError::InvalidAmount
        );
    }
}

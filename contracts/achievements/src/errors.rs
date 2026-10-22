/// Error types for the achievements contract.
///
/// The enum definition lives in `common::error` so the achievements contract
/// and `common` share a single source of truth for its on-chain discriminants.
/// Re-exporting it as `ContractError` keeps existing call sites and numeric
/// codes unchanged.
pub use common::AchievementsError as ContractError;

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

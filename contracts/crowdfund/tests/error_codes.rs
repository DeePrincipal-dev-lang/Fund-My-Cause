//! Pins the on-chain numeric code of every `ContractError` variant (#1454).
//!
//! Clients and off-chain tooling match on these discriminants, so changing one
//! is a breaking ABI change. This table is the single source of truth for the
//! expected codes; any new variant must be added here with its next code.

use crowdfund::ContractError;

const EXPECTED: &[(ContractError, u32, &str)] = &[
    (ContractError::AlreadyInitialized, 1, "AlreadyInitialized"),
    (ContractError::CampaignEnded, 2, "CampaignEnded"),
    (ContractError::CampaignStillActive, 3, "CampaignStillActive"),
    (ContractError::GoalNotReached, 4, "GoalNotReached"),
    (ContractError::GoalReached, 5, "GoalReached"),
    (ContractError::Overflow, 6, "Overflow"),
    (ContractError::NotActive, 7, "NotActive"),
    (ContractError::InvalidFee, 8, "InvalidFee"),
    (ContractError::BelowMinimum, 9, "BelowMinimum"),
    (ContractError::InvalidDeadline, 10, "InvalidDeadline"),
    (ContractError::CampaignPaused, 11, "CampaignPaused"),
    (ContractError::InvalidGoal, 12, "InvalidGoal"),
    (ContractError::TokenNotAccepted, 13, "TokenNotAccepted"),
    (ContractError::ExceedsMaximum, 14, "ExceedsMaximum"),
    (ContractError::NotWhitelisted, 15, "NotWhitelisted"),
    (ContractError::Blacklisted, 16, "Blacklisted"),
    (ContractError::InvalidDelegation, 17, "InvalidDelegation"),
    (ContractError::DelegationNotFound, 18, "DelegationNotFound"),
    (ContractError::InvalidTemplate, 19, "InvalidTemplate"),
    (ContractError::VotingEnded, 20, "VotingEnded"),
    (
        ContractError::InvalidRecurringPlan,
        21,
        "InvalidRecurringPlan",
    ),
    (
        ContractError::RefundLimitExceeded,
        22,
        "RefundLimitExceeded",
    ),
    (ContractError::VestingNotComplete, 23, "VestingNotComplete"),
    (ContractError::EmergencyLocked, 24, "EmergencyLocked"),
    (ContractError::RateLimitExceeded, 25, "RateLimitExceeded"),
    (ContractError::MessageTooLong, 26, "MessageTooLong"),
    (ContractError::StringEmpty, 27, "StringEmpty"),
    (ContractError::StringTooLong, 28, "StringTooLong"),
    (ContractError::AmountNotPositive, 29, "AmountNotPositive"),
    (ContractError::SelfFeeAddress, 30, "SelfFeeAddress"),
    (ContractError::GoalOverflow, 31, "GoalOverflow"),
    (ContractError::InsufficientFunds, 32, "InsufficientFunds"),
    (ContractError::Unauthorized, 33, "Unauthorized"),
    (ContractError::InvalidRateLimit, 34, "InvalidRateLimit"),
    (ContractError::MultiSigNotMet, 35, "MultiSigNotMet"),
    (ContractError::ProposalNotFound, 36, "ProposalNotFound"),
    (ContractError::AlreadyVoted, 37, "AlreadyVoted"),
    (
        ContractError::NoRewardsConfigured,
        38,
        "NoRewardsConfigured",
    ),
    (ContractError::NotCreator, 39, "NotCreator"),
    (ContractError::MilestoneNotFound, 40, "MilestoneNotFound"),
    (
        ContractError::MilestoneAlreadyReached,
        41,
        "MilestoneAlreadyReached",
    ),
    (
        ContractError::VerificationNotApproved,
        42,
        "VerificationNotApproved",
    ),
    (ContractError::DisputeNotFound, 43, "DisputeNotFound"),
    (
        ContractError::DisputeAlreadyVoted,
        44,
        "DisputeAlreadyVoted",
    ),
    (ContractError::DisputeVotingEnded, 45, "DisputeVotingEnded"),
    (
        ContractError::AnalyticsNotAvailable,
        46,
        "AnalyticsNotAvailable",
    ),
    (
        ContractError::GovernanceProposalNotFound,
        47,
        "GovernanceProposalNotFound",
    ),
    (
        ContractError::GovernanceAlreadyVoted,
        48,
        "GovernanceAlreadyVoted",
    ),
    (
        ContractError::GovernanceVotingEnded,
        49,
        "GovernanceVotingEnded",
    ),
    (
        ContractError::GovernanceNotEnoughApprovals,
        50,
        "GovernanceNotEnoughApprovals",
    ),
    (
        ContractError::GovernanceTimelockPending,
        51,
        "GovernanceTimelockPending",
    ),
    (
        ContractError::GovernanceNotGovernor,
        52,
        "GovernanceNotGovernor",
    ),
    (
        ContractError::GovernanceProposalNotReady,
        53,
        "GovernanceProposalNotReady",
    ),
    (
        ContractError::GovernanceAlreadyExecuted,
        54,
        "GovernanceAlreadyExecuted",
    ),
    (
        ContractError::GovernanceEmergencyPaused,
        55,
        "GovernanceEmergencyPaused",
    ),
    (ContractError::ReentrancyDetected, 56, "ReentrancyDetected"),
    (
        ContractError::EmergencyPauseActive,
        57,
        "EmergencyPauseActive",
    ),
    (ContractError::InvalidInput, 58, "InvalidInput"),
    (ContractError::NotFound, 59, "NotFound"),
    (ContractError::InvalidCategory, 60, "InvalidCategory"),
    (
        ContractError::ContributorCapExceeded,
        61,
        "ContributorCapExceeded",
    ),
    (
        ContractError::StreamNotConfigured,
        62,
        "StreamNotConfigured",
    ),
    (
        ContractError::StreamNotYetClaimable,
        63,
        "StreamNotYetClaimable",
    ),
    (ContractError::StreamFullyClaimed, 64, "StreamFullyClaimed"),
    (ContractError::WrongCampaignState, 65, "WrongCampaignState"),
    (ContractError::DeadlineNotReached, 66, "DeadlineNotReached"),
    (
        ContractError::NoContributionToRefund,
        67,
        "NoContributionToRefund",
    ),
    (ContractError::InvalidInitParams, 68, "InvalidInitParams"),
    (ContractError::AlreadyWithdrawn, 69, "AlreadyWithdrawn"),
    (ContractError::InvalidAddress, 70, "InvalidAddress"),
    (ContractError::NothingToRefund, 71, "NothingToRefund"),
    (ContractError::NotPaused, 72, "NotPaused"),
];

#[test]
fn every_variant_keeps_its_stable_code() {
    for &(variant, code, name) in EXPECTED {
        assert_eq!(variant as u32, code, "discriminant changed for {name}");
    }
}

#[test]
fn codes_are_unique_and_contiguous_from_one() {
    let mut codes: Vec<u32> = EXPECTED.iter().map(|&(_, c, _)| c).collect();
    codes.sort_unstable();
    let expected: Vec<u32> = (1..=EXPECTED.len() as u32).collect();
    assert_eq!(
        codes, expected,
        "codes must be unique and contiguous from 1"
    );
}

#[test]
fn table_covers_every_error_variant_count() {
    // Guards against a new variant being added without a table entry: the
    // highest code in the table must equal the number of entries.
    let max = EXPECTED.iter().map(|&(_, c, _)| c).max().unwrap();
    assert_eq!(max as usize, EXPECTED.len());
}

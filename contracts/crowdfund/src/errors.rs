/// Error types for the crowdfund contract.
///
/// This module defines all possible error conditions that can occur during contract execution.
use soroban_sdk::contracterror;

/// Contract error types.
///
/// Represents all possible error conditions that can occur during contract execution.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Campaign has already been initialized
    AlreadyInitialized = 1,
    /// Campaign deadline has passed
    CampaignEnded = 2,
    /// Campaign deadline has not yet passed
    CampaignStillActive = 3,
    /// Campaign goal was not reached
    GoalNotReached = 4,
    /// Campaign goal was already reached
    GoalReached = 5,
    /// Arithmetic overflow occurred
    Overflow = 6,
    /// Campaign is not in Active status
    NotActive = 7,
    /// Platform fee is invalid (> 10,000 bps)
    InvalidFee = 8,
    /// Amount is below minimum contribution
    BelowMinimum = 9,
    /// Deadline is invalid
    InvalidDeadline = 10,
    /// Campaign is paused
    CampaignPaused = 11,
    /// Campaign goal is invalid (<= 0)
    InvalidGoal = 12,
    /// Token is not accepted by this campaign
    TokenNotAccepted = 13,
    /// Contribution would exceed the per-contributor maximum
    ExceedsMaximum = 14,
    /// Address is not whitelisted
    NotWhitelisted = 15,
    /// Address is blacklisted
    Blacklisted = 16,
    /// Invalid delegation
    InvalidDelegation = 17,
    /// Delegation not found
    DelegationNotFound = 18,
    /// Invalid template
    InvalidTemplate = 19,
    /// Voting period has ended
    VotingEnded = 20,
    /// Invalid recurring plan
    InvalidRecurringPlan = 21,
    /// Refund limit exceeded
    RefundLimitExceeded = 22,
    /// Vesting not complete
    VestingNotComplete = 23,
    /// Emergency withdrawal locked
    EmergencyLocked = 24,
    /// Rate limit exceeded
    RateLimitExceeded = 25,
    /// Message too long
    MessageTooLong = 26,
    /// String field (title/description) is empty
    StringEmpty = 27,
    /// String field exceeds maximum allowed length
    StringTooLong = 28,
    /// Numeric amount must be positive (> 0)
    AmountNotPositive = 29,
    /// Platform fee address must differ from creator
    SelfFeeAddress = 30,
    /// Goal would overflow i128 when combined with existing totals
    GoalOverflow = 31,
    /// Insufficient funds in pool or balance
    InsufficientFunds = 32,
    /// Caller is not authorized for this operation
    Unauthorized = 33,
    /// Rate limit configuration is invalid (negative amount or zero window)
    InvalidRateLimit = 34,
    /// Multi-sig approval requirement not met
    MultiSigNotMet = 35,
    /// Proposal not found
    ProposalNotFound = 36,
    /// Already voted on proposal
    AlreadyVoted = 37,
    /// Rewards not configured for this campaign
    NoRewardsConfigured = 38,
    /// Caller is not the campaign creator
    NotCreator = 39,
    /// Milestone not found
    MilestoneNotFound = 40,
    /// Milestone already reached
    MilestoneAlreadyReached = 41,
    /// Verification status is not approved
    VerificationNotApproved = 42,
    /// Dispute not found
    DisputeNotFound = 43,
    /// Dispute already voted on by this address
    DisputeAlreadyVoted = 44,
    /// Dispute voting period has ended
    DisputeVotingEnded = 45,
    /// Analytics not available
    AnalyticsNotAvailable = 46,
    /// Governance proposal not found
    GovernanceProposalNotFound = 47,
    /// Already voted on this governance proposal
    GovernanceAlreadyVoted = 48,
    /// Voting period for governance proposal has ended
    GovernanceVotingEnded = 49,
    /// Not enough approvals to execute governance proposal
    GovernanceNotEnoughApprovals = 50,
    /// Governance timelock has not yet expired
    GovernanceTimelockPending = 51,
    /// Address is not a designated governor
    GovernanceNotGovernor = 52,
    /// Governance proposal is not in a ready state
    GovernanceProposalNotReady = 53,
    /// Governance proposal has already been executed
    GovernanceAlreadyExecuted = 54,
    /// Contract is emergency paused by governance
    GovernanceEmergencyPaused = 55,
    /// Reentrancy detected (function called recursively)
    ReentrancyDetected = 56,
    /// Emergency pause is active
    EmergencyPauseActive = 57,
    /// Invalid input provided
    InvalidInput = 58,
    /// Requested item not found
    NotFound = 59,
    /// Invalid campaign category
    InvalidCategory = 60,
    // ── Issue #702: Per-contributor cap ──────────────────────────────────────
    /// Contribution would push this contributor's total above the per-contributor cap
    ContributorCapExceeded = 61,
    // ── Issue #704: Withdrawal streaming ─────────────────────────────────────
    /// No streaming configuration set for this campaign
    StreamNotConfigured = 62,
    /// The requested stream claim amount exceeds what has unlocked so far
    StreamNotYetClaimable = 63,
    /// Nothing left to claim (fully claimed or zero claimable)
    StreamFullyClaimed = 64,
    // ── Issue #705: Improved error granularity ────────────────────────────────
    /// Campaign is not in the correct state for this operation (replaces generic NotActive for mismatched states)
    WrongCampaignState = 65,
    /// The operation requires the campaign deadline to have passed
    DeadlineNotReached = 66,
    /// The contributor has no contribution to refund
    NoContributionToRefund = 67,
    /// Initialization parameters are invalid (replaces generic InvalidInput for init)
    InvalidInitParams = 68,
    /// The withdrawal has already been executed (campaign already paid out)
    AlreadyWithdrawn = 69,
    /// A required address could not be read from storage (contract not initialized)
    InvalidAddress = 70,
    /// There is nothing available to refund for this caller
    NothingToRefund = 71,
    /// The campaign is not currently paused
    NotPaused = 72,
    // ── Issue #1569/#1571: Metadata limit errors ─────────────────────────────
    /// Campaign metadata exceeds the maximum allowed size
    MetadataTooLong = 73,
    /// Campaign metadata is invalid (empty or malformed)
    InvalidMetadata = 74,
}

impl From<common::CommonError> for ContractError {
    /// Folds the shared [`common::CommonError`] variants into this contract's
    /// error space, preserving stable on-chain discriminants.
    ///
    /// | `CommonError` variant   | Maps to                           |
    /// |-------------------------|-----------------------------------|
    /// | `Unauthorized`          | `ContractError::Unauthorized` (33) |
    /// | `NotFound`              | `ContractError::NotFound` (59)     |
    /// | `AlreadyInitialized`    | `ContractError::AlreadyInitialized` (1) |
    /// | `AlreadyExists`         | `ContractError::InvalidGoal` (12) — closest generic |
    /// | `InvalidInput`          | `ContractError::InvalidInput` (58) |
    /// | `NotInitialized`        | `ContractError::InvalidAddress` (70) |
    /// | `Paused`                | `ContractError::CampaignPaused` (11) |
    /// | `Overflow`              | `ContractError::Overflow` (6) |
    fn from(err: common::CommonError) -> Self {
        match err {
            common::CommonError::Unauthorized => ContractError::Unauthorized,
            common::CommonError::NotFound => ContractError::NotFound,
            common::CommonError::AlreadyInitialized => ContractError::AlreadyInitialized,
            common::CommonError::AlreadyExists => ContractError::InvalidGoal,
            common::CommonError::InvalidInput => ContractError::InvalidInput,
            common::CommonError::NotInitialized => ContractError::InvalidAddress,
            common::CommonError::Paused => ContractError::CampaignPaused,
            common::CommonError::Overflow => ContractError::Overflow,
        }
    }
}

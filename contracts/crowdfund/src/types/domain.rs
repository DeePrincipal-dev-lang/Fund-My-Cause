/// Domain types and structures for the crowdfund contract.
///
/// Contains the `DataKey` storage key variants plus re-exports of the
/// domain-specific type modules.  Event payload types live in the sibling
/// [`super::events`] module.
use soroban_sdk::{contracttype, Address, String};

pub use super::campaign::{
    CampaignInfo, CampaignStats, CampaignTemplate, CampaignUpdate, Category, FundingMilestone,
    MatchingConfig, RewardTier, Status, TemplateType, Visibility,
};
pub use super::contribution::{
    ContributionHistory, Delegation, FeeMode, PlatformConfig, RateLimit,
};
pub use super::withdrawal::{
    AnalyticsDataPoint, CampaignAnalytics, ContractStateSnapshot, Dispute, DisputeStatus,
    ExecutionRecord, ExtensionProposal, FunctionPerfStats, GoalAdjustment, GovernanceConfig,
    GovernanceProposal, InsuranceConfig, MetadataVersion, MilestoneStatus, PerformanceMetrics,
    QfContributorInput, QfInputs, RecurringPlan, RewardConfig, SearchIndexEntry,
    StateValidationResult, StreamConfig, VerificationStatus, VersionMigration, VestingSchedule,
    YieldConfig, YieldInfo,
};

/// Storage key variants for contract data.
///
/// Used to organize persistent and instance storage in the contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Contribution amount for a specific address
    Contribution(Address),
    /// Whether an address has contributed (presence flag)
    ContributorPresence(Address),
    /// Total number of unique contributors
    ContributorCount,
    /// Largest single contribution amount
    LargestContribution,
    /// Whitelist of accepted token addresses
    AcceptedTokens,
    /// Contribution message for a specific address
    ContributionMessage(Address),
    /// Recurring contribution plan for a specific address
    RecurringPlan(Address),
    /// Recurring contribution history for a specific address
    RecurringHistory(Address),
    /// Extension proposal data
    ExtensionProposal,
    /// Extension votes for a specific address
    ExtensionVote(Address),
    /// Partial refund amount for a specific address
    PartialRefund(Address),
    /// Insurance fee paid by a specific contributor
    InsuranceFee(Address),
    /// Whitelist flag for a specific address
    Whitelist(Address),
    /// Blacklist flag for a specific address
    Blacklist(Address),
    /// Whitelist-only mode flag
    WhitelistOnly,
    /// Delegation for a specific address
    Delegation(Address),
    /// Delegated contribution amount for a specific address
    DelegatedContribution(Address),
    /// Campaign template
    Template,
    /// Emergency lock time
    EmergencyLockTime,
    /// Rate limit timestamp for a specific address
    RateLimitTimestamp(Address),
    /// Rate limit amount for a specific address
    RateLimitAmount(Address),
    /// Matching configuration
    MatchingConfig,
    /// Total matched amount
    TotalMatched,
    /// Escrowed matching pool (tokens held by contract on behalf of sponsor)
    MatchingPool,
    /// Penalty basis points
    PenaltyBps,
    /// Ordered list of reward tiers configured by the creator
    RewardTiers,
    /// Best reward tier currently assigned to a specific contributor
    ContributorTier(Address),
    /// Full contribution history for a specific contributor
    ContributionHistory(Address),
    /// Required number of approvals for emergency withdrawal multi-sig
    EmergencyApproversRequired,
    /// Running approval count for the active emergency withdrawal session
    EmergencyApprovalCount,
    /// Session token (lock_until timestamp) that a specific address last approved
    EmergencyApproval(Address),
    /// Authorized approver addresses for emergency multi-sig
    EmergencyApproversList,
    /// Reward configuration for the campaign
    RewardConfig,
    /// Total rewards distributed
    TotalRewardsDistributed,
    /// Rewards claimed by a specific contributor
    RewardsClaimed(Address),
    /// Search index entry for the campaign
    SearchIndex,
    /// Campaign title index for search
    TitleIndex,
    /// Campaign category index for filtering
    CategoryIndex,
    // #460: per-function performance stats
    /// Performance stats for a named function
    PerfStats(String),
    /// Indexed contributor address — key is the contributor's insertion order (0-based).
    /// Replaces the monolithic KEY_CONTRIBS Vec to give O(1) per-write cost and
    /// O(page_size) pagination instead of O(n) reads of the full list.
    ContributorIndex(u32),
    /// Yield accounting info for a specific contributor
    YieldInfo(Address),
    /// Whether an address is on the campaign allow-list (#697)
    AllowList(Address),
    /// Whether an address is on the campaign deny-list (#697)
    DenyList(Address),
    /// Governance proposal by nonce
    GovernanceProposal(u32),
    /// Records whether a governor (by address) has voted on a proposal (by nonce)
    GovernanceVote(u32, Address),
    /// Emergency pause approval by governor address
    EmergencyPauseApproval(Address),
    /// Running emergency pause approval count
    EmergencyPauseApprovals,
    /// KYC/AML verification status for a specific address.
    ///
    /// Kept separate from `Contribution` so updating verification cannot
    /// overwrite the contributor's i128 amount (issue #1560).
    Verification(Address),
}

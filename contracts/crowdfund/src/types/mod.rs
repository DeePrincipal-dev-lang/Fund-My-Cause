// These are public API re-exports for external consumers; not all are
// referenced internally, but all should remain accessible.
#![allow(unused_imports)]

/// Types for the crowdfund contract, split into two sub-modules:
///
/// - [`domain`] — storage/state types, enums, `DataKey`, and non-event structs.
/// - [`events`] — structured event payload types (`Event*` structs).
///
/// Everything is re-exported at this level so existing `use crate::types::*`
/// or `use crate::types::Foo` imports continue to resolve without any change.
pub mod campaign;
pub mod contribution;
pub mod domain;
pub mod events;
pub mod withdrawal;

// ── Re-export all campaign domain types ───────────────────────────────────────
pub use campaign::{
    CampaignAnalytics, CampaignInfo, CampaignStats, CampaignTemplate, CampaignUpdate, Category,
    ExtensionProposal, FundingMilestone, GoalAdjustment, MetadataVersion, MilestoneStatus,
    RecurringPlan, RewardConfig, RewardTier, StreamConfig, TemplateType, Visibility,
};

// ── Re-export all contribution domain types ───────────────────────────────────
pub use contribution::{
    ContributionHistory, Delegation, MatchingConfig, QfContributorInput, QfInputs, RateLimit,
    VestingSchedule, YieldConfig, YieldInfo,
};

// ── Re-export all withdrawal domain types ─────────────────────────────────────
pub use withdrawal::{
    AnalyticsDataPoint, ContractStateSnapshot, Dispute, DisputeStatus, ExecutionRecord, FeeMode,
    FunctionPerfStats, GovernanceConfig, GovernanceProposal, InsuranceConfig, PerformanceMetrics,
    PlatformConfig, StateValidationResult, VerificationStatus, VersionMigration,
};

// ── Re-export all domain types ────────────────────────────────────────────────
pub use domain::{
    DataKey, Status,
};

// ── Re-export all event types ─────────────────────────────────────────────────
pub use events::{
    campaign::{
        EventArchived, EventCampaignCloned, EventCampaignIndexed, EventCancelled,
        EventCapsConfigured, EventCategoryUpdated, EventDeadlineExtended, EventGoalAdjusted,
        EventInitialized, EventMetadataUpdated, EventMetadataVersioned, EventMilestoneReached,
        EventMilestoneRelease, EventMilestoneVerified, EventOwnershipTransferred, EventPaused,
        EventPausedWithTimelock, EventResumed, EventStatusChanged, EventTemplateApplied,
        EventTiersSet, EventVisibilityChanged, EventWhitelistOnlySet,
    },
    contribution::{
        EventAllowlistRemoved, EventAllowlisted, EventBatchRefundCompleted, EventBlacklistRemoved,
        EventBlacklisted, EventContributed, EventContributionRecorded, EventDelegatedContribution,
        EventDelegationCreated, EventDelegationRevoked, EventDenylistRemoved, EventDenylisted,
        EventMatchingSetup, EventPartialRefund, EventQfContribution, EventRateLimitHit,
        EventRateLimitUpdated, EventRecurringCancelled, EventRecurringExecuted,
        EventRecurringSetup, EventRewardsConfigured, EventRewardsDistributed, EventTierAssigned,
        EventWhitelistRemoved, EventWhitelisted,
    },
    refund::{
        EventRefunded,
    },
    withdrawal::{
        EventAnalyticsGenerated, EventContractMigrated, EventDebugLog, EventDebugSnapshot,
        EventDisputeFiled, EventDisputeResolved, EventDisputeVoted, EventEmergencyApproved,
        EventEmergencyExecuted, EventEmergencyInitiated, EventExecutionRecorded,
        EventExtensionExecuted, EventExtensionProposed, EventExtensionVoted,
        EventGovernanceConfigUpdated, EventGovernanceEmergencyPaused,
        EventGovernanceEmergencyResumed, EventGovernanceExecuted, EventGovernanceProposed,
        EventGovernanceVoted, EventInsuranceEnabled, EventInsurancePayout, EventInvariantViolated,
        EventIpfsCidUpdated, EventMultiSigConfigured, EventPerfAlert, EventStateValidated,
        EventStreamClaimed, EventVerificationUpdated, EventVersionChecked, EventWithdrawn,
        EventYieldClaimed, EventYieldConfigured,
    },
};

// ── Issue #703 / #924: Event schema versioning ───────────────────────────────
/// Current event schema version. Re-exported from `common`'s shared event
/// convention (see `contracts/common/src/events.rs`) so all three contracts
/// start from the same version number. Bump this when the shape of any
/// emitted event payload changes in a backwards-incompatible way so that
/// indexers can adapt without guessing.
pub use common::EVENT_SCHEMA_VERSION;

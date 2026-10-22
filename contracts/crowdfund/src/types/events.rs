// contracts/crowdfund/src/types/events/mod.rs
//
//! Structured event payload types for the crowdfund contract.
//!
//! Each event emitted by the contract carries one of these structs as its data
//! payload.  Using typed structs instead of raw tuples makes events indexable,
//! self-documenting, and forward-compatible.
//!
//! Events are grouped by family into submodules:
//! - [`campaign`]: campaign lifecycle, configuration, governance, and misc.
//! - [`contribution`]: contributions, matching, delegation, and rewards.
//! - [`refund`]: refunds and cancellations.
//! - [`withdrawal`]: withdrawals, streaming, and emergency withdrawals.
//!
//! Every event is re-exported here so existing imports resolve unchanged.
//!
//! Domain/storage types live in the sibling [`super::domain`] module.

pub mod campaign;
pub mod contribution;
pub mod refund;
pub mod withdrawal;

pub use campaign::*;
pub use contribution::*;
pub use refund::*;
pub use withdrawal::*;
```

```rust
// contracts/crowdfund/src/types/events/campaign.rs
//
//! Campaign-family events: lifecycle, configuration, governance, and misc.

use soroban_sdk::{contracttype, Address, String};

use super::super::domain::{
    Category, DisputeStatus, Status, TemplateType, VerificationStatus, Visibility,
};

/// Emitted when a campaign is successfully initialized.
///
/// Event topic: `("crowdfund", "initialized")`
#[derive(Clone)]
#[contracttype]
pub struct EventInitialized {
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
    pub category: Category,
    pub schema_version: u32,
}

/// Emitted when a contribution is accepted.
///
/// Event topic: `("crowdfund", "contributed")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributed {
    pub contributor: Address,
    pub amount: i128,
    /// New running total for this contributor after this contribution
    pub new_total: i128,
    /// Matched amount added by a sponsor (0 if no matching configured)
    pub matched_amount: i128,
    pub schema_version: u32,
}

/// Emitted when the creator withdraws funds after a successful campaign.
///
/// Event topic: `("crowdfund", "withdrawn")`
#[derive(Clone)]
#[contracttype]
pub struct EventWithdrawn {
    pub creator: Address,
    /// Total raised at the time of withdrawal (before fee deduction)
    pub total: i128,
    /// Platform fee deducted (0 if no platform config)
    pub fee: i128,
    /// Net amount transferred to the creator
    pub payout: i128,
    pub schema_version: u32,
}

/// Emitted when a contributor claims a full refund.
///
/// Event topic: `("crowdfund", "refunded")`
#[derive(Clone)]
#[contracttype]
pub struct EventRefunded {
    pub contributor: Address,
    pub amount: i128,
    pub schema_version: u32,
}

/// Emitted when a contributor claims a partial refund before the deadline.
///
/// Event topic: `("crowdfund", "partial_refund")`
#[derive(Clone)]
#[contracttype]
pub struct EventPartialRefund {
    pub contributor: Address,
    pub amount: i128,
    /// Remaining contribution balance after the partial refund
    pub remaining: i128,
}

/// Emitted when the campaign status changes.
///
/// Event topic: `("crowdfund", "status_changed")`
#[derive(Clone)]
#[contracttype]
pub struct EventStatusChanged {
    pub old_status: Status,
    pub new_status: Status,
}

/// Emitted when campaign metadata is updated.
///
/// Event topic: `("crowdfund", "metadata_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventMetadataUpdated {
    pub updated_title: bool,
    pub updated_description: bool,
    pub updated_social_links: bool,
}

/// Emitted when the campaign deadline is extended directly by the creator.
///
/// Event topic: `("crowdfund", "deadline_extended")`
#[derive(Clone)]
#[contracttype]
pub struct EventDeadlineExtended {
    pub old_deadline: u64,
    pub new_deadline: u64,
}

/// Emitted when a deadline extension proposal is created.
///
/// Event topic: `("crowdfund", "extension_proposed")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionProposed {
    pub new_deadline: u64,
    pub voting_ends_at: u64,
}

/// Emitted when a contributor votes on a deadline extension.
///
/// Event topic: `("crowdfund", "extension_voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionVoted {
    pub contributor: Address,
    pub approve: bool,
    pub vote_weight: i128,
}

/// Emitted when a deadline extension is executed after successful voting.
///
/// Event topic: `("crowdfund", "extension_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventExtensionExecuted {
    pub new_deadline: u64,
    pub votes_for: i128,
    pub votes_against: i128,
}

/// Emitted when a recurring contribution plan is set up.
///
/// Event topic: `("crowdfund", "recurring_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringSetup {
    pub contributor: Address,
    pub amount: i128,
    pub interval: u64,
    pub end_date: u64,
}

/// Emitted when a recurring contribution is executed.
///
/// Event topic: `("crowdfund", "recurring_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringExecuted {
    pub contributor: Address,
    pub amount: i128,
}

/// Emitted when a recurring plan is cancelled.
///
/// Event topic: `("crowdfund", "recurring_cancelled")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringCancelled {
    pub contributor: Address,
}

/// Emitted when a delegation is created.
///
/// Event topic: `("crowdfund", "delegation_created")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationCreated {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegated contribution is made.
///
/// Event topic: `("crowdfund", "delegated_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegatedContribution {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegation is revoked.
///
/// Event topic: `("crowdfund", "delegation_revoked")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationRevoked {
    pub delegator: Address,
}

/// Emitted when an address is added to the whitelist.
///
/// Event topic: `("crowdfund", "whitelisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelisted {
    pub address: Address,
}

/// Emitted when an address is removed from the whitelist.
///
/// Event topic: `("crowdfund", "whitelist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelistRemoved {
    pub address: Address,
}

/// Emitted when an address is added to the blacklist.
///
/// Event topic: `("crowdfund", "blacklisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventBlacklisted {
    pub address: Address,
}

/// Emitted when an address is removed from the blacklist.
///
/// Event topic: `("crowdfund", "blacklist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventBlacklistRemoved {
    pub address: Address,
}

/// Emitted when whitelist-only mode is toggled.
///
/// Event topic: `("crowdfund", "whitelist_only_set")`
#[derive(Clone)]
#[contracttype]
pub struct EventWhitelistOnlySet {
    pub enabled: bool,
}

/// Emitted when the rate limit is updated.
///
/// Event topic: `("crowdfund", "rate_limit_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventRateLimitUpdated {
    /// Maximum total contribution amount per address within `window_seconds`.
    pub max_amount: i128,
    /// Window length in seconds (0 when the rate limit is cleared).
    pub window_seconds: u64,
}

/// Emitted when a contribution is rejected because it would exceed the rate limit.
///
/// Event topic: `("crowdfund", "rate_limit_hit")`
#[derive(Clone)]
#[contracttype]
pub struct EventRateLimitHit {
    pub contributor: Address,
    /// Amount the contributor attempted to add.
    pub attempted: i128,
    /// Amount already counted toward the contributor's current window.
    pub period_amount: i128,
    /// Configured maximum for the window.
    pub max_amount: i128,
}

/// Emitted when a campaign's visibility level is changed.
///
/// Event topic: `("crowdfund", "visibility_changed")`
#[derive(Clone)]
#[contracttype]
pub struct EventVisibilityChanged {
    pub old_visibility: Visibility,
    pub new_visibility: Visibility,
}

/// Emitted when an emergency withdrawal is initiated.
///
/// Event topic: `("crowdfund", "emergency_initiated")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyInitiated {
    pub lock_until: u64,
}

/// Emitted when an emergency withdrawal is executed.
///
/// Event topic: `("crowdfund", "emergency_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyExecuted {
    pub amount: i128,
}

/// Emitted when insurance is enabled for the campaign.
///
/// Event topic: `("insurance", "enabled")`
#[derive(Clone)]
#[contracttype]
pub struct EventInsuranceEnabled {
    pub fee_bps: u32,
    pub provider: Address,
}

/// Emitted when an insurance payout is processed.
///
/// Event topic: `("insurance", "payout")`
#[derive(Clone)]
#[contracttype]
pub struct EventInsurancePayout {
    pub contributor: Address,
    pub amount: i128,
}

/// Emitted when emergency withdrawal multi-sig is configured.
///
/// Event topic: `("crowdfund", "multisig_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventMultiSigConfigured {
    /// Minimum number of approvals required to execute the emergency withdrawal
    pub required_approvals: u32,
    /// Total number of authorised approver addresses
    pub approver_count: u32,
}

/// Emitted when an emergency withdrawal approval is submitted by an approver.
///
/// Event topic: `("crowdfund", "emergency_approved")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyApproved {
    /// Address of the approver who submitted this approval
    pub approver: Address,
    /// Running approval count for the current session after this approval
    pub approval_count: u32,
}

/// Emitted when a contribution matching pool is configured.
///
/// Event topic: `("crowdfund", "matching_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventMatchingSetup {
    /// Sponsor address funding the matching pool
    pub sponsor: Address,
    /// Match ratio in basis points (e.g. 10 000 = 1 : 1)
    pub match_ratio: u32,
    /// Maximum total matching amount in stroops
    pub max_match: i128,
}

/// Emitted when a campaign is initialised via a template.
///
/// Event topic: `("crowdfund", "template_applied")`
#[derive(Clone)]
#[contracttype]
pub struct EventTemplateApplied {
    /// Template type used to initialise the campaign
    pub template_type: TemplateType,
    /// Minimum contribution derived from the template
    pub suggested_min: i128,
}

/// Emitted when the campaign category is updated by the creator.
///
/// Event topic: `("crowdfund", "category_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventCategoryUpdated {
    /// Previous category before the update
    pub old_category: Category,
    /// New category after the update
    pub new_category: Category,
}

/// Emitted when the campaign is paused.
///
/// Event topic: `("crowdfund", "paused")`
#[derive(Clone)]
#[contracttype]
pub struct EventPaused {
    pub timestamp: u64,
}

/// Emitted when the campaign is resumed.
///
/// Event topic: `("crowdfund", "resumed")`
#[derive(Clone)]
#[contracttype]
pub struct EventResumed {
    pub timestamp: u64,
}

/// Emitted when a campaign is cancelled.
///
/// Event topic: `("crowdfund", "cancelled")`
#[derive(Clone)]
#[contracttype]
pub struct EventCancelled {
    pub creator: Address,
    pub total_raised: i128,
}

/// Emitted after a batch refund completes.
///
/// Event topic: `("crowdfund", "batch_refund_completed")`
#[derive(Clone)]
#[contracttype]
pub struct EventBatchRefundCompleted {
    pub total_refunded: u32,
    pub batch_size: u32,
}

/// Emitted when a contributor is assigned a reward tier.
///
/// Event topic: `("crowdfund", "tier_assigned")`
#[derive(Clone)]
#[contracttype]
pub struct EventTierAssigned {
    pub contributor: Address,
    pub tier_name: String,
    pub min_amount: i128,
}

/// Emitted when reward tiers are configured.
///
/// Event topic: `("crowdfund", "tiers_set")`
#[derive(Clone)]
#[contracttype]
pub struct EventTiersSet {
    pub tier_count: u32,
}

/// Emitted when a metadata version snapshot is stored.
///
/// Event topic: `("crowdfund", "metadata_versioned")`
#[derive(Clone)]
#[contracttype]
pub struct EventMetadataVersioned {
    pub version: u32,
    pub timestamp: u64,
}

/// Emitted when the campaign goal is adjusted.
///
/// Event topic: `("crowdfund", "goal_adjusted")`
#[derive(Clone)]
#[contracttype]
pub struct EventGoalAdjusted {
    pub previous_goal: i128,
    pub new_goal: i128,
    pub timestamp: u64,
}

/// Emitted when a contribution is recorded with full detail.
///
/// Event topic: `("crowdfund", "contribution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributionRecorded {
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub running_total: i128,
}

/// Emitted when a campaign is archived.
///
/// Event topic: `("crowdfund", "archived")`
#[derive(Clone)]
#[contracttype]
pub struct EventArchived {
    pub creator: Address,
    pub total_raised: i128,
    pub timestamp: u64,
}

/// Emitted when campaign ownership is transferred to a new address.
///
/// Event topic: `("crowdfund", "ownership_transferred")`
#[derive(Clone)]
#[contracttype]
pub struct EventOwnershipTransferred {
    pub previous_owner: Address,
    pub new_owner: Address,
}

// ── Issue #436: Campaign Milestones ───────────────────────────────────────────

/// Emitted when a milestone is reached.
///
/// Event topic: `("crowdfund", "milestone_reached")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneReached {
    pub milestone_index: u32,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a milestone is verified.
///
/// Event topic: `("crowdfund", "milestone_verified")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneVerified {
    pub milestone_index: u32,
    pub timestamp: u64,
}

/// Emitted when funds are released based on milestone completion.
///
/// Event topic: `("crowdfund", "milestone_release")`
#[derive(Clone)]
#[contracttype]
pub struct EventMilestoneRelease {
    pub milestone_index: u32,
    pub amount: i128,
    pub timestamp: u64,
}

// ── Issue #437: Contribution Verification (KYC/AML) ──────────────────────────

/// Emitted when a contributor's verification status is updated.
///
/// Event topic: `("crowdfund", "verification_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventVerificationUpdated {
    pub contributor: Address,
    pub status: VerificationStatus,
    pub timestamp: u64,
}

// ── Issue #438: Campaign Analytics ────────────────────────────────────────────

/// Emitted when analytics are generated.
///
/// Event topic: `("crowdfund", "analytics_generated")`
#[derive(Clone)]
#[contracttype]
pub struct EventAnalyticsGenerated {
    pub total_contributions: u32,
    pub average_contribution: i128,
    pub peak_contribution: i128,
    pub timestamp: u64,
}

// ── Issue #439: Dispute Resolution System ─────────────────────────────────────

/// Emitted when a dispute is filed.
///
/// Event topic: `("crowdfund", "dispute_filed")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeFiled {
    pub dispute_id: u32,
    pub filer: Address,
    pub timestamp: u64,
}

/// Emitted when a vote is cast on a dispute.
///
/// Event topic: `("crowdfund", "dispute_voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeVoted {
    pub dispute_id: u32,
    pub voter: Address,
    pub vote_weight: i128,
    pub in_favor: bool,
    pub timestamp: u64,
}

/// Emitted when a dispute is resolved.
///
/// Event topic: `("crowdfund", "dispute_resolved")`
#[derive(Clone)]
#[contracttype]
pub struct EventDisputeResolved {
    pub dispute_id: u32,
    pub status: DisputeStatus,
    pub votes_for: i128,
    pub votes_against: i128,
    pub timestamp: u64,
}

// ── Issue #457: Contract Versioning ──────────────────────────────────────────

/// Emitted when the contract version is checked.
///
/// Event topic: `("contract", "version_checked")`
#[derive(Clone)]
#[contracttype]
pub struct EventVersionChecked {
    pub current_version: u32,
    pub expected_version: u32,
    pub compatible: bool,
}

/// Emitted when a contract migration is executed.
///
/// Event topic: `("contract", "migrated")`
#[derive(Clone)]
#[contracttype]
pub struct EventContractMigrated {
    pub from_version: u32,
    pub to_version: u32,
    pub timestamp: u64,
}

// ── Issue #458: State Validation ──────────────────────────────────────────────

/// Emitted when state validation is run.
///
/// Event topic: `("contract", "state_validated")`
#[derive(Clone)]
#[contracttype]
pub struct EventStateValidated {
    pub valid: bool,
    pub checks_passed: u32,
    pub checks_failed: u32,
    pub timestamp: u64,
}

/// Emitted when a state invariant violation is detected.
///
/// Event topic: `("contract", "invariant_violated")`
#[derive(Clone)]
#[contracttype]
pub struct EventInvariantViolated {
    pub invariant_id: u32,
    pub timestamp: u64,
}

// ── Issue #459: Debugging Utilities ──────────────────────────────────────────

/// Emitted when a debug state snapshot is taken.
///
/// Event topic: `("debug", "snapshot")`
#[derive(Clone)]
#[contracttype]
pub struct EventDebugSnapshot {
    pub version: u32,
    pub status: Status,
    pub total_raised: i128,
    pub contributor_count: u32,
    pub timestamp: u64,
}

/// Emitted for a debug log entry.
///
/// Event topic: `("debug", "log")`
#[derive(Clone)]
#[contracttype]
pub struct EventDebugLog {
    pub message: String,
    pub timestamp: u64,
}

// ── Issue #460: Performance Monitoring ───────────────────────────────────────

/// Emitted when a function execution time is recorded.
///
/// Event topic: `("perf", "execution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventExecutionRecorded {
    pub function_name: String,
    pub duration_ms: u64,
    pub timestamp: u64,
}

/// Emitted when a performance alert threshold is breached.
///
/// Event topic: `("perf", "alert")`
#[derive(Clone)]
#[contracttype]
pub struct EventPerfAlert {
    pub function_name: String,
    pub duration_ms: u64,
    pub threshold_ms: u64,
    pub timestamp: u64,
}

// ── DeFi: Yield Generation ────────────────────────────────────────────────────

/// Emitted when yield is configured by the creator.
///
/// Event topic: `("defi", "yield_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventYieldConfigured {
    pub reward_token: Address,
    pub pool: i128,
    pub rate_bps: u32,
}

/// Emitted when a contributor claims their accrued yield.
///
/// Event topic: `("defi", "yield_claimed")`
#[derive(Clone)]
#[contracttype]
pub struct EventYieldClaimed {
    pub contributor: Address,
    pub amount: i128,
}

// ── Governance Events (Multi-Sig) ────────────────────────────────────────────

/// Emitted when a governance proposal is created.
///
/// Event topic: `("governance", "proposed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceProposed {
    pub nonce: u32,
    pub proposer: soroban_sdk::Address,
    pub platform_address: soroban_sdk::Address,
    pub platform_fee_bps: u32,
    pub voting_ends_at: u64,
}

/// Emitted when a governance vote is cast.
///
/// Event topic: `("governance", "voted")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceVoted {
    pub nonce: u32,
    pub governor: soroban_sdk::Address,
    pub approvals: u32,
    pub required: u32,
}

/// Emitted when a governance proposal is executed after timelock.
///
/// Event topic: `("governance", "executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceExecuted {
    pub nonce: u32,
    pub platform_address: soroban_sdk::Address,
    pub platform_fee_bps: u32,
}

/// Emitted when governance configuration is updated.
///
/// Event topic: `("governance", "config_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceConfigUpdated {
    pub required_approvals: u32,
    pub governor_count: u32,
    pub timelock_delay: u64,
}

/// Emitted when the contract is emergency paused by governance.
///
/// Event topic: `("governance", "emergency_paused")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceEmergencyPaused {
    pub timestamp: u64,
}

/// Emitted when the contract is resumed from emergency pause by governance.
///
/// Event topic: `("governance", "emergency_resumed")`
#[derive(Clone)]
#[contracttype]
pub struct EventGovernanceEmergencyResumed {
    pub timestamp: u64,
}

// ── Issue #634: Quadratic-Funding Hooks ──────────────────────────────────────

/// Emitted on every contribution with the per-contributor weighting inputs.
///
/// Event topic: `("crowdfund", "qf_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventQfContribution {
    /// Contributor address
    pub contributor: Address,
    /// Incremental amount added in this contribution (in stroops)
    pub amount: i128,
    /// Contributor's cumulative total after this contribution (in stroops)
    pub cumulative: i128,
    /// Distinct-contributor count after this contribution
    pub contributor_count: u32,
}

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────

/// Emitted when a stream claim is executed.
///
/// Event topic: `("crowdfund", "stream_claimed")`
#[derive(Clone)]
#[contracttype]
pub struct EventStreamClaimed {
    pub creator: Address,
    pub amount: i128,
    pub remaining: i128,
    pub schema_version: u32,
}

// ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────────

/// Emitted when soft-cap or stretch-goal is configured.
///
/// Event topic: `("crowdfund", "caps_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventCapsConfigured {
    /// Soft cap amount in stroops (0 = not set)
    pub soft_cap: i128,
    /// Stretch goal amount in stroops (0 = not set)
    pub stretch_goal: i128,
}

// ── Issue #696: Pause timelock ───────────────────────────────────────────────

/// Emitted when the campaign is paused with a timelock.
///
/// Event topic: `("crowdfund", "paused_with_timelock")`
#[derive(Clone)]
#[contracttype]
pub struct EventPausedWithTimelock {
    pub timestamp: u64,
    /// Earliest time the campaign can be unpaused
    pub unpause_after: u64,
}

// ── Issue #697: Allow/deny list ──────────────────────────────────────────────

/// Emitted when an address is added to the allow list.
///
/// Event topic: `("crowdfund", "allowlisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventAllowlisted {
    pub address: Address,
}

/// Emitted when an address is removed from the allow list.
///
/// Event topic: `("crowdfund", "allowlist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventAllowlistRemoved {
    pub address: Address,
}

/// Emitted when an address is added to the deny list.
///
/// Event topic: `("crowdfund", "denylisted")`
#[derive(Clone)]
#[contracttype]
pub struct EventDenylisted {
    pub address: Address,
}

/// Emitted when an address is removed from the deny list.
///
/// Event topic: `("crowdfund", "denylist_removed")`
#[derive(Clone)]
#[contracttype]
pub struct EventDenylistRemoved {
    pub address: Address,
}

// ── Issue #416: Campaign search index ────────────────────────────────────────

/// Emitted when a campaign is (re)indexed.
///
/// Event topic: `("campaign", "indexed")`
#[derive(Clone)]
#[contracttype]
pub struct EventCampaignIndexed {
    pub title: String,
    pub category: Category,
    pub visibility: Visibility,
}

/// Emitted when a campaign is cloned into a new campaign.
///
/// Event topic: `("campaign", "cloned")`
#[derive(Clone)]
#[contracttype]
pub struct EventCampaignCloned {
    pub original_creator: Address,
    pub new_creator: Address,
    pub new_goal: i128,
    pub new_deadline: u64,
}

// ── Issue #699: IPFS metadata ────────────────────────────────────────────────

/// Emitted when the campaign's off-chain IPFS CID is updated.
///
/// Event topic: `("campaign", "ipfs_cid_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventIpfsCidUpdated {
    pub cid: String,
    pub timestamp: u64,
}
```

```rust
// contracts/crowdfund/src/types/events/contribution.rs
//
//! Contribution-family events: contributions, matching, delegation, and rewards.

use soroban_sdk::{contracttype, Address};

/// Emitted when a contribution is accepted.
///
/// Event topic: `("campaign", "contributed")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributed {
    pub contributor: Address,
    pub amount: i128,
    /// New running total for this contributor after this contribution
    pub new_total: i128,
    /// Matched amount added by a sponsor (0 if no matching configured)
    pub matched_amount: i128,
    pub schema_version: u32,
}

/// Emitted when a recurring contribution plan is set up.
///
/// Event topic: `("campaign", "recurring_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringSetup {
    pub contributor: Address,
    pub amount: i128,
    pub interval: u64,
    pub end_date: u64,
}

/// Emitted when a recurring contribution is executed.
///
/// Event topic: `("campaign", "recurring_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringExecuted {
    pub contributor: Address,
    pub amount: i128,
}

/// Emitted when a recurring plan is cancelled.
///
/// Event topic: `("campaign", "recurring_cancelled")`
#[derive(Clone)]
#[contracttype]
pub struct EventRecurringCancelled {
    pub contributor: Address,
}

/// Emitted when a delegation is created.
///
/// Event topic: `("campaign", "delegation_created")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationCreated {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegated contribution is made.
///
/// Event topic: `("campaign", "delegated_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegatedContribution {
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegation is revoked.
///
/// Event topic: `("campaign", "delegation_revoked")`
#[derive(Clone)]
#[contracttype]
pub struct EventDelegationRevoked {
    pub delegator: Address,
}

/// Emitted when a contribution matching pool is configured.
///
/// Event topic: `("campaign", "matching_setup")`
#[derive(Clone)]
#[contracttype]
pub struct EventMatchingSetup {
    /// Sponsor address funding the matching pool
    pub sponsor: Address,
    /// Match ratio in basis points (e.g. 10 000 = 1 : 1)
    pub match_ratio: u32,
    /// Maximum total matching amount in stroops
    pub max_match: i128,
}

/// Emitted when a contribution is recorded with full detail.
///
/// Event topic: `("campaign", "contribution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributionRecorded {
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub running_total: i128,
}

// ── Issue #634: Quadratic-Funding Hooks ──────────────────────────────────────

/// Emitted on every contribution with the per-contributor weighting inputs.
///
/// Event topic: `("campaign", "qf_contribution")`
#[derive(Clone)]
#[contracttype]
pub struct EventQfContribution {
    /// Contributor address
    pub contributor: Address,
    /// Incremental amount added in this contribution (in stroops)
    pub amount: i128,
    /// Contributor's cumulative total after this contribution (in stroops)
    pub cumulative: i128,
    /// Distinct-contributor count after this contribution
    pub contributor_count: u32,
}

// ── Issue #418: Contributor rewards ──────────────────────────────────────────

/// Emitted when contributor rewards are configured.
///
/// Event topic: `("crowdfund", "rewards_configured")`
#[derive(Clone)]
#[contracttype]
pub struct EventRewardsConfigured {
    pub reward_token: Address,
    pub reward_per_unit: i128,
}

/// Emitted when rewards are distributed to a contributor.
///
/// Event topic: `("crowdfund", "rewards_distributed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRewardsDistributed {
    pub contributor: Address,
    pub contribution_amount: i128,
    pub reward_amount: i128,
}
```

```rust
// contracts/crowdfund/src/types/events/refund.rs
//
//! Refund-family events: full refunds, partial refunds, and batch refunds.

use soroban_sdk::{contracttype, Address};

/// Emitted when a contributor claims a full refund.
///
/// Event topic: `("crowdfund", "indexed")`
#[derive(Clone)]
#[contracttype]
pub struct EventRefunded {
    pub contributor: Address,
    pub amount: i128,
    pub schema_version: u32,
}

/// Emitted when a contributor claims a partial refund before the deadline.
///
/// Event topic: `("crowdfund", "cloned")`
#[derive(Clone)]
#[contracttype]
pub struct EventPartialRefund {
    pub contributor: Address,
    pub amount: i128,
    /// Remaining contribution balance after the partial refund
    pub remaining: i128,
}

/// Emitted after a batch refund completes.
///
/// Event topic: `("campaign", "batch_refund_completed")`
#[derive(Clone)]
#[contracttype]
pub struct EventBatchRefundCompleted {
    pub total_refunded: u32,
    pub batch_size: u32,
}
```

```rust
// contracts/crowdfund/src/types/events/withdrawal.rs
//
//! Withdrawal-family events: withdrawals, streaming, and emergency withdrawals.

use soroban_sdk::{contracttype, Address};

/// Emitted when the creator withdraws funds after a successful campaign.
///
/// Event topic: `("crowdfund", "ipfs_cid_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventWithdrawn {
    pub creator: Address,
    /// Total raised at the time of withdrawal (before fee deduction)
    pub total: i128,
    /// Platform fee deducted (0 if no platform config)
    pub fee: i128,
    /// Net amount transferred to the creator
    pub payout: i128,
    pub schema_version: u32,
}

/// Emitted when an emergency withdrawal is initiated.
///
/// Event topic: `("campaign", "emergency_initiated")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyInitiated {
    pub lock_until: u64,
}

/// Emitted when an emergency withdrawal is executed.
///
/// Event topic: `("campaign", "emergency_executed")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyExecuted {
    pub amount: i128,
}

/// Emitted when an emergency withdrawal approval is submitted by an approver.
///
/// Event topic: `("campaign", "emergency_approved")`
#[derive(Clone)]
#[contracttype]
pub struct EventEmergencyApproved {
    /// Address of the approver who submitted this approval
    pub approver: Address,
    /// Running approval count for the current session after this approval
    pub approval_count: u32,
}

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────

/// Emitted when a stream claim is executed.
///
/// Event topic: `("campaign", "stream_claimed")`
#[derive(Clone)]
#[contracttype]
pub struct EventStreamClaimed {
    pub creator: Address,
    pub amount: i128,
    pub remaining: i128,
    pub schema_version: u32,
}
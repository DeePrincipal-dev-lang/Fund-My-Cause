//! # Fund-My-Cause Crowdfund Contract
//!
//! A Soroban smart contract for decentralised crowdfunding on the Stellar network.
//!
//! ## Overview
//!
//! Each deployed instance of [`CrowdfundContract`] represents a single crowdfunding
//! campaign. The contract lifecycle is:
//!
//! 1. **Initialise** — creator calls [`initialize`](CrowdfundContract::initialize) once.
//! 2. **Contribute** — backers call [`contribute`](CrowdfundContract::contribute) before the deadline.
//! 3. **Withdraw** — if goal is met after deadline, creator calls [`withdraw`](CrowdfundContract::withdraw).
//! 4. **Refund** — if goal is not met (or campaign is cancelled), contributors call
//!    [`refund_single`](CrowdfundContract::refund_single) to reclaim their funds.
//!
//! ## Advanced Features
//!
//! - **Recurring contributions** — [`setup_recurring`](CrowdfundContract::setup_recurring) /
//!   [`execute_recurring`](CrowdfundContract::execute_recurring)
//! - **Delegation** — [`delegate_contribution`](CrowdfundContract::delegate_contribution) /
//!   [`contribute_on_behalf`](CrowdfundContract::contribute_on_behalf)
//! - **Deadline extension voting** — [`propose_extension`](CrowdfundContract::propose_extension) /
//!   [`vote_on_extension`](CrowdfundContract::vote_on_extension) /
//!   [`execute_extension`](CrowdfundContract::execute_extension)
//! - **Whitelist / Blacklist** — [`add_to_whitelist`](CrowdfundContract::add_to_whitelist) /
//!   [`add_to_blacklist`](CrowdfundContract::add_to_blacklist)
//! - **Partial refunds** — [`refund_partial`](CrowdfundContract::refund_partial)
//! - **Emergency withdrawal** — [`initiate_emergency_withdrawal`](CrowdfundContract::initiate_emergency_withdrawal) /
//!   [`execute_emergency_withdrawal`](CrowdfundContract::execute_emergency_withdrawal)
//! - **Insurance** — [`enable_insurance`](CrowdfundContract::enable_insurance)
//! - **Vesting** — configurable cliff + linear vesting on withdrawal
//! - **Matching** — sponsor-funded contribution matching
//!
//! ## Storage Model
//!
//! - **Instance storage** — campaign-wide state (status, goal, deadline, totals).
//! - **Persistent storage** — per-contributor data (balances, plans, flags).
//!
//! ### Initialization invariant (why some `inst.get(&KEY_*).unwrap()` reads are safe)
//!
//! The core campaign keys — `KEY_CREATOR`, `KEY_STATUS`, `KEY_GOAL`, `KEY_DEADLINE`,
//! `KEY_TOKEN`, `KEY_MIN`, `KEY_ADMIN`, `KEY_TOTAL` and friends — are written exactly
//! once by [`initialize`](CrowdfundContract::initialize) and are **never removed**
//! afterwards. Every externally-callable entry point can only run against an
//! already-initialized contract, so reading these keys back is infallible by
//! construction. Such reads use `unwrap()` deliberately; they are the "genuinely
//! infallible" bucket from the unwrap-audit (issue #835) and are documented here in one
//! place rather than annotated at each of the ~120 identical call sites.
//!
//! By contrast, reads whose absence is *reachable* — collection indexing on
//! caller-supplied lengths, optional configuration, or values that may legitimately be
//! unset — return a typed [`ContractError`] via `ok_or(..)?` and never panic.
//!
//! ## Error Handling
//!
//! All mutating functions return `Result<_, ContractError>`. See [`errors::ContractError`]
//! for the full list of error codes.
//!
//! ## Events
//!
//! Every state-changing function publishes a structured event. See the `Event*` types
//! in [`types`] for the full list of event payloads.

#![no_std]
#![allow(clippy::too_many_arguments)]
// The SDK deprecated `Events::publish` in favour of the `#[contractevent]` macro.
// Migrating changes how events are encoded on the wire, so it is a behaviour change
// for every off-chain consumer, not a lint cleanup, and is tracked separately.
#![allow(deprecated)]

use common::math::{proportional, REWARD_DIVISOR};

mod access;
mod analytics;
mod contribute;
mod errors;
mod events;
mod helpers;
mod lifecycle;
mod metadata;
mod recurring;
mod refund;
mod security;
mod storage;
mod types;
mod validation;
mod views;
mod withdraw;

pub use views::CampaignSnapshot;

/// Public `pub fn` wrappers around otherwise `pub(crate)` validation logic,
/// compiled only under the `fuzz` feature so the `contracts/crowdfund/fuzz`
/// harness (see its README section) can drive them directly without
/// widening the normal contract's public API.
#[cfg(feature = "fuzz")]
pub mod fuzz_api {
    use crate::errors::ContractError;
    use crate::validation;

    pub fn validate_initialization(
        goal: i128,
        deadline: u64,
        min_contribution: i128,
        max_contribution: i128,
        platform_fee_bps: Option<u32>,
        current_time: u64,
    ) -> Result<(), ContractError> {
        validation::validate_initialization(
            goal,
            deadline,
            min_contribution,
            max_contribution,
            platform_fee_bps,
            current_time,
        )
    }

    pub fn validate_min_contribution(
        amount: i128,
        min_contribution: i128,
    ) -> Result<(), ContractError> {
        validation::validate_min_contribution(amount, min_contribution)
    }

    pub fn validate_contributor_cap(
        amount: i128,
        max_contribution: i128,
        current_contribution: i128,
    ) -> Result<(), ContractError> {
        validation::validate_contributor_cap(amount, max_contribution, current_contribution)
    }
}

pub use errors::ContractError;
pub use security::{CircuitBreaker, ContributorGate, InputValidator, RateLimiter, ReentrancyGuard};
pub use validation::{
    MAX_RECURRING_EXECUTIONS, MAX_RECURRING_INTERVAL, MIN_RECURRING_INTERVAL,
};

use access::auth_admin;
use helpers::require_auth_creator;
pub use storage::{
    CONTRACT_VERSION,
    KEY_ADMIN,
    KEY_ANALYTICS,
    KEY_ANALYTICS_DATA,
    KEY_ARCHIVED,
    KEY_CATEGORY,
    // #457
    KEY_CONTRACT_VERSION,
    KEY_CONTRIBS,
    KEY_CREATOR,
    KEY_DEADLINE,
    // #459
    KEY_DEBUG_SNAPSHOT,
    KEY_DESC,
    KEY_DISPUTES,
    KEY_DISPUTE_ID,
    KEY_DISPUTE_VOTE,
    KEY_EMERGENCY_PAUSE,
    KEY_GOAL,
    KEY_GOAL_HISTORY,
    // Governance
    KEY_GOVERNANCE_CONFIG,
    KEY_GOVERNANCE_NONCE,
    // #698 Fee Mode
    KEY_GROSS_TOTAL,
    KEY_INSURANCE,
    KEY_INSURANCE_POOL,
    // #699 IPFS CID
    KEY_IPFS_CID,
    // #458
    KEY_LAST_VALIDATION,
    KEY_MAX,
    KEY_META_HIST,
    KEY_MILESTONES,
    KEY_MILESTONE_STATUS,
    KEY_MIN,
    KEY_NEXT_RELEASE,
    // #696 Pause timelock
    KEY_PAUSE_TIMELOCK,
    KEY_PERF_STATS,
    // #460
    KEY_PERF_THRESHOLD,
    KEY_PLATFORM,
    KEY_RATE_LIMIT,
    // #605 Security Hardening
    KEY_REENTRANCY_LOCK,
    // #695 Released amount tracking
    KEY_RELEASED,
    KEY_SOCIAL,
    // #694 Soft-cap / stretch-goal
    KEY_SOFT_CAP,
    KEY_START_TIME,
    KEY_STATUS,
    // #704 Withdrawal streaming
    KEY_STREAM,
    KEY_STRETCH_GOAL,
    KEY_TITLE,
    KEY_TOKEN,
    KEY_TOTAL,
    KEY_UNPAUSE_AFTER,
    KEY_VERIFICATION,
    KEY_VERSION_HISTORY,
    KEY_VESTING,
    KEY_VISIBILITY,
    // DeFi yield
    KEY_YIELD_CONFIG,
    KEY_YIELD_TOTAL,
    MAX_BATCH_REFUND_SIZE,
    MAX_MESSAGE_LENGTH,
    MIN_SUPPORTED_VERSION,
    TTL_INSTANCE_EXTEND_MAX,
    TTL_INSTANCE_EXTEND_MIN,
    TTL_PERSISTENT_ENTRY,
};
pub use types::{
    AnalyticsDataPoint,
    CampaignAnalytics,
    CampaignInfo,
    CampaignStats,
    CampaignTemplate,
    Category,
    // #459
    ContractStateSnapshot,
    // #416
    ContributionHistory,
    DataKey,
    Delegation,
    Dispute,
    DisputeStatus,
    EventAllowlistRemoved,
    // #697 Allow/deny list
    EventAllowlisted,
    EventAnalyticsGenerated,
    EventArchived,
    EventBatchRefundCompleted,
    EventBlacklistRemoved,
    EventBlacklisted,
    // #416
    EventCampaignCloned,
    EventCampaignIndexed,
    EventCancelled,
    // #694 Soft-cap / stretch-goal
    EventCapsConfigured,
    EventCategoryUpdated,
    EventContractMigrated,
    EventContributed,
    // #419
    EventContributionRecorded,
    EventDeadlineExtended,
    EventDebugLog,
    EventDebugSnapshot,
    EventDelegatedContribution,
    EventDelegationCreated,
    EventDelegationRevoked,
    EventDenylistRemoved,
    EventDenylisted,
    EventDisputeFiled,
    EventDisputeResolved,
    EventDisputeVoted,
    EventEmergencyApproved,
    EventEmergencyExecuted,
    EventEmergencyInitiated,
    EventExecutionRecorded,
    EventExtensionExecuted,
    EventExtensionProposed,
    EventExtensionVoted,
    // Issue #420
    EventGoalAdjusted,
    EventGovernanceConfigUpdated,
    EventGovernanceEmergencyPaused,
    EventGovernanceEmergencyResumed,
    EventGovernanceExecuted,
    EventGovernanceProposed,
    EventGovernanceVoted,
    // Event payload types
    EventInitialized,
    EventInsuranceEnabled,
    EventInsurancePayout,
    EventInvariantViolated,
    // #699
    EventIpfsCidUpdated,
    EventMatchingSetup,
    EventMetadataUpdated,
    EventMetadataVersioned,
    EventMilestoneReached,
    EventMilestoneRelease,
    EventMilestoneVerified,
    EventMultiSigConfigured,
    EventOwnershipTransferred,
    EventPartialRefund,
    EventPaused,
    // #696 Pause timelock
    EventPausedWithTimelock,
    EventPerfAlert,
    EventQfContribution,
    EventRateLimitHit,
    EventRateLimitUpdated,
    EventRecurringCancelled,
    EventRecurringExecuted,
    EventRecurringSetup,
    EventRefunded,
    // #417
    EventResumed,
    EventRewardsConfigured,
    EventRewardsDistributed,
    EventStateValidated,
    EventStatusChanged,
    EventStreamClaimed,
    EventTemplateApplied,
    EventTierAssigned,
    EventTiersSet,
    EventVerificationUpdated,
    EventVersionChecked,
    EventVisibilityChanged,
    EventWhitelistOnlySet,
    EventWhitelistRemoved,
    EventWhitelisted,
    EventWithdrawn,
    EventYieldClaimed,
    EventYieldConfigured,
    // #460
    ExecutionRecord,
    ExtensionProposal,
    // #698
    FeeMode,
    FunctionPerfStats,
    GoalAdjustment,
    // Governance
    GovernanceConfig,
    GovernanceProposal,
    InsuranceConfig,
    MatchingConfig,
    // Issue #423
    MetadataVersion,
    FundingMilestone,
    MilestoneStatus,
    // #443
    PerformanceMetrics,
    PlatformConfig,
    // #634 Quadratic-Funding Hooks
    QfContributorInput,
    QfInputs,
    RateLimit,
    RecurringPlan,
    // #418
    RewardConfig,
    RewardTier,
    SearchIndexEntry,
    // #458
    StateValidationResult,
    Status,
    // #704 Withdrawal streaming
    StreamConfig,
    TemplateType,
    VerificationStatus,
    // #457
    VersionMigration,
    VestingSchedule,
    Visibility,
    // DeFi
    YieldConfig,
    YieldInfo,
    // #703 Event schema versioning
    EVENT_SCHEMA_VERSION,
};

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

use crate::validation::{
    validate_address_not_self, validate_category, validate_deadline_extension, validate_fee_bps,
    validate_goal_not_overflow, validate_governance_config, validate_positive_amount,
    validate_refund_eligibility, validate_string_length,
};

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initializes a new crowdfunding campaign.
    ///
    /// Creates a campaign with the specified parameters. Can only be called once per contract instance.
    /// The creator must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `creator` - The campaign creator's Stellar address (must authorize)
    /// * `token` - The token address for contributions (e.g., native XLM or custom token)
    /// * `goal` - The funding goal in stroops (must be > 0)
    /// * `deadline` - Unix timestamp (seconds) when the campaign ends (must be > current ledger time)
    /// * `min_contribution` - Minimum contribution amount in stroops (must be >= 0)
    /// * `title` - Campaign title
    /// * `description` - Campaign description
    /// * `social_links` - Optional list of social media URLs
    /// * `platform_config` - Optional platform fee configuration (address and fee_bps)
    /// * `accepted_tokens` - Optional whitelist of accepted token addresses
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if campaign already initialized
    /// * `Err(ContractError::InvalidGoal)` if goal <= 0
    /// * `Err(ContractError::InvalidDeadline)` if deadline <= current time
    /// * `Err(ContractError::InvalidFee)` if platform fee_bps > 10,000
    ///
    /// # Example
    /// ```ignore
    /// initialize(
    ///     env,
    ///     creator_address,
    ///     token_address,
    ///     1_000_000_000,  // 100 XLM goal
    ///     1704067200,     // deadline timestamp
    ///     1_000_000,      // 0.1 XLM minimum
    ///     String::from_str(&env, "My Campaign"),
    ///     String::from_str(&env, "Help fund my project"),
    ///     None,
    ///     None,
    ///     None,
    /// )
    /// ```
    pub fn initialize(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        min_contribution: i128,
        max_contribution: i128,
        title: String,
        description: String,
        social_links: Option<Vec<String>>,
        platform_config: Option<PlatformConfig>,
        accepted_tokens: Option<Vec<Address>>,
        category: Category,
        vesting: Option<VestingSchedule>,
        penalty_bps: Option<u32>,
    ) -> Result<(), ContractError> {
        lifecycle::initialize(
            env,
            creator,
            token,
            goal,
            deadline,
            min_contribution,
            max_contribution,
            title,
            description,
            social_links,
            platform_config,
            accepted_tokens,
            category,
            vesting,
            penalty_bps,
        )
    }

    /// Submits a contribution to the campaign.
    ///
    /// Allows a contributor to pledge tokens before the campaign deadline.
    /// The contributor must authorize this transaction and have sufficient token balance.
    /// Uses a pull-based refund model: contributors claim refunds individually if the goal is not met.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address (must authorize)
    /// * `amount` - Contribution amount in stroops (must be >= min_contribution)
    /// * `token` - The token address being contributed (must match campaign token or be in whitelist)
    /// * `message` - Optional message/memo attached to the contribution (max 256 chars)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::BelowMinimum)` if amount < min_contribution
    /// * `Err(ContractError::CampaignPaused)` if campaign is paused
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignEnded)` if current time >= deadline
    /// * `Err(ContractError::TokenNotAccepted)` if token not in whitelist
    /// * `Err(ContractError::Overflow)` if total raised would overflow
    /// * `Err(ContractError::MessageTooLong)` if message exceeds 256 characters
    ///
    /// # Side Effects
    /// - Transfers tokens from contributor to contract
    /// - Updates contributor's total contribution amount
    /// - Stores contribution message if provided
    /// - Increments contributor count if this is their first contribution
    /// - Updates largest contribution if applicable
    /// - Stores anonymity flag if anonymous=true
    /// - Publishes "contributed" event
    pub fn contribute(
        env: Env,
        contributor: Address,
        amount: i128,
        token: Address,
        message: Option<String>,
    ) -> Result<(), ContractError> {
        contribute::contribute(env, contributor, amount, token, message)
    }

    /// Withdraws raised funds to the campaign creator after a successful campaign.
    ///
    /// Can only be called after the deadline has passed and the goal has been reached.
    /// The creator must authorize this transaction.
    /// If a platform fee is configured, it is deducted from the total before payout.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignStillActive)` if current time < deadline
    /// * `Err(ContractError::GoalNotReached)` if total_raised < goal
    ///
    /// # Side Effects
    /// - Transfers platform fee to platform address (if configured)
    /// - Transfers remaining funds to creator
    /// - Sets campaign status to Successful
    /// - Resets total_raised to 0
    /// - Publishes "withdrawn" event
    ///
    /// # Platform Fee Calculation
    /// If platform_config is set:
    /// ```ignore
    /// fee = total_raised * platform_fee_bps / 10_000
    /// creator_payout = total_raised - fee
    /// ```
    pub fn withdraw(env: Env) -> Result<(), ContractError> {
        withdraw::withdraw(env)
    }

    /// Configures optional streaming / scheduled withdrawal for the creator.
    ///
    /// Must be called before the campaign deadline.  When a `StreamConfig` is
    /// set, the normal `withdraw()` lump-sum path is blocked; the creator must
    /// use `claim_stream()` instead.
    ///
    /// # Arguments
    /// * `start_time` — Unix timestamp when streaming begins (must be >= current time)
    /// * `end_time`   — Unix timestamp when all funds are fully unlocked (must be > start_time)
    pub fn set_stream_config(
        env: Env,
        start_time: u64,
        end_time: u64,
    ) -> Result<(), ContractError> {
        withdraw::set_stream_config(env, start_time, end_time)
    }

    /// Claims the portion of streamed funds that has unlocked since the last claim.
    ///
    /// After a successful campaign (goal met, deadline passed) and once
    /// `start_time` has been reached, the creator can call this at any time to
    /// pull whatever fraction of the total has vested linearly.
    ///
    /// # Errors
    /// * `StreamNotConfigured`   — no `StreamConfig` set
    /// * `CampaignStillActive`   — deadline not yet passed
    /// * `GoalNotReached`        — total raised < goal
    /// * `StreamNotYetClaimable` — current time is before `start_time`
    /// * `StreamFullyClaimed`    — nothing left to claim
    pub fn claim_stream(env: Env) -> Result<(), ContractError> {
        withdraw::claim_stream(env)
    }

    /// Updates campaign metadata (title, description, social links).
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// Any field can be omitted (None) to leave it unchanged.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `title` - New campaign title (optional)
    /// * `description` - New campaign description (optional)
    /// * `social_links` - New social media links (optional)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Updates specified metadata fields in storage
    /// - Publishes "metadata_updated" event
    pub fn update_metadata(
        env: Env,
        title: Option<String>,
        description: Option<String>,
        social_links: Option<Vec<String>>,
    ) -> Result<(), ContractError> {
        metadata::update_metadata(env, title, description, social_links)
    }

    /// Anchors an IPFS content identifier (CID) on-chain for the campaign.
    ///
    /// The CID must be a valid IPFS v0 (Qm…, 46 chars) or v1 (bafy…, 59+ chars)
    /// identifier.  Only the campaign creator may call this while the campaign
    /// is Active.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not Active
    /// * `Err(ContractError::InvalidInput)` if the CID format is invalid
    pub fn update_ipfs_cid(env: Env, cid: String) -> Result<(), ContractError> {
        metadata::update_ipfs_cid(env, cid)
    }

    /// Returns the stored IPFS CID for this campaign, if one has been set.
    pub fn get_ipfs_cid(env: Env) -> Option<String> {
        metadata::get_ipfs_cid(env)
    }

    /// Extends the campaign deadline to a later time.
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// The new deadline must be strictly greater than the current deadline.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_deadline` - New Unix timestamp (seconds) for campaign end
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current_deadline
    ///
    /// # Side Effects
    /// - Updates deadline in storage
    /// - Publishes "deadline_extended" event with new deadline
    pub fn extend_deadline(env: Env, new_deadline: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        common::AccessControl::require_role_auth(&creator);

        let old_deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        validate_deadline_extension(new_deadline, old_deadline)?;
        inst.set(&KEY_DEADLINE, &new_deadline);
        env.events().publish(
            ("crowdfund", "deadline_extended"),
            EventDeadlineExtended {
                old_deadline,
                new_deadline,
            },
        );
        Ok(())
    }

    // ── Issue #420 — Dynamic Goal Adjustment ─────────────────────────────────

    /// Adjusts the campaign funding goal mid-campaign.
    ///
    /// Allows the creator to raise or lower the goal while the campaign is
    /// still active.  Every adjustment is appended to the persistent goal
    /// history so the full audit trail is always available via
    /// [`get_goal_history`](CrowdfundContract::get_goal_history).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_goal` - New funding goal in stroops (must be > 0)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::InvalidGoal)` if `new_goal` <= 0
    /// * `Err(ContractError::GoalOverflow)` if `new_goal` is dangerously large
    ///
    /// # Side Effects
    /// - Updates `KEY_GOAL` in instance storage
    /// - Appends a [`GoalAdjustment`] entry to persistent `KEY_GOAL_HISTORY`
    /// - Publishes `("crowdfund", "goal_adjusted")` event
    pub fn adjust_goal(env: Env, new_goal: i128) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        common::AccessControl::require_role_auth(&creator);

        if new_goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        validate_goal_not_overflow(new_goal)?;

        let previous_goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        inst.set(&KEY_GOAL, &new_goal);

        let now = env.ledger().timestamp();
        let mut history: Vec<GoalAdjustment> = env
            .storage()
            .persistent()
            .get(&KEY_GOAL_HISTORY)
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(GoalAdjustment {
            previous_goal,
            new_goal,
            timestamp: now,
        });
        env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);
        env.storage().persistent().extend_ttl(
            &KEY_GOAL_HISTORY,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        inst.extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);

        env.events().publish(
            ("crowdfund", "goal_adjusted"),
            EventGoalAdjusted {
                previous_goal,
                new_goal,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Cancels the campaign, allowing all contributors to claim refunds.
    ///
    /// Can only be called while the campaign is in Active or Paused status.
    /// The creator must authorize this transaction.
    /// After cancellation, contributors can call `refund_single` or `refund_batch`
    /// to reclaim their tokens at any time, regardless of the deadline.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is already Cancelled, Successful,
    ///   or Refunded
    ///
    /// # Side Effects
    /// - Sets campaign status to `Cancelled`
    /// - Publishes structured `EventCancelled` event with creator and total raised
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("crowdfund", "cancelled")      → EventCancelled { creator, total_raised }
    /// ("crowdfund", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn cancel_campaign(env: Env) -> Result<(), ContractError> {
        lifecycle::cancel_campaign(env)
    }

    /// Archives a completed campaign for historical reference.
    ///
    /// Can only be called on campaigns in `Successful`, `Cancelled`, or `Refunded`
    /// status. The creator must authorize this transaction.
    /// Archiving marks the campaign as `Archived` and records the timestamp.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is Active or Paused (not yet completed)
    ///
    /// # Side Effects
    /// - Sets campaign status to `Archived`
    /// - Stores archival timestamp in instance storage
    /// - Publishes `("crowdfund", "archived")` event
    pub fn archive(env: Env) -> Result<(), ContractError> {
        lifecycle::archive(env)
    }

    /// Returns whether this campaign has been archived.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// `true` if the campaign status is `Archived`, `false` otherwise
    pub fn is_archived(env: Env) -> bool {
        lifecycle::is_archived(env)
    }

    /// Returns the archival timestamp if the campaign has been archived.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// `Some(timestamp)` if archived, `None` otherwise
    pub fn get_archived_at(env: Env) -> Option<u64> {
        lifecycle::get_archived_at(env)
    }

    /// Claims a refund for a single contributor (pull-based refund model).
    ///
    /// A contributor can claim their refund if:
    /// - The campaign was cancelled, OR
    /// - The deadline has passed AND the goal was not reached
    ///
    /// This implements a pull-based refund model where each contributor individually
    /// claims their refund, avoiding the gas cost and failure risk of a single
    /// transaction refunding all contributors.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address claiming the refund
    ///
    /// # Returns
    /// * `Ok(())` on success (even if contributor has no refund)
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    ///
    /// # Side Effects
    /// - Transfers refund amount to contributor (if > 0)
    /// - Sets contributor's contribution to 0
    /// - Publishes "refunded" event
    pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
        refund::refund_single(env, contributor)
    }

    /// Refunds multiple contributors in a single transaction (batch refund).
    ///
    /// Processes refunds for a list of contributors. Stops early if the batch
    /// limit is reached to avoid exceeding resource limits.
    /// Each contributor is only refunded if eligible (same conditions as `refund_single`).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributors` - List of contributor addresses to refund
    ///
    /// # Returns
    /// * `Ok(u32)` - Number of contributors successfully refunded
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    pub fn refund_batch(env: Env, contributors: Vec<Address>) -> Result<u32, ContractError> {
        refund::refund_batch(env, contributors)
    }

    /// Sets the per-address contribution rate limit (admin only).
    ///
    /// Configures the maximum amount a single address can contribute within a
    /// rolling window of `window_seconds`. Passing `max_amount = 0` clears the
    /// rate limit (and the window value is then ignored).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `max_amount` - Maximum contribution amount per address per window (0 = disabled)
    /// * `window_seconds` - Length of the per-address window in seconds (must be > 0 when enabling)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRateLimit)` if `max_amount < 0`, or if enabling
    ///   the limit with `window_seconds == 0`
    ///
    /// # Side Effects
    /// - Updates or clears the stored rate limit configuration
    /// - Publishes a "rate_limit_updated" event
    pub fn set_rate_limit(
        env: Env,
        max_amount: i128,
        window_seconds: u64,
    ) -> Result<(), ContractError> {
        access::set_rate_limit(env, max_amount, window_seconds)
    }

    /// Returns the current per-address rate limit configuration, if any.
    pub fn get_rate_limit(env: Env) -> Option<RateLimit> {
        access::get_rate_limit(env)
    }

    /// Initiates an emergency withdrawal (admin only).
    ///
    /// Starts a time-locked emergency withdrawal process. After the lock period expires,
    /// the admin can call `execute_emergency_withdrawal()` to recover funds.
    /// This requires admin authorization and can be cancelled before execution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `lock_period` - Time in seconds to lock the withdrawal (e.g., 604800 for 7 days)
    ///
    /// # Returns
    /// * `Ok(())` on success
    ///
    /// # Side Effects
    /// - Sets emergency lock time to current time + lock_period
    /// - Publishes "EmergencyWithdrawalInitiated" event
    pub fn initiate_emergency_withdrawal(env: Env, lock_period: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;
        let lock_until = env.ledger().timestamp() + lock_period;
        inst.set(&DataKey::EmergencyLockTime, &lock_until);
        // Reset multi-sig approval count for the new session so previous approvals
        // from an older initiation cannot carry over.
        inst.set(&DataKey::EmergencyApprovalCount, &0u32);
        env.events().publish(
            ("crowdfund", "emergency_initiated"),
            EventEmergencyInitiated { lock_until },
        );
        Ok(())
    }

    /// Executes the emergency withdrawal (admin only).
    ///
    /// Transfers all funds to the admin after the lock period has expired.
    /// Can only be called after the time-lock delay has passed.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::EmergencyLocked)` if lock period has not expired
    ///
    /// # Side Effects
    /// - Transfers all funds to admin
    /// - Clears emergency lock time
    /// - Publishes "EmergencyWithdrawalExecuted" event
    pub fn execute_emergency_withdrawal(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let admin = auth_admin(&env)?;

        let lock_time: u64 = inst.get(&DataKey::EmergencyLockTime).unwrap_or(0);
        if lock_time == 0 || env.ledger().timestamp() < lock_time {
            return Err(ContractError::EmergencyLocked);
        }

        // ── Multi-sig check: if a minimum approval count is configured, verify it ─
        let required: u32 = inst.get(&DataKey::EmergencyApproversRequired).unwrap_or(0);
        if required > 0 {
            let count: u32 = inst.get(&DataKey::EmergencyApprovalCount).unwrap_or(0);
            if count < required {
                return Err(ContractError::MultiSigNotMet);
            }
        }

        let total: i128 = inst.get(&KEY_TOTAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if total > 0 {
            let token_address: Address = inst.get(&KEY_TOKEN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
            token::Client::new(&env, &token_address).transfer(
                &env.current_contract_address(),
                &admin,
                &total,
            );
            inst.set(&KEY_TOTAL, &0i128);
        }

        inst.set(&DataKey::EmergencyLockTime, &0u64);
        env.events().publish(
            ("crowdfund", "emergency_executed"),
            EventEmergencyExecuted { amount: total },
        );
        Ok(())
    }

    /// Cancels a pending emergency withdrawal (admin only).
    ///
    /// Removes the emergency lock, preventing the withdrawal from being executed.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    ///
    /// # Side Effects
    /// - Clears emergency lock time
    /// - Publishes "EmergencyWithdrawalCancelled" event
    pub fn cancel_emergency_withdrawal(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;
        inst.set(&DataKey::EmergencyLockTime, &0u64);
        env.events()
            .publish(("crowdfund", "emergency_cancelled"), ());
        Ok(())
    }

    // === Emergency Multi-Sig Functions

    /// Configures multi-sig approval requirements for emergency withdrawals (admin only).
    ///
    /// Sets the minimum number of approvals required from a pre-defined list of
    /// approvers before `execute_emergency_withdrawal` can succeed.
    /// If multi-sig is not configured (default), the admin-only timelock model remains.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `required_approvals` - Minimum number of approvals (must be 1–approvers.len())
    /// * `approvers` - List of authorized approver addresses
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if required_approvals is invalid
    pub fn setup_emergency_multisig(
        env: Env,
        required_approvals: u32,
        approvers: Vec<Address>,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;

        // required_approvals must be between 1 and the total number of approvers
        if required_approvals == 0 || required_approvals > approvers.len() {
            return Err(ContractError::Unauthorized);
        }

        let approver_count = approvers.len();
        inst.set(&DataKey::EmergencyApproversRequired, &required_approvals);
        env.storage()
            .persistent()
            .set(&DataKey::EmergencyApproversList, &approvers);
        env.storage().persistent().extend_ttl(
            &DataKey::EmergencyApproversList,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "multisig_configured"),
            EventMultiSigConfigured {
                required_approvals,
                approver_count,
            },
        );
        Ok(())
    }

    /// Submits an approval for the active emergency withdrawal (approver only).
    ///
    /// Each authorised approver calls this once per initiated emergency session.
    /// The call is idempotent — a second call from the same approver in the same
    /// session is a silent no-op to avoid double-counting.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `approver` - Approver address (must be in the authorised list and must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success (including idempotent re-call)
    /// * `Err(ContractError::EmergencyLocked)` if no emergency has been initiated
    /// * `Err(ContractError::Unauthorized)` if multi-sig is not configured or approver
    ///   is not in the authorised list
    pub fn approve_emergency_withdrawal(env: Env, approver: Address) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&approver);

        let inst = env.storage().instance();

        // An emergency must have been initiated
        let lock_until: u64 = inst.get(&DataKey::EmergencyLockTime).unwrap_or(0);
        if lock_until == 0 {
            return Err(ContractError::EmergencyLocked);
        }

        // Multi-sig must be configured
        let required: u32 = inst.get(&DataKey::EmergencyApproversRequired).unwrap_or(0);
        if required == 0 {
            return Err(ContractError::Unauthorized);
        }

        // Approver must be in the authorised list
        let approvers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::EmergencyApproversList)
            .unwrap_or_else(|| Vec::new(&env));
        if !approvers.contains(&approver) {
            return Err(ContractError::Unauthorized);
        }

        // Idempotency guard: the stored value is the lock_until of the session they
        // last approved.  A matching value means they already voted this session.
        let last_approved: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::EmergencyApproval(approver.clone()))
            .unwrap_or(0);
        if last_approved == lock_until {
            // Already approved this session — idempotent no-op
            return Ok(());
        }

        // Record approval for this session
        env.storage()
            .persistent()
            .set(&DataKey::EmergencyApproval(approver.clone()), &lock_until);
        env.storage().persistent().extend_ttl(
            &DataKey::EmergencyApproval(approver.clone()),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        let count: u32 = inst.get(&DataKey::EmergencyApprovalCount).unwrap_or(0);
        let new_count = count.checked_add(1).ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::EmergencyApprovalCount, &new_count);

        env.events().publish(
            ("crowdfund", "emergency_approved"),
            EventEmergencyApproved {
                approver,
                approval_count: new_count,
            },
        );
        Ok(())
    }

    // ── Template Functions (extended) ─────────────────────────────────────────

    /// Initialises a new campaign from a pre-configured template.
    ///
    /// Works like [`initialize`](CrowdfundContract::initialize) but derives
    /// `min_contribution` from `template.suggested_min` and the campaign category
    /// from the template type.  The template is stored on-chain for future reference.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `creator` - Campaign creator address (must authorize)
    /// * `token` - Contribution token address
    /// * `goal` - Funding goal in stroops (must be > 0)
    /// * `deadline` - Campaign end timestamp
    /// * `max_contribution` - Per-contributor maximum (0 = no limit)
    /// * `title` - Campaign title (max 64 chars)
    /// * `description` - Campaign description (max 512 chars)
    /// * `template` - Template providing suggested_min and template_type
    /// * `social_links` - Optional social media URLs
    /// * `platform_config` - Optional platform fee configuration
    /// * `accepted_tokens` - Optional whitelist of accepted tokens
    /// * `vesting` - Optional vesting schedule
    /// * `penalty_bps` - Optional early-withdrawal penalty in basis points
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if already initialised
    /// * `Err(ContractError::InvalidTemplate)` if template.goal_multiplier is 0
    pub fn initialize_from_template(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        max_contribution: i128,
        title: String,
        description: String,
        template: CampaignTemplate,
        social_links: Option<Vec<String>>,
        platform_config: Option<PlatformConfig>,
        accepted_tokens: Option<Vec<Address>>,
        vesting: Option<VestingSchedule>,
        penalty_bps: Option<u32>,
    ) -> Result<(), ContractError> {
        lifecycle::initialize_from_template(
            env,
            creator,
            token,
            goal,
            deadline,
            max_contribution,
            title,
            description,
            template,
            social_links,
            platform_config,
            accepted_tokens,
            vesting,
            penalty_bps,
        )
    }

    // ── Matching Functions ────────────────────────────────────────────────────

    /// Configures a sponsor-funded contribution matching pool (creator only).
    ///
    /// When matching is active, every qualifying contribution is topped up by the
    /// sponsor at a rate of `match_ratio` basis points, capped at `max_match` total.
    /// Matching is applied automatically inside `contribute`.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `sponsor` - Address of the sponsor funding the match
    /// * `match_ratio` - Match rate in basis points (e.g. 10 000 = 1 : 1, max 10 000)
    /// * `max_match` - Maximum total matching in stroops (must be > 0)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidFee)` if match_ratio > 10 000
    /// * `Err(ContractError::AmountNotPositive)` if max_match ≤ 0
    pub fn setup_matching(
        env: Env,
        sponsor: Address,
        match_ratio: u32,
        max_match: i128,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        require_auth_creator(&env)?;

        if match_ratio > 10_000 {
            return Err(ContractError::InvalidFee);
        }
        if max_match <= 0 {
            return Err(ContractError::AmountNotPositive);
        }

        // Require campaign to be Active before accepting sponsor escrow
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        // ── Escrow matching funds from sponsor into the contract ──────────────
        common::AccessControl::require_role_auth(&sponsor);
        let token_address: Address = inst.get(&KEY_TOKEN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        token::Client::new(&env, &token_address).transfer(
            &sponsor,
            env.current_contract_address(),
            &max_match,
        );

        let config = MatchingConfig {
            sponsor: sponsor.clone(),
            match_ratio,
            max_match,
        };

        inst.set(&DataKey::MatchingConfig, &config);
        inst.set(&DataKey::TotalMatched, &0i128);
        inst.set(&DataKey::MatchingPool, &max_match);

        env.events().publish(
            ("crowdfund", "matching_setup"),
            EventMatchingSetup {
                sponsor,
                match_ratio,
                max_match,
            },
        );
        Ok(())
    }

    /// Returns the active matching configuration, if any.
    pub fn get_matching_config(env: Env) -> Option<MatchingConfig> {
        env.storage().instance().get(&DataKey::MatchingConfig)
    }

    /// Returns the total amount matched by the sponsor so far.
    pub fn get_total_matched(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalMatched)
            .unwrap_or(0)
    }

    /// Returns the remaining unspent balance in the matching pool.
    pub fn get_matching_pool(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MatchingPool)
            .unwrap_or(0)
    }

    /// Refunds any unspent matching funds back to the sponsor.
    ///
    /// Can only be called after the campaign has ended (Successful, Cancelled,
    /// or Refunded status). The creator or sponsor may trigger this.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if the campaign is still Active
    pub fn refund_matching_sponsor(env: Env) -> Result<(), ContractError> {
        refund::refund_matching_sponsor(env)
    }

    // ── Category Functions ────────────────────────────────────────────────────

    /// Updates the campaign category (creator only, Active campaigns only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `category` - New campaign category
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not Active
    pub fn update_category(env: Env, category: Category) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        validate_category(&category)?;
        let creator: Address = inst.get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        common::AccessControl::require_role_auth(&creator);

        let old_category: Category = inst.get(&KEY_CATEGORY).unwrap_or(Category::Other);
        inst.set(&KEY_CATEGORY, &category);

        env.events().publish(
            ("crowdfund", "category_updated"),
            EventCategoryUpdated {
                old_category,
                new_category: category,
            },
        );
        Ok(())
    }

    // ── pause / unpause (admin) ───────────────────────────────────────────────

    /// Verify campaign (admin only).
    ///
    /// Can only be called while the campaign is in Active status.
    /// The admin (creator) must authorize this transaction.
    /// While paused, `contribute` calls are rejected with `CampaignPaused`.
    /// The campaign can be resumed with [`resume`](CrowdfundContract::resume)
    /// (or the legacy [`unpause`](CrowdfundContract::unpause)).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Sets campaign status to `Paused`
    /// - Publishes structured `EventPaused` event
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("crowdfund", "paused")         → EventPaused { timestamp }
    /// ("crowdfund", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn pause(env: Env) -> Result<(), ContractError> {
        access::pause(env)
    }

    /// Resumes a paused campaign, allowing contributions again.
    ///
    /// Can only be called while the campaign is in Paused status.
    /// The admin (creator) must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Paused status
    ///
    /// # Side Effects
    /// - Sets campaign status to `Active`
    /// - Publishes structured `EventResumed` event
    /// - Publishes `EventStatusChanged` event
    ///
    /// # Events
    /// ```ignore
    /// ("crowdfund", "resumed")        → EventResumed { timestamp }
    /// ("crowdfund", "status_changed") → EventStatusChanged { old_status, new_status }
    /// ```
    pub fn resume(env: Env) -> Result<(), ContractError> {
        access::resume(env)
    }

    /// Resumes a paused campaign (legacy alias for [`resume`](CrowdfundContract::resume)).
    ///
    /// Prefer `resume()` in new integrations; this function is kept for backward
    /// compatibility with existing callers.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Paused status
    pub fn unpause(env: Env) -> Result<(), ContractError> {
        access::unpause(env)
    }

    /// Sets up a recurring contribution plan for a contributor.
    ///
    /// Allows a contributor to schedule automatic contributions at regular intervals.
    /// The contributor must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address (must authorize)
    /// * `amount` - Amount to contribute each interval in stroops
    /// * `interval` - Interval in seconds between contributions
    /// * `end_date` - Unix timestamp when recurring contributions should stop
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRecurringPlan)` if parameters are invalid
    ///
    /// # Side Effects
    /// - Stores recurring plan in persistent storage
    /// - Publishes "recurring_setup" event
    pub fn setup_recurring(
        env: Env,
        contributor: Address,
        amount: i128,
        interval: u64,
        end_date: u64,
    ) -> Result<(), ContractError> {
        recurring::setup(&env, contributor, amount, interval, end_date)
    }

    /// Executes pending recurring contributions for a contributor.
    ///
    /// Can be called by anyone to trigger scheduled contributions.
    /// Only executes if the interval has passed since last execution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidRecurringPlan)` if no plan exists or plan expired
    pub fn execute_recurring(env: Env, contributor: Address) -> Result<(), ContractError> {
        recurring::execute(&env, contributor)
    }

    /// Cancels a recurring contribution plan.
    ///
    /// The contributor must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn cancel_recurring(env: Env, contributor: Address) -> Result<(), ContractError> {
        recurring::cancel(&env, contributor)
    }

    /// Proposes a deadline extension and initiates voting.
    ///
    /// Only the creator can propose extensions. Voting period is 7 days.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_deadline` - Proposed new deadline (Unix timestamp)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current_deadline
    pub fn propose_extension(env: Env, new_deadline: u64) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator = require_auth_creator(&env)?;

        let current_deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        validate_deadline_extension(new_deadline, current_deadline)?;

        let now = env.ledger().timestamp();
        let voting_ends_at = now + 604800; // 7 days
        let proposal = ExtensionProposal {
            new_deadline,
            votes_for: 0,
            votes_against: 0,
            created_at: now,
            voting_ends_at,
            executed: false,
        };

        inst.set(&DataKey::ExtensionProposal, &proposal);
        env.events().publish(
            ("crowdfund", "extension_proposed"),
            EventExtensionProposed {
                new_deadline,
                voting_ends_at,
            },
        );
        Ok(())
    }

    /// Votes on a pending deadline extension.
    ///
    /// Contributors vote with weight equal to their contribution amount.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    /// * `approve` - true to vote for, false to vote against
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::VotingEnded)` if voting period has ended
    pub fn vote_on_extension(
        env: Env,
        contributor: Address,
        approve: bool,
    ) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&contributor);

        let inst = env.storage().instance();
        let mut proposal: ExtensionProposal = inst
            .get(&DataKey::ExtensionProposal)
            .ok_or(ContractError::ProposalNotFound)?;

        if env.ledger().timestamp() > proposal.voting_ends_at {
            return Err(ContractError::VotingEnded);
        }

        // Double-vote prevention: store the proposal's `created_at` as the
        // vote marker so a fresh proposal (different created_at) is treated as
        // a fresh ballot and stale markers from prior proposals don't block it.
        let vote_key = DataKey::ExtensionVote(contributor.clone());
        let last_voted: u64 = inst.get(&vote_key).unwrap_or(0);
        if last_voted == proposal.created_at {
            return Err(ContractError::AlreadyVoted);
        }

        let vote_weight: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);

        if approve {
            proposal.votes_for = proposal
                .votes_for
                .checked_add(vote_weight)
                .ok_or(ContractError::Overflow)?;
        } else {
            proposal.votes_against = proposal
                .votes_against
                .checked_add(vote_weight)
                .ok_or(ContractError::Overflow)?;
        }

        inst.set(&DataKey::ExtensionProposal, &proposal);
        inst.set(&vote_key, &proposal.created_at);

        env.events().publish(
            ("crowdfund", "extension_voted"),
            EventExtensionVoted {
                contributor,
                approve,
                vote_weight,
            },
        );
        Ok(())
    }

    /// Executes a deadline extension if voting threshold is met.
    ///
    /// Requires >50% of votes to be in favor. Can only be called after voting period ends.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn execute_extension(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let mut proposal: ExtensionProposal = inst
            .get(&DataKey::ExtensionProposal)
            .ok_or(ContractError::InvalidRecurringPlan)?;

        if env.ledger().timestamp() <= proposal.voting_ends_at {
            return Err(ContractError::VotingEnded);
        }

        if proposal.executed {
            return Ok(());
        }

        let total_votes = proposal
            .votes_for
            .checked_add(proposal.votes_against)
            .ok_or(ContractError::Overflow)?;
        if total_votes > 0 && (proposal.votes_for as u64) * 2 > total_votes as u64 {
            inst.set(&KEY_DEADLINE, &proposal.new_deadline);
            env.events().publish(
                ("crowdfund", "extension_executed"),
                EventExtensionExecuted {
                    new_deadline: proposal.new_deadline,
                    votes_for: proposal.votes_for,
                    votes_against: proposal.votes_against,
                },
            );
        }

        proposal.executed = true;
        inst.set(&DataKey::ExtensionProposal, &proposal);
        Ok(())
    }

    /// Allows a contributor to request a partial refund before campaign ends.
    ///
    /// Limited to 50% of original contribution. Contributor must authorize.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    /// * `amount` - Amount to refund in stroops
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::RefundLimitExceeded)` if amount > 50% of contribution
    pub fn refund_partial(
        env: Env,
        contributor: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        refund::refund_partial(env, contributor, amount)
    }

    // ── Whitelist/Blacklist Functions ─────────────────────────────────────────

    /// Adds an address to the whitelist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to whitelist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn add_to_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
        access::add_to_whitelist(env, address)
    }

    /// Removes an address from the whitelist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to remove from whitelist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn remove_from_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
        access::remove_from_whitelist(env, address)
    }

    /// Adds an address to the blacklist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to blacklist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn add_to_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
        access::add_to_blacklist(env, address)
    }

    /// Removes an address from the blacklist (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to remove from blacklist
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn remove_from_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
        access::remove_from_blacklist(env, address)
    }

    /// Enables whitelist-only mode (creator only).
    ///
    /// When enabled, only whitelisted addresses can contribute.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `enabled` - true to enable, false to disable
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn set_whitelist_only(env: Env, enabled: bool) -> Result<(), ContractError> {
        access::set_whitelist_only(env, enabled)
    }

    /// Checks if an address is whitelisted.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to check
    ///
    /// # Returns
    /// true if whitelisted, false otherwise
    pub fn is_whitelisted(env: Env, address: Address) -> bool {
        access::is_whitelisted(env, address)
    }

    /// Checks if an address is blacklisted.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - Address to check
    ///
    /// # Returns
    /// true if blacklisted, false otherwise
    pub fn is_blacklisted(env: Env, address: Address) -> bool {
        access::is_blacklisted(env, address)
    }

    // ── Visibility Controls ───────────────────────────────────────────────────

    /// Sets the campaign visibility level (creator only).
    ///
    /// `Public` and `Unlisted` allow anyone to contribute; `Private` restricts
    /// contributions to whitelisted addresses (orthogonal to the legacy
    /// `whitelist_only` flag — either being on requires the contributor to be
    /// whitelisted). The `Unlisted` variant signals that the campaign should
    /// not appear in public discovery feeds but does not restrict contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `visibility` - New visibility level
    pub fn set_visibility(env: Env, visibility: Visibility) -> Result<(), ContractError> {
        access::set_visibility(env, visibility)
    }

    /// Returns the campaign's current visibility level.
    pub fn get_visibility(env: Env) -> Visibility {
        access::get_visibility(env)
    }

    /// Transfers campaign ownership to a new address (creator only).
    ///
    /// Updates both the creator and admin to `new_owner`. The current creator
    /// must authorize this transaction. The new owner cannot be the same as
    /// the current owner.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if `new_owner` equals current creator
    pub fn transfer_ownership(env: Env, new_owner: Address) -> Result<(), ContractError> {
        access::transfer_ownership(env, new_owner)
    }

    // ── Delegation Functions ──────────────────────────────────────────────────

    /// Delegates contribution authority to another address (delegator must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The address delegating authority (must authorize)
    /// * `delegate` - The address receiving delegation authority
    /// * `amount` - Maximum amount the delegate can contribute on behalf of delegator
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn delegate_contribution(
        env: Env,
        delegator: Address,
        delegate: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        contribute::delegate_contribution(env, delegator, delegate, amount)
    }

    /// Contributes on behalf of a delegator (delegate must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The address on whose behalf the contribution is made
    /// * `delegate` - The delegate address (must authorize)
    /// * `amount` - Contribution amount in stroops
    /// * `token` - Token address
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn contribute_on_behalf(
        env: Env,
        delegator: Address,
        delegate: Address,
        amount: i128,
        token: Address,
    ) -> Result<(), ContractError> {
        contribute::contribute_on_behalf(env, delegator, delegate, amount, token)
    }

    /// Revokes a delegation (delegator must authorize).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The delegator address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn revoke_delegation(env: Env, delegator: Address) -> Result<(), ContractError> {
        contribute::revoke_delegation(env, delegator)
    }

    /// Gets delegation info for an address.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `delegator` - The delegator address
    ///
    /// # Returns
    /// Optional Delegation info
    pub fn get_delegation(env: Env, delegator: Address) -> Option<Delegation> {
        contribute::get_delegation(env, delegator)
    }

    // ── Template Functions ────────────────────────────────────────────────────

    /// Sets a campaign template (creator only).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `template_type` - The template type
    /// * `name` - Template name
    /// * `description` - Template description
    /// * `suggested_min` - Suggested minimum contribution
    /// * `goal_multiplier` - Goal multiplier in basis points
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn set_template(
        env: Env,
        template_type: TemplateType,
        name: String,
        description: String,
        suggested_min: i128,
        goal_multiplier: u32,
    ) -> Result<(), ContractError> {
        require_auth_creator(&env)?;

        validate_string_length(&name, 64)?;
        validate_string_length(&description, 512)?;

        let template = CampaignTemplate {
            template_type,
            name,
            description,
            suggested_min,
            goal_multiplier,
        };

        env.storage().instance().set(&DataKey::Template, &template);
        env.events().publish(("crowdfund", "template_set"), ());
        Ok(())
    }

    /// Gets the campaign template.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional CampaignTemplate
    pub fn get_template(env: Env) -> Option<CampaignTemplate> {
        env.storage().instance().get(&DataKey::Template)
    }

    // ── Issue #418: Reward Tier Functions ─────────────────────────────────────

    /// Configures reward tiers for the campaign (creator only).
    ///
    /// Tiers must be provided sorted by `min_amount` in **ascending** order.
    /// The contract validates this ordering and rejects unsorted lists.
    /// Up to 10 tiers are supported.
    ///
    /// When a contributor's cumulative total reaches a tier's `min_amount`,
    /// that tier is automatically assigned to them by [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`   - The Soroban environment
    /// * `tiers` - Ordered list of `RewardTier` values (ascending `min_amount`)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not the creator
    /// * `Err(ContractError::InvalidGoal)` if tiers are not sorted or list is empty
    ///
    /// # Side Effects
    /// - Stores tier list in instance storage
    /// - Publishes `EventTiersSet` event
    pub fn set_reward_tiers(env: Env, tiers: Vec<RewardTier>) -> Result<(), ContractError> {
        require_auth_creator(&env)?;

        if tiers.is_empty() {
            return Err(ContractError::InvalidGoal);
        }

        // Validate ascending sort order and positive min_amounts
        let mut prev_min = 0i128;
        for tier in tiers.iter() {
            if tier.min_amount <= 0 || tier.min_amount <= prev_min {
                return Err(ContractError::InvalidGoal);
            }
            prev_min = tier.min_amount;
        }

        let tier_count = tiers.len();
        env.storage().instance().set(&DataKey::RewardTiers, &tiers);
        env.events()
            .publish(("crowdfund", "tiers_set"), EventTiersSet { tier_count });
        Ok(())
    }

    /// Returns the highest reward tier a given amount qualifies for.
    ///
    /// Iterates the configured tiers (ascending) and returns the last one whose
    /// `min_amount` is ≤ `amount`.  Returns `None` if no tiers are configured or
    /// `amount` is below all thresholds.
    ///
    /// # Arguments
    /// * `env`    - The Soroban environment
    /// * `amount` - Cumulative contribution amount to evaluate (in stroops)
    ///
    /// # Returns
    /// * `Some(RewardTier)` — the best qualifying tier
    /// * `None` — no tiers are configured or amount is below all thresholds
    pub fn get_tier_for_amount(env: Env, amount: i128) -> Option<RewardTier> {
        let tiers: Vec<RewardTier> = env
            .storage()
            .instance()
            .get(&DataKey::RewardTiers)
            .unwrap_or_else(|| Vec::new(&env));

        let mut best: Option<RewardTier> = None;
        for tier in tiers.iter() {
            if amount >= tier.min_amount {
                best = Some(tier);
            } else {
                break;
            }
        }
        best
    }

    /// Returns the reward tier currently assigned to a contributor.
    ///
    /// The assignment is updated automatically every time the contributor calls
    /// [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`         - The Soroban environment
    /// * `contributor` - Address to query
    ///
    /// # Returns
    /// * `Some(RewardTier)` — current tier
    /// * `None` — contributor has no tier (no tiers configured, or amount below minimum)
    pub fn get_contributor_tier(env: Env, contributor: Address) -> Option<RewardTier> {
        env.storage()
            .persistent()
            .get(&DataKey::ContributorTier(contributor))
    }

    // ── Issue #419: Contribution History Functions ────────────────────────────

    /// Returns the full contribution history for a contributor.
    ///
    /// Each entry is a [`ContributionHistory`] capturing the amount, ledger
    /// timestamp, and running total at the time of the contribution.  Records
    /// are appended chronologically by [`contribute`](CrowdfundContract::contribute).
    ///
    /// # Arguments
    /// * `env`         - The Soroban environment
    /// * `contributor` - Address whose history to retrieve
    ///
    /// # Returns
    /// Ordered `Vec<ContributionHistory>` — empty if the address has never contributed
    pub fn get_contribution_history(env: Env, contributor: Address) -> Vec<ContributionHistory> {
        views::get_contribution_history(env, contributor)
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns the total amount raised so far in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Total raised amount (i128), or 0 if not yet initialized
    pub fn total_raised(env: Env) -> i128 {
        views::total_raised(env)
    }

    /// Returns the campaign creator's Stellar address.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Creator's address
    pub fn creator(env: Env) -> Address {
        views::creator(env)
    }

    /// Returns the current campaign status.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Current Status (Active, Successful, Refunded, Cancelled, or Paused)
    pub fn status(env: Env) -> Status {
        views::status(env)
    }

    /// Returns the campaign funding goal in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Goal amount (i128)
    pub fn goal(env: Env) -> i128 {
        views::goal(env)
    }

    /// Returns the campaign deadline as a Unix timestamp (seconds).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Deadline timestamp (u64)
    pub fn deadline(env: Env) -> u64 {
        views::deadline(env)
    }

    /// Returns the total contribution amount for a specific contributor in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address
    ///
    /// # Returns
    /// Total contribution amount (i128), or 0 if no contributions
    pub fn contribution(env: Env, contributor: Address) -> i128 {
        views::contribution(env, contributor)
    }

    /// Checks if an address has made any contributions to the campaign.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - The address to check
    ///
    /// # Returns
    /// true if the address has contributed, false otherwise
    pub fn is_contributor(env: Env, address: Address) -> bool {
        views::is_contributor(env, address)
    }

    /// Returns the minimum contribution amount in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Minimum contribution amount (i128)
    pub fn min_contribution(env: Env) -> i128 {
        views::min_contribution(env)
    }

    /// Returns the maximum contribution amount per contributor in stroops (0 = no limit).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Maximum contribution amount (i128), or 0 if no limit is set
    pub fn max_contribution(env: Env) -> i128 {
        views::max_contribution(env)
    }

    /// Returns the campaign title.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign title string
    pub fn title(env: Env) -> String {
        views::title(env)
    }

    /// Returns the campaign description.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign description string
    pub fn description(env: Env) -> String {
        views::description(env)
    }

    /// Returns the campaign's social media links.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of social media URLs
    pub fn social_links(env: Env) -> Vec<String> {
        views::social_links(env)
    }

    /// Returns the list of accepted token addresses (whitelist).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of accepted token addresses, or a single-element list with the
    /// primary token when no explicit whitelist is configured.
    pub fn accepted_tokens(env: Env) -> Vec<Address> {
        views::accepted_tokens(env)
    }

    /// Returns the platform fee configuration (if set).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional PlatformConfig containing address and fee_bps
    pub fn platform_config(env: Env) -> Option<PlatformConfig> {
        views::platform_config(env)
    }

    /// Returns the current fee mode (`OnSuccess` or `OnContribution`), defaulting
    /// to `OnSuccess` when no platform config is set.
    pub fn get_fee_mode(env: Env) -> FeeMode {
        views::get_fee_mode(env)
    }

    /// Returns the contract version number.
    ///
    /// # Arguments
    /// * `_env` - The Soroban environment (unused)
    ///
    /// # Returns
    /// Contract version (u32)
    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Returns comprehensive campaign statistics.
    ///
    /// Includes total raised, goal, progress percentage, contributor count,
    /// average contribution, and largest single contribution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignStats struct with all metrics
    ///
    /// # Progress Calculation
    /// progress_bps = (total_raised * 10_000) / goal, capped at 10_000 (100%)
    pub fn get_stats(env: Env) -> CampaignStats {
        analytics::get_stats(env)
    }

    /// Returns all inputs needed for off-chain quadratic-funding distribution.
    ///
    /// Walks the indexed contributor list and returns each address paired with
    /// its cumulative contribution.  The sqrt-and-sum step is intentionally
    /// left to the off-chain QF calculator so the contract stays lightweight.
    ///
    /// # Returns
    /// `QfInputs` — contributor count and per-contributor amounts
    pub fn get_qf_inputs(env: Env) -> QfInputs {
        analytics::get_qf_inputs(env)
    }

    /// Returns comprehensive campaign information.
    ///
    /// Includes creator, token, goal, deadline, minimum contribution, metadata,
    /// status, and platform fee configuration.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignInfo struct with all campaign details
    pub fn get_campaign_info(env: Env) -> CampaignInfo {
        views::get_campaign_info(env)
    }

    /// Returns the campaign header snapshot in a single storage pass (issue #1561).
    ///
    /// This is a drop-in replacement for calling `creator`, `status`,
    /// `total_raised`, `goal`, `deadline`, `title`, `description`,
    /// `min_contribution`, `max_contribution` and `get_category` separately.
    /// All fields are loaded from one instance-storage read, so the
    /// cross-contract read fee is paid once instead of once per getter.
    pub fn get_campaign_snapshot(env: Env) -> CampaignSnapshot {
        views::get_campaign_snapshot(env)
    }

    /// Returns the campaign category.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign category
    pub fn get_category(env: Env) -> Category {
        views::get_category(env)
    }

    /// Returns the vesting schedule (if configured).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional VestingSchedule with cliff and duration
    pub fn get_vesting_info(env: Env) -> Option<VestingSchedule> {
        views::get_vesting_info(env)
    }

    /// Returns the amount of the creator payout that is currently vested.
    ///
    /// The vested amount is computed against the current `total_raised`, minus
    /// the configured platform fee (if any). If no vesting schedule is set the
    /// full post-fee payout is reported as vested. Before the cliff, 0 is
    /// returned; after `cliff + duration`, the full post-fee payout; in
    /// between, linear vesting based on elapsed time.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vested portion of the creator payout in stroops
    pub fn get_vested_amount(env: Env) -> i128 {
        views::get_vested_amount(env)
    }

    /// Returns the goal adjustment history.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of GoalAdjustment entries
    pub fn get_goal_history(env: Env) -> Vec<GoalAdjustment> {
        views::get_goal_history(env)
    }

    /// Returns comprehensive campaign performance metrics.
    ///
    /// Calculates success rate, contribution velocity, trending direction,
    /// milestone progress, time elapsed, and estimated time to reach goal.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// PerformanceMetrics struct with all performance indicators
    ///
    /// # Calculations
    /// - success_rate_bps: (total_raised * 10000) / goal, capped at 10000
    /// - contribution_velocity: total_raised / days_elapsed (if any time has passed)
    /// - trending: compares recent vs earlier contributions (positive = increasing)
    /// - time_elapsed: current_time - start_time
    /// - estimated_time_to_goal: (goal - total_raised) / daily_velocity
    /// - average_daily_contribution: total_raised / days_elapsed
    pub fn get_performance_metrics(env: Env) -> PerformanceMetrics {
        analytics::get_performance_metrics(env)
    }

    // ── Issue #423 — Campaign Metadata Versioning ─────────────────────────────

    /// Returns the full metadata version history for this campaign.
    ///
    /// Version 0 is the initial metadata recorded at initialization.
    /// Subsequent entries are created by every successful call to
    /// [`update_metadata`](CrowdfundContract::update_metadata).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of [`MetadataVersion`] entries in chronological order
    pub fn get_metadata_history(env: Env) -> Vec<MetadataVersion> {
        metadata::get_metadata_history(env)
    }

    /// Returns the penalty fee in basis points (if configured).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Penalty fee in basis points, or 0 if not configured
    pub fn get_penalty_bps(env: Env) -> u32 {
        views::get_penalty_bps(env)
    }

    /// Returns a paginated list of contributor addresses.
    ///
    /// Useful for iterating through all contributors without loading the entire list.
    /// The limit is capped at 50 to prevent excessive memory usage.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `offset` - Starting index in the contributor list (0-based)
    /// * `limit` - Maximum number of contributors to return (capped at 50)
    ///
    /// # Returns
    /// Vector of contributor addresses for the requested page
    ///
    /// # Example
    /// ```ignore
    /// // Get first 10 contributors
    /// let page1 = contributor_list(env, 0, 10);
    /// // Get next 10 contributors
    /// let page2 = contributor_list(env, 10, 10);
    /// ```
    pub fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        views::contributor_list(env, offset, limit)
    }

    /// Returns the contribution message for a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Optional message string, or None if no message was provided
    pub fn get_contribution_message(env: Env, contributor: Address) -> Option<String> {
        views::get_contribution_message(env, contributor)
    }

    /// Returns the recurring plan for a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Optional RecurringPlan, or None if no plan exists
    pub fn get_recurring_plan(env: Env, contributor: Address) -> Option<RecurringPlan> {
        views::get_recurring_plan(env, contributor)
    }

    /// Returns the current extension proposal.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional ExtensionProposal, or None if no proposal exists
    pub fn get_extension_proposal(env: Env) -> Option<ExtensionProposal> {
        views::get_extension_proposal(env)
    }

    /// Enables insurance for the campaign.
    ///
    /// Allows the creator to set up optional insurance protection for contributors.
    /// Insurance fees are collected during contributions and held in a pool.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `fee_bps` - Insurance fee in basis points (e.g., 100 = 1%)
    /// * `provider` - Address of the insurance provider
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not the creator
    /// * `Err(ContractError::InvalidFee)` if fee_bps > 10,000
    pub fn enable_insurance(
        env: Env,
        fee_bps: u32,
        provider: Address,
    ) -> Result<(), ContractError> {
        let creator = require_auth_creator(&env)?;

        validate_fee_bps(fee_bps)?;
        validate_address_not_self(&creator, &provider)?;

        let config = InsuranceConfig {
            fee_bps,
            provider: provider.clone(),
            enabled: true,
        };

        let inst = env.storage().instance();
        inst.set(&KEY_INSURANCE, &config);
        inst.set(&KEY_INSURANCE_POOL, &0i128);
        env.events().publish(
            ("insurance", "enabled"),
            EventInsuranceEnabled { fee_bps, provider },
        );
        Ok(())
    }

    /// Returns the insurance configuration if enabled.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional InsuranceConfig, or None if insurance is not enabled
    pub fn get_insurance_config(env: Env) -> Option<InsuranceConfig> {
        env.storage().instance().get(&KEY_INSURANCE)
    }

    /// Returns the total insurance pool amount.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Total insurance fees collected in stroops
    pub fn get_insurance_pool(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&KEY_INSURANCE_POOL)
            .unwrap_or(0)
    }

    /// Returns the insurance fee paid by a contributor.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// Insurance fee amount in stroops, or 0 if no insurance fee paid
    pub fn get_insurance_fee(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::InsuranceFee(contributor))
            .unwrap_or(0)
    }

    /// Claims an insurance payout for a contributor of a failed campaign.
    ///
    /// Can only be called when the campaign is in `Cancelled` status, or when
    /// the deadline has passed and the goal was not reached. Transfers the
    /// per-contributor insurance fee from the contract back to the contributor
    /// and decrements the insurance pool counter.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success (no-op if the contributor has no insurance fee on record)
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    /// * `Err(ContractError::InsufficientFunds)` if the pool is somehow below the fee
    pub fn claim_insurance_payout(env: Env, contributor: Address) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&contributor);

        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Cancelled {
            let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
            let goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
            let total: i128 = inst.get(&KEY_TOTAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
            validate_refund_eligibility(env.ledger().timestamp(), deadline, total, goal)?;
        }

        let fee_key = DataKey::InsuranceFee(contributor.clone());
        let insurance_fee: i128 = env.storage().persistent().get(&fee_key).unwrap_or(0);
        if insurance_fee == 0 {
            return Ok(());
        }

        let mut pool: i128 = inst.get(&KEY_INSURANCE_POOL).unwrap_or(0);
        if pool < insurance_fee {
            return Err(ContractError::InsufficientFunds);
        }

        let token_address: Address = inst.get(&KEY_TOKEN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        token::Client::new(&env, &token_address).transfer(
            &env.current_contract_address(),
            &contributor,
            &insurance_fee,
        );

        pool = pool
            .checked_sub(insurance_fee)
            .ok_or(ContractError::Overflow)?;
        inst.set(&KEY_INSURANCE_POOL, &pool);
        env.storage().persistent().set(&fee_key, &0i128);

        env.events().publish(
            ("insurance", "payout"),
            EventInsurancePayout {
                contributor,
                amount: insurance_fee,
            },
        );
        Ok(())
    }

    /// Configures reward distribution for the campaign.
    ///
    /// Sets up NFT or token rewards that contributors will receive based on their contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `reward_token` - The token address for rewards
    /// * `reward_per_unit` - Reward amount per contribution unit (stroops)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotCreator)` if caller is not the creator
    pub fn configure_rewards(
        env: Env,
        reward_token: Address,
        reward_per_unit: i128,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        require_auth_creator(&env)?;

        validate_positive_amount(reward_per_unit)?;

        let config = RewardConfig {
            reward_token: reward_token.clone(),
            reward_per_unit,
            enabled: true,
        };

        inst.set(&DataKey::RewardConfig, &config);
        inst.set(&DataKey::TotalRewardsDistributed, &0i128);

        env.events().publish(
            ("crowdfund", "rewards_configured"),
            EventRewardsConfigured {
                reward_token,
                reward_per_unit,
            },
        );
        Ok(())
    }

    /// Distributes rewards to a contributor based on their contribution.
    ///
    /// Mints and transfers reward tokens to the contributor proportional to their contribution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's address
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NoRewardsConfigured)` if rewards not configured
    pub fn distribute_rewards(env: Env, contributor: Address) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let reward_config: Option<RewardConfig> = inst.get(&DataKey::RewardConfig);

        let config = reward_config.ok_or(ContractError::NoRewardsConfigured)?;
        if !config.enabled {
            return Err(ContractError::NoRewardsConfigured);
        }

        let contribution: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);

        if contribution == 0 {
            return Err(ContractError::BelowMinimum);
        }

        let reward_amount = proportional(contribution, REWARD_DIVISOR, config.reward_per_unit)
            .map_err(|_| ContractError::Overflow)?;

        let already_claimed: i128 = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::RewardsClaimed(contributor.clone()))
            .unwrap_or(0);

        if already_claimed > 0 {
            return Ok(());
        }

        token::Client::new(&env, &config.reward_token).transfer(
            &env.current_contract_address(),
            &contributor,
            &reward_amount,
        );

        let mut total: i128 = inst.get(&DataKey::TotalRewardsDistributed).unwrap_or(0);
        total = total
            .checked_add(reward_amount)
            .ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::TotalRewardsDistributed, &total);

        env.storage().persistent().set(
            &DataKey::RewardsClaimed(contributor.clone()),
            &reward_amount,
        );
        env.storage().persistent().extend_ttl(
            &DataKey::RewardsClaimed(contributor.clone()),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "rewards_distributed"),
            EventRewardsDistributed {
                contributor,
                contribution_amount: contribution,
                reward_amount,
            },
        );
        Ok(())
    }

    /// Creates or updates the search index for the campaign.
    ///
    /// Indexes campaign metadata for efficient discovery and filtering.
    /// Called automatically on initialization and when metadata is updated.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    pub fn index_campaign(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let title: String = inst.get(&KEY_TITLE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let description: String = inst.get(&KEY_DESC).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let category: Category = inst.get(&KEY_CATEGORY).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let visibility: Visibility = inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public);
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));

        let index = SearchIndexEntry {
            title: title.clone(),
            description,
            category,
            visibility,
            created_at: env.ledger().timestamp(),
            status,
        };

        env.storage()
            .persistent()
            .set(&DataKey::SearchIndex, &index);
        env.storage().persistent().extend_ttl(
            &DataKey::SearchIndex,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "indexed"),
            EventCampaignIndexed {
                title,
                category,
                visibility,
            },
        );
        Ok(())
    }

    /// Searches campaigns by category.
    ///
    /// Retrieves the search index entry filtered by category.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `category` - The category to filter by
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if campaign matches category
    /// * `Ok(None)` if campaign doesn't match category
    pub fn search_by_category(
        env: Env,
        category: Category,
    ) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env.storage().persistent().get(&DataKey::SearchIndex);

        match index {
            Some(entry) if entry.category == category => Ok(Some(entry)),
            Some(_) => Ok(None),
            None => Ok(None),
        }
    }

    /// Searches campaigns by visibility.
    ///
    /// Retrieves the search index entry filtered by visibility level.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `visibility` - The visibility level to filter by
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if campaign matches visibility
    /// * `Ok(None)` if campaign doesn't match visibility
    pub fn search_by_visibility(
        env: Env,
        visibility: Visibility,
    ) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env.storage().persistent().get(&DataKey::SearchIndex);

        match index {
            Some(entry) if entry.visibility == visibility => Ok(Some(entry)),
            Some(_) => Ok(None),
            None => Ok(None),
        }
    }

    /// Retrieves the full search index entry for the campaign.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(Some(SearchIndexEntry))` if index exists
    /// * `Ok(None)` if index not yet created
    pub fn get_search_index(env: Env) -> Result<Option<SearchIndexEntry>, ContractError> {
        let index: Option<SearchIndexEntry> = env.storage().persistent().get(&DataKey::SearchIndex);
        Ok(index)
    }

    /// Clones a campaign with new creator and deadline.
    ///
    /// Allows a creator to clone an existing campaign's metadata and settings
    /// while resetting contribution data. The new campaign starts fresh with
    /// zero contributions.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_creator` - The new campaign creator's address (must authorize)
    /// * `new_goal` - The funding goal for the cloned campaign
    /// * `new_deadline` - The deadline for the cloned campaign
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotCreator)` if caller is not the original creator
    /// * `Err(ContractError::InvalidGoal)` if new_goal <= 0
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current time
    pub fn clone_campaign(
        env: Env,
        new_creator: Address,
        new_goal: i128,
        new_deadline: u64,
    ) -> Result<(), ContractError> {
        lifecycle::clone_campaign(env, new_creator, new_goal, new_deadline)
    }

    // ── Issue #457: Contract Versioning ──────────────────────────────────────

    /// Returns the current contract version constant.
    pub fn contract_version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Checks whether the on-chain stored version is compatible with the current binary.
    ///
    /// Emits `EventVersionChecked`. Returns `true` if compatible.
    pub fn check_version(env: Env) -> bool {
        let stored: u32 = env
            .storage()
            .instance()
            .get(&KEY_CONTRACT_VERSION)
            .unwrap_or(CONTRACT_VERSION);
        let compatible = (storage::MIN_SUPPORTED_VERSION..=CONTRACT_VERSION).contains(&stored);
        env.events().publish(
            ("contract", "version_checked"),
            EventVersionChecked {
                current_version: CONTRACT_VERSION,
                expected_version: stored,
                compatible,
            },
        );
        compatible
    }

    /// Migrates the on-chain version record to the current binary version (admin only).
    ///
    /// Records the migration in persistent history and emits `EventContractMigrated`.
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not admin
    pub fn migrate_version(env: Env) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;

        let from_version: u32 = inst.get(&KEY_CONTRACT_VERSION).unwrap_or(0);
        let now = env.ledger().timestamp();

        inst.set(&KEY_CONTRACT_VERSION, &CONTRACT_VERSION);

        let mut history: Vec<VersionMigration> = env
            .storage()
            .persistent()
            .get(&KEY_VERSION_HISTORY)
            .unwrap_or_else(|| Vec::new(&env));
        history.push_back(VersionMigration {
            from_version,
            to_version: CONTRACT_VERSION,
            timestamp: now,
        });
        env.storage()
            .persistent()
            .set(&KEY_VERSION_HISTORY, &history);
        env.storage().persistent().extend_ttl(
            &KEY_VERSION_HISTORY,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("contract", "migrated"),
            EventContractMigrated {
                from_version,
                to_version: CONTRACT_VERSION,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Returns the full version migration history.
    pub fn get_version_history(env: Env) -> Vec<VersionMigration> {
        env.storage()
            .persistent()
            .get(&KEY_VERSION_HISTORY)
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── Issue #458: State Validation ─────────────────────────────────────────

    /// Runs all state invariant checks and returns a validation result.
    ///
    /// Invariants checked:
    /// 1. `total_raised >= 0`
    /// 2. `goal > 0`
    /// 3. `deadline > 0`
    /// 4. `total_raised <= goal * 2` (sanity upper bound)
    /// 5. `contributor_count` is a valid u32 (always true, structural check)
    ///
    /// Emits `EventStateValidated` and `EventInvariantViolated` for each failure.
    pub fn validate_state(env: Env) -> StateValidationResult {
        analytics::validate_state(env)
    }

    /// Returns the result of the last `validate_state` call, if any.
    pub fn get_last_validation(env: Env) -> Option<StateValidationResult> {
        analytics::get_last_validation(env)
    }

    // ── Issue #459: Debugging Utilities ──────────────────────────────────────

    /// Takes a snapshot of the current contract state for debugging.
    ///
    /// Stores the snapshot in instance storage and emits `EventDebugSnapshot`.
    pub fn debug_snapshot(env: Env) -> ContractStateSnapshot {
        let inst = env.storage().instance();
        let now = env.ledger().timestamp();
        let snapshot = ContractStateSnapshot {
            version: CONTRACT_VERSION,
            status: inst.get(&KEY_STATUS).unwrap_or(Status::Active),
            total_raised: inst.get(&KEY_TOTAL).unwrap_or(0),
            goal: inst.get(&KEY_GOAL).unwrap_or(0),
            contributor_count: inst.get(&DataKey::ContributorCount).unwrap_or(0),
            deadline: inst.get(&KEY_DEADLINE).unwrap_or(0),
            timestamp: now,
        };

        inst.set(&KEY_DEBUG_SNAPSHOT, &snapshot);

        env.events().publish(
            ("debug", "snapshot"),
            EventDebugSnapshot {
                version: snapshot.version,
                status: snapshot.status.clone(),
                total_raised: snapshot.total_raised,
                contributor_count: snapshot.contributor_count,
                timestamp: now,
            },
        );

        snapshot
    }

    /// Returns the most recent debug snapshot, if any.
    pub fn get_debug_snapshot(env: Env) -> Option<ContractStateSnapshot> {
        env.storage().instance().get(&KEY_DEBUG_SNAPSHOT)
    }

    /// Emits a debug log event with a custom message (admin only).
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if caller is not admin
    pub fn debug_log(env: Env, message: String) -> Result<(), ContractError> {
        auth_admin(&env)?;

        let now = env.ledger().timestamp();
        env.events().publish(
            ("debug", "log"),
            EventDebugLog {
                message,
                timestamp: now,
            },
        );
        Ok(())
    }

    /// Inspects the contribution balance for a specific address (admin only).
    ///
    /// Returns the stored contribution amount without requiring contributor auth.
    pub fn inspect_contribution(env: Env, contributor: Address) -> Result<i128, ContractError> {
        auth_admin(&env)?;

        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0))
    }

    // ── Issue #460: Performance Monitoring ───────────────────────────────────

    /// Sets the performance alert threshold in milliseconds (admin only).
    ///
    /// When a recorded execution duration exceeds this threshold, an
    /// `EventPerfAlert` is emitted. Set to 0 to disable alerting.
    pub fn set_perf_threshold(env: Env, threshold_ms: u64) -> Result<(), ContractError> {
        auth_admin(&env)?;

        env.storage()
            .instance()
            .set(&KEY_PERF_THRESHOLD, &threshold_ms);
        Ok(())
    }

    /// Returns the current performance alert threshold in milliseconds.
    pub fn get_perf_threshold(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&KEY_PERF_THRESHOLD)
            .unwrap_or(0)
    }

    /// Records an execution time observation for a named function (admin only).
    ///
    /// Updates the per-function `FunctionPerfStats` in persistent storage and
    /// emits `EventExecutionRecorded`. If the duration exceeds the configured
    /// threshold, also emits `EventPerfAlert`.
    pub fn record_execution(
        env: Env,
        function_name: String,
        duration_ms: u64,
    ) -> Result<(), ContractError> {
        auth_admin(&env)?;

        let now = env.ledger().timestamp();
        let stats_key = DataKey::PerfStats(function_name.clone());

        let mut stats: FunctionPerfStats =
            env.storage()
                .persistent()
                .get(&stats_key)
                .unwrap_or(FunctionPerfStats {
                    call_count: 0,
                    total_duration_ms: 0,
                    max_duration_ms: 0,
                });

        stats.call_count += 1;
        stats.total_duration_ms = stats.total_duration_ms.saturating_add(duration_ms);
        if duration_ms > stats.max_duration_ms {
            stats.max_duration_ms = duration_ms;
        }

        env.storage().persistent().set(&stats_key, &stats);
        env.storage().persistent().extend_ttl(
            &stats_key,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("perf", "execution_recorded"),
            EventExecutionRecorded {
                function_name: function_name.clone(),
                duration_ms,
                timestamp: now,
            },
        );

        // Alert if threshold is set and exceeded
        let threshold: u64 = env
            .storage()
            .instance()
            .get(&KEY_PERF_THRESHOLD)
            .unwrap_or(0);
        if threshold > 0 && duration_ms > threshold {
            env.events().publish(
                ("perf", "alert"),
                EventPerfAlert {
                    function_name,
                    duration_ms,
                    threshold_ms: threshold,
                    timestamp: now,
                },
            );
        }

        Ok(())
    }

    /// Returns the performance stats for a named function.
    pub fn get_perf_stats(env: Env, function_name: String) -> Option<FunctionPerfStats> {
        env.storage()
            .persistent()
            .get(&DataKey::PerfStats(function_name))
    }

    // ── Issue #436: Campaign Milestones ───────────────────────────────────────

    /// Sets up milestones for the campaign.
    ///
    /// Only the creator can call this function. Milestones define target amounts
    /// that trigger fund releases when reached and verified.
    pub fn set_milestones(env: Env, milestones: Vec<FundingMilestone>) -> Result<(), ContractError> {
        let creator: Address = env
            .storage()
            .instance()
            .get(&KEY_CREATOR)
            .ok_or(ContractError::NotCreator)?;
        common::AccessControl::require_role_auth(&creator);

        if milestones.len() > storage::MAX_MILESTONES {
            return Err(ContractError::InvalidGoal);
        }

        env.storage().persistent().set(&KEY_MILESTONES, &milestones);
        env.storage().persistent().extend_ttl(
            &KEY_MILESTONES,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        Ok(())
    }

    /// Gets all milestones for the campaign.
    pub fn get_milestones(env: Env) -> Result<Vec<FundingMilestone>, ContractError> {
        env.storage()
            .persistent()
            .get(&KEY_MILESTONES)
            .ok_or(ContractError::MilestoneNotFound)
    }

    /// Verifies a milestone has been reached and releases funds accordingly.
    ///
    /// Only the creator can call this function. Verifies that the milestone
    /// amount has been reached and marks it as verified for fund release.
    pub fn verify_milestone(env: Env, milestone_index: u32) -> Result<(), ContractError> {
        let creator: Address = env
            .storage()
            .instance()
            .get(&KEY_CREATOR)
            .ok_or(ContractError::NotCreator)?;
        common::AccessControl::require_role_auth(&creator);

        let mut milestones: Vec<FundingMilestone> = env
            .storage()
            .persistent()
            .get(&KEY_MILESTONES)
            .ok_or(ContractError::MilestoneNotFound)?;

        if milestone_index >= milestones.len() {
            return Err(ContractError::MilestoneNotFound);
        }

        // Bounds are checked above; use typed access rather than a panicking unwrap
        // so an out-of-range index surfaces as a ContractError, not a host panic.
        let mut milestone = milestones
            .get(milestone_index)
            .ok_or(ContractError::MilestoneNotFound)?;

        let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        if total_raised < milestone.amount {
            return Err(ContractError::GoalNotReached);
        }

        if milestone.reached {
            return Err(ContractError::MilestoneAlreadyReached);
        }

        milestone.reached = true;
        milestones.set(milestone_index, milestone);
        env.storage().persistent().set(&KEY_MILESTONES, &milestones);
        env.storage().persistent().extend_ttl(
            &KEY_MILESTONES,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "milestone_verified"),
            EventMilestoneVerified {
                milestone_index,
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    // ── Issue #437: Contribution Verification ─────────────────────────────────

    /// Updates the verification status of a contributor.
    ///
    /// Only the creator can call this function. Sets the KYC/AML verification
    /// status for a contributor address.
    pub fn update_verification(
        env: Env,
        contributor: Address,
        status: VerificationStatus,
    ) -> Result<(), ContractError> {
        let creator: Address = env
            .storage()
            .instance()
            .get(&KEY_CREATOR)
            .ok_or(ContractError::NotCreator)?;
        common::AccessControl::require_role_auth(&creator);

        env.storage()
            .persistent()
            .set(&DataKey::Verification(contributor.clone()), &status);
        env.storage().persistent().extend_ttl(
            &DataKey::Verification(contributor.clone()),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "verification_updated"),
            EventVerificationUpdated {
                contributor,
                status,
                timestamp: env.ledger().timestamp(),
            },
        );
        Ok(())
    }

    /// Gets the verification status of a contributor.
    pub fn get_verification(env: Env, contributor: Address) -> VerificationStatus {
        env.storage()
            .persistent()
            .get(&DataKey::Verification(contributor))
            .unwrap_or(VerificationStatus::Unverified)
    }

    // ── Issue #438: Campaign Analytics ────────────────────────────────────────

    /// Generates analytics for the campaign.
    ///
    /// Calculates and returns detailed analytics including contribution patterns,
    /// velocity, and statistical measures.
    pub fn get_analytics(env: Env) -> Result<CampaignAnalytics, ContractError> {
        analytics::get_analytics(env)
    }

    // ── Issue #439: Dispute Resolution ────────────────────────────────────────

    /// Files a new dispute for the campaign.
    ///
    /// Any contributor can file a dispute. Returns the dispute ID.
    pub fn file_dispute(
        env: Env,
        filer: Address,
        description: String,
    ) -> Result<u32, ContractError> {
        common::AccessControl::require_role_auth(&filer);

        let mut dispute_id: u32 = env.storage().persistent().get(&KEY_DISPUTE_ID).unwrap_or(0);
        dispute_id = dispute_id.checked_add(1).ok_or(ContractError::Overflow)?;

        let dispute = Dispute {
            id: dispute_id,
            filer: filer.clone(),
            description,
            status: DisputeStatus::Filed,
            filed_at: env.ledger().timestamp(),
            resolved_at: 0,
            votes_for: 0,
            votes_against: 0,
        };

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .unwrap_or_else(|| Vec::new(&env));
        disputes.push_back(dispute);

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);
        env.storage().persistent().extend_ttl(
            &KEY_DISPUTES,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        env.storage().persistent().set(&KEY_DISPUTE_ID, &dispute_id);
        env.storage().persistent().extend_ttl(
            &KEY_DISPUTE_ID,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "dispute_filed"),
            EventDisputeFiled {
                dispute_id,
                filer,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(dispute_id)
    }

    /// Votes on a dispute.
    ///
    /// Contributors can vote on disputes. Vote weight is based on their contribution amount.
    pub fn vote_on_dispute(
        env: Env,
        voter: Address,
        dispute_id: u32,
        in_favor: bool,
    ) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&voter);
        let vote_weight: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(voter.clone()))
            .unwrap_or(0);

        if vote_weight == 0 {
            return Err(ContractError::Unauthorized);
        }

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        let mut dispute_found = false;
        for i in 0..disputes.len() {
            let mut dispute = disputes.get(i).ok_or(ContractError::DisputeNotFound)?;
            if dispute.id == dispute_id {
                if dispute.status != DisputeStatus::Filed
                    && dispute.status != DisputeStatus::InReview
                {
                    return Err(ContractError::DisputeVotingEnded);
                }

                if in_favor {
                    dispute.votes_for = dispute
                        .votes_for
                        .checked_add(vote_weight)
                        .ok_or(ContractError::Overflow)?;
                } else {
                    dispute.votes_against = dispute
                        .votes_against
                        .checked_add(vote_weight)
                        .ok_or(ContractError::Overflow)?;
                }
                dispute.status = DisputeStatus::InReview;
                disputes.set(i, dispute);
                dispute_found = true;
                break;
            }
        }

        if !dispute_found {
            return Err(ContractError::DisputeNotFound);
        }

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);
        env.storage().persistent().extend_ttl(
            &KEY_DISPUTES,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("crowdfund", "dispute_voted"),
            EventDisputeVoted {
                dispute_id,
                voter,
                vote_weight,
                in_favor,
                timestamp: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Resolves a dispute based on voting results.
    ///
    /// Only the creator can call this function. Resolves the dispute and
    /// determines the outcome based on votes.
    pub fn resolve_dispute(env: Env, dispute_id: u32) -> Result<(), ContractError> {
        let creator: Address = env
            .storage()
            .instance()
            .get(&KEY_CREATOR)
            .ok_or(ContractError::NotCreator)?;
        common::AccessControl::require_role_auth(&creator);

        let mut disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        let mut dispute_found = false;
        for i in 0..disputes.len() {
            let mut dispute = disputes.get(i).ok_or(ContractError::DisputeNotFound)?;
            if dispute.id == dispute_id {
                let status = match dispute.votes_for.cmp(&dispute.votes_against) {
                    core::cmp::Ordering::Greater => DisputeStatus::ResolvedInFavor,
                    core::cmp::Ordering::Less => DisputeStatus::ResolvedAgainst,
                    core::cmp::Ordering::Equal => DisputeStatus::Dismissed,
                };

                dispute.status = status;
                dispute.resolved_at = env.ledger().timestamp();
                disputes.set(i, dispute.clone());
                dispute_found = true;

                env.events().publish(
                    ("crowdfund", "dispute_resolved"),
                    EventDisputeResolved {
                        dispute_id,
                        status,
                        votes_for: dispute.votes_for,
                        votes_against: dispute.votes_against,
                        timestamp: env.ledger().timestamp(),
                    },
                );
                break;
            }
        }

        if !dispute_found {
            return Err(ContractError::DisputeNotFound);
        }

        env.storage().persistent().set(&KEY_DISPUTES, &disputes);
        env.storage().persistent().extend_ttl(
            &KEY_DISPUTES,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        Ok(())
    }

    /// Gets a dispute by ID.
    pub fn get_dispute(env: Env, dispute_id: u32) -> Result<Dispute, ContractError> {
        let disputes: Vec<Dispute> = env
            .storage()
            .persistent()
            .get(&KEY_DISPUTES)
            .ok_or(ContractError::DisputeNotFound)?;

        for dispute in disputes.iter() {
            if dispute.id == dispute_id {
                return Ok(dispute.clone());
            }
        }

        Err(ContractError::DisputeNotFound)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Sig Governance Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// Initializes multi-sig governance for platform configuration changes.
    ///
    /// Sets the governance configuration including the list of authorized governors,
    /// minimum approvals required, and timelock delay. Can only be called by the
    /// contract admin on an uninitialized governance.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governors` - List of authorized governor addresses
    /// * `required_approvals` - Minimum number of approvals required (must be 1 ≤ n ≤ governors.len())
    /// * `timelock_delay` - Timelock delay in seconds (minimum 3600)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if governance already configured
    /// * `Err(ContractError::Unauthorized)` if parameters are invalid
    pub fn initialize_governance(
        env: Env,
        governors: Vec<Address>,
        required_approvals: u32,
        timelock_delay: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;

        if inst.has(&KEY_GOVERNANCE_CONFIG) {
            return Err(ContractError::AlreadyInitialized);
        }

        validate_governance_config(required_approvals, governors.len(), timelock_delay)?;

        let config = GovernanceConfig {
            governors,
            required_approvals,
            timelock_delay,
        };
        inst.set(&KEY_GOVERNANCE_CONFIG, &config);
        inst.set(&KEY_GOVERNANCE_NONCE, &0u32);

        env.events().publish(
            ("governance", "config_updated"),
            EventGovernanceConfigUpdated {
                required_approvals,
                governor_count: config.governors.len(),
                timelock_delay,
            },
        );
        Ok(())
    }

    /// Proposes a platform configuration update.
    ///
    /// Creates a new governance proposal to change the platform fee address
    /// and/or fee basis points. The proposer must be a designated governor.
    /// Voting lasts for 7 days from creation.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `proposer` - The governor creating the proposal (must authorize)
    /// * `platform_address` - Proposed new platform fee recipient address
    /// * `platform_fee_bps` - Proposed new platform fee in basis points
    ///
    /// # Returns
    /// * `Ok(u32)` - The proposal nonce on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if proposer is not a governor
    pub fn propose_platform_update(
        env: Env,
        proposer: Address,
        platform_address: Address,
        platform_fee_bps: u32,
    ) -> Result<u32, ContractError> {
        common::AccessControl::require_role_auth(&proposer);
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&proposer) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        validate_fee_bps(platform_fee_bps)?;

        let nonce: u32 = inst.get(&KEY_GOVERNANCE_NONCE).unwrap_or(0);
        let new_nonce = nonce.checked_add(1).ok_or(ContractError::Overflow)?;
        let now = env.ledger().timestamp();

        let proposal = GovernanceProposal {
            nonce: new_nonce,
            proposer: proposer.clone(),
            platform_address: platform_address.clone(),
            platform_fee_bps,
            created_at: now,
            voting_ends_at: now + 604800, // 7 days
            approvals: 0,
            timelock_until: 0,
            executed: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(new_nonce), &proposal);
        env.storage().persistent().extend_ttl(
            &DataKey::GovernanceProposal(new_nonce),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        inst.set(&KEY_GOVERNANCE_NONCE, &new_nonce);

        env.events().publish(
            ("governance", "proposed"),
            EventGovernanceProposed {
                nonce: new_nonce,
                proposer,
                platform_address,
                platform_fee_bps,
                voting_ends_at: proposal.voting_ends_at,
            },
        );
        Ok(new_nonce)
    }

    /// Votes on a governance proposal.
    ///
    /// Governors cast approval votes on a pending proposal. When the required
    /// number of approvals is met, the proposal enters the timelock period.
    /// Voting is idempotent — a second vote from the same governor is a no-op.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor casting the vote (must authorize)
    /// * `proposal_nonce` - Nonce of the proposal to vote on
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceProposalNotFound)` if proposal doesn't exist
    /// * `Err(ContractError::GovernanceVotingEnded)` if voting period has ended
    /// * `Err(ContractError::GovernanceAlreadyVoted)` if already voted
    /// * `Err(ContractError::GovernanceNotGovernor)` if governor is not a governor
    pub fn vote_on_proposal(
        env: Env,
        governor: Address,
        proposal_nonce: u32,
    ) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&governor);
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        let mut proposal: GovernanceProposal = env
            .storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
            .ok_or(ContractError::GovernanceProposalNotFound)?;

        if proposal.executed {
            return Err(ContractError::GovernanceAlreadyExecuted);
        }

        if env.ledger().timestamp() > proposal.voting_ends_at {
            return Err(ContractError::GovernanceVotingEnded);
        }

        // Idempotency check
        let vote_key = DataKey::GovernanceVote(proposal_nonce, governor.clone());
        let has_voted: bool = env.storage().persistent().get(&vote_key).unwrap_or(false);
        if has_voted {
            return Err(ContractError::GovernanceAlreadyVoted);
        }

        env.storage().persistent().set(&vote_key, &true);

        proposal.approvals = proposal
            .approvals
            .checked_add(1)
            .ok_or(ContractError::Overflow)?;

        // If threshold met, start timelock
        if proposal.approvals >= config.required_approvals && proposal.timelock_until == 0 {
            proposal.timelock_until = env.ledger().timestamp() + config.timelock_delay;
        }

        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(proposal_nonce), &proposal);
        env.storage().persistent().extend_ttl(
            &DataKey::GovernanceProposal(proposal_nonce),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("governance", "voted"),
            EventGovernanceVoted {
                nonce: proposal_nonce,
                governor,
                approvals: proposal.approvals,
                required: config.required_approvals,
            },
        );
        Ok(())
    }

    /// Executes a governance proposal after voting and timelock have completed.
    ///
    /// Updates the platform configuration to the proposed values. Anyone may
    /// call this once the timelock has expired.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `proposal_nonce` - Nonce of the proposal to execute
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceProposalNotFound)` if proposal doesn't exist
    /// * `Err(ContractError::GovernanceAlreadyExecuted)` if already executed
    /// * `Err(ContractError::GovernanceNotEnoughApprovals)` if threshold not met
    /// * `Err(ContractError::GovernanceTimelockPending)` if timelock not expired
    pub fn execute_proposal(env: Env, proposal_nonce: u32) -> Result<(), ContractError> {
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        let mut proposal: GovernanceProposal = env
            .storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
            .ok_or(ContractError::GovernanceProposalNotFound)?;

        if proposal.executed {
            return Err(ContractError::GovernanceAlreadyExecuted);
        }

        if proposal.approvals < config.required_approvals {
            return Err(ContractError::GovernanceNotEnoughApprovals);
        }

        if env.ledger().timestamp() < proposal.timelock_until {
            return Err(ContractError::GovernanceTimelockPending);
        }

        // Execute: update platform config
        let platform = PlatformConfig {
            address: proposal.platform_address.clone(),
            fee_bps: proposal.platform_fee_bps,
            fee_mode: FeeMode::OnSuccess,
        };
        inst.set(&KEY_PLATFORM, &platform);

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::GovernanceProposal(proposal_nonce), &proposal);
        env.storage().persistent().extend_ttl(
            &DataKey::GovernanceProposal(proposal_nonce),
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        env.events().publish(
            ("governance", "executed"),
            EventGovernanceExecuted {
                nonce: proposal_nonce,
                platform_address: proposal.platform_address,
                platform_fee_bps: proposal.platform_fee_bps,
            },
        );
        Ok(())
    }

    /// Emergency pauses all contract operations via multi-sig governance.
    ///
    /// Requires a majority (>50%) of governors to approve within a single
    /// transaction window. Sets the emergency pause flag which blocks all
    /// mutative operations.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor requesting the pause (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if caller is not a governor
    pub fn emergency_pause(env: Env, governor: Address) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&governor);
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        // Track approvals for this emergency pause
        let approval_key = DataKey::EmergencyPauseApproval(governor.clone());
        let already_approved: bool = env
            .storage()
            .persistent()
            .get(&approval_key)
            .unwrap_or(false);
        if already_approved {
            return Ok(());
        }

        env.storage().persistent().set(&approval_key, &true);

        let count: u32 = inst.get(&DataKey::EmergencyPauseApprovals).unwrap_or(0);
        let new_count = count.checked_add(1).ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::EmergencyPauseApprovals, &new_count);

        // Trigger pause when majority approves
        if new_count > config.governors.len() / 2 {
            inst.set(&KEY_EMERGENCY_PAUSE, &true);
            env.events().publish(
                ("governance", "emergency_paused"),
                EventGovernanceEmergencyPaused {
                    timestamp: env.ledger().timestamp(),
                },
            );
        }
        Ok(())
    }

    /// Resumes contract operations after emergency pause via multi-sig governance.
    ///
    /// Requires a majority (>50%) of governors to approve.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governor` - The governor requesting the resume (must authorize)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::GovernanceNotGovernor)` if caller is not a governor
    pub fn emergency_resume(env: Env, governor: Address) -> Result<(), ContractError> {
        common::AccessControl::require_role_auth(&governor);
        let inst = env.storage().instance();

        let config: GovernanceConfig = inst
            .get(&KEY_GOVERNANCE_CONFIG)
            .ok_or(ContractError::Unauthorized)?;

        if !config.governors.contains(&governor) {
            return Err(ContractError::GovernanceNotGovernor);
        }

        let approval_key = DataKey::EmergencyPauseApproval(governor.clone());
        let already_approved: bool = env
            .storage()
            .persistent()
            .get(&approval_key)
            .unwrap_or(false);
        if already_approved {
            return Ok(());
        }

        env.storage().persistent().set(&approval_key, &true);

        let count: u32 = inst.get(&DataKey::EmergencyPauseApprovals).unwrap_or(0);
        let new_count = count.checked_add(1).ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::EmergencyPauseApprovals, &new_count);

        // Resume when majority approves
        if new_count > config.governors.len() / 2 {
            inst.set(&KEY_EMERGENCY_PAUSE, &false);
            env.events().publish(
                ("governance", "emergency_resumed"),
                EventGovernanceEmergencyResumed {
                    timestamp: env.ledger().timestamp(),
                },
            );
        }
        Ok(())
    }

    /// Updates the governance configuration.
    ///
    /// Can only be called by the contract admin. Enables changing the governor
    /// set, required approvals, and timelock delay after initial setup.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `governors` - New list of authorized governor addresses
    /// * `required_approvals` - New minimum approvals required
    /// * `timelock_delay` - New timelock delay in seconds
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::Unauthorized)` if parameters are invalid
    pub fn update_governance_config(
        env: Env,
        governors: Vec<Address>,
        required_approvals: u32,
        timelock_delay: u64,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        auth_admin(&env)?;

        validate_governance_config(required_approvals, governors.len(), timelock_delay)?;

        let config = GovernanceConfig {
            governors,
            required_approvals,
            timelock_delay,
        };
        inst.set(&KEY_GOVERNANCE_CONFIG, &config);

        env.events().publish(
            ("governance", "config_updated"),
            EventGovernanceConfigUpdated {
                required_approvals,
                governor_count: config.governors.len(),
                timelock_delay,
            },
        );
        Ok(())
    }

    /// Returns the current governance configuration.
    pub fn get_governance_config(env: Env) -> Option<GovernanceConfig> {
        env.storage().instance().get(&KEY_GOVERNANCE_CONFIG)
    }

    /// Returns a governance proposal by nonce.
    pub fn get_proposal(env: Env, proposal_nonce: u32) -> Option<GovernanceProposal> {
        env.storage()
            .persistent()
            .get(&DataKey::GovernanceProposal(proposal_nonce))
    }

    /// Returns whether the contract is emergency paused by governance.
    pub fn is_emergency_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&KEY_EMERGENCY_PAUSE)
            .unwrap_or(false)
    }

    // ── DeFi: Yield Generation ────────────────────────────────────────────────

    /// Configures a yield reward pool for the campaign.
    ///
    /// The creator deposits `pool` units of `reward_token` into the contract.
    /// Contributors can then claim yield proportional to their contribution share,
    /// accrued linearly over the campaign period at `rate_bps` annually.
    ///
    /// # Arguments
    /// * `reward_token` - Token address for yield payouts
    /// * `pool` - Total reward tokens to deposit (transferred from creator)
    /// * `rate_bps` - Annual yield rate in basis points (e.g. 500 = 5%)
    ///
    /// # Errors
    /// * `NotCreator` — caller is not the campaign creator
    /// * `NotActive` — campaign is not active
    /// * `AmountNotPositive` — pool or rate is zero
    /// * `InvalidFee` — rate_bps > 10_000
    pub fn configure_yield(
        env: Env,
        reward_token: Address,
        pool: i128,
        rate_bps: u32,
    ) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let creator = require_auth_creator(&env)?;

        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        validate_positive_amount(pool)?;
        if rate_bps == 0 || rate_bps > 10_000 {
            return Err(ContractError::InvalidFee);
        }

        // Transfer reward pool from creator into the contract
        token::Client::new(&env, &reward_token).transfer(
            &creator,
            env.current_contract_address(),
            &pool,
        );

        let start_time: u64 = inst
            .get(&KEY_START_TIME)
            .unwrap_or_else(|| env.ledger().timestamp());
        let config = YieldConfig {
            reward_token: reward_token.clone(),
            pool,
            rate_bps,
            start_time,
        };
        inst.set(&KEY_YIELD_CONFIG, &config);
        inst.set(&KEY_YIELD_TOTAL, &0i128);

        env.events().publish(
            ("defi", "yield_configured"),
            EventYieldConfigured {
                reward_token,
                pool,
                rate_bps,
            },
        );
        Ok(())
    }

    /// Claims accrued yield for the calling contributor.
    ///
    /// Yield accrues linearly over time, proportional to the contributor's share
    /// of total contributions. Callable by any contributor at any time while the
    /// yield pool has remaining balance.
    ///
    /// # Errors
    /// * `NoRewardsConfigured` — yield not configured
    /// * `InsufficientFunds` — pool exhausted
    pub fn claim_yield(env: Env, contributor: Address) -> Result<i128, ContractError> {
        common::AccessControl::require_role_auth(&contributor);

        let inst = env.storage().instance();
        let config: YieldConfig = inst
            .get(&KEY_YIELD_CONFIG)
            .ok_or(ContractError::NoRewardsConfigured)?;

        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        if total_raised == 0 {
            return Ok(0);
        }

        let contrib_amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);
        if contrib_amount == 0 {
            return Ok(0);
        }

        let now = env.ledger().timestamp();
        // Seconds elapsed since yield started (capped at 1 year)
        let elapsed = now.saturating_sub(config.start_time).min(365 * 24 * 3600);

        // Proportional share: contributor_amount / total_raised
        // Accrued = pool * rate_bps/10000 * (elapsed / seconds_per_year) * share
        // Use i128 arithmetic; scale by 1e9 to preserve precision
        let seconds_per_year: i128 = 365 * 24 * 3600;
        let share_numerator = contrib_amount;
        // Issue #1145: guard the divisor against overflow and zero-division
        let divisor = (10_000i128)
            .checked_mul(seconds_per_year)
            .and_then(|v| v.checked_mul(total_raised))
            .ok_or(ContractError::Overflow)?;
        if divisor == 0 {
            return Ok(0);
        }
        let accrued = config
            .pool
            .checked_mul(config.rate_bps as i128)
            .ok_or(ContractError::Overflow)?
            .checked_mul(elapsed as i128)
            .ok_or(ContractError::Overflow)?
            .checked_mul(share_numerator)
            .ok_or(ContractError::Overflow)?
            .checked_div(divisor)
            .unwrap_or(0);

        let yield_key = DataKey::YieldInfo(contributor.clone());
        let info: YieldInfo = env
            .storage()
            .persistent()
            .get(&yield_key)
            .unwrap_or(YieldInfo {
                claimed: 0,
                reward_debt: 0,
            });

        let claimable = accrued.saturating_sub(info.claimed);
        if claimable <= 0 {
            return Ok(0);
        }

        let distributed: i128 = inst.get(&KEY_YIELD_TOTAL).unwrap_or(0);
        let remaining = config.pool.saturating_sub(distributed);
        if remaining <= 0 {
            return Err(ContractError::InsufficientFunds);
        }
        let payout = claimable.min(remaining);

        // Update accounting
        env.storage().persistent().set(
            &yield_key,
            &YieldInfo {
                claimed: info
                    .claimed
                    .checked_add(payout)
                    .ok_or(ContractError::Overflow)?,
                reward_debt: accrued,
            },
        );
        inst.set(
            &KEY_YIELD_TOTAL,
            &(distributed
                .checked_add(payout)
                .ok_or(ContractError::Overflow)?),
        );

        // Transfer yield tokens to contributor
        token::Client::new(&env, &config.reward_token).transfer(
            &env.current_contract_address(),
            &contributor,
            &payout,
        );

        env.events().publish(
            ("defi", "yield_claimed"),
            EventYieldClaimed {
                contributor,
                amount: payout,
            },
        );
        Ok(payout)
    }

    /// Returns the yield configuration, if set.
    pub fn get_yield_config(env: Env) -> Option<YieldConfig> {
        env.storage().instance().get(&KEY_YIELD_CONFIG)
    }

    /// Returns accrued (unclaimed) yield for a contributor.
    pub fn pending_yield(env: Env, contributor: Address) -> i128 {
        let inst = env.storage().instance();
        let config: YieldConfig = match inst.get(&KEY_YIELD_CONFIG) {
            Some(c) => c,
            None => return 0,
        };
        let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        if total_raised == 0 {
            return 0;
        }
        let contrib_amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);
        if contrib_amount == 0 {
            return 0;
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(config.start_time).min(365 * 24 * 3600);
        let seconds_per_year: i128 = 365 * 24 * 3600;

        // Issue #1145: guard divisor against overflow and zero-division
        let divisor = (10_000i128)
            .saturating_mul(seconds_per_year)
            .saturating_mul(total_raised);
        if divisor == 0 {
            return 0;
        }
        let accrued = config
            .pool
            .saturating_mul(config.rate_bps as i128)
            .saturating_mul(elapsed as i128)
            .saturating_mul(contrib_amount)
            / divisor;

        let info: YieldInfo = env
            .storage()
            .persistent()
            .get(&DataKey::YieldInfo(contributor))
            .unwrap_or(YieldInfo {
                claimed: 0,
                reward_debt: 0,
            });

        accrued.saturating_sub(info.claimed).max(0)
    }

    // ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────

    /// Sets the soft cap and stretch goal for the campaign (creator only).
    ///
    /// - `soft_cap`: minimum viable funding target; campaign succeeds at this amount.
    ///   Pass 0 to leave unset (falls back to the hard goal).
    /// - `stretch_goal`: over-funding target tracked separately.
    ///   Pass 0 to leave unset.
    ///
    /// Must be called while the campaign is `Active`.
    pub fn set_caps(env: Env, soft_cap: i128, stretch_goal: i128) -> Result<(), ContractError> {
        let inst = env.storage().instance();
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = inst.get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        common::AccessControl::require_role_auth(&creator);

        if soft_cap < 0 || stretch_goal < 0 {
            return Err(ContractError::InvalidGoal);
        }
        let goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        // soft_cap must not exceed the hard goal; stretch_goal must be >= goal
        if soft_cap > 0 && soft_cap > goal {
            return Err(ContractError::InvalidGoal);
        }
        if stretch_goal > 0 && stretch_goal < goal {
            return Err(ContractError::InvalidGoal);
        }

        inst.set(&KEY_SOFT_CAP, &soft_cap);
        inst.set(&KEY_STRETCH_GOAL, &stretch_goal);

        env.events().publish(
            ("crowdfund", "caps_configured"),
            EventCapsConfigured {
                soft_cap,
                stretch_goal,
            },
        );
        Ok(())
    }

    // ── Issue #695: Track released amount; refund only unreleased on cancel ──

    /// Records that `amount` stroops have been released to the creator
    /// (e.g. via a milestone payout). Admin/creator only.
    ///
    /// This is called internally by milestone-release logic so that
    /// `refund_single` knows how much has already left the contract.
    pub fn record_release(env: Env, amount: i128) -> Result<(), ContractError> {
        withdraw::record_release(env, amount)
    }

    /// Returns the total amount already released to the creator.
    pub fn released_amount(env: Env) -> i128 {
        withdraw::released_amount(env)
    }

    // ── Issue #696: Timelocked pause ─────────────────────────────────────────

    /// Sets the timelock duration (in seconds) that must elapse after pausing
    /// before the campaign can be unpaused. Admin only.
    ///
    /// Set to 0 to disable the timelock (instant unpause allowed).
    pub fn set_pause_timelock(env: Env, timelock_seconds: u64) -> Result<(), ContractError> {
        access::set_pause_timelock(env, timelock_seconds)
    }

    // ── Issue #697: Allow/deny list (clean API over whitelist/blacklist) ──────

    /// Adds an address to the allow list (admin only).
    ///
    /// Alias for `add_to_whitelist` with a dedicated event so indexers can
    /// distinguish the two APIs.
    pub fn add_to_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
        access::add_to_allowlist(env, address)
    }

    /// Removes an address from the allow list (admin only).
    pub fn remove_from_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
        access::remove_from_allowlist(env, address)
    }

    /// Adds an address to the deny list (admin only).
    ///
    /// Alias for `add_to_blacklist` with a dedicated event.
    pub fn add_to_denylist(env: Env, address: Address) -> Result<(), ContractError> {
        access::add_to_denylist(env, address)
    }
}

#[cfg(test)]
mod panic_safety_tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup_client(env: &Env) -> CrowdfundContractClient<'_> {
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CrowdfundContract);
        CrowdfundContractClient::new(env, &contract_id)
    }

    #[test]
    fn test_no_panic_on_overflow() {
        let env = Env::default();
        let client = setup_client(&env);
        let addr = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin);

        env.ledger().set_timestamp(100);
        // Initialize a valid campaign first so contribute reaches arithmetic paths.
        client.initialize(
            &addr,
            &token_id,
            &10_000,
            &1_000_000,
            &100,
            &0i128,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
            &None,
            &None,
            &None,
            &Category::Other,
            &None,
            &None,
        );

        // A huge amount must surface as a contract error, never a host panic.
        let result =
            client.try_contribute(&addr, &i128::MAX, &token_id, &None);
        assert!(result.is_err());
    }

    #[test]
    fn test_no_panic_on_uninitialized() {
        let env = Env::default();
        let client = setup_client(&env);
        let addr = Address::generate(&env);
        let token_id = Address::generate(&env);

        // Contribute to an uninitialized campaign must error, not panic.
        let result = client.try_contribute(&addr, &100, &token_id, &None);
        assert!(result.is_err());
    }

    #[test]
    fn test_no_panic_on_invalid_goal() {
        let env = Env::default();
        let client = setup_client(&env);
        let creator = Address::generate(&env);
        let token_id = Address::generate(&env);

        env.ledger().set_timestamp(100);
        // Zero goal is invalid and must error, not panic.
        let result = client.try_initialize(
            &creator,
            &token_id,
            &0,
            &(env.ledger().timestamp() + 1000),
            &0,
            &0,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
            &None,
            &None,
            &None,
            &Category::Other,
            &None,
            &None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_no_panic_on_uninitialized_admin_paths() {
        let env = Env::default();
        let client = setup_client(&env);
        let addr = Address::generate(&env);

        // Admin/creator-only entry points on an uninitialized contract must
        // return a typed error instead of panicking on a missing storage key.
        assert!(client.try_pause().is_err());
        assert!(client.try_resume().is_err());
        assert!(client.try_execute_emergency_withdrawal().is_err());
        assert!(client.try_cancel_emergency_withdrawal().is_err());
        assert!(client.try_set_caps(&0, &0).is_err());
        assert!(client.try_update_category(&Category::Other).is_err());
        assert!(client.try_propose_extension(&1_000_000).is_err());
        assert!(client
            .try_setup_matching(&addr, &10_000, &1_000)
            .is_err());
        assert!(client
            .try_configure_yield(&addr, &1_000, &500)
            .is_err());
    }

    #[test]
    fn test_no_panic_on_past_deadline() {
        let env = Env::default();
        let client = setup_client(&env);
        let creator = Address::generate(&env);
        let token_id = Address::generate(&env);

        env.ledger().set_timestamp(10_000);
        // Past deadline is invalid and must error, not panic.
        let result = client.try_initialize(
            &creator,
            &token_id,
            &1000,
            &9_000,
            &0,
            &0,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
            &None,
            &None,
            &None,
            &Category::Other,
            &None,
            &None,
        );
        assert!(result.is_err());
    }
}

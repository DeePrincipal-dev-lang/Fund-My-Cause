//! # Shared Event Helpers for Fund-My-Cause Contracts
//!
//! This module provides standardized event emission helpers for all contracts
//! in the Fund-My-Cause ecosystem. Events are structured for easy consumption
//! by indexers and off-chain services.

use soroban_sdk::{symbol_short, Address, Env, String, Symbol, Val, Vec};

/// Shared starting schema version for all contract events. Each contract
/// re-exports this as its own `EVENT_SCHEMA_VERSION` so a future divergence
/// (one contract's event shapes evolving faster than another's) is a
/// one-line change at the re-export site, not a breaking change to this
/// shared constant.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ================================================================
// Shared Event Topics
// ================================================================

/// Standardized event topics for all contracts
pub mod topics {
    use soroban_sdk::{symbol_short, Symbol};

    // ── Registry Events ────────────────────────────────────────────
    pub const REGISTRY_INITIALIZED: Symbol = symbol_short!("reg_init");
    pub const REGISTRY_PROJECT_REGISTERED: Symbol = symbol_short!("reg_proj");
    pub const REGISTRY_PROJECT_UPDATED: Symbol = symbol_short!("reg_upd");
    pub const REGISTRY_PROJECT_VERIFIED: Symbol = symbol_short!("reg_ver");
    pub const REGISTRY_PROJECT_ARCHIVED: Symbol = symbol_short!("reg_arch");

    // ── Crowdfund Events ──────────────────────────────────────────
    pub const CAMPAIGN_INITIALIZED: Symbol = symbol_short!("camp_init");
    pub const CAMPAIGN_CONTRIBUTED: Symbol = symbol_short!("camp_cont");
    pub const CAMPAIGN_WITHDRAWN: Symbol = symbol_short!("camp_with");
    pub const CAMPAIGN_REFUNDED: Symbol = symbol_short!("camp_ref");
    pub const CAMPAIGN_CANCELLED: Symbol = symbol_short!("camp_can");
    pub const CAMPAIGN_PAUSED: Symbol = symbol_short!("camp_pau");
    pub const CAMPAIGN_RESUMED: Symbol = symbol_short!("camp_res");

    // ── Dispute Events ────────────────────────────────────────────
    pub const DISPUTE_CREATED: Symbol = symbol_short!("disp_crt");
    pub const DISPUTE_RESOLVED: Symbol = symbol_short!("disp_res");
    pub const DISPUTE_APPEALED: Symbol = symbol_short!("disp_app");

    // ── Milestone Events ──────────────────────────────────────────
    pub const MILESTONE_ADDED: Symbol = symbol_short!("ms_add");
    pub const MILESTONE_VERIFIED: Symbol = symbol_short!("ms_ver");
    pub const MILESTONE_RELEASED: Symbol = symbol_short!("ms_rel");

    // ── Admin Events ──────────────────────────────────────────────
    pub const ADMIN_TRANSFERRED: Symbol = symbol_short!("adm_trf");
    pub const ADMIN_UPDATED: Symbol = symbol_short!("adm_upd");
    pub const FEE_CONFIGURED: Symbol = symbol_short!("fee_cfg");

    // ── Governance Events ─────────────────────────────────────────
    pub const PROPOSAL_CREATED: Symbol = symbol_short!("prop_crt");
    pub const PROPOSAL_VOTED: Symbol = symbol_short!("prop_vot");
    pub const PROPOSAL_EXECUTED: Symbol = symbol_short!("prop_exe");

    // ── Security Events ───────────────────────────────────────────
    pub const EMERGENCY_PAUSED: Symbol = symbol_short!("emrg_pau");
    pub const EMERGENCY_UNPAUSED: Symbol = symbol_short!("emrg_unp");
    pub const EMERGENCY_WITHDRAWN: Symbol = symbol_short!("emrg_wth");

    // ── System Events ─────────────────────────────────────────────
    pub const CONTRACT_UPGRADED: Symbol = symbol_short!("sys_upg");
    pub const CONTRACT_MIGRATED: Symbol = symbol_short!("sys_mig");
    pub const CONFIGURATION_UPDATED: Symbol = symbol_short!("sys_cfg");

    // ── Achievements Events ───────────────────────────────────────
    pub const ACHIEVEMENT_UNLOCKED: Symbol = symbol_short!("ach_unl");
    pub const ACHIEVEMENT_POINTS_AWARDED: Symbol = symbol_short!("ach_pts");

    // ── Quadratic Funding Events ───────────────────────────────────
    pub const QF_CALCULATED: Symbol = symbol_short!("qf_calc");
}

// ================================================================
// Event Helper Functions
// ================================================================

/// Standard event emitter with versioning
pub struct EventEmitter;

impl EventEmitter {
    /// Emit a simple event with a single payload
    pub fn emit<T: soroban_sdk::IntoVal<Env, Val>>(
        env: &Env,
        topic: Symbol,
        data: T,
    ) {
        env.events().publish((topic, "v1"), data);
    }

    /// Emit an event with version
    pub fn emit_with_version<T: soroban_sdk::IntoVal<Env, Val>>(
        env: &Env,
        topic: Symbol,
        version: &str,
        data: T,
    ) {
        env.events().publish((topic, Symbol::new(env, version)), data);
    }

    /// Emit a typed event with standard fields
    pub fn emit_typed<T: soroban_sdk::IntoVal<Env, Val>>(
        env: &Env,
        topic: Symbol,
        event: T,
    ) {
        env.events().publish((topic, "v1"), event);
    }

    // ── Registry Events ────────────────────────────────────────────

    /// Emit registry initialized event
    pub fn registry_initialized(env: &Env, admin: Address) {
        Self::emit(env, topics::REGISTRY_INITIALIZED, (admin, env.ledger().timestamp()));
    }

    /// Emit project registered event
    pub fn project_registered(
        env: &Env,
        project_id: u64,
        creator: Address,
        name: String,
        category: String,
    ) {
        Self::emit(
            env,
            topics::REGISTRY_PROJECT_REGISTERED,
            (project_id, creator, name, category, env.ledger().timestamp()),
        );
    }

    /// Emit project updated event
    pub fn project_updated(
        env: &Env,
        project_id: u64,
        updated_by: Address,
    ) {
        Self::emit(
            env,
            topics::REGISTRY_PROJECT_UPDATED,
            (project_id, updated_by, env.ledger().timestamp()),
        );
    }

    /// Emit project verified event
    pub fn project_verified(
        env: &Env,
        project_id: u64,
        verifier: Address,
    ) {
        Self::emit(
            env,
            topics::REGISTRY_PROJECT_VERIFIED,
            (project_id, verifier, env.ledger().timestamp()),
        );
    }

    /// Emit project archived event
    pub fn project_archived(
        env: &Env,
        project_id: u64,
        archived_by: Address,
    ) {
        Self::emit(
            env,
            topics::REGISTRY_PROJECT_ARCHIVED,
            (project_id, archived_by, env.ledger().timestamp()),
        );
    }

    // ── Campaign Events ────────────────────────────────────────────

    /// Emit campaign initialized event
    pub fn campaign_initialized(
        env: &Env,
        campaign_id: u64,
        creator: Address,
        goal: i128,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_INITIALIZED,
            (campaign_id, creator, goal, env.ledger().timestamp()),
        );
    }

    /// Emit contribution made event
    pub fn contribution_made(
        env: &Env,
        campaign_id: u64,
        contributor: Address,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_CONTRIBUTED,
            (campaign_id, contributor, amount, env.ledger().timestamp()),
        );
    }

    /// Emit funds withdrawn event
    pub fn funds_withdrawn(
        env: &Env,
        campaign_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_WITHDRAWN,
            (campaign_id, recipient, amount, env.ledger().timestamp()),
        );
    }

    /// Emit refund event
    pub fn refund_issued(
        env: &Env,
        campaign_id: u64,
        contributor: Address,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_REFUNDED,
            (campaign_id, contributor, amount, env.ledger().timestamp()),
        );
    }

    /// Emit campaign cancelled event
    pub fn campaign_cancelled(
        env: &Env,
        campaign_id: u64,
        cancelled_by: Address,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_CANCELLED,
            (campaign_id, cancelled_by, env.ledger().timestamp()),
        );
    }

    /// Emit campaign paused event
    pub fn campaign_paused(
        env: &Env,
        campaign_id: u64,
        paused_by: Address,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_PAUSED,
            (campaign_id, paused_by, env.ledger().timestamp()),
        );
    }

    /// Emit campaign resumed event
    pub fn campaign_resumed(
        env: &Env,
        campaign_id: u64,
        resumed_by: Address,
    ) {
        Self::emit(
            env,
            topics::CAMPAIGN_RESUMED,
            (campaign_id, resumed_by, env.ledger().timestamp()),
        );
    }

    // ── Dispute Events ────────────────────────────────────────────

    /// Emit dispute created event
    pub fn dispute_created(
        env: &Env,
        dispute_id: u64,
        campaign_id: u64,
        initiator: Address,
        reason: String,
    ) {
        Self::emit(
            env,
            topics::DISPUTE_CREATED,
            (dispute_id, campaign_id, initiator, reason, env.ledger().timestamp()),
        );
    }

    /// Emit dispute resolved event
    pub fn dispute_resolved(
        env: &Env,
        dispute_id: u64,
        resolver: Address,
        outcome: String,
    ) {
        Self::emit(
            env,
            topics::DISPUTE_RESOLVED,
            (dispute_id, resolver, outcome, env.ledger().timestamp()),
        );
    }

    /// Emit dispute appealed event
    pub fn dispute_appealed(
        env: &Env,
        dispute_id: u64,
        appellant: Address,
        reason: String,
    ) {
        Self::emit(
            env,
            topics::DISPUTE_APPEALED,
            (dispute_id, appellant, reason, env.ledger().timestamp()),
        );
    }

    // ── Milestone Events ───────────────────────────────────────────

    /// Emit milestone added event
    pub fn milestone_added(
        env: &Env,
        campaign_id: u64,
        milestone_id: u64,
        title: String,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::MILESTONE_ADDED,
            (campaign_id, milestone_id, title, amount, env.ledger().timestamp()),
        );
    }

    /// Emit milestone verified event
    pub fn milestone_verified(
        env: &Env,
        campaign_id: u64,
        milestone_id: u64,
        verifier: Address,
    ) {
        Self::emit(
            env,
            topics::MILESTONE_VERIFIED,
            (campaign_id, milestone_id, verifier, env.ledger().timestamp()),
        );
    }

    /// Emit milestone released event
    pub fn milestone_released(
        env: &Env,
        campaign_id: u64,
        milestone_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::MILESTONE_RELEASED,
            (campaign_id, milestone_id, recipient, amount, env.ledger().timestamp()),
        );
    }

    // ── Admin Events ──────────────────────────────────────────────

    /// Emit admin transferred event
    pub fn admin_transferred(
        env: &Env,
        old_admin: Address,
        new_admin: Address,
    ) {
        Self::emit(
            env,
            topics::ADMIN_TRANSFERRED,
            (old_admin, new_admin, env.ledger().timestamp()),
        );
    }

    /// Emit fee configured event
    pub fn fee_configured(
        env: &Env,
        fee_type: String,
        fee_rate: u32,
        configured_by: Address,
    ) {
        Self::emit(
            env,
            topics::FEE_CONFIGURED,
            (fee_type, fee_rate, configured_by, env.ledger().timestamp()),
        );
    }

    // ── Governance Events ──────────────────────────────────────────

    /// Emit proposal created event
    pub fn proposal_created(
        env: &Env,
        proposal_id: u64,
        proposer: Address,
        description: String,
    ) {
        Self::emit(
            env,
            topics::PROPOSAL_CREATED,
            (proposal_id, proposer, description, env.ledger().timestamp()),
        );
    }

    /// Emit proposal voted event
    pub fn proposal_voted(
        env: &Env,
        proposal_id: u64,
        voter: Address,
        support: bool,
        weight: i128,
    ) {
        Self::emit(
            env,
            topics::PROPOSAL_VOTED,
            (proposal_id, voter, support, weight, env.ledger().timestamp()),
        );
    }

    /// Emit proposal executed event
    pub fn proposal_executed(
        env: &Env,
        proposal_id: u64,
        executor: Address,
    ) {
        Self::emit(
            env,
            topics::PROPOSAL_EXECUTED,
            (proposal_id, executor, env.ledger().timestamp()),
        );
    }

    // ── Security Events ────────────────────────────────────────────

    /// Emit emergency paused event
    pub fn emergency_paused(
        env: &Env,
        paused_by: Address,
    ) {
        Self::emit(
            env,
            topics::EMERGENCY_PAUSED,
            (paused_by, env.ledger().timestamp()),
        );
    }

    /// Emit emergency unpaused event
    pub fn emergency_unpaused(
        env: &Env,
        unpaused_by: Address,
    ) {
        Self::emit(
            env,
            topics::EMERGENCY_UNPAUSED,
            (unpaused_by, env.ledger().timestamp()),
        );
    }

    /// Emit emergency withdrawn event
    pub fn emergency_withdrawn(
        env: &Env,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(
            env,
            topics::EMERGENCY_WITHDRAWN,
            (recipient, amount, env.ledger().timestamp()),
        );
    }

    // ── System Events ──────────────────────────────────────────────

    /// Emit contract upgraded event
    pub fn contract_upgraded(
        env: &Env,
        new_version: String,
        upgraded_by: Address,
    ) {
        Self::emit(
            env,
            topics::CONTRACT_UPGRADED,
            (new_version, upgraded_by, env.ledger().timestamp()),
        );
    }

    /// Emit contract migrated event
    pub fn contract_migrated(
        env: &Env,
        from_version: u32,
        to_version: u32,
        migrated_by: Address,
    ) {
        Self::emit(
            env,
            topics::CONTRACT_MIGRATED,
            (from_version, to_version, migrated_by, env.ledger().timestamp()),
        );
    }

    // ── Achievements Events ─────────────────────────────────────────

    /// Emit achievement unlocked event
    pub fn achievement_unlocked(
        env: &Env,
        user: Address,
        achievement_type: u32,
        points_earned: u32,
    ) {
        Self::emit(
            env,
            topics::ACHIEVEMENT_UNLOCKED,
            (user, achievement_type, points_earned, env.ledger().timestamp()),
        );
    }

    /// Emit achievement points awarded event
    pub fn achievement_points_awarded(
        env: &Env,
        user: Address,
        points: u32,
        total_points: u32,
    ) {
        Self::emit(
            env,
            topics::ACHIEVEMENT_POINTS_AWARDED,
            (user, points, total_points, env.ledger().timestamp()),
        );
    }

    // ── Quadratic Funding Events ─────────────────────────────────────

    /// Emit QF round calculated event
    pub fn qf_calculated(
        env: &Env,
        total_distributed: i128,
        remaining_pool: i128,
        recipients_funded: u64,
    ) {
        Self::emit(
            env,
            topics::QF_CALCULATED,
            (total_distributed, remaining_pool, recipients_funded, env.ledger().timestamp()),
        );
    }
}

// ================================================================
// Event Schema Documentation
// ================================================================

// Event schema for indexer consumption
//
// All events follow this structure:
//
// ```json
// {
//   "topic": "event_name",
//   "version": "v1",
//   "data": {
//     // Event-specific fields
//   },
//   "timestamp": 1234567890
// }
// ```
//
// ## Registry Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Registry Initialized | `reg_init` | `admin`, `timestamp` |
// | Project Registered | `reg_proj` | `project_id`, `creator`, `name`, `category`, `timestamp` |
// | Project Updated | `reg_upd` | `project_id`, `updated_by`, `timestamp` |
// | Project Verified | `reg_ver` | `project_id`, `verifier`, `timestamp` |
// | Project Archived | `reg_arch` | `project_id`, `archived_by`, `timestamp` |
//
// ## Campaign Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Campaign Initialized | `camp_init` | `campaign_id`, `creator`, `goal`, `timestamp` |
// | Contribution Made | `camp_cont` | `campaign_id`, `contributor`, `amount`, `timestamp` |
// | Funds Withdrawn | `camp_with` | `campaign_id`, `recipient`, `amount`, `timestamp` |
// | Refund Issued | `camp_ref` | `campaign_id`, `contributor`, `amount`, `timestamp` |
// | Campaign Cancelled | `camp_can` | `campaign_id`, `cancelled_by`, `timestamp` |
// | Campaign Paused | `camp_pau` | `campaign_id`, `paused_by`, `timestamp` |
// | Campaign Resumed | `camp_res` | `campaign_id`, `resumed_by`, `timestamp` |
//
// ## Dispute Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Dispute Created | `disp_crt` | `dispute_id`, `campaign_id`, `initiator`, `reason`, `timestamp` |
// | Dispute Resolved | `disp_res` | `dispute_id`, `resolver`, `outcome`, `timestamp` |
// | Dispute Appealed | `disp_app` | `dispute_id`, `appellant`, `reason`, `timestamp` |
//
// ## Milestone Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Milestone Added | `ms_add` | `campaign_id`, `milestone_id`, `title`, `amount`, `timestamp` |
// | Milestone Verified | `ms_ver` | `campaign_id`, `milestone_id`, `verifier`, `timestamp` |
// | Milestone Released | `ms_rel` | `campaign_id`, `milestone_id`, `recipient`, `amount`, `timestamp` |
//
// ## Admin Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Admin Transferred | `adm_trf` | `old_admin`, `new_admin`, `timestamp` |
// | Fee Configured | `fee_cfg` | `fee_type`, `fee_rate`, `configured_by`, `timestamp` |
//
// ## Governance Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Proposal Created | `prop_crt` | `proposal_id`, `proposer`, `description`, `timestamp` |
// | Proposal Voted | `prop_vot` | `proposal_id`, `voter`, `support`, `weight`, `timestamp` |
// | Proposal Executed | `prop_exe` | `proposal_id`, `executor`, `timestamp` |
//
// ## Security Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Emergency Paused | `emrg_pau` | `paused_by`, `timestamp` |
// | Emergency Unpaused | `emrg_unp` | `unpaused_by`, `timestamp` |
// | Emergency Withdrawn | `emrg_wth` | `recipient`, `amount`, `timestamp` |
//
// ## System Events
//
// | Event | Topic | Data Fields |
// |-------|-------|-------------|
// | Contract Upgraded | `sys_upg` | `new_version`, `upgraded_by`, `timestamp` |
// | Contract Migrated | `sys_mig` | `from_version`, `to_version`, `migrated_by`, `timestamp` |

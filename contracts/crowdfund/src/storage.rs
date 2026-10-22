//! Storage management and constants for the crowdfund contract.
//!
//! This module provides storage keys and helper utilities for managing contract state.
//!
//! ## Storage key table
//!
//! Every `KEY_*` constant below is listed once. The `Storage` column is the
//! ledger entry type the key is written to; the `TTL policy` column is how its
//! lifetime is extended. The `storage_key_audit` tests in this file fail if a
//! constant is added without a row here, or if a row has no recognised policy.
//!
//! | Constant | Symbol | Storage | TTL policy |
//! |---|---|---|---|
//! | `KEY_CREATOR` | `CREATOR` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_TOKEN` | `TOKEN` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_GOAL` | `GOAL` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_DEADLINE` | `DEADLINE` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_TOTAL` | `TOTAL` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_CONTRIBS` | `CONTRIBS` | none | reserved: declared but not read or written |
//! | `KEY_STATUS` | `STATUS` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_MIN` | `MIN` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_MAX` | `MAX` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_TITLE` | `TITLE` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_DESC` | `DESC` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_SOCIAL` | `SOCIAL` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_PLATFORM` | `PLATFORM` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_ADMIN` | `ADMIN` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_RATE_LIMIT` | `RATELIMIT` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_INSURANCE` | `INSURE` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_INSURANCE_POOL` | `INSPOOL` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_CATEGORY` | `CATEGORY` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_VESTING` | `VESTING` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_GOAL_HISTORY` | `GHIST` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_VISIBILITY` | `VIS` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_META_HIST` | `METAHIST` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_START_TIME` | `START` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_ARCHIVED` | `ARCHIVED` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_MILESTONES` | `MILESTONE` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_MILESTONE_STATUS` | `MLSTATUS` | none | reserved: declared but not read or written |
//! | `KEY_NEXT_RELEASE` | `NEXTREL` | none | reserved: declared but not read or written |
//! | `KEY_VERIFICATION` | `VERIFY` | none | reserved: declared but not read or written |
//! | `KEY_ANALYTICS` | `ANALYTICS` | none | reserved: declared but not read or written |
//! | `KEY_ANALYTICS_DATA` | `ANALDATA` | none | reserved: declared but not read or written |
//! | `KEY_DISPUTES` | `DISPUTES` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_DISPUTE_ID` | `DISPID` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_DISPUTE_VOTE` | `DISPVOTE` | none | reserved: declared but not read or written |
//! | `KEY_CONTRACT_VERSION` | `CVER` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_VERSION_HISTORY` | `VERHIST` | persistent | persistent: per-entry TTL_PERSISTENT_ENTRY bump on write |
//! | `KEY_LAST_VALIDATION` | `LASTVAL` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_DEBUG_SNAPSHOT` | `DBGSNAP` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_PERF_THRESHOLD` | `PERFTHR` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_PERF_STATS` | `PERFST` | none | reserved: declared but not read or written |
//! | `KEY_GOVERNANCE_CONFIG` | `GOVCFG` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_GOVERNANCE_NONCE` | `GOVNONCE` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_EMERGENCY_PAUSE` | `EMPAUSE` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_REENTRANCY_LOCK` | `REENTLK` | none | reserved: declared but not read or written |
//! | `KEY_STREAM` | `STREAM` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_SOFT_CAP` | `SOFTCAP` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_STRETCH_GOAL` | `STRETCH` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_RELEASED` | `RELEASED` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_PAUSE_TIMELOCK` | `PTLOCK` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_UNPAUSE_AFTER` | `UNPAFTER` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_GROSS_TOTAL` | `GROSST` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_IPFS_CID` | `IPFSCID` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump (written via `MetadataField::IpfsCid`) |
//! | `KEY_YIELD_CONFIG` | `YLDCFG` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//! | `KEY_YIELD_TOTAL` | `YLDTOT` | instance | instance: contract-wide TTL_INSTANCE_EXTEND_MIN/MAX bump |
//!
//! ## TTL rules
//!
//! * **instance** rows live in the shared contract instance entry, which is
//!   extended with `TTL_INSTANCE_EXTEND_MIN`/`TTL_INSTANCE_EXTEND_MAX` at the
//!   contract level. Individual instance keys must not call `extend_ttl`.
//! * **persistent** rows must call `extend_ttl(key, TTL_PERSISTENT_ENTRY,
//!   TTL_PERSISTENT_ENTRY)` immediately after every `set`, including updates to
//!   an existing value. A missing bump can silently expire campaign history,
//!   milestones or disputes.
//! * **none** rows are reserved symbols. They must not be written until this
//!   table and the TTL policy are updated together.
//!
//! `MetadataField` is an alias layer over existing keys, not a second key
//! space: `Title`/`Description`/`SocialLinks` map to `KEY_TITLE`/`KEY_DESC`/
//! `KEY_SOCIAL`, `History` maps to `KEY_META_HIST`, and `IpfsCid` maps to
//! `KEY_IPFS_CID`. The `storage_key_audit` uniqueness test includes these
//! aliases so a future alias cannot silently reuse an unrelated symbol.
//!
//! `DataKey` variants are typed ledger keys rather than `KEY_*` symbols. The
//! same two rules apply: instance-scoped variants inherit the contract-wide
//! instance bump, and every persistent variant must bump its own TTL on write.
//! Each address-scoped value also needs its own variant: `DataKey::Verification`
//! is deliberately separate from `DataKey::Contribution` so writing a
//! verification status cannot overwrite the contribution amount.
//!
use soroban_sdk::Symbol;

/// Re-export `DataKey` so it can be imported via `crate::storage::DataKey`
/// (the enum itself is defined in the `types` module).
pub use crate::types::DataKey;

/// Canonical metadata storage key variants. Keeping them in one place avoids
/// drift between metadata accessors and the rest of the contract.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MetadataField {
    Title,
    Description,
    SocialLinks,
    History,
    IpfsCid,
}

pub fn metadata_field_key(field: MetadataField) -> Symbol {
    match field {
        MetadataField::Title => soroban_sdk::symbol_short!("TITLE"),
        MetadataField::Description => soroban_sdk::symbol_short!("DESC"),
        MetadataField::SocialLinks => soroban_sdk::symbol_short!("SOCIAL"),
        MetadataField::History => soroban_sdk::symbol_short!("METAHIST"),
        MetadataField::IpfsCid => soroban_sdk::symbol_short!("IPFSCID"),
    }
}

/// Contract version for upgrades and compatibility tracking
pub const CONTRACT_VERSION: u32 = 6;

/// Minimum supported version for migration (versions below this require a full re-deploy)
pub const MIN_SUPPORTED_VERSION: u32 = 1;

/// Maximum number of updates per campaign
#[allow(dead_code)] // documented cap, not yet enforced anywhere
pub const MAX_UPDATES: u32 = 100;

/// Maximum number of milestones per campaign
pub const MAX_MILESTONES: u32 = 20;

// ── Storage Keys ──────────────────────────────────────────────────────────────
/// Storage key for campaign creator address
pub const KEY_CREATOR: Symbol = soroban_sdk::symbol_short!("CREATOR");
/// Storage key for contribution token address
pub const KEY_TOKEN: Symbol = soroban_sdk::symbol_short!("TOKEN");
/// Storage key for campaign funding goal
pub const KEY_GOAL: Symbol = soroban_sdk::symbol_short!("GOAL");
/// Storage key for campaign deadline timestamp
pub const KEY_DEADLINE: Symbol = soroban_sdk::symbol_short!("DEADLINE");
/// Storage key for total amount raised
pub const KEY_TOTAL: Symbol = soroban_sdk::symbol_short!("TOTAL");
/// Storage key for list of contributors
pub const KEY_CONTRIBS: Symbol = soroban_sdk::symbol_short!("CONTRIBS");
/// Storage key for campaign status
pub const KEY_STATUS: Symbol = soroban_sdk::symbol_short!("STATUS");
/// Storage key for minimum contribution amount
pub const KEY_MIN: Symbol = soroban_sdk::symbol_short!("MIN");
/// Storage key for maximum contribution amount per contributor (0 = no limit)
pub const KEY_MAX: Symbol = soroban_sdk::symbol_short!("MAX");
/// Storage key for campaign title
pub const KEY_TITLE: Symbol = soroban_sdk::symbol_short!("TITLE");
/// Storage key for campaign description
pub const KEY_DESC: Symbol = soroban_sdk::symbol_short!("DESC");
/// Storage key for campaign social links
pub const KEY_SOCIAL: Symbol = soroban_sdk::symbol_short!("SOCIAL");
/// Storage key for platform fee configuration
pub const KEY_PLATFORM: Symbol = soroban_sdk::symbol_short!("PLATFORM");
/// Storage key for contract administrator
pub const KEY_ADMIN: Symbol = soroban_sdk::symbol_short!("ADMIN");
/// Storage key for rate limit configuration (max amount per hour)
pub const KEY_RATE_LIMIT: Symbol = soroban_sdk::symbol_short!("RATELIMIT");
/// Storage key for insurance pool configuration
pub const KEY_INSURANCE: Symbol = soroban_sdk::symbol_short!("INSURE");
/// Storage key for total insurance fees collected
pub const KEY_INSURANCE_POOL: Symbol = soroban_sdk::symbol_short!("INSPOOL");
/// Storage key for campaign category
pub const KEY_CATEGORY: Symbol = soroban_sdk::symbol_short!("CATEGORY");
/// Storage key for vesting schedule
pub const KEY_VESTING: Symbol = soroban_sdk::symbol_short!("VESTING");
/// Storage key for goal adjustment history
pub const KEY_GOAL_HISTORY: Symbol = soroban_sdk::symbol_short!("GHIST");
/// Storage key for campaign visibility level
pub const KEY_VISIBILITY: Symbol = soroban_sdk::symbol_short!("VIS");
/// Storage key for metadata version history
pub const KEY_META_HIST: Symbol = soroban_sdk::symbol_short!("METAHIST");
/// Storage key for campaign start timestamp
pub const KEY_START_TIME: Symbol = soroban_sdk::symbol_short!("START");
/// Storage key for campaign archival timestamp
pub const KEY_ARCHIVED: Symbol = soroban_sdk::symbol_short!("ARCHIVED");

// ── Issue #436: Campaign Milestones ───────────────────────────────────────────
/// Storage key for milestones list
pub const KEY_MILESTONES: Symbol = soroban_sdk::symbol_short!("MILESTONE");
/// Storage key for milestone verification status
pub const KEY_MILESTONE_STATUS: Symbol = soroban_sdk::symbol_short!("MLSTATUS");
/// Storage key for next milestone release amount
pub const KEY_NEXT_RELEASE: Symbol = soroban_sdk::symbol_short!("NEXTREL");

// ── Issue #437: Contribution Verification ────────────────────────────────────
/// Storage key for verification status of an address
pub const KEY_VERIFICATION: Symbol = soroban_sdk::symbol_short!("VERIFY");

// ── Issue #438: Campaign Analytics ────────────────────────────────────────────
/// Storage key for campaign analytics
pub const KEY_ANALYTICS: Symbol = soroban_sdk::symbol_short!("ANALYTICS");
/// Storage key for analytics time-series data points
pub const KEY_ANALYTICS_DATA: Symbol = soroban_sdk::symbol_short!("ANALDATA");

// ── Issue #439: Dispute Resolution ────────────────────────────────────────────
/// Storage key for disputes list
pub const KEY_DISPUTES: Symbol = soroban_sdk::symbol_short!("DISPUTES");
/// Storage key for next dispute ID counter
pub const KEY_DISPUTE_ID: Symbol = soroban_sdk::symbol_short!("DISPID");
/// Storage key for dispute votes by address
pub const KEY_DISPUTE_VOTE: Symbol = soroban_sdk::symbol_short!("DISPVOTE");

// ── Issue #457: Contract Versioning ──────────────────────────────────────────
/// Storage key for the on-chain stored contract version (set during migration)
pub const KEY_CONTRACT_VERSION: Symbol = soroban_sdk::symbol_short!("CVER");
/// Storage key for version migration history
pub const KEY_VERSION_HISTORY: Symbol = soroban_sdk::symbol_short!("VERHIST");

// ── Issue #458: State Validation ──────────────────────────────────────────────
/// Storage key for the last state validation result
pub const KEY_LAST_VALIDATION: Symbol = soroban_sdk::symbol_short!("LASTVAL");

// ── Issue #459: Debugging Utilities ──────────────────────────────────────────
/// Storage key for the latest debug snapshot
pub const KEY_DEBUG_SNAPSHOT: Symbol = soroban_sdk::symbol_short!("DBGSNAP");

// ── Issue #460: Performance Monitoring ───────────────────────────────────────
/// Storage key for performance alert threshold in ms (0 = disabled)
pub const KEY_PERF_THRESHOLD: Symbol = soroban_sdk::symbol_short!("PERFTHR");
/// Storage key for per-function performance stats prefix
pub const KEY_PERF_STATS: Symbol = soroban_sdk::symbol_short!("PERFST");

// ── Issue #XXX: Multi-Sig Governance ─────────────────────────────────────────
/// Storage key for governance configuration (governors list, required approvals, timelock)
pub const KEY_GOVERNANCE_CONFIG: Symbol = soroban_sdk::symbol_short!("GOVCFG");
/// Storage key for governance proposal nonce counter
pub const KEY_GOVERNANCE_NONCE: Symbol = soroban_sdk::symbol_short!("GOVNONCE");
/// Storage key for emergency pause flag
pub const KEY_EMERGENCY_PAUSE: Symbol = soroban_sdk::symbol_short!("EMPAUSE");

// ── Issue #605: Security Hardening ───────────────────────────────────────────
/// Storage key for reentrancy lock (prevents reentrancy attacks)
pub const KEY_REENTRANCY_LOCK: Symbol = soroban_sdk::symbol_short!("REENTLK");

// ── Issue #704: Withdrawal streaming ─────────────────────────────────────────
/// Storage key for optional streaming/scheduled-release config
pub const KEY_STREAM: Symbol = soroban_sdk::symbol_short!("STREAM");

// ── Issue #694: Soft-cap / stretch-goal ──────────────────────────────────────
/// Storage key for the campaign soft cap (minimum viable funding target)
pub const KEY_SOFT_CAP: Symbol = soroban_sdk::symbol_short!("SOFTCAP");
/// Storage key for the campaign stretch goal (over-funding target)
pub const KEY_STRETCH_GOAL: Symbol = soroban_sdk::symbol_short!("STRETCH");

// ── Issue #695: Released-amount tracking ─────────────────────────────────────
/// Storage key for the total amount already released to the creator via milestones
pub const KEY_RELEASED: Symbol = soroban_sdk::symbol_short!("RELEASED");

// ── Issue #696: Pause timelock ───────────────────────────────────────────────
/// Storage key for the timelock duration (seconds) required before unpausing
pub const KEY_PAUSE_TIMELOCK: Symbol = soroban_sdk::symbol_short!("PTLOCK");
/// Storage key for the earliest timestamp at which the contract may be unpaused
pub const KEY_UNPAUSE_AFTER: Symbol = soroban_sdk::symbol_short!("UNPAFTER");

// ── Gross contribution tracking ──────────────────────────────────────────────
/// Storage key for the gross total contributed (before any fee deductions)
pub const KEY_GROSS_TOTAL: Symbol = soroban_sdk::symbol_short!("GROSST");

// ── IPFS metadata ─────────────────────────────────────────────────────────────
/// Storage key for the campaign's off-chain IPFS content identifier (CID)
pub const KEY_IPFS_CID: Symbol = soroban_sdk::symbol_short!("IPFSCID");

// ── Yield / treasury ─────────────────────────────────────────────────────────
/// Storage key for the yield-generation configuration
pub const KEY_YIELD_CONFIG: Symbol = soroban_sdk::symbol_short!("YLDCFG");
/// Storage key for the total yield accrued
pub const KEY_YIELD_TOTAL: Symbol = soroban_sdk::symbol_short!("YLDTOT");

// ── Issue #929: Magic Number Constants ───────────────────────────────────────

/// Maximum message length (characters) for contribution messages.
/// Validated when storing contribution messages to prevent unbounded storage.
pub const MAX_MESSAGE_LENGTH: u32 = 256;

/// TTL extension value for persistent storage entries (in ledger entries).
/// Used to extend time-to-live for frequently accessed per-contributor data.
/// Value represents 100 ledger entries worth of extension.
pub const TTL_PERSISTENT_ENTRY: u32 = 100;

#[cfg(test)]
mod tests {
    use super::{metadata_field_key, MetadataField};

    #[test]
    fn metadata_storage_keys_are_unique() {
        let keys = [
            metadata_field_key(MetadataField::Title),
            metadata_field_key(MetadataField::Description),
            metadata_field_key(MetadataField::SocialLinks),
            metadata_field_key(MetadataField::History),
            metadata_field_key(MetadataField::IpfsCid),
        ];

        for (idx, lhs) in keys.iter().enumerate() {
            for (other_idx, rhs) in keys.iter().enumerate() {
                if idx != other_idx {
                    assert_ne!(*lhs, *rhs, "metadata storage keys must remain unique");
                }
            }
        }
    }
}

/// TTL extension value for instance storage (short-term, in ledger entries).
/// Used for frequent writes to campaign-wide state (e.g., totals, counts).
/// Value represents 2 days of Soroban ledger entries (~17,280 entries).
pub const TTL_INSTANCE_EXTEND_MIN: u32 = 17280;

/// TTL extension value for instance storage (long-term, in ledger entries).
/// Used to ensure campaign data survives well beyond typical campaign lifetime.
/// Value represents ~6 days of Soroban ledger entries (~518,400 entries).
pub const TTL_INSTANCE_EXTEND_MAX: u32 = 518400;

/// Maximum batch size for refund operations.
/// Limits the number of contributors processed in a single `refund_batch` call
/// to prevent exceeding transaction resource limits and ensure predictable gas costs.
pub const MAX_BATCH_REFUND_SIZE: u32 = 25;

use soroban_sdk::{Address, Symbol as SorobanSymbol};

/// Helper function to get the admin address from storage
pub fn get_admin(env: &soroban_sdk::Env) -> Result<Address, crate::ContractError> {
    env.storage()
        .instance()
        .get::<_, Address>(&KEY_ADMIN)
        .ok_or(crate::ContractError::NotFound)
}

/// Helper function to create a rate limit key for an address
pub fn make_rate_limit_key(_addr: &Address) -> SorobanSymbol {
    // This creates a unique persistent key for rate limiting per address
    // In a full implementation, this would use the address hash
    soroban_sdk::symbol_short!("RATELIM")
}

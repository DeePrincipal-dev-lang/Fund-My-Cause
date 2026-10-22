//! Contribution-domain types for the crowdfund contract.
//!
//! This module holds types related to contributions, fees, platform
//! configuration, rate limiting, delegation, and contribution history.

use soroban_sdk::{contracttype, Address, BytesN, Vec};

/// Fee mode used when computing platform fees on a contribution.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeeMode {
    /// Fee is deducted from the contribution amount.
    DeductFromContribution,
    /// Fee is added on top of the contribution amount.
    AddToContribution,
}

/// Platform configuration controlling fee collection.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformConfig {
    /// Address that receives platform fees.
    pub fee_recipient: Address,
    /// Fee in basis points (1/100th of a percent).
    pub fee_bps: u32,
    /// How the fee is applied to contributions.
    pub fee_mode: FeeMode,
}

/// Rate limit configuration for contributions.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimit {
    /// Maximum amount that can be contributed within the window.
    pub max_amount: i128,
    /// Window duration in seconds.
    pub window_seconds: u64,
}

/// Delegation record allowing one address to contribute on behalf of another.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Delegation {
    /// The delegator granting permission.
    pub delegator: Address,
    /// The delegate permitted to contribute.
    pub delegate: Address,
    /// Optional expiry ledger for the delegation.
    pub expires_at: Option<u64>,
}

/// A single entry in a contributor's history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionHistoryEntry {
    /// Ledger timestamp of the contribution.
    pub timestamp: u64,
    /// Amount contributed.
    pub amount: i128,
    /// Ledger sequence at which the contribution occurred.
    pub ledger: u32,
}

/// Full contribution history for a contributor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionHistory {
    /// Contributor the history belongs to.
    pub contributor: Address,
    /// Ordered list of contribution entries.
    pub entries: Vec<ContributionHistoryEntry>,
}

/// Record of a single contribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Contribution {
    /// Contributor address.
    pub contributor: Address,
    /// Amount contributed.
    pub amount: i128,
    /// Ledger timestamp of the contribution.
    pub timestamp: u64,
}

/// Key used to identify a rate-limit bucket.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimitKey {
    /// Contributor the bucket applies to.
    pub contributor: Address,
    /// Hash identifying the bucket window.
    pub bucket: BytesN<32>,
}
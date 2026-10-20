//! Contribution-family events.
//!
//! These structs were moved verbatim from `types/events.rs`. Names, `#[contracttype]`
//! attributes, field order, and emitted topics/payloads are unchanged.

use soroban_sdk::{contracttype, Address, BytesN, Symbol};

/// Emitted when a contribution is made to a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventContributed {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub total_raised: i128,
}

/// Emitted when a contribution is recorded in the contribution ledger.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventContributionRecorded {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a recurring contribution schedule is set up.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRecurringSetup {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub interval: u64,
    pub next_contribution_at: u64,
}

/// Emitted when a recurring contribution is executed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRecurringExecuted {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub executed_at: u64,
}

/// Emitted when a recurring contribution schedule is cancelled.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRecurringCancelled {
    pub campaign_id: u64,
    pub contributor: Address,
    pub cancelled_at: u64,
}

/// Emitted when a delegation is created for a contributor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDelegationCreated {
    pub campaign_id: u64,
    pub delegator: Address,
    pub delegate: Address,
    pub created_at: u64,
}

/// Emitted when a delegated contribution is made.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDelegatedContribution {
    pub campaign_id: u64,
    pub delegator: Address,
    pub delegate: Address,
    pub amount: i128,
}

/// Emitted when a delegation is revoked.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDelegationRevoked {
    pub campaign_id: u64,
    pub delegator: Address,
    pub delegate: Address,
    pub revoked_at: u64,
}

/// Emitted when a quadratic-funding contribution is recorded.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventQfContribution {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub weight: i128,
}

/// Emitted when rewards are accrued for a contributor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRewardsAccrued {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub total_accrued: i128,
}

/// Emitted when accrued rewards are claimed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRewardsClaimed {
    pub campaign_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub claimed_at: u64,
}

/// Emitted when a contribution stream is claimed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventStreamClaimed {
    pub campaign_id: u64,
    pub contributor: Address,
    pub stream_id: BytesN<32>,
    pub amount: i128,
    pub claimed_at: u64,
}

/// Emitted when a contribution is matched by a matching pool.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventContributionMatched {
    pub campaign_id: u64,
    pub contributor: Address,
    pub contribution: i128,
    pub matched: i128,
    pub source: Symbol,
}
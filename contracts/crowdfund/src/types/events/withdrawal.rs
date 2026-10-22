//! Withdrawal-family events.
//!
//! These events cover payouts from the campaign: creator withdrawals,
//! emergency withdrawals, yield configuration/claims, milestone releases,
//! and vesting-related payouts. Struct names, field order, and emitted
//! topics/payloads are kept byte-identical to the original definitions.

use soroban_sdk::{contracttype, Address, Symbol};

/// Emitted when the creator withdraws raised funds.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventWithdrawn {
    pub campaign_id: Symbol,
    pub creator: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when an emergency withdrawal is initiated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyInitiated {
    pub campaign_id: Symbol,
    pub initiator: Address,
    pub amount: i128,
    pub reason: Symbol,
    pub timestamp: u64,
}

/// Emitted when an emergency withdrawal is approved.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyApproved {
    pub campaign_id: Symbol,
    pub approver: Address,
    pub timestamp: u64,
}

/// Emitted when an emergency withdrawal is executed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyExecuted {
    pub campaign_id: Symbol,
    pub recipient: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when yield configuration is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventYieldConfigured {
    pub campaign_id: Symbol,
    pub enabled: bool,
    pub yield_rate: i128,
    pub timestamp: u64,
}

/// Emitted when accrued yield is claimed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventYieldClaimed {
    pub campaign_id: Symbol,
    pub recipient: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a milestone is released and funds are paid out.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventMilestoneRelease {
    pub campaign_id: Symbol,
    pub milestone_index: u32,
    pub recipient: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a vesting schedule is created.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventVestingCreated {
    pub campaign_id: Symbol,
    pub beneficiary: Address,
    pub total_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub timestamp: u64,
}

/// Emitted when vested funds are released.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventVestingReleased {
    pub campaign_id: Symbol,
    pub beneficiary: Address,
    pub amount: i128,
    pub timestamp: u64,
}
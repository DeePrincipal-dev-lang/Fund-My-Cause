//! Refund-family events.
//!
//! These events cover refunds issued to contributors, partial refunds,
//! batch refund completion, and insurance-related payouts. The struct names,
//! `#[contracttype]` attributes, and field order are preserved verbatim from
//! the original monolithic `events.rs` module so that emitted topics and
//! payloads remain byte-identical.

use soroban_sdk::{contracttype, Address, BytesN};

/// Emitted when a contributor is refunded.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRefunded {
    pub campaign_id: BytesN<32>,
    pub contributor: Address,
    pub amount: i128,
    pub timestamp: u64,
}

/// Emitted when a contributor receives a partial refund.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventPartialRefund {
    pub campaign_id: BytesN<32>,
    pub contributor: Address,
    pub refunded_amount: i128,
    pub remaining_amount: i128,
    pub timestamp: u64,
}

/// Emitted when a batch refund operation completes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventBatchRefundCompleted {
    pub campaign_id: BytesN<32>,
    pub total_refunded: i128,
    pub contributors_refunded: u32,
    pub timestamp: u64,
}

/// Emitted when insurance is enabled for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInsuranceEnabled {
    pub campaign_id: BytesN<32>,
    pub coverage_amount: i128,
    pub premium: i128,
    pub timestamp: u64,
}

/// Emitted when an insurance payout is made.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInsurancePayout {
    pub campaign_id: BytesN<32>,
    pub recipient: Address,
    pub payout_amount: i128,
    pub timestamp: u64,
}
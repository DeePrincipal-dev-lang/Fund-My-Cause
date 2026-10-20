//! Withdrawal-domain types for the crowdfund contract.
//!
//! This module contains types related to withdrawals, payouts, vesting,
//! streaming, yield, insurance, and governance.

use soroban_sdk::{contracttype, Address, BytesN, Vec};

/// Status of a withdrawal request.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WithdrawalStatus {
    /// Request has been created but not yet processed.
    Pending,
    /// Request has been approved and is awaiting execution.
    Approved,
    /// Request has been executed and funds transferred.
    Completed,
    /// Request was rejected or cancelled.
    Rejected,
}

/// A withdrawal request record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRequest {
    /// Unique identifier for the request.
    pub id: u64,
    /// Address requesting the withdrawal.
    pub requester: Address,
    /// Amount requested.
    pub amount: i128,
    /// Current status of the request.
    pub status: WithdrawalStatus,
    /// Ledger timestamp when the request was created.
    pub created_at: u64,
    /// Ledger timestamp when the request was processed.
    pub processed_at: u64,
}

/// Vesting schedule configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VestingSchedule {
    /// Beneficiary of the vesting schedule.
    pub beneficiary: Address,
    /// Total amount to be vested.
    pub total_amount: i128,
    /// Amount already claimed.
    pub claimed_amount: i128,
    /// Ledger timestamp when vesting starts.
    pub start_time: u64,
    /// Duration of the cliff period in seconds.
    pub cliff_duration: u64,
    /// Total vesting duration in seconds.
    pub vesting_duration: u64,
}

/// A single vesting claim record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VestingClaim {
    /// Beneficiary who claimed.
    pub beneficiary: Address,
    /// Amount claimed.
    pub amount: i128,
    /// Ledger timestamp of the claim.
    pub claimed_at: u64,
}

/// Streaming payment configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamConfig {
    /// Sender of the stream.
    pub sender: Address,
    /// Recipient of the stream.
    pub recipient: Address,
    /// Total amount to be streamed.
    pub total_amount: i128,
    /// Amount already withdrawn from the stream.
    pub withdrawn_amount: i128,
    /// Ledger timestamp when the stream starts.
    pub start_time: u64,
    /// Ledger timestamp when the stream ends.
    pub end_time: u64,
}

/// A stream withdrawal record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StreamWithdrawal {
    /// Recipient who withdrew.
    pub recipient: Address,
    /// Amount withdrawn.
    pub amount: i128,
    /// Ledger timestamp of the withdrawal.
    pub withdrawn_at: u64,
}

/// Yield distribution configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldConfig {
    /// Total yield pool amount.
    pub total_yield: i128,
    /// Amount of yield already distributed.
    pub distributed_yield: i128,
    /// Ledger timestamp when yield distribution started.
    pub start_time: u64,
    /// Ledger timestamp when yield distribution ends.
    pub end_time: u64,
}

/// A yield claim record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct YieldClaim {
    /// Claimant address.
    pub claimant: Address,
    /// Amount claimed.
    pub amount: i128,
    /// Ledger timestamp of the claim.
    pub claimed_at: u64,
}

/// Insurance pool configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InsuranceConfig {
    /// Total insurance pool amount.
    pub total_pool: i128,
    /// Amount of pool already paid out.
    pub paid_out: i128,
    /// Minimum contribution required to be eligible.
    pub min_contribution: i128,
}

/// An insurance claim record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InsuranceClaim {
    /// Claimant address.
    pub claimant: Address,
    /// Amount claimed.
    pub amount: i128,
    /// Reason or reference for the claim.
    pub reason: BytesN<32>,
    /// Ledger timestamp of the claim.
    pub claimed_at: u64,
}

/// Governance proposal for withdrawal-related decisions.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceProposal {
    /// Unique identifier for the proposal.
    pub id: u64,
    /// Address that created the proposal.
    pub proposer: Address,
    /// Description or reference hash of the proposal.
    pub description: BytesN<32>,
    /// Ledger timestamp when voting starts.
    pub voting_start: u64,
    /// Ledger timestamp when voting ends.
    pub voting_end: u64,
    /// Number of votes in favor.
    pub votes_for: i128,
    /// Number of votes against.
    pub votes_against: i128,
    /// Whether the proposal has been executed.
    pub executed: bool,
}

/// A governance vote record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceVote {
    /// Voter address.
    pub voter: Address,
    /// Proposal identifier voted on.
    pub proposal_id: u64,
    /// Whether the voter voted in favor.
    pub in_favor: bool,
    /// Voting power used.
    pub weight: i128,
    /// Ledger timestamp of the vote.
    pub voted_at: u64,
}

/// A payout record for a single recipient.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payout {
    /// Recipient address.
    pub recipient: Address,
    /// Amount paid out.
    pub amount: i128,
    /// Ledger timestamp of the payout.
    pub paid_at: u64,
}

/// Batch payout configuration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchPayout {
    /// List of individual payouts in the batch.
    pub payouts: Vec<Payout>,
    /// Ledger timestamp when the batch was created.
    pub created_at: u64,
    /// Whether the batch has been processed.
    pub processed: bool,
}
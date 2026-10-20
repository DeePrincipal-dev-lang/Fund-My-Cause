//! # Quadratic Funding Contract
//!
//! A pure mathematical computation library for quadratic funding allocations.
//!
//! ## Authorization Model
//!
//! This contract has **no access control** — it is a stateless, permissionless
//! computation library.  There are no admin-only functions, no `require_auth`
//! calls, and no persistent storage.
//!
//! The authorization boundary lives entirely in the **caller contract**
//! (`crowdfund`), which invokes `calculate_qf` as a cross-contract read-only
//! call.  The caller is responsible for verifying that only authorized parties
//! trigger the calculation.
//!
//! Per [ADR-004](../../docs/adr/ADR-004-contract-module-boundaries.md):
//! > "qf is a pure mathematical computation library without authorization
//! > requirements; no need for shared error handling or access control
//! > primitives."
//!
//! ## Invariants
//!
//! - Total distributed ≤ matching pool
//! - All payouts are non-negative
//! - Monotonicity: More contributions → More funding
//! - Zero contributions → Zero funding
//!
//! ## Formula
//!
//! For each recipient with total contribution C and contributor count N:
//! ```text
//! matching = pool × √N / Σ(√Nᵢ)
//! total    = C + matching
//! ```

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec, Map, String};

// ================================================================
// Quadratic Funding Core Logic
// ================================================================

/// Quadratic Funding calculation results
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QFResult {
    /// Amount distributed to each recipient
    pub allocations: Map<Address, i128>,
    /// Total pool used
    pub total_distributed: i128,
    /// Matching pool remaining
    pub remaining_pool: i128,
    /// Total unique contributors
    pub total_contributors: u64,
    /// Number of recipients funded
    pub recipients_funded: u64,
}

/// QF calculation inputs
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QFInput {
    /// Matching pool amount
    pub matching_pool: i128,
    /// Contributions: recipient address -> total contribution amount
    pub contributions: Map<Address, i128>,
    /// Number of contributors per recipient
    pub contributor_counts: Map<Address, u64>,
    /// Minimum funding threshold for a recipient to receive matching funds
    pub min_threshold: i128,
}

// ================================================================
// QF Error Types
// ================================================================

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum QFError {
    InvalidPoolAmount = 1,
    NoContributions = 2,
    NegativeContribution = 3,
    InsufficientPool = 4,
    NegativePayout = 5,
    RecipientBelowThreshold = 6,
    Overflow = 7,
    /// Wrapped host error from cross-contract invocation or SDK
    HostError = 255,
}

impl From<soroban_sdk::Error> for QFError {
    fn from(_: soroban_sdk::Error) -> Self {
        QFError::HostError
    }
}

impl From<common::CommonError> for QFError {
    /// Folds the shared [`common::CommonError`] variants into this crate's
    /// own error space (see `contracts/common/src/error.rs` and
    /// `contracts/ERROR_CONSOLIDATION.md`).
    ///
    /// `QuadraticFunding::calculate` is a pure, stateless computation with no
    /// auth/init/lookup concept of its own, so there is no exact match for
    /// most `CommonError` variants; each is mapped to the closest available
    /// domain-specific case so a future stateful QF entry point (e.g. one
    /// gated by `require_auth`) can reuse this conversion instead of
    /// inventing a parallel `Unauthorized`/`NotFound` variant.
    fn from(err: common::CommonError) -> Self {
        match err {
            common::CommonError::Unauthorized => QFError::InvalidPoolAmount,
            common::CommonError::NotFound => QFError::NoContributions,
            common::CommonError::InvalidInput => QFError::NegativeContribution,
            common::CommonError::AlreadyInitialized => QFError::InvalidPoolAmount,
            common::CommonError::AlreadyExists => QFError::RecipientBelowThreshold,
            common::CommonError::NotInitialized => QFError::NoContributions,
        }
    }
}

// ================================================================
// Quadratic Funding Calculator
// ================================================================

pub struct QuadraticFunding;

impl QuadraticFunding {
    /// Calculate quadratic funding allocations
    ///
    /// # Invariants
    /// - Total distributed ≤ matching pool
    /// - All payouts are non-negative
    /// - Monotonicity: More contributions → More funding
    /// - Zero contributions → Zero funding
    ///
    /// # Formula
    /// For each recipient with total contribution C and contributor count N:
    ///   matching = pool * (N^0.5) / sum(N^0.5)
    ///   total = C + matching
    pub fn calculate(
        input: QFInput,
    ) -> Result<QFResult, QFError> {
        // Validate input
        if input.matching_pool <= 0 {
            return Err(QFError::InvalidPoolAmount);
        }

        if input.contributions.is_empty() {
            return Err(QFError::NoContributions);
        }

        // Calculate square root sums and individual allocations
        let mut total_sqrt_sum: i128 = 0;
        let mut sqrt_values = Map::new(&input.contributions.env());

        // First pass: compute sqrt sums
        for (recipient, count) in input.contributor_counts.iter() {
            if count == 0 {
                continue;
            }
            let sqrt = Self::integer_sqrt(count);
            if sqrt > 0 {
                sqrt_values.set(recipient, sqrt);
                total_sqrt_sum = total_sqrt_sum
                    .checked_add(sqrt)
                    .ok_or(QFError::Overflow)?;
            }
        }

        if total_sqrt_sum == 0 {
            return Err(QFError::NoContributions);
        }

        // Second pass: calculate matching allocations
        let mut allocations = Map::new(&input.contributions.env());
        let mut total_distributed: i128 = 0;
        let mut recipients_funded: u64 = 0;

        // Sort recipients by contribution amount for deterministic results
        let mut recipients: Vec<Address> = Vec::new(&input.contributions.env());

        // Collect valid recipients that meet threshold
        for (recipient, contrib) in input.contributions.iter() {
            let contributor_count = input.contributor_counts.get(recipient.clone()).unwrap_or(0);

            // Invariant: No negative payouts
            // Skip recipients with zero contributions or below threshold
            if contrib <= 0 || contributor_count == 0 {
                continue;
            }

            if contrib < input.min_threshold && input.min_threshold > 0 {
                continue;
            }

            let sqrt = sqrt_values.get(recipient.clone()).unwrap_or(0);
            if sqrt == 0 {
                continue;
            }

            // Calculate matching allocation
            // matching = pool * (sqrt(contributor_count)) / total_sqrt_sum
            let matching = input.matching_pool
                .checked_mul(sqrt)
                .ok_or(QFError::Overflow)?
                .checked_div(total_sqrt_sum)
                .ok_or(QFError::Overflow)?;

            // Total = original contribution + matching
            let total = contrib
                .checked_add(matching)
                .ok_or(QFError::Overflow)?;

            // Invariant: No negative payouts
            if total < 0 {
                return Err(QFError::NegativePayout);
            }

            allocations.set(recipient, total);
            total_distributed = total_distributed
                .checked_add(matching)
                .ok_or(QFError::Overflow)?;
            recipients_funded += 1;
        }

        // Invariant: Total distributed ≤ matching pool
        if total_distributed > input.matching_pool {
            return Err(QFError::InsufficientPool);
        }

        // Invariant: Total distributed is non-negative
        if total_distributed < 0 {
            return Err(QFError::NegativePayout);
        }

        let remaining_pool = input.matching_pool
            .checked_sub(total_distributed)
            .ok_or(QFError::Overflow)?;

        // Calculate total contributors
        let total_contributors = Self::total_unique_contributors(&input.contributions);

        Ok(QFResult {
            allocations,
            total_distributed,
            remaining_pool,
            total_contributors,
            recipients_funded,
        })
    }

    /// Integer square root approximation using Babylonian method
    fn integer_sqrt(n: u64) -> i128 {
        if n == 0 {
            return 0;
        }
        let mut x = n as i128;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n as i128 / x) / 2;
        }
        x
    }

    /// Calculate total unique contributors across all recipients
    fn total_unique_contributors(contributions: &Map<Address, i128>) -> u64 {
        // In a real implementation, this would count unique contributors
        // For now, return the number of recipients that received contributions
        contributions.len() as u64
    }
}

// ================================================================
// QF Contract
// ================================================================

#[contract]
pub struct QFContract;

#[contractimpl]
impl QFContract {
    /// Calculate quadratic funding allocations
    pub fn calculate_qf(
        env: Env,
        matching_pool: i128,
        contributions: Map<Address, i128>,
        contributor_counts: Map<Address, u64>,
        min_threshold: i128,
    ) -> Result<QFResult, QFError> {
        let input = QFInput {
            matching_pool,
            contributions,
            contributor_counts,
            min_threshold,
        };
        let result = QuadraticFunding::calculate(input)?;

        // Emit via the shared cross-contract event schema (contracts/common)
        // so services/indexer can parse QF results the same way it parses
        // crowdfund/registry/achievements events.
        common::EventEmitter::qf_calculated(
            &env,
            result.total_distributed,
            result.remaining_pool,
            result.recipients_funded,
        );

        Ok(result)
    }
}

#[cfg(test)]
#[path = "tests/qf_tests.rs"]
mod qf_tests;
#[cfg(test)]
#[path = "tests/invariants.rs"]
mod invariants_tests;

//! Edge-case and property-based coverage for the quadratic-funding matching
//! formula (`QuadraticFunding::calculate`).
//!
//! Added to close a coverage gap: the matching math is numerically
//! sensitive (integer square roots, checked division against a running sum,
//! saturating totals against the matching pool), so it needs explicit
//! coverage for zero contributors, a single contributor, and maximum-value
//! (`i128::MAX`) inputs, plus randomized property tests that hold for any
//! valid input rather than a handful of hand-picked cases.

#![cfg(test)]

use soroban_sdk::{Env, Map};

use crate::{QFError, QFInput, QuadraticFunding};

fn env() -> Env {
    Env::default()
}

// ---------------------------------------------------------------------
// Zero-contributor edge cases
// ---------------------------------------------------------------------

#[test]
fn zero_contributions_map_returns_no_contributions_error() {
    let e = env();
    let input = QFInput {
        matching_pool: 1_000,
        contributions: Map::new(&e),
        contributor_counts: Map::new(&e),
        min_threshold: 0,
    };

    let result = QuadraticFunding::calculate(input);
    assert_eq!(result, Err(QFError::NoContributions));
}

#[test]
fn all_zero_contributor_counts_returns_no_contributions_error() {
    let e = env();
    let recipient = soroban_sdk::Address::generate(&e);

    let mut contributions = Map::new(&e);
    contributions.set(recipient.clone(), 500i128);

    let mut contributor_counts = Map::new(&e);
    contributor_counts.set(recipient, 0u64);

    let input = QFInput {
        matching_pool: 1_000,
        contributions,
        contributor_counts,
        min_threshold: 0,
    };

    // Every recipient has a zero contributor count, so the sqrt-sum stays
    // zero and the calculation must fail cleanly rather than divide by zero.
    let result = QuadraticFunding::calculate(input);
    assert_eq!(result, Err(QFError::NoContributions));
}

#[test]
fn zero_or_negative_matching_pool_is_rejected() {
    let e = env();
    let recipient = soroban_sdk::Address::generate(&e);
    let mut contributions = Map::new(&e);
    contributions.set(recipient.clone(), 100i128);
    let mut contributor_counts = Map::new(&e);
    contributor_counts.set(recipient, 1u64);

    for pool in [0i128, -1i128, i128::MIN] {
        let input = QFInput {
            matching_pool: pool,
            contributions: contributions.clone(),
            contributor_counts: contributor_counts.clone(),
            min_threshold: 0,
        };
        assert_eq!(
            QuadraticFunding::calculate(input),
            Err(QFError::InvalidPoolAmount)
        );
    }
}

// ---------------------------------------------------------------------
// Single-contributor edge case
// ---------------------------------------------------------------------

#[test]
fn single_contributor_receives_entire_matching_pool() {
    let e = env();
    let recipient = soroban_sdk::Address::generate(&e);

    let mut contributions = Map::new(&e);
    contributions.set(recipient.clone(), 250i128);

    let mut contributor_counts = Map::new(&e);
    contributor_counts.set(recipient.clone(), 1u64);

    let input = QFInput {
        matching_pool: 1_000,
        contributions,
        contributor_counts,
        min_threshold: 0,
    };

    let result = QuadraticFunding::calculate(input).expect("single contributor should succeed");

    // Only one recipient with the only nonzero sqrt weight; it should absorb
    // the full matching pool and the recipient count should be one.
    assert_eq!(result.recipients_funded, 1);
    assert_eq!(result.total_distributed, 1_000);
    assert_eq!(result.remaining_pool, 0);
    assert_eq!(result.allocations.get(recipient), Some(1_250));
}

// ---------------------------------------------------------------------
// Maximum-value / overflow edge cases
// ---------------------------------------------------------------------

#[test]
fn maximum_value_inputs_do_not_silently_wrap() {
    let e = env();
    let recipient = soroban_sdk::Address::generate(&e);

    let mut contributions = Map::new(&e);
    contributions.set(recipient.clone(), i128::MAX);

    let mut contributor_counts = Map::new(&e);
    // A very large contributor count pushes `matching_pool * sqrt(count)`
    // toward i128::MAX; the implementation must return `Overflow` via
    // checked_mul rather than wrap around to a bogus (possibly negative)
    // allocation.
    contributor_counts.set(recipient.clone(), u64::MAX);

    let input = QFInput {
        matching_pool: i128::MAX,
        contributions,
        contributor_counts,
        min_threshold: 0,
    };

    let result = QuadraticFunding::calculate(input);
    match result {
        Err(QFError::Overflow) => {}
        Err(other) => panic!("expected Overflow, got {other:?}"),
        Ok(r) => {
            // If it didn't overflow (small sqrt weight relative to pool),
            // the total distributed must never exceed the matching pool
            // and must never be negative -- i.e. no silent wraparound.
            assert!(r.total_distributed <= i128::MAX);
            assert!(r.total_distributed >= 0);
        }
    }
}

#[test]
fn contribution_near_i128_max_with_matching_does_not_overflow_silently() {
    let e = env();
    let recipient = soroban_sdk::Address::generate(&e);

    let mut contributions = Map::new(&e);
    // A contribution close to i128::MAX combined with any positive matching
    // would overflow on `checked_add`; the function must surface
    // `QFError::Overflow` rather than wrapping to a negative total.
    contributions.set(recipient.clone(), i128::MAX - 10);

    let mut contributor_counts = Map::new(&e);
    contributor_counts.set(recipient.clone(), 4u64);

    let input = QFInput {
        matching_pool: 1_000,
        contributions,
        contributor_counts,
        min_threshold: 0,
    };

    let result = QuadraticFunding::calculate(input);
    if let Ok(r) = &result {
        assert!(r.total_distributed >= 0);
        assert!(r.total_distributed <= 1_000);
    }
    // Either a clean success bounded within the pool, or an explicit
    // Overflow error -- never a panic and never a negative allocation.
    if let Err(err) = result {
        assert!(matches!(err, QFError::Overflow | QFError::NegativePayout));
    }
}

// ---------------------------------------------------------------------
// Property-based tests (proptest) over randomized inputs
// ---------------------------------------------------------------------

mod proptests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        /// For any valid combination of pool size, contribution amount, and
        /// contributor count, the matching engine must never distribute more
        /// than the matching pool, and never produce a negative allocation.
        #[test]
        fn matching_never_exceeds_pool_and_never_negative(
            pool in 1i128..1_000_000_000_000i128,
            contribution in 1i128..1_000_000_000_000i128,
            count in 1u64..1_000_000u64,
        ) {
            let e = env();
            let recipient = soroban_sdk::Address::generate(&e);

            let mut contributions = Map::new(&e);
            contributions.set(recipient.clone(), contribution);
            let mut contributor_counts = Map::new(&e);
            contributor_counts.set(recipient.clone(), count);

            let input = QFInput {
                matching_pool: pool,
                contributions,
                contributor_counts,
                min_threshold: 0,
            };

            match QuadraticFunding::calculate(input) {
                Ok(result) => {
                    prop_assert!(result.total_distributed <= pool);
                    prop_assert!(result.total_distributed >= 0);
                    prop_assert!(result.remaining_pool >= 0);
                    prop_assert!(result.remaining_pool <= pool);
                }
                Err(err) => {
                    // Only checked-arithmetic failures or explicit validation
                    // errors are acceptable outcomes -- never a panic.
                    prop_assert!(matches!(
                        err,
                        QFError::Overflow
                            | QFError::InvalidPoolAmount
                            | QFError::NoContributions
                            | QFError::NegativePayout
                            | QFError::InsufficientPool
                    ));
                }
            }
        }

        /// Monotonicity: increasing a single recipient's contributor count
        /// (holding everything else fixed) must never decrease that
        /// recipient's matching allocation, since its relative weight in the
        /// sqrt-sum can only grow or stay flat.
        #[test]
        fn more_contributors_never_decreases_matching(
            pool in 1i128..1_000_000_000i128,
            contribution in 1i128..1_000_000_000i128,
            low_count in 1u64..1_000u64,
            extra in 0u64..1_000u64,
        ) {
            let e = env();
            let recipient = soroban_sdk::Address::generate(&e);
            let high_count = low_count + extra;

            let run = |count: u64| -> Option<i128> {
                let mut contributions = Map::new(&e);
                contributions.set(recipient.clone(), contribution);
                let mut contributor_counts = Map::new(&e);
                contributor_counts.set(recipient.clone(), count);

                let input = QFInput {
                    matching_pool: pool,
                    contributions,
                    contributor_counts,
                    min_threshold: 0,
                };

                QuadraticFunding::calculate(input)
                    .ok()
                    .map(|r| r.allocations.get(recipient.clone()).unwrap_or(0))
            };

            if let (Some(low_alloc), Some(high_alloc)) = (run(low_count), run(high_count)) {
                // Single-recipient case: matching = pool (sqrt is the only
                // weight), so allocation is invariant to count once count > 0.
                prop_assert_eq!(low_alloc, high_alloc);
            }
        }
    }
}

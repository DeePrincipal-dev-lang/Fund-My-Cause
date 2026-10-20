#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Map};
use proptest::prelude::*;

/// Property: QF calculation is deterministic
proptest! {
    #[test]
    fn property_deterministic(
        pool in 1000i128..100000i128,
        num_recipients in 2u64..10u64,
        contrib in 1i128..5000i128,
        contributors in 1u64..50u64,
    ) {
        let env = Env::default();

        let mut contributions1 = Map::new(&env);
        let mut contributions2 = Map::new(&env);
        let mut contributor_counts1 = Map::new(&env);
        let mut contributor_counts2 = Map::new(&env);

        let mut recipients = Vec::new(&env);
        for i in 0..num_recipients {
            let addr = Address::generate(&env);
            recipients.push_back(addr.clone());
            contributions1.set(addr.clone(), contrib);
            contributions2.set(addr.clone(), contrib);
            contributor_counts1.set(addr.clone(), contributors);
            contributor_counts2.set(addr.clone(), contributors);
        }

        let input1 = QFInput {
            matching_pool: pool,
            contributions: contributions1,
            contributor_counts: contributor_counts1,
            min_threshold: 0,
        };

        let input2 = QFInput {
            matching_pool: pool,
            contributions: contributions2,
            contributor_counts: contributor_counts2,
            min_threshold: 0,
        };

        let result1 = QuadraticFunding::calculate(input1);
        let result2 = QuadraticFunding::calculate(input2);

        // Both results should be identical
        if let (Ok(r1), Ok(r2)) = (result1, result2) {
            assert_eq!(r1.total_distributed, r2.total_distributed);
            assert_eq!(r1.remaining_pool, r2.remaining_pool);
            assert_eq!(r1.recipients_funded, r2.recipients_funded);

            // Check allocations match
            for (addr, amount) in r1.allocations.iter() {
                let amount2 = r2.allocations.get(addr).unwrap();
                assert_eq!(amount, amount2);
            }
        }
    }
}

/// Property: Recipients with zero contributions get zero funding
proptest! {
    #[test]
    fn property_zero_contrib_zero_funding(
        pool in 1000i128..100000i128,
        num_recipients in 2u64..10u64,
        contrib in 1i128..5000i128,
        contributors in 1u64..50u64,
    ) {
        let env = Env::default();

        let mut contributions = Map::new(&env);
        let mut contributor_counts = Map::new(&env);

        // First recipient gets contributions
        let addr1 = Address::generate(&env);
        contributions.set(addr1.clone(), contrib);
        contributor_counts.set(addr1.clone(), contributors);

        // Second recipient gets zero
        let addr2 = Address::generate(&env);
        contributions.set(addr2.clone(), 0);
        contributor_counts.set(addr2.clone(), 0);

        let input = QFInput {
            matching_pool: pool,
            contributions,
            contributor_counts,
            min_threshold: 0,
        };

        let result = QuadraticFunding::calculate(input);

        if let Ok(r) = result {
            // Only the first recipient should get funding
            assert_eq!(r.recipients_funded, 1);
            // The second recipient should not be in the allocations
            assert!(!r.allocations.contains_key(addr2.clone()));
            // The first recipient should have at least their contribution
            let allocation = r.allocations.get(addr1.clone()).unwrap();
            assert!(allocation >= contrib);
        }
    }
}

// ================================================================
// Negative-path tests
// ================================================================

/// Test: calculate_qf entry point rejects zero pool amounts
#[test]
fn test_calculate_qf_rejects_zero_pool() {
    let env = Env::default();
    let mut contributions = Map::new(&env);
    let mut contributor_counts = Map::new(&env);
    let addr = Address::generate(&env);
    contributions.set(addr.clone(), 1000);
    contributor_counts.set(addr, 5);

    let result = QFContract::calculate_qf(
        env.clone(),
        0,
        contributions,
        contributor_counts,
        0,
    );
    assert_eq!(result, Err(QFError::InvalidPoolAmount));
}

/// Test: calculate_qf entry point rejects negative pool amounts
#[test]
fn test_calculate_qf_rejects_negative_pool() {
    let env = Env::default();
    let mut contributions = Map::new(&env);
    let mut contributor_counts = Map::new(&env);
    let addr = Address::generate(&env);
    contributions.set(addr.clone(), 1000);
    contributor_counts.set(addr, 5);

    let result = QFContract::calculate_qf(
        env.clone(),
        -100,
        contributions,
        contributor_counts,
        0,
    );
    assert_eq!(result, Err(QFError::InvalidPoolAmount));
}

/// Test: calculate_qf rejects empty contributions
#[test]
fn test_calculate_qf_rejects_empty_contributions() {
    let env = Env::default();
    let contributions = Map::new(&env);
    let contributor_counts = Map::new(&env);

    let result = QFContract::calculate_qf(
        env.clone(),
        10_000,
        contributions,
        contributor_counts,
        0,
    );
    assert_eq!(result, Err(QFError::NoContributions));
}

/// Test: double invocation with same inputs produces identical results
/// (verifies no state mutation / replay issue on stateless computation)
#[test]
fn test_calculate_qf_deterministic_no_replay() {
    let env = Env::default();
    let addr1 = Address::generate(&env);
    let addr2 = Address::generate(&env);

    let mut contributions1 = Map::new(&env);
    let mut contributor_counts1 = Map::new(&env);
    contributions1.set(addr1.clone(), 5000);
    contributions1.set(addr2.clone(), 3000);
    contributor_counts1.set(addr1.clone(), 10);
    contributor_counts1.set(addr2.clone(), 7);

    let result1 = QFContract::calculate_qf(
        env.clone(),
        100_000,
        contributions1,
        contributor_counts1,
        0,
    ).unwrap();

    let mut contributions2 = Map::new(&env);
    let mut contributor_counts2 = Map::new(&env);
    contributions2.set(addr1.clone(), 5000);
    contributions2.set(addr2.clone(), 3000);
    contributor_counts2.set(addr1.clone(), 10);
    contributor_counts2.set(addr2.clone(), 7);

    let result2 = QFContract::calculate_qf(
        env.clone(),
        100_000,
        contributions2,
        contributor_counts2,
        0,
    ).unwrap();

    assert_eq!(result1.total_distributed, result2.total_distributed);
    assert_eq!(result1.remaining_pool, result2.remaining_pool);
    assert_eq!(result1.recipients_funded, result2.recipients_funded);
}

/// Test: recipients below min_threshold receive zero matching
#[test]
fn test_calculate_qf_below_threshold_gets_no_matching() {
    let env = Env::default();
    let addr = Address::generate(&env);

    let mut contributions = Map::new(&env);
    let mut contributor_counts = Map::new(&env);
    contributions.set(addr.clone(), 500);
    contributor_counts.set(addr, 3);

    let result = QFContract::calculate_qf(
        env.clone(),
        10_000,
        contributions,
        contributor_counts,
        1000,
    );

    if let Ok(r) = result {
        assert_eq!(r.recipients_funded, 0);
        assert_eq!(r.total_distributed, 0);
        assert_eq!(r.remaining_pool, 10_000);
    }
}

/// Test: zero contributor count yields no allocation
#[test]
fn test_calculate_qf_zero_contributor_count() {
    let env = Env::default();
    let addr = Address::generate(&env);

    let mut contributions = Map::new(&env);
    let mut contributor_counts = Map::new(&env);
    contributions.set(addr.clone(), 5000);
    contributor_counts.set(addr, 0);

    let result = QFContract::calculate_qf(
        env.clone(),
        10_000,
        contributions,
        contributor_counts,
        0,
    );

    if let Ok(r) = result {
        assert_eq!(r.recipients_funded, 0);
        assert_eq!(r.total_distributed, 0);
    }
}

/// Test: negative contribution amounts are skipped
#[test]
fn test_calculate_qf_negative_contribution_skipped() {
    let env = Env::default();
    let addr = Address::generate(&env);

    let mut contributions = Map::new(&env);
    let mut contributor_counts = Map::new(&env);
    contributions.set(addr.clone(), -500);
    contributor_counts.set(addr, 5);

    let result = QFContract::calculate_qf(
        env.clone(),
        10_000,
        contributions,
        contributor_counts,
        0,
    );

    if let Ok(r) = result {
        assert_eq!(r.recipients_funded, 0);
        assert_eq!(r.total_distributed, 0);
    }
}

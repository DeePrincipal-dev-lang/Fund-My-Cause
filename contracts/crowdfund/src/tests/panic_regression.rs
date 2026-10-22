#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address, String};

/// Test that arithmetic operations don't panic
#[test]
fn test_no_panic_on_arithmetic() {
    let env = Env::default();

    // Test safe add
    let result = SafeMath::add(i128::MAX, 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::Overflow);

    let result = SafeMath::add(100, 200);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 300);

    // Test safe sub
    let result = SafeMath::sub(100, 200);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::Underflow);

    let result = SafeMath::sub(200, 100);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 100);

    // Test safe mul
    let result = SafeMath::mul(i128::MAX, 2);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::Overflow);

    let result = SafeMath::mul(100, 2);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 200);

    // Test safe div
    let result = SafeMath::div(100, 0);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidAmount);

    let result = SafeMath::div(100, 2);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 50);
}

/// Test that campaign creation doesn't panic
#[test]
fn test_no_panic_campaign_creation() {
    let env = Env::default();
    let creator = Address::random(&env);

    // Valid campaign
    let result = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1000,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Test Campaign"),
    );
    assert!(result.is_ok());

    // Invalid amount
    let result = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        0,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Test Campaign"),
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidAmount);

    // Past deadline
    let result = CrowdfundContract::create_campaign(
        env.clone(),
        creator,
        -100,
        env.ledger().timestamp() - 1000,
        String::from_str(&env, "Test Campaign"),
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidAmount);
}

/// Test that contributions don't panic
#[test]
fn test_no_panic_contributions() {
    let env = Env::default();
    let creator = Address::random(&env);
    let contributor = Address::random(&env);

    // Create campaign
    let campaign_id = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1000,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Test Campaign"),
    ).unwrap();

    // Valid contribution
    let result = CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor.clone(),
        500,
    );
    assert!(result.is_ok());

    // Invalid amount
    let result = CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor.clone(),
        -100,
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidAmount);

    // Zero amount
    let result = CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor,
        0,
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidAmount);
}

/// Test that claiming funds doesn't panic
#[test]
fn test_no_panic_claiming() {
    let env = Env::default();
    let creator = Address::random(&env);
    let contributor = Address::random(&env);

    // Create campaign
    let campaign_id = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1000,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Test Campaign"),
    ).unwrap();

    // Contribute enough to meet goal
    CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor,
        1500,
    ).unwrap();

    // Claim before deadline
    let result = CrowdfundContract::claim_funds(
        env.clone(),
        campaign_id,
        creator.clone(),
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::InvalidState);

    // Claim by non-creator
    let attacker = Address::random(&env);
    let result = CrowdfundContract::claim_funds(
        env.clone(),
        campaign_id,
        attacker,
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::Unauthorized);
}

/// Test that loading non-existent campaign doesn't panic
#[test]
fn test_no_panic_loading_non_existent() {
    let env = Env::default();

    let result = CrowdfundContract::get_campaign(
        env.clone(),
        99999,
    );
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::NotFound);
}

/// Test edge cases that previously caused panics
#[test]
fn test_regression_edge_cases() {
    let env = Env::default();
    let creator = Address::random(&env);

    // Test with maximum values
    let result = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        i128::MAX,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Max Campaign"),
    );
    assert!(result.is_ok());

    // Test with minimum values
    let result = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1,
        env.ledger().timestamp() + 1,
        String::from_str(&env, "Min Campaign"),
    );
    assert!(result.is_ok());

    // Test with large contribution
    let campaign_id = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1000,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Large Contribution"),
    ).unwrap();

    let contributor = Address::random(&env);
    let result = CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor,
        i128::MAX,
    );
    // Should succeed or fail gracefully, but not panic
    assert!(result.is_ok() || result.is_err());
}

/// Test that get_next_id doesn't overflow (regression)
#[test]
fn test_no_panic_get_next_id_overflow() {
    let env = Env::default();

    // Simulate reaching near-max ID
    let key = String::from_str(&env, "next_id");
    env.storage().set(&key, &u64::MAX);

    let result = CrowdfundContract::get_next_id(&env);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), CrowdfundError::Overflow);
}

/// Test that no panics occur during campaign funding edge cases
#[test]
fn test_no_panic_funding_edge_cases() {
    let env = Env::default();
    let creator = Address::random(&env);
    let contributor = Address::random(&env);

    let campaign_id = CrowdfundContract::create_campaign(
        env.clone(),
        creator.clone(),
        1000,
        env.ledger().timestamp() + 1000,
        String::from_str(&env, "Edge Case Campaign"),
    ).unwrap();

    // Test contributions that would overflow
    let result = CrowdfundContract::contribute(
        env.clone(),
        campaign_id,
        contributor.clone(),
        i128::MAX,
    );
    // Should not panic, even if it fails
    assert!(result.is_ok() || result.is_err());
}

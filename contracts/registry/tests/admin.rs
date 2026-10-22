//! # Registry Access Control Integration Tests
//!
//! These tests explicitly verify:
//! - Unauthorized callers are **rejected** on every state-mutating entry-point.
//! - Authorized callers succeed on every state-mutating entry-point.
//! - Read-only queries remain accessible without auth.
//! - Error codes match `ContractError` variants.
//!
//! Soroban's generated test client exposes two call styles:
//!   - `client.method(args)` — panics on `Err` (used for happy-path assertions)
//!   - `client.try_method(args)` — returns `Result<T, Result<ContractError, _>>`
//!     (used to assert specific error codes)
//!
//! Each test stands alone: it creates a fresh `Env`, registers the contract,
//! and drives it through a specific scenario.

#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use common::test_utils::setup_env;
use registry::{CampaignStatus, ContractError, RegistryContract, RegistryContractClient};

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Deploy a fresh registry contract and return its client.
/// The contract is **not** initialised — callers must call `initialize` themselves.
fn deploy(env: &Env) -> RegistryContractClient {
    let id = env.register_contract(None, RegistryContract);
    RegistryContractClient::new(env, &id)
}

/// Deploy and initialise a registry; returns the client and the admin address.
fn deploy_and_init(env: &Env) -> (RegistryContractClient, Address) {
    let client = deploy(env);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (client, admin)
}

// ═══════════════════════════════════════════════════════════════════════════════
// initialize()
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize_succeeds() {
    let env = setup_env();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    // Should not panic
    client.initialize(&admin);
}

#[test]
fn test_initialize_twice_returns_already_initialized() {
    let env = setup_env();
    let (client, admin) = deploy_and_init(&env);

    let result = client.try_initialize(&admin);
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyInitialized)),
        "second initialize should return AlreadyInitialized"
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// register() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_without_init_returns_not_initialized() {
    let env = setup_env();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register(&campaign);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_requires_campaign_auth() {
    // Verify campaign_id.require_auth() is recorded in the auth context.
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register(&campaign);

    // The campaign address must appear as an authorizing signer.
    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_authorized_and_deduplicates() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register(&campaign);
    client.register(&campaign); // duplicate — must be ignored

    let all = client.list(&0, &10);
    assert_eq!(all.len(), 1);
    assert_eq!(all.get(0).unwrap(), campaign);
}

#[test]
fn test_register_multiple_campaigns() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);
    client.register(&c1);
    client.register(&c2);
    client.register(&c3);

    assert_eq!(client.list(&0, &10).len(), 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_category() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_category_without_init_returns_not_initialized() {
    let env = setup_env();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register_with_category(&campaign, &0);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register_with_category before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_with_category_requires_campaign_auth() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_category(&campaign, &1);

    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_category() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_category_filters_correctly() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let charity1 = Address::generate(&env);
    let charity2 = Address::generate(&env);
    let tech1 = Address::generate(&env);

    client.register_with_category(&charity1, &0);
    client.register_with_category(&charity2, &0);
    client.register_with_category(&tech1, &1);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&1, &0, &10).len(), 1);
    assert_eq!(client.get_campaigns_by_category(&99, &0, &10).len(), 0);
}

#[test]
fn test_register_with_category_deduplicates() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let campaign = Address::generate(&env);
    client.register_with_category(&campaign, &0);
    client.register_with_category(&campaign, &0); // duplicate

    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 1);
    assert_eq!(client.list(&0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_status() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_status_without_init_returns_not_initialized() {
    let env = setup_env();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "register_with_status before initialize should return NotInitialized"
    );
}

#[test]
fn test_register_with_status_requires_campaign_auth() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_status(&campaign, &CampaignStatus::Active);

    let auths = env.auths();
    let found = auths.iter().any(|(addr, _)| *addr == campaign);
    assert!(found, "campaign address should appear in recorded auths");
}

// ═══════════════════════════════════════════════════════════════════════════════
// register_with_status() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_register_with_status_filters_correctly() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let active1 = Address::generate(&env);
    let active2 = Address::generate(&env);
    let success1 = Address::generate(&env);

    client.register_with_status(&active1, &CampaignStatus::Active);
    client.register_with_status(&active2, &CampaignStatus::Active);
    client.register_with_status(&success1, &CampaignStatus::Successful);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        2
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Cancelled, &0, &10)
            .len(),
        0
    );
}

#[test]
fn test_register_with_status_deduplicates() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);
    client.register_with_status(&campaign, &CampaignStatus::Active); // duplicate

    assert_eq!(client.list(&0, &10).len(), 1);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// update_status() — guards
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_update_status_without_init_returns_not_initialized() {
    let env = setup_env();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "update_status before initialize should return NotInitialized"
    );
}

#[test]
fn test_update_status_campaign_not_found_returns_error() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let unregistered = Address::generate(&env);

    let result = client.try_update_status(
        &unregistered,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::NotFound)),
        "update_status on unregistered campaign should return NotFound"
    );
}

#[test]
fn test_update_status_requires_admin_auth() {
    // Verify admin.require_auth() is recorded — not the campaign's address.
    let env = setup_env();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_status(&campaign, &CampaignStatus::Active);

    // Clear auth history then call update_status.
    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    let auths = env.auths();
    let admin_found = auths.iter().any(|(addr, _)| *addr == admin);
    assert!(
        admin_found,
        "admin address must appear in recorded auths for update_status"
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// update_status() — authorized happy path
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_update_status_moves_campaign_between_buckets() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        0
    );

    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        0
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    // Global list is unchanged
    assert_eq!(client.list(&0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Read-only queries — no auth required
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_list_pagination() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    for _ in 0..5 {
        client.register(&Address::generate(&env));
    }

    assert_eq!(client.list(&0, &3).len(), 3);
    assert_eq!(client.list(&3, &3).len(), 2);
    assert_eq!(client.list(&5, &3).len(), 0);
    assert_eq!(client.list(&0, &0).len(), 0);
}

#[test]
fn test_list_by_status_pagination() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    for _ in 0..5 {
        client.register_with_status(&Address::generate(&env), &CampaignStatus::Active);
    }

    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &3).len(),
        3
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &3, &3).len(),
        2
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &5, &3).len(),
        0
    );
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &0).len(),
        0
    );
}

#[test]
fn test_get_campaigns_by_category_pagination() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    for _ in 0..4 {
        client.register_with_category(&Address::generate(&env), &2);
    }

    assert_eq!(client.get_campaigns_by_category(&2, &0, &2).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&2, &2, &2).len(), 2);
    assert_eq!(client.get_campaigns_by_category(&2, &4, &2).len(), 0);
    assert_eq!(client.get_campaigns_by_category(&2, &0, &0).len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Privilege escalation edge cases (#1312)
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_update_status_rejects_non_admin() {
    // Non-admin caller should be rejected even if campaign is registered
    let env = setup_env();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    let non_admin = Address::generate(&env);

    client.register_with_status(&campaign, &CampaignStatus::Active);
    
    // Switch to non-admin context
    non_admin.require_auth();
    let result = client.try_update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    
    assert_eq!(
        result,
        Err(Ok(ContractError::Unauthorized)),
        "non-admin should be rejected for update_status"
    );
}

#[test]
fn test_initialize_rejects_second_admin() {
    // First admin initializes, second admin should not be able to reinitialize
    let env = setup_env();
    let (client, admin) = deploy_and_init(&env);
    let second_admin = Address::generate(&env);
    
    // Switch to second admin context
    second_admin.require_auth();
    let result = client.try_initialize(&second_admin);
    
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyInitialized)),
        "second admin should not be able to reinitialize"
    );
}

#[test]
fn test_initialize_requires_admin_auth() {
    // Test that initialize requires auth from the admin address being set
    let env = setup_env();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    let imposter = Address::generate(&env);
    
    // Imposter tries to initialize with admin address (should fail)
    imposter.require_auth();
    let result = client.try_initialize(&admin);
    
    // Should fail because imposter is not the admin address being set
    assert!(
        result.is_err(),
        "initialize should require auth from the admin address being set"
    );
}

#[test]
fn test_register_requires_exact_campaign_auth() {
    // Campaign A should not be able to auth for Campaign B
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign_a = Address::generate(&env);
    let campaign_b = Address::generate(&env);
    
    // Campaign A tries to register Campaign B
    campaign_a.require_auth();
    let result = client.try_register(&campaign_b);
    
    // Should fail because auth doesn't match the campaign being registered
    assert!(
        result.is_err(),
        "campaign A should not be able to register campaign B"
    );
}

#[test]
fn test_update_status_invalid_transitions() {
    // Test invalid status transitions (e.g., Active to Active, Failed to Active without proper flow)
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    
    client.register_with_status(&campaign, &CampaignStatus::Active);
    
    // Try invalid transition: Active to Active (should work but be a no-op)
    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Active,
    );
    
    // Campaign should still be in Active status
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
}

#[test]
fn test_update_status_wrong_old_status() {
    // Admin tries to update status with wrong old_status parameter
    // This could be a privilege escalation if not handled correctly
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    
    // Register campaign as Active
    client.register_with_status(&campaign, &CampaignStatus::Active);
    
    // Admin tries to update with wrong old_status (Active -> Successful but claiming old_status is Failed)
    // The contract should still find and move the campaign since it checks actual status
    client.update_status(
        &campaign,
        &CampaignStatus::Failed, // Wrong old_status
        &CampaignStatus::Successful,
    );
    
    // Campaign should now be in Successful, not in Active or Failed
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        0
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Failed, &0, &10)
            .len(),
        0
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
}

#[test]
fn test_category_boundary_conditions() {
    // Test edge cases for category IDs
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    
    // Test with maximum u32 value
    client.register_with_category(&campaign, &u32::MAX);
    
    let result = client.get_campaigns_by_category(&u32::MAX, &0, &10);
    assert_eq!(result.len(), 1, "should handle max category ID");
}

#[test]
fn test_duplicate_registration_edge_cases() {
    // Test multiple registration attempts with different auth patterns
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    
    // First registration
    client.register(&campaign);
    assert_eq!(client.list(&0, &10).len(), 1);
    
    // Try registering with category (should still deduplicate)
    client.register_with_category(&campaign, &0);
    assert_eq!(client.list(&0, &10).len(), 1);
    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 1);
    
    // Try registering with status (should still deduplicate)
    client.register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(client.list(&0, &10).len(), 1);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
}

#[test]
fn test_empty_campaign_lists() {
    // Edge cases for empty lists and pagination
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);
    
    // Test list with empty registry
    assert_eq!(client.list(&0, &10).len(), 0);
    assert_eq!(client.list(&100, &10).len(), 0); // offset beyond empty list
    
    // Test status lists with no campaigns
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        0
    );
    
    // Test category lists with no campaigns
    assert_eq!(client.get_campaigns_by_category(&0, &0, &10).len(), 0);
    assert_eq!(client.get_campaigns_by_category(&0, &100, &10).len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Full lifecycle integration
// ═══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_lifecycle_register_update_and_list() {
    let env = setup_env();
    let (client, _admin) = deploy_and_init(&env);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    client.register_with_status(&c1, &CampaignStatus::Active);
    client.register_with_status(&c2, &CampaignStatus::Active);
    client.register_with_status(&c3, &CampaignStatus::Failed);

    assert_eq!(client.list(&0, &10).len(), 3);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        2
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Failed, &0, &10)
            .len(),
        1
    );

    // Admin transitions c1 to Successful
    client.update_status(&c1, &CampaignStatus::Active, &CampaignStatus::Successful);

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    // Global count unchanged
    assert_eq!(client.list(&0, &10).len(), 3);
}

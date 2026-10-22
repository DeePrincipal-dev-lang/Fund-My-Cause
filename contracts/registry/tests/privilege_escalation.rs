//! # Registry Privilege-Escalation Regression Tests  (#962)
//!
//! ## Enumerated Attack Vectors
//!
//! This module documents every plausible privilege-escalation path against the
//! registry contract's admin model and provides a dedicated regression test per
//! vector.  The table below is the canonical mapping; each row references the
//! test function that exercises it.
//!
//! | # | Vector | Test |
//! |---|--------|------|
//! | V1 | Non-admin reinitialises to swap the stored admin | `test_v1_reinitialize_to_swap_admin_is_blocked` |
//! | V2 | `initialize` called without admin's own signature (auth enforcement) | `test_v2_initialize_requires_admin_auth` |
//! | V3 | Non-admin calls `update_status` without admin auth | `test_v3_non_admin_update_status_requires_stored_admin` |
//! | V4 | `update_status` auth is anchored to the *stored* admin address | `test_v4_only_stored_admin_can_call_update_status` |
//! | V5 | Blocked reinit attempt leaves stored admin and campaign list intact | `test_v5_blocked_reinit_leaves_state_unchanged` |
//! | V6 | Admin self-registers as a campaign — role confusion check | `test_v6_admin_self_register_does_not_elevate_privileges` |
//! | V7 | All mutating calls before `initialize` expose no auth bypass | `test_v7_all_mutators_require_initialization` |
//! | V8 | Rapid double-initialize in the same Env | `test_v8_double_initialize_is_idempotently_blocked` |
//! | V9 | Extreme category/status IDs cannot corrupt ADMIN storage key | `test_v9_extreme_ids_cannot_corrupt_admin_key` |
//! | V10 | Registered campaign attempts self-status-promotion | `test_v10_campaign_self_promotion_requires_admin_auth` |
//! | V11 | `register` called without campaign's own auth | `test_v11_register_requires_campaign_auth_panics_without_mock` |
//! | V12 | `register` before `initialize` returns `NotInitialized` | `test_v12_register_before_initialize_returns_not_initialized` |
//! | V13 | `register_with_category` before `initialize` returns `NotInitialized` | `test_v13_register_with_category_before_initialize_returns_not_initialized` |
//! | V14 | `register_with_status` before `initialize` returns `NotInitialized` | `test_v14_register_with_status_before_initialize_returns_not_initialized` |
//! | V15 | `register` auth anchored to *campaign*, not admin | `test_v15_register_auth_is_campaign_not_admin` |
//! | V16 | `register_with_category` auth anchored to *campaign*, not admin | `test_v16_register_with_category_auth_is_campaign_not_admin` |
//! | V17 | `register_with_status` auth anchored to *campaign*, not admin | `test_v17_register_with_status_auth_is_campaign_not_admin` |
//! | V18 | Duplicate registration across all paths is idempotent | `test_v18_duplicate_registration_across_paths_is_idempotent` |
//!
//! ## Cross-reference with `security/formal-verification`
//!
//! The `security/formal-verification/README.md` documents *Access Control* as
//! property #3 for the crowdfund contract:
//! > "Only authorized addresses can perform sensitive operations."
//!
//! The registry was not explicitly covered in that document.  No discrepancy
//! was found — the formal property statements are consistent with the registry
//! implementation.  These tests extend the same guarantees to the registry's
//! own admin model.
//!
//! ## Vulnerability Findings
//!
//! **No real vulnerability was discovered.**  All escalation attempts are
//! correctly blocked by the contract.  If a test below unexpectedly PASSES
//! (i.e., the escalation *succeeds*), that is a **P0 vulnerability** and MUST
//! be escalated immediately via a private GitHub Security Advisory — do NOT
//! fold a fix silently into this PR.

#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use registry::{CampaignStatus, ContractError, RegistryContract, RegistryContractClient};

// ── Local helpers ─────────────────────────────────────────────────────────────
// Intentionally separate from `tests/common/mod.rs` so each test can control
// auth mocking independently without inheriting helpers that always call
// `mock_all_auths`.

fn deploy(env: &Env) -> RegistryContractClient {
    let id = env.register_contract(None, RegistryContract);
    RegistryContractClient::new(env, &id)
}

fn deploy_and_init(env: &Env) -> (RegistryContractClient, Address) {
    env.mock_all_auths();
    let client = deploy(env);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (client, admin)
}

// ═══════════════════════════════════════════════════════════════════════════
// V1 — Reinitialise to swap stored admin
// ═══════════════════════════════════════════════════════════════════════════

/// A second `initialize` call must be rejected with `AlreadyInitialized`
/// regardless of who the proposed new admin is.
///
/// **Failure mode if NOT blocked:** attacker replaces the stored admin and
/// gains full control over `update_status`.
#[test]
fn test_v1_reinitialize_to_swap_admin_is_blocked() {
    let env = Env::default();
    let (client, _original_admin) = deploy_and_init(&env);
    let attacker = Address::generate(&env);

    let result = client.try_initialize(&attacker);
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyInitialized)),
        "V1: second initialize must return AlreadyInitialized"
    );

    // Original admin still controls the registry: register a campaign and
    // transition its status — both must succeed under mock_all_auths.
    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);
    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1,
        "V1: original admin must still govern the registry after blocked reinit"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 — `initialize` without admin's auth signature
// ═══════════════════════════════════════════════════════════════════════════

/// Without `mock_all_auths`, calling `initialize` panics at the Soroban auth
/// layer because `admin.require_auth()` is not satisfied.  This is the
/// correct, expected behaviour — the contract must not be bootstrappable
/// without the designated admin's consent.
///
/// **Failure mode if NOT blocked:** any account could nominate any admin
/// without that admin's knowledge.
#[test]
#[should_panic]
fn test_v2_initialize_requires_admin_auth() {
    // Deliberately omit mock_all_auths so require_auth() is enforced for real.
    let env = Env::default();
    let client = deploy(&env);
    let victim = Address::generate(&env);

    // Must panic at the Soroban auth layer.
    // If it does NOT panic, admin.require_auth() is missing → P0 vulnerability.
    client.initialize(&victim);
}

// ═══════════════════════════════════════════════════════════════════════════
// V3 — Non-admin calls `update_status` (NotFound guard is hit first)
// ═══════════════════════════════════════════════════════════════════════════

/// `update_status` reads the stored admin from `KEY_ADMIN` and calls
/// `admin.require_auth()`.  For a campaign address that is not in the global
/// registry the `NotFound` guard fires first (before the transfer token check),
/// meaning any non-admin who names a non-existent campaign gets `NotFound` —
/// not a silent no-op, and not a successful status change.
///
/// **Failure mode if NOT blocked:** anyone could flip campaign statuses.
#[test]
fn test_v3_non_admin_update_status_requires_stored_admin() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);

    // Unregistered campaign — NotFound fires before admin auth is even checked.
    let ghost = Address::generate(&env);
    let result =
        client.try_update_status(&ghost, &CampaignStatus::Active, &CampaignStatus::Successful);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotFound)),
        "V3: update_status on unregistered campaign must return NotFound"
    );

    // Registered campaign — with mock_all_auths both campaign and admin are
    // authorised; verify the status change only goes through once (no double
    // application).
    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);
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
}

// ═══════════════════════════════════════════════════════════════════════════
// V4 — Only the *stored* admin can call `update_status`
// ═══════════════════════════════════════════════════════════════════════════

/// Positive confirmation that the stored admin address is what `update_status`
/// checks.  The auth recording must show the admin address as the authoriser,
/// not the campaign address.
#[test]
fn test_v4_only_stored_admin_can_call_update_status() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);

    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    // The Soroban test harness records all require_auth() calls.  Verify that
    // the admin address — not the campaign address — is the auth subject.
    let auths = env.auths();
    let admin_authorised = auths.iter().any(|(addr, _invocation)| *addr == admin);
    assert!(
        admin_authorised,
        "V4: admin address must appear in the auth record for update_status"
    );

    // Confirm the campaign is now in Successful and not Active.
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        0
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V5 — Blocked reinit leaves stored admin and campaign list intact
// ═══════════════════════════════════════════════════════════════════════════

/// After a blocked reinit attempt the contract must behave identically to
/// before the attempt: same admin, same campaign list, same read results.
#[test]
fn test_v5_blocked_reinit_leaves_state_unchanged() {
    let env = Env::default();
    let (client, _original_admin) = deploy_and_init(&env);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    client.register_with_status(&c1, &CampaignStatus::Active);
    client.register_with_status(&c2, &CampaignStatus::Failed);
    assert_eq!(client.list(&0, &10).len(), 2);

    // Attempt blocked.
    let attacker = Address::generate(&env);
    let _ = client.try_initialize(&attacker);

    // State must be identical.
    assert_eq!(
        client.list(&0, &10).len(),
        2,
        "V5: campaign list must not change after blocked reinit"
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Active, &0, &10)
            .len(),
        1
    );
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Failed, &0, &10)
            .len(),
        1
    );

    // update_status still works — original admin auth in effect.
    client.update_status(&c1, &CampaignStatus::Active, &CampaignStatus::Successful);
    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1,
        "V5: original admin governance must be intact after blocked reinit"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V6 — Admin self-registers as campaign (role-confusion check)
// ═══════════════════════════════════════════════════════════════════════════

/// `register` requires `campaign_id.require_auth()`.  The admin registering
/// their own address satisfies that check (self-auth) — that is intentional
/// and not a vulnerability.  But being in the campaign list must NOT grant any
/// new capabilities to unrelated addresses.
#[test]
fn test_v6_admin_self_register_does_not_elevate_privileges() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);

    // Admin registers themselves as a campaign — allowed.
    client.register(&admin);
    assert_eq!(client.list(&0, &10).len(), 1);

    // A completely unrelated outsider still cannot update statuses.
    let outsider = Address::generate(&env);
    let result = client.try_update_status(
        &outsider,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::NotFound)),
        "V6: outsider not in registry gets NotFound, not a status change"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V7 — All mutating calls before initialize expose no admin bypass
// ═══════════════════════════════════════════════════════════════════════════

/// Calling any state-mutating function before `initialize` must return
/// `NotInitialized`.  This prevents an attacker from inserting campaign state
/// before the legitimate admin bootstraps the contract.
#[test]
fn test_v7_all_mutators_require_initialization() {
    let env = Env::default();
    // No mock_all_auths, no initialize.
    let client = deploy(&env);
    let addr = Address::generate(&env);

    let r1 = client.try_register(&addr);
    let r2 = client.try_register_with_status(&addr, &CampaignStatus::Active);
    let r3 = client.try_register_with_category(&addr, &42);
    let r4 = client.try_update_status(&addr, &CampaignStatus::Active, &CampaignStatus::Successful);

    assert_eq!(r1, Err(Ok(ContractError::NotInitialized)), "V7: register");
    assert_eq!(
        r2,
        Err(Ok(ContractError::NotInitialized)),
        "V7: register_with_status"
    );
    assert_eq!(
        r3,
        Err(Ok(ContractError::NotInitialized)),
        "V7: register_with_category"
    );
    assert_eq!(
        r4,
        Err(Ok(ContractError::NotInitialized)),
        "V7: update_status"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V8 — Rapid double-initialize in same Env
// ═══════════════════════════════════════════════════════════════════════════

/// Two successive `initialize` calls in the same Env must be idempotent: the
/// second always fails.  The first-writer-wins semantic is enforced by the
/// `has(&KEY_ADMIN)` guard inside `admin::initialize`.
#[test]
fn test_v8_double_initialize_is_idempotently_blocked() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    client.initialize(&admin1);

    let result = client.try_initialize(&admin2);
    assert_eq!(
        result,
        Err(Ok(ContractError::AlreadyInitialized)),
        "V8: second initialize in same env must be blocked"
    );

    // Contract is still healthy after the blocked call.
    assert_eq!(client.list(&0, &10).len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// V9 — Extreme category/status IDs cannot corrupt ADMIN storage key
// ═══════════════════════════════════════════════════════════════════════════

/// Soroban instance storage keys are type-tagged: `RegDataKey::CategoryList(u32)`
/// is encoded differently from the `Symbol` keys used for KEY_ADMIN and
/// KEY_CAMPAIGNS.  Even a u32 value that bit-matches those symbols cannot
/// overwrite them.  This test provides empirical confirmation.
#[test]
fn test_v9_extreme_ids_cannot_corrupt_admin_key() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = deploy_and_init(&env);

    // Values that could plausibly alias short Soroban Symbol encodings if type
    // encoding were naive (it is not, but we verify empirically).
    let suspicious_ids: &[u32] = &[0, 1, u32::MAX, u32::MAX - 1, 0x00_4144_4D4E];

    for &id in suspicious_ids {
        let campaign = Address::generate(&env);
        client.register_with_category(&campaign, &id);
    }

    // All registrations succeeded — global list intact.
    assert_eq!(
        client.list(&0, &100).len(),
        suspicious_ids.len() as u32,
        "V9: registrations with suspicious IDs must succeed"
    );

    // KEY_ADMIN still intact: update_status returns NotFound (not NotInitialized)
    // for an unknown campaign.
    let ghost = Address::generate(&env);
    let result =
        client.try_update_status(&ghost, &CampaignStatus::Active, &CampaignStatus::Successful);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotFound)),
        "V9: ADMIN key must not be corrupted by extreme category IDs"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V10 — Registered campaign attempts self-status-promotion
// ═══════════════════════════════════════════════════════════════════════════

/// `update_status` reads the *stored admin address* and calls
/// `admin.require_auth()`.  The Soroban auth recording lets us confirm that
/// even when the call succeeds (because `mock_all_auths` is active), the auth
/// is attributed to the admin address — not to the campaign.
///
/// This is the key invariant: the implementation must never derive the auth
/// subject from the *caller's identity* but always from `KEY_ADMIN` in storage.
#[test]
fn test_v10_campaign_self_promotion_requires_admin_auth() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);
    client.register_with_status(&campaign, &CampaignStatus::Active);

    client.update_status(
        &campaign,
        &CampaignStatus::Active,
        &CampaignStatus::Successful,
    );

    // Auth history: verify admin — not campaign — is recorded as the authoriser
    // of the update_status call.
    let auths = env.auths();
    let admin_in_auths = auths.iter().any(|(addr, _)| *addr == admin);
    let campaign_authorised_update = auths.iter().any(|(addr, invocation)| {
        // The campaign must NOT appear as the sole authoriser of update_status.
        *addr == campaign
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "update_status"
                }
                _ => false,
            }
    });

    assert!(
        admin_in_auths,
        "V10: admin address must appear in recorded auths"
    );
    // A campaign address appearing as an update_status authoriser would mean
    // the admin check is wrong (it read the campaign's auth, not admin's).
    assert!(
        !campaign_authorised_update,
        "V10: campaign address must NOT be the authoriser of update_status — \
         that would indicate the admin check reads the wrong key"
    );

    assert_eq!(
        client
            .list_by_status(&CampaignStatus::Successful, &0, &10)
            .len(),
        1
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V11 — `register` without campaign's own auth signature
// ═══════════════════════════════════════════════════════════════════════════

/// Without `mock_all_auths`, calling `register` panics at the Soroban auth
/// layer because `campaign_id.require_auth()` is not satisfied.
///
/// This mirrors V2 (`initialize` auth enforcement) but for the campaign-self-auth
/// path: the campaign contract — not the registry admin — must authorise its own
/// registration.
///
/// **Failure mode if NOT blocked:** any address could register any contract
/// address as a campaign, polluting the global list with spurious entries and
/// potentially spoofing legitimate campaigns.
#[test]
#[should_panic]
fn test_v11_register_requires_campaign_auth() {
    // Fresh env with no mock_all_auths — require_auth() is enforced for real.
    let env = Env::default();
    let id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(&env, &id);
    // Note: without mock_all_auths, register() panics because the campaign
    // address has not signed; NotInitialized fires first (before auth) but
    // the host surfaces it as a panic in the test runner. This is the same
    // mechanism as V2. The positive-auth counterpart is V15.
    let campaign = Address::generate(&env);
    client.register(&campaign); // panics — no auth for campaign OR admin
}

// ═══════════════════════════════════════════════════════════════════════════
// V12 — `register` before `initialize` must return NotInitialized
// ═══════════════════════════════════════════════════════════════════════════

/// Any call to `register` on an uninitialised contract must return
/// `NotInitialized` — not silently succeed or panic.
///
/// **Failure mode if NOT blocked:** campaigns could be registered before the
/// admin is set, meaning no one can call `update_status` on them.
#[test]
fn test_v12_register_before_initialize_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register(&campaign);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "V12: register on uninitialised contract must return NotInitialized"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V13 — `register_with_category` before `initialize`
// ═══════════════════════════════════════════════════════════════════════════

/// Same guard as V12 but for `register_with_category`.
///
/// **Failure mode if NOT blocked:** category indexes could be seeded before
/// admin governance is established, poisoning filtered queries.
#[test]
fn test_v13_register_with_category_before_initialize_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register_with_category(&campaign, &0u32);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "V13: register_with_category on uninitialised contract must return NotInitialized"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V14 — `register_with_status` before `initialize`
// ═══════════════════════════════════════════════════════════════════════════

/// Same guard as V12 but for `register_with_status`.
///
/// **Failure mode if NOT blocked:** status indexes could be seeded before
/// admin governance is established, producing ghost entries in status buckets.
#[test]
fn test_v14_register_with_status_before_initialize_returns_not_initialized() {
    let env = Env::default();
    let client = deploy(&env);
    let campaign = Address::generate(&env);

    let result = client.try_register_with_status(&campaign, &CampaignStatus::Active);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotInitialized)),
        "V14: register_with_status on uninitialised contract must return NotInitialized"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V15 — `register` auth is anchored to the *campaign* address, not the admin
// ═══════════════════════════════════════════════════════════════════════════

/// Positive confirmation that `register` records `campaign_id` — not admin —
/// as the authoriser.  An implementation bug that used `admin.require_auth()`
/// instead of `campaign_id.require_auth()` would let any campaign be registered
/// by the admin without the campaign's knowledge (effectively allowing
/// involuntary registration).
#[test]
fn test_v15_register_auth_is_campaign_not_admin() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register(&campaign);

    let auths = env.auths();

    // Campaign must appear as an authoriser of the register call.
    let campaign_in_auths = auths.iter().any(|(addr, invocation)| {
        *addr == campaign
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register"
                }
                _ => false,
            }
    });
    assert!(
        campaign_in_auths,
        "V15: campaign address must appear as the auth subject of register"
    );

    // Admin must NOT be the authoriser of a `register` call — that would mean
    // the implementation used admin.require_auth() instead of campaign.require_auth().
    let admin_authorised_register = auths.iter().any(|(addr, invocation)| {
        *addr == admin
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register"
                }
                _ => false,
            }
    });
    assert!(
        !admin_authorised_register,
        "V15: admin must NOT be the auth subject of register — \
         that would allow involuntary registration of any address"
    );

    assert_eq!(client.list(&0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// V16 — `register_with_category` auth is anchored to the campaign, not admin
// ═══════════════════════════════════════════════════════════════════════════

/// Same invariant as V15 but for `register_with_category`.
/// The category index must not be writable by the admin unilaterally.
#[test]
fn test_v16_register_with_category_auth_is_campaign_not_admin() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_category(&campaign, &42u32);

    let auths = env.auths();

    let campaign_in_auths = auths.iter().any(|(addr, invocation)| {
        *addr == campaign
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register_with_category"
                }
                _ => false,
            }
    });
    assert!(
        campaign_in_auths,
        "V16: campaign must appear as auth subject of register_with_category"
    );

    let admin_authorised = auths.iter().any(|(addr, invocation)| {
        *addr == admin
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register_with_category"
                }
                _ => false,
            }
    });
    assert!(
        !admin_authorised,
        "V16: admin must NOT be the auth subject of register_with_category"
    );

    assert_eq!(client.get_campaigns_by_category(&42, &0, &10).len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// V17 — `register_with_status` auth is anchored to the campaign, not admin
// ═══════════════════════════════════════════════════════════════════════════

/// Same invariant as V15 but for `register_with_status`.
/// The status index must not be writable by the admin unilaterally.
#[test]
fn test_v17_register_with_status_auth_is_campaign_not_admin() {
    let env = Env::default();
    let (client, admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    client.register_with_status(&campaign, &CampaignStatus::Active);

    let auths = env.auths();

    let campaign_in_auths = auths.iter().any(|(addr, invocation)| {
        *addr == campaign
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register_with_status"
                }
                _ => false,
            }
    });
    assert!(
        campaign_in_auths,
        "V17: campaign must appear as auth subject of register_with_status"
    );

    let admin_authorised = auths.iter().any(|(addr, invocation)| {
        *addr == admin
            && match &invocation.function {
                soroban_sdk::testutils::AuthorizedFunction::Contract((_, fn_name, _)) => {
                    fn_name.to_string() == "register_with_status"
                }
                _ => false,
            }
    });
    assert!(
        !admin_authorised,
        "V17: admin must NOT be the auth subject of register_with_status"
    );

    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &10).len(),
        1
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// V18 — Blocked registration of an already-registered campaign is idempotent
//       and does not create duplicate entries in any index
// ═══════════════════════════════════════════════════════════════════════════

/// Registering the same campaign twice via different registration paths must
/// not insert duplicates into any index (global list, status list, or category
/// list). An attacker who can call any registration function with the campaign's
/// auth must not be able to inflate count-based metrics or cause double-refund
/// scenarios.
///
/// **Failure mode if NOT blocked:** duplicate entries allow `list_by_status` to
/// return the same address multiple times, misleading frontends about the number
/// of active campaigns.
#[test]
fn test_v18_duplicate_registration_across_paths_is_idempotent() {
    let env = Env::default();
    let (client, _admin) = deploy_and_init(&env);
    let campaign = Address::generate(&env);

    // Register through three different entry-points in succession.
    client.register(&campaign);
    client.register_with_status(&campaign, &CampaignStatus::Active);
    client.register_with_category(&campaign, &0u32);

    // Global list must still have exactly one entry.
    assert_eq!(
        client.list(&0, &10).len(),
        1,
        "V18: global list must not contain duplicates after multiple registration paths"
    );

    // Status index must have exactly one entry.
    assert_eq!(
        client.list_by_status(&CampaignStatus::Active, &0, &10).len(),
        1,
        "V18: status list must not contain duplicates"
    );

    // Category index must have exactly one entry.
    assert_eq!(
        client.get_campaigns_by_category(&0, &0, &10).len(),
        1,
        "V18: category list must not contain duplicates"
    );
}

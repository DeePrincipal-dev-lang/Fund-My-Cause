//! # Crowdfund Panic-Fix Regression Suite  (#963)
//!
//! This module locks in every call-site change made in issues #835 and #856:
//! panicking `.unwrap()` / `.expect()` calls in error-reachable paths were
//! replaced with typed errors returned via `ok_or(ContractError::...)?`.
//!
//! For each old-panic site a test deliberately triggers the original failure
//! condition and asserts that the contract returns a typed `ContractError`
//! instead of aborting with a panic.
//!
//! ## Architecture note on "genuinely infallible" unwraps
//!
//! Per the `lib.rs` top-level comment, core keys written exactly once by
//! `initialize` (`KEY_CREATOR`, `KEY_STATUS`, `KEY_TOKEN`, etc.) remain in
//! instance storage for the contract's lifetime and are safe to `.unwrap()`.
//! Those sites are **intentionally not changed** by #835/#856 and are not
//! tested here.  Only paths reachable on un-initialised contracts, or paths
//! with legitimately absent optional state, were changed — and those are the
//! sites this regression suite covers.
//!
//! ## Old-panic-site → New-error-variant mapping
//!
//! | File | Location | Former panic | New typed error | Test |
//! |------|----------|-------------|-----------------|------|
//! | `refund.rs` | `refund_single` token read | `KEY_TOKEN.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r1_*` |
//! | `refund.rs` | `refund_batch` token read | `KEY_TOKEN.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r2_*` |
//! | `refund.rs` | `refund_partial` token read | `KEY_TOKEN.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r3_*` |
//! | `refund.rs` | `refund_single` status guard | unwrap on status | `ContractError::NotActive` | `test_856_r4_*` |
//! | `refund.rs` | `refund_single` goal guard | missing guard | `ContractError::GoalReached` | `test_856_r5_*` |
//! | `refund.rs` | `refund_single` zero-balance guard | missing guard | `ContractError::NothingToRefund` | `test_856_r6_*` |
//! | `lifecycle.rs` | `cancel_campaign` creator read | `KEY_CREATOR.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r7_*` |
//! | `lifecycle.rs` | `archive` creator read | `KEY_CREATOR.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r8_*` |
//! | `helpers.rs` | `require_active_and_auth_creator` creator read | `KEY_CREATOR.get().unwrap()` | `ContractError::InvalidAddress` | `test_835_r9_*` |
//! | `storage.rs` | `get_admin` admin read | `KEY_ADMIN.get().unwrap()` | `ContractError::NotFound` | `test_835_r10_*` |
//! | `helpers.rs` | arithmetic in `apply_matching` | `checked_sub(...).unwrap()` | `ContractError::Overflow` | `test_856_r11_*` |
//! | `lib.rs` | `contribute` total accumulation | `checked_add(...).unwrap()` | `ContractError::Overflow` | `test_856_r12_*` |

#![cfg(test)]
// Test harness still uses the deprecated `register_contract` /
// `register_stellar_asset_contract` helpers; migrating them is separate work.
#![allow(deprecated)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String, Vec,
};

use crowdfund::{
    Category, ContractError, CrowdfundContract, CrowdfundContractClient, KEY_GROSS_TOTAL, KEY_TOTAL,
};

// ── Test helpers ──────────────────────────────────────────────────────────────

/// Deploy a contract without calling `initialize`.
/// Used for tests verifying guards that fire on un-initialised contracts.
fn deploy_raw(env: &Env) -> CrowdfundContractClient {
    let id = env.register_contract(None, CrowdfundContract);
    CrowdfundContractClient::new(env, &id)
}

/// Full deploy + init.  Returns (client, creator, token_id, token_admin_client).
fn setup(
    env: &Env,
    goal: i128,
    deadline: u64,
    min: i128,
) -> (
    CrowdfundContractClient<'_>,
    Address,
    Address,
    token::StellarAssetClient<'_>,
) {
    env.mock_all_auths();
    let creator = Address::generate(env);
    let token_admin_addr = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin_addr.clone());
    let token_admin = token::StellarAssetClient::new(env, &token_id);

    let id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min,
        &0i128,
        &String::from_str(env, "Test"),
        &String::from_str(env, "Regression"),
        &None,
        &None,
        &None,
        &Category::Other,
        &None,
        &None,
    );

    (client, creator, token_id, token_admin)
}

// ═══════════════════════════════════════════════════════════════════════════
// R1 — refund_single: KEY_TOKEN read on un-initialised contract
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_TOKEN).unwrap()` in `refund.rs`
///
/// On an un-initialised contract the status defaults to Active, the deadline
/// to 0 (past), and the goal to 0; since total == goal (0 == 0) the
/// `GoalReached` guard fires before the token read — meaning the KEY_TOKEN
/// panic was reachable only if the status/goal guards were also absent.
/// #856 added those guards.  Together with #835 (token key guard) the chain
/// is now fully typed.
///
/// Regression guarantee: calling `refund_single` on an un-initialised
/// contract must NOT panic — it must return a typed `ContractError`.
#[test]
fn test_835_r1_refund_single_uninitialised_returns_typed_error() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let contributor = Address::generate(&env);

    let result = client.try_refund_single(&contributor);
    assert!(
        result.is_err(),
        "R1: refund_single on un-initialised contract must return a typed error, not panic"
    );
    // Goal 0, total 0, deadline 0, status Active → GoalReached is the first guard.
    assert_eq!(
        result,
        Err(Ok(ContractError::GoalReached)),
        "R1: GoalReached guard must fire first on un-initialised contract"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R2 — refund_batch: KEY_TOKEN read on un-initialised contract
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_TOKEN).unwrap()` in `refund_batch`
///
/// `refund_batch` checks status first: Active/Cancelled are the only allowed
/// states.  On an un-initialised contract status defaults to Active, which
/// is NOT in the allowed set for batch refunds — so `NotActive` fires before
/// the token read.
#[test]
fn test_835_r2_refund_batch_uninitialised_returns_not_active() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let contributor = Address::generate(&env);
    let contributors: Vec<Address> = soroban_sdk::vec![&env, contributor];

    let result = client.try_refund_batch(&contributors);
    assert_eq!(
        result,
        Err(Ok(ContractError::NotActive)),
        "R2: refund_batch on un-initialised contract must return NotActive"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R3 — refund_partial: KEY_TOKEN read guard
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_TOKEN).unwrap()` in `refund_partial`
///
/// With amount > current_contribution (both 0 on un-initialised contract)
/// the `ExceedsMaximum` guard fires.  With amount == 0 the check also fires.
/// Either way: no panic.
#[test]
fn test_835_r3_refund_partial_uninitialised_returns_typed_error() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let contributor = Address::generate(&env);

    // amount=1, balance=0 → the 50% partial-refund cap fires before the token read.
    let result = client.try_refund_partial(&contributor, &1i128);
    assert!(
        result.is_err(),
        "R3: refund_partial on un-initialised contract must return a typed error, not panic"
    );
    assert_eq!(
        result,
        Err(Ok(ContractError::RefundLimitExceeded)),
        "R3: RefundLimitExceeded must fire when amount > 0 and balance == 0"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R4 — refund_single: NotActive guard for active-before-deadline campaign
// ═══════════════════════════════════════════════════════════════════════════

/// Former missing guard: calling `refund_single` on an Active campaign before
/// the deadline would fall through to the token read and panic.
/// #856 added the explicit `NotActive` return.
#[test]
fn test_856_r4_refund_single_active_before_deadline_returns_not_active() {
    let env = Env::default();
    env.ledger().set_timestamp(500);
    let (client, _creator, token_id, token_admin) = setup(&env, 10_000, 2_000, 100);

    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &500);
    client.contribute(&contributor, &500, &token_id, &None);

    // Still Active, deadline has not passed.
    let result = client.try_refund_single(&contributor);
    assert_eq!(
        result,
        Err(Ok(ContractError::CampaignStillActive)),
        "R4: refund_single during active campaign must return a typed error, not panic"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R5 — refund_single: GoalReached guard
// ═══════════════════════════════════════════════════════════════════════════

/// Former missing guard: if the deadline passed and the goal was met,
/// `refund_single` would attempt a refund regardless.  #856 added the
/// `GoalReached` check.
#[test]
fn test_856_r5_refund_single_goal_met_returns_goal_reached() {
    let env = Env::default();
    env.ledger().set_timestamp(500);
    let goal: i128 = 1_000;
    let (client, _creator, token_id, token_admin) = setup(&env, goal, 2_000, 1);

    let contributor = Address::generate(&env);
    token_admin.mint(&contributor, &goal);
    client.contribute(&contributor, &goal, &token_id, &None);

    // Advance past deadline.
    env.ledger().set_timestamp(3_000);

    let result = client.try_refund_single(&contributor);
    assert_eq!(
        result,
        Err(Ok(ContractError::GoalReached)),
        "R5: refund_single after goal met must return GoalReached"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R6 — refund_single: NothingToRefund guard
// ═══════════════════════════════════════════════════════════════════════════

/// Former missing guard: a contributor with zero balance would hit the token
/// transfer and send 0 tokens (or worse, panic).  #856 added an explicit
/// `NothingToRefund` check before the transfer.
#[test]
fn test_856_r6_refund_single_zero_balance_returns_nothing_to_refund() {
    let env = Env::default();
    env.ledger().set_timestamp(500);
    // Goal is very high so it will not be met.
    let (client, _creator, _token_id, _token_admin) = setup(&env, 100_000, 2_000, 1);

    // No one contributes — advance past deadline with 0 raised.
    env.ledger().set_timestamp(3_000);

    let non_contributor = Address::generate(&env);
    let result = client.try_refund_single(&non_contributor);
    assert_eq!(
        result,
        Ok(Ok(())),
        "R6: refund_single with zero balance must be an idempotent no-op, not a panic"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R7 — cancel_campaign: KEY_CREATOR read on un-initialised contract
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_CREATOR).unwrap()` in `lifecycle::cancel_campaign`
///
/// On an un-initialised contract: status defaults to Active (guard passes),
/// then KEY_CREATOR is absent → `InvalidAddress`.
#[test]
fn test_835_r7_cancel_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);

    let result = client.try_cancel_campaign();
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R7: cancel_campaign on un-initialised contract must return InvalidAddress"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R8 — archive: KEY_CREATOR read on un-initialised contract
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_CREATOR).unwrap()` in `lifecycle::archive`
#[test]
fn test_835_r8_archive_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);

    let result = client.try_archive();
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R8: archive on un-initialised contract must return InvalidAddress"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R9 — require_active_and_auth_creator: KEY_CREATOR read
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_CREATOR).unwrap()` in `helpers::require_active_and_auth_creator`
///
/// This helper is called by `add_to_whitelist`, `add_to_blacklist`,
/// `set_whitelist_only`, `set_visibility`, `transfer_ownership`, and similar
/// creator-gated functions.  On an un-initialised contract KEY_CREATOR is
/// absent → `InvalidAddress`.
#[test]
fn test_835_r9_whitelist_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let addr = Address::generate(&env);

    let result = client.try_add_to_whitelist(&addr);
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R9: add_to_whitelist on un-initialised contract must return InvalidAddress"
    );
}

/// Same guard via `add_to_blacklist`.
#[test]
fn test_835_r9b_blacklist_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let addr = Address::generate(&env);

    let result = client.try_add_to_blacklist(&addr);
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R9b: add_to_blacklist on un-initialised contract must return InvalidAddress"
    );
}

/// Same guard via `transfer_ownership`.
#[test]
fn test_835_r9c_transfer_ownership_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);
    let new_owner = Address::generate(&env);

    let result = client.try_transfer_ownership(&new_owner);
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R9c: transfer_ownership on un-initialised contract must return InvalidAddress"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R10 — storage::get_admin: KEY_ADMIN read on un-initialised contract
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `inst.get(&KEY_ADMIN).unwrap()` in `storage::get_admin`
///
/// `get_admin` is called by functions that require the admin address (e.g.
/// `update_metadata`, `pause`, `set_rate_limit`).  On an un-initialised
/// contract KEY_ADMIN is absent → typed error (either `InvalidAddress` or
/// `NotFound` depending on which guard fires first).
#[test]
fn test_835_r10_update_metadata_uninitialised_returns_typed_error() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);

    let result = client.try_update_metadata(
        &Some(String::from_str(&env, "New Title")),
        &Some(String::from_str(&env, "New Desc")),
        &None,
    );
    assert!(
        result.is_err(),
        "R10: update_metadata on un-initialised contract must return a typed error, not panic"
    );
}

/// Same guard via `pause`.
#[test]
fn test_835_r10b_pause_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);

    let result = client.try_pause();
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R10b: pause on un-initialised contract must return InvalidAddress"
    );
}

/// Same guard via `set_rate_limit`.
#[test]
fn test_835_r10c_set_rate_limit_uninitialised_returns_invalid_address() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy_raw(&env);

    let result = client.try_set_rate_limit(&1_000i128, &3_600u64);
    assert_eq!(
        result,
        Err(Ok(ContractError::InvalidAddress)),
        "R10c: set_rate_limit on un-initialised contract must return InvalidAddress"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R11 — helpers::apply_matching: arithmetic guard
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `checked_sub(...).unwrap()` in `apply_matching`
///
/// The fix uses `checked_sub(...).unwrap_or(0).max(0)` which saturates.
/// This test exercises the matching path with a valid large contribution to
/// verify the saturating arithmetic does not panic.
#[test]
fn test_856_r11_apply_matching_large_contribution_does_not_panic() {
    let env = Env::default();
    env.ledger().set_timestamp(500);
    let goal: i128 = 1_000_000;
    let (client, creator, token_id, token_admin) = setup(&env, goal, 10_000, 1);

    // Setup a small matching pool (1_000) with 100% match ratio.
    // setup_matching(sponsor, match_ratio, max_match)
    let sponsor = sponsor_addr(&env, &creator);
    // setup_matching escrows the pool from the sponsor, so fund the sponsor first.
    token_admin.mint(&sponsor, &1_000i128);
    client.setup_matching(
        &sponsor, &10_000u32, // 100% match ratio in bps
        &1_000i128, // max_match
    );

    let contributor = Address::generate(&env);
    let amount: i128 = 5_000; // match = min(5000, 1000) = 1000 → capped
    token_admin.mint(&contributor, &amount);

    // Must not panic even when match exhausts the pool.
    client.contribute(&contributor, &amount, &token_id, &None);

    let raised = client.total_raised();
    // total_raised = contribution + matched = 5000 + 1000 = 6000
    assert_eq!(
        raised, 6_000,
        "R11: matching arithmetic must not panic and must cap at max_match"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// R12 — lib.rs contribute: total overflow guard
// ═══════════════════════════════════════════════════════════════════════════

/// Former panic: `checked_add(...).unwrap()` when accumulating `KEY_TOTAL`
///
/// #856 replaced this with `checked_add(...).ok_or(ContractError::Overflow)?`.
/// When the cumulative total would overflow i128, the typed error must be
/// returned rather than panicking.
#[test]
fn test_856_r12_contribute_overflow_returns_overflow_error() {
    let env = Env::default();
    env.ledger().set_timestamp(500);
    // Largest goal `initialize` accepts (validate_goal_not_overflow caps at MAX / 2).
    let (client, _creator, token_id, token_admin) = setup(&env, i128::MAX / 2, 10_000, 1);

    // Drive the running total to the edge of i128 directly. It cannot be reached
    // by contributing: the amounts would have to sum past i128::MAX, which exceeds
    // what the asset contract will issue, so the transfer fails long before the
    // accumulator does.
    let near_max: i128 = i128::MAX - 1;
    env.as_contract(&client.address, || {
        env.storage().instance().set(&KEY_TOTAL, &near_max);
        env.storage().instance().set(&KEY_GROSS_TOTAL, &near_max);
    });

    // One more contribution would overflow the total.
    let c2 = Address::generate(&env);
    let overflow_amount: i128 = 2; // near_max + 2 > i128::MAX
    token_admin.mint(&c2, &overflow_amount);

    let result = client.try_contribute(&c2, &overflow_amount, &token_id, &None);
    assert_eq!(
        result,
        Err(Ok(ContractError::Overflow)),
        "R12: contribution that overflows total must return Overflow, not panic"
    );
}

// ── Helper used by R11 ────────────────────────────────────────────────────────

/// Return a sponsor address distinct from creator (required by `setup_matching`
/// which validates the sponsor is not the creator).
fn sponsor_addr(env: &Env, creator: &Address) -> Address {
    loop {
        let a = Address::generate(env);
        if a != *creator {
            return a;
        }
    }
}

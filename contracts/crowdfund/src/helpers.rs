//! # Internal Helper Functions
//!
//! Shared helpers used across multiple contract endpoints.

use soroban_sdk::{Address, Env};

use crate::{errors::ContractError, storage::KEY_CREATOR};

/// Reads the campaign creator and requires their authorization, without any
/// status check.
///
/// Access-control changes (whitelist, blacklist, visibility, ownership) are
/// deliberately allowed on a non-Active campaign: a creator still has to be able
/// to correct an access list after the campaign is paused or has ended. Only
/// `pause()` gates on `Status::Active`, and it checks that itself.
///
/// ## Issue #1147
/// Delegates to [`common::AccessControl::require_stored_auth`] — the shared
/// helper that replaced the inline "read KEY_CREATOR → require_auth" pattern
/// that was duplicated across `access.rs` and this file. The behaviour is
/// identical: returns the creator address on success or
/// `ContractError::InvalidAddress` when the contract is uninitialised.
///
/// # Returns
/// - `Ok(Address)` with the creator's address, having required their auth
/// - `Err(ContractError::InvalidAddress)` if the contract was never initialized
pub(crate) fn require_auth_creator(env: &Env) -> Result<Address, ContractError> {
    common::AccessControl::require_stored_auth(env, &KEY_CREATOR)
        .map_err(|_| ContractError::InvalidAddress)
}

//! Address-based access-control primitives shared across contracts.
//!
//! ## Issue #1147 — eliminate inline auth-check duplication
//!
//! Before this change, authorization checks were duplicated inline across
//! multiple contracts:
//!
//! | Location | Pattern | Duplicate of |
//! |----------|---------|--------------|
//! | `crowdfund/src/access.rs` — `auth_admin()` | read `KEY_ADMIN` → `require_auth` | — |
//! | `crowdfund/src/helpers.rs` — `require_auth_creator()` | read `KEY_CREATOR` → `require_auth` | — |
//! | `registry/src/admin.rs` — `update_status` inline | read `KEY_ADMIN` → `AccessControl::require_role_auth` | `auth_admin()` |
//!
//! All three patterns reduce to the same two-step operation:
//! 1. Read a stored privileged address from instance storage.
//! 2. Call `require_auth()` on that address.
//!
//! This module now provides three shared helpers that encapsulate those
//! patterns. Contracts import the helper and supply the symbol key; the
//! helper handles the storage read, the auth enforcement, **and** the typed
//! error if the contract was never initialised.
//!
//! ### Usage
//!
//! ```rust,ignore
//! use common::AccessControl;
//! use common::error::CommonError;
//!
//! // Replaces every inline `auth_admin` / require_auth_creator` block:
//! let admin = AccessControl::require_stored_auth(&env, &KEY_ADMIN)
//!     .map_err(|_| ContractError::InvalidAddress)?;
//!
//! let creator = AccessControl::require_stored_auth(&env, &KEY_CREATOR)
//!     .map_err(|_| ContractError::InvalidAddress)?;
//! ```
//!
//! ### Why the storage-key is caller-supplied
//!
//! The common crate has no dependency on either contract's storage module, so
//! it cannot reference `KEY_ADMIN` or `KEY_CREATOR` directly. Passing the
//! `Symbol` value as a parameter keeps the helper generic and avoids coupling.

use soroban_sdk::{Address, Env, IntoVal, Symbol, Val};

use crate::error::CommonError;

/// Address-comparison and `require_auth` access-control helpers.
///
/// All methods are pure functions — no state is stored in the struct itself.
pub struct AccessControl;

impl AccessControl {
    // ── Existing primitive (unchanged) ────────────────────────────────────

    /// Requires that `role_address` authorised the current invocation.
    ///
    /// Thin wrapper around [`Address::require_auth`] so contracts express
    /// the "only this stored address may call this" pattern consistently,
    /// rather than re-deriving it inline per contract.
    ///
    /// Prefer [`require_stored_auth`] when the address must first be read
    /// from instance storage — it handles both the read and the auth in one
    /// call and returns a typed error if the key is absent.
    pub fn require_role_auth(role_address: &Address) {
        role_address.require_auth();
    }

    // ── Issue #1147 — new shared helpers ──────────────────────────────────

    /// Read a privileged address from **instance** storage under `key` and
    /// require that it authorised the current invocation.
    ///
    /// This replaces every inline "read-then-require_auth" block that was
    /// duplicated across `crowdfund/src/access.rs` (`auth_admin`),
    /// `crowdfund/src/helpers.rs` (`require_auth_creator`), and
    /// `registry/src/admin.rs` (`update_status` inline block).
    ///
    /// # Returns
    /// - `Ok(address)` — the stored address; it has already authorised the call.
    /// - `Err(CommonError::NotInitialized)` — the key is absent (contract was
    ///   never initialised).  Callers map this to their own error type:
    ///   ```rust,ignore
    ///   AccessControl::require_stored_auth(&env, &KEY_ADMIN)
    ///       .map_err(|_| ContractError::InvalidAddress)?;
    ///   ```
    ///
    /// # Storage tier
    /// Instance storage only.  Use [`require_persistent_auth`] for persistent
    /// storage keys.
    pub fn require_stored_auth(env: &Env, key: &Symbol) -> Result<Address, CommonError>
    where
        Symbol: IntoVal<Env, Val>,
    {
        let addr: Address = env
            .storage()
            .instance()
            .get(key)
            .ok_or(CommonError::NotInitialized)?;
        addr.require_auth();
        Ok(addr)
    }

    /// Read a privileged address from **persistent** storage under `key` and
    /// require that it authorised the current invocation.
    ///
    /// Same contract as [`require_stored_auth`] but reads from the persistent
    /// storage tier. Provided for completeness; most privileged-address keys
    /// (`KEY_ADMIN`, `KEY_CREATOR`) are kept in instance storage.
    ///
    /// # Returns
    /// - `Ok(address)` — the stored address; it has already authorised the call.
    /// - `Err(CommonError::NotInitialized)` — the key is absent.
    pub fn require_persistent_auth(env: &Env, key: &Symbol) -> Result<Address, CommonError>
    where
        Symbol: IntoVal<Env, Val>,
    {
        let addr: Address = env
            .storage()
            .persistent()
            .get(key)
            .ok_or(CommonError::NotInitialized)?;
        addr.require_auth();
        Ok(addr)
    }

    /// Check whether a stored address equals `caller` **without** performing an
    /// on-chain auth check.
    ///
    /// Useful in read-only view functions or in guard paths where the
    /// `require_auth` was already performed at the entry-point level and we only
    /// need the equality assertion for error routing.
    ///
    /// Returns `true` when the stored address exists and equals `caller`.
    pub fn is_stored_role(env: &Env, key: &Symbol, caller: &Address) -> bool {
        env.storage()
            .instance()
            .get::<_, Address>(key)
            .map(|a| a == *caller)
            .unwrap_or(false)
    }
}

#[cfg(any(test, feature = "testutils"))]
#[path = "access_control_tests.rs"]
mod access_control_tests;

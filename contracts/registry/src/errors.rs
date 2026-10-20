//! # Registry Contract Error Types
//!
//! Typed error variants for the Fund-My-Cause registry contract.
//!
//! Every state-mutating entry-point returns `Result<_, ContractError>` so that
//! callers receive a structured, machine-readable error code rather than an
//! opaque panic or a silent no-op.
//!
//! ## Error Codes
//!
//! | Code | Variant | Meaning |
//! |------|---------|---------|
//! | 1 | `AlreadyInitialized` | `initialize()` was called more than once |
//! | 2 | `NotInitialized` | A mutating call was made before `initialize()` |
//! | 3 | `Unauthorized` | Caller did not satisfy the required `require_auth()` check |
//! | 4 | `NotFound` | The requested campaign is not registered |
//! | 5 | `AlreadyRegistered` | The campaign is already in the registry (informational) |

use soroban_sdk::contracterror;

/// All possible error conditions for the registry contract.
///
/// Mirroring the pattern used in `contracts/crowdfund/src/errors.rs` and
/// `contracts/achievements/src/errors.rs`, each variant is assigned a stable
/// `u32` discriminant so that on-chain clients can match on the raw value.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// `initialize()` has already been called; the contract cannot be
    /// re-initialised without a contract upgrade.
    AlreadyInitialized = 1,

    /// A mutating function was invoked before `initialize()` set the admin.
    /// The registry must be initialised before any campaigns can be registered.
    NotInitialized = 2,

    /// The caller did not satisfy the required authorisation check.
    ///
    /// For `register`, `register_with_category`, and `register_with_status`
    /// this means `campaign_id.require_auth()` failed — the campaign contract
    /// did not sign the transaction.
    ///
    /// For `update_status` this means the stored admin address did not sign the
    /// transaction.
    Unauthorized = 3,

    /// The campaign address supplied to `update_status` is not present in the
    /// registry.  Clients should call `register_with_status` first.
    NotFound = 4,

    /// The campaign is already present in the registry.
    /// Returned instead of silently ignoring duplicate registrations.
    AlreadyRegistered = 5,
}

impl From<common::CommonError> for ContractError {
    /// Folds the shared [`common::CommonError`] variants into this contract's
    /// error space, preserving stable on-chain discriminants.
    ///
    /// | `CommonError` variant   | Maps to                           |
    /// |-------------------------|-----------------------------------|
    /// | `Unauthorized`          | `ContractError::Unauthorized` (3) |
    /// | `NotFound`              | `ContractError::NotFound` (4)     |
    /// | `AlreadyInitialized`    | `ContractError::AlreadyInitialized` (1) |
    /// | `AlreadyExists`         | `ContractError::AlreadyRegistered` (5) |
    /// | `InvalidInput`          | `ContractError::Unauthorized` (3) — closest available generic |
    /// | `NotInitialized`        | `ContractError::NotInitialized` (2) |
    fn from(err: common::CommonError) -> Self {
        match err {
            common::CommonError::Unauthorized => ContractError::Unauthorized,
            common::CommonError::NotFound => ContractError::NotFound,
            common::CommonError::AlreadyInitialized => ContractError::AlreadyInitialized,
            common::CommonError::AlreadyExists => ContractError::AlreadyRegistered,
            common::CommonError::NotInitialized => ContractError::NotInitialized,
            // No exact match for InvalidInput in the registry error set;
            // Unauthorized is the closest generic catch-all.
            common::CommonError::InvalidInput => ContractError::Unauthorized,
            common::CommonError::NotInitialized => ContractError::NotInitialized,
        }
    }
}

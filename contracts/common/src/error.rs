//! Shared base error variants for Fund-My-Cause Soroban contracts.

use soroban_sdk::contracterror;

/// Base error variants shared by every Fund-My-Cause contract.
///
/// Each contract keeps its own `#[contracterror] ContractError` (so its
/// domain-specific variants and existing on-chain discriminants stay
/// undisturbed) and implements `From<CommonError> for ContractError` to fold
/// these shared cases into its own error space. See the crate README for the
/// rationale.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    /// Caller is not authorized to perform this operation.
    Unauthorized = 1,
    /// Requested item was not found.
    NotFound = 2,
    /// Provided input failed validation.
    InvalidInput = 3,
    /// Contract or resource has already been initialized.
    AlreadyInitialized = 4,
    /// Resource already exists.
    AlreadyExists = 5,
    /// Contract has not been initialised yet; required storage key is absent.
    NotInitialized = 6,
    /// Operation blocked because the contract is paused.
    Paused = 7,
    /// Arithmetic overflow detected.
    Overflow = 8,
}

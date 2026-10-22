//! Security module for the crowdfund contract.
//!
//! ## Checks-Effects-Interactions (CEI) Safety Model
//!
//! All state-mutating entrypoints in `lib.rs` follow the CEI pattern to prevent
//! reentrancy and ensure atomicity:
//!
//! 1. **Checks** — validate all preconditions (status, auth, amounts, deadlines)
//!    before touching any state.
//! 2. **Effects** — write every state change (storage updates, counter increments)
//!    before any external call.
//! 3. **Interactions** — perform token transfers (external calls) only after all
//!    internal state is finalised.
//!
//! ### Entrypoint audit
//!
//! | Function                   | CEI order         | Notes                                        |
//! |----------------------------|-------------------|----------------------------------------------|
//! | `contribute`               | ✅ checks→effects→transfer | Transfer after all storage writes.  |
//! | `withdraw`                 | ✅ checks→effects→transfer | Status set to `Successful`, total zeroed, then transfer. |
//! | `refund_single`            | ✅ checks→effects→transfer | Contribution zeroed before transfer.         |
//! | `refund_batch`             | ✅ checks→effects→transfer | Each contribution zeroed before its transfer.|
//! | `refund_partial`           | ✅ checks→effects→transfer | Balance decremented then transfer.           |
//! | `execute_emergency_withdrawal` | ✅ checks→effects→transfer | Total zeroed before transfer.           |
//! | `contribute_on_behalf`     | ✅ checks→effects→transfer | All writes before transfer.                  |
//! | `setup_matching`           | ✅ checks→effects→transfer | Config written before sponsor transfer-in.   |
//! | `claim_insurance_payout`   | ✅ checks→effects→transfer | Fee record zeroed, pool decremented before transfer. |
//! | `claim_yield`              | ✅ checks→effects→transfer | Accounting updated before transfer.          |
//! | `distribute_rewards`       | ✅ checks→effects→transfer | Claimed amount recorded before transfer.     |
//!
//! ### Reentrancy
//!
//! Soroban's execution model is single-threaded and contracts cannot be re-entered
//! mid-execution via the token transfer mechanism (token contracts are separate
//! Wasm instances and cannot call back into the crowdfund contract during a
//! transfer).  The `ReentrancyGuard` struct is available as an additional
//! defence-in-depth layer for any future entrypoints that may be susceptible.
//!
//! ### Malicious Token Defence
//!
//! A malicious token contract that panics, loops, or lies about balances can
//! cause a transaction to abort.  Because all effects are written before the
//! external transfer call, an aborted transaction rolls back the entire ledger
//! change — no partial state corruption is possible.  See `adversarial.rs` for
//! tests that verify this property.

use crate::errors::ContractError;
use crate::storage;
use soroban_sdk::{Address, Env, Vec};

const REENTRANCY_GUARD_LOCK: u32 = 1;
const REENTRANCY_GUARD_UNLOCKED: u32 = 0;

/// Reentrancy protection guard using the state machine pattern.
pub struct ReentrancyGuard;

impl ReentrancyGuard {
    /// Acquires the reentrancy lock.
    ///
    /// # Returns
    /// * `Ok(())` if lock acquired successfully
    /// * `Err(ContractError::ReentrancyDetected)` if already locked
    pub fn acquire(env: &Env) -> Result<(), ContractError> {
        let current = env
            .storage()
            .instance()
            .get::<_, u32>(&storage::KEY_REENTRANCY_LOCK)
            .unwrap_or(REENTRANCY_GUARD_UNLOCKED);

        if current == REENTRANCY_GUARD_LOCK {
            return Err(ContractError::ReentrancyDetected);
        }

        env.storage()
            .instance()
            .set(&storage::KEY_REENTRANCY_LOCK, &REENTRANCY_GUARD_LOCK);
        Ok(())
    }

    /// Releases the reentrancy lock.
    pub fn release(env: &Env) {
        env.storage()
            .instance()
            .set(&storage::KEY_REENTRANCY_LOCK, &REENTRANCY_GUARD_UNLOCKED);
    }
}

/// Circuit breaker pattern for emergency stops.
pub struct CircuitBreaker;

impl CircuitBreaker {
    /// Checks if the circuit is broken (emergency pause is active).
    ///
    /// # Returns
    /// * `true` if emergency pause is active
    /// * `false` otherwise
    pub fn is_broken(env: &Env) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&storage::KEY_EMERGENCY_PAUSE)
            .unwrap_or(false)
    }

    /// Enforces circuit breaker. Returns error if broken.
    pub fn enforce(env: &Env) -> Result<(), ContractError> {
        if Self::is_broken(env) {
            return Err(ContractError::EmergencyPauseActive);
        }
        Ok(())
    }

    /// Trips the circuit breaker (activates emergency pause).
    pub fn trip(env: &Env, admin: &Address) -> Result<(), ContractError> {
        let contract_admin = storage::get_admin(env)?;
        if admin != &contract_admin {
            return Err(ContractError::Unauthorized);
        }
        env.storage()
            .instance()
            .set(&storage::KEY_EMERGENCY_PAUSE, &true);
        Ok(())
    }

    /// Resets the circuit breaker (deactivates emergency pause).
    pub fn reset(env: &Env, admin: &Address) -> Result<(), ContractError> {
        let contract_admin = storage::get_admin(env)?;
        if admin != &contract_admin {
            return Err(ContractError::Unauthorized);
        }
        env.storage()
            .instance()
            .set(&storage::KEY_EMERGENCY_PAUSE, &false);
        Ok(())
    }
}

/// Rate limiting control for sensitive operations.
pub struct RateLimiter;

impl RateLimiter {
    /// Checks if an address can perform an operation given the rate limit.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `addr` - Address to check
    /// * `max_ops_per_ledger` - Maximum operations allowed per ledger
    ///
    /// # Returns
    /// * `Ok(())` if operation is allowed
    /// * `Err(ContractError::RateLimitExceeded)` if limit exceeded
    pub fn check(env: &Env, addr: &Address, max_ops_per_ledger: u32) -> Result<(), ContractError> {
        let current_ledger = env.ledger().sequence();
        let key = storage::make_rate_limit_key(addr);

        let (last_ledger, count): (u32, u32) =
            env.storage().persistent().get(&key).unwrap_or((0, 0));

        // Reset count if we're in a new ledger
        let (new_ledger, new_count) = if last_ledger < current_ledger {
            (current_ledger, 1)
        } else if count >= max_ops_per_ledger {
            return Err(ContractError::RateLimitExceeded);
        } else {
            (current_ledger, count + 1)
        };

        env.storage()
            .persistent()
            .set(&key, &(new_ledger, new_count));
        Ok(())
    }
}

/// Input sanitization helpers.
pub struct InputValidator;

impl InputValidator {
    /// Validates that a string is within acceptable length bounds.
    ///
    /// # Arguments
    /// * `input` - String to validate
    /// * `max_length` - Maximum allowed length
    ///
    /// # Returns
    /// * `Ok(())` if string is valid
    /// * `Err(ContractError::InvalidInput)` if string is too long
    pub fn validate_string_length(input: &str, max_length: usize) -> Result<(), ContractError> {
        if input.len() > max_length {
            return Err(ContractError::InvalidInput);
        }
        Ok(())
    }

    /// Validates that an amount is within reasonable bounds.
    ///
    /// # Arguments
    /// * `amount` - Amount to validate
    /// * `max_amount` - Maximum allowed amount (set to i128::MAX to disable)
    ///
    /// # Returns
    /// * `Ok(())` if amount is valid
    /// * `Err(ContractError::InvalidInput)` if amount exceeds bounds
    pub fn validate_amount(amount: i128, max_amount: i128) -> Result<(), ContractError> {
        if amount < 0 || amount > max_amount {
            return Err(ContractError::InvalidInput);
        }
        Ok(())
    }

    /// Validates an address list for duplicates.
    ///
    /// # Arguments
    /// * `addresses` - Vector of addresses to validate
    ///
    /// # Returns
    /// * `Ok(())` if no duplicates
    /// * `Err(ContractError::InvalidInput)` if duplicates found
    pub fn validate_no_duplicates(addresses: &Vec<Address>) -> Result<(), ContractError> {
        let len = addresses.len();
        for i in 0..len {
            // Bounds are guaranteed by the loop range, but use fallible access so an
            // unexpected out-of-range index returns a typed error rather than panicking.
            let a = addresses.get(i).ok_or(ContractError::InvalidInput)?;
            for j in (i + 1)..len {
                let b = addresses.get(j).ok_or(ContractError::InvalidInput)?;
                if a == b {
                    return Err(ContractError::InvalidInput);
                }
            }
        }
        Ok(())
    }
}

/// Contributor allow/deny list helpers.
///
/// Renamed from `AccessControl` to `ContributorGate` to eliminate the name
/// collision with `common::AccessControl` (the role-auth primitive shared
/// across contracts).  This struct handles whitelist/blacklist membership
/// checks for individual contributors — a semantically distinct concern from
/// the role-based `require_auth` wrapper in `contracts/common`.
pub struct ContributorGate;

impl ContributorGate {
    /// Requires that the caller is the contract admin.
    ///
    /// # Arguments
    /// * `caller` - The caller's address
    /// * `admin` - The admin's address
    ///
    /// # Returns
    /// * `Ok(())` if caller is admin
    /// * `Err(ContractError::Unauthorized)` otherwise
    pub fn require_admin(caller: &Address, admin: &Address) -> Result<(), ContractError> {
        if caller != admin {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    /// Requires that the caller is the campaign creator.
    ///
    /// # Arguments
    /// * `caller` - The caller's address
    /// * `creator` - The creator's address
    ///
    /// # Returns
    /// * `Ok(())` if caller is creator
    /// * `Err(ContractError::Unauthorized)` otherwise
    pub fn require_creator(caller: &Address, creator: &Address) -> Result<(), ContractError> {
        if caller != creator {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    /// Checks if an address is in a whitelist.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `addr` - Address to check
    /// * `whitelist` - Vector of whitelisted addresses
    ///
    /// # Returns
    /// * `true` if address is whitelisted
    /// * `false` otherwise
    pub fn is_whitelisted(addr: &Address, whitelist: &Vec<Address>) -> bool {
        // Iterate by value so no panicking index access is required.
        whitelist.iter().any(|entry| &entry == addr)
    }

    /// Checks if an address is in a blacklist.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `addr` - Address to check
    /// * `blacklist` - Vector of blacklisted addresses
    ///
    /// # Returns
    /// * `true` if address is blacklisted
    /// * `false` otherwise
    pub fn is_blacklisted(addr: &Address, blacklist: &Vec<Address>) -> bool {
        // Iterate by value so no panicking index access is required.
        blacklist.iter().any(|entry| &entry == addr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_validator_string_length() {
        assert!(InputValidator::validate_string_length("hello", 10).is_ok());
        assert!(InputValidator::validate_string_length("hello", 5).is_ok());
        assert!(InputValidator::validate_string_length("hello", 4).is_err());
    }

    #[test]
    fn test_input_validator_amount() {
        assert!(InputValidator::validate_amount(100, 1000).is_ok());
        assert!(InputValidator::validate_amount(-1, 1000).is_err());
        assert!(InputValidator::validate_amount(1001, 1000).is_err());
    }

    // ── Issue #835: no-panic guarantees on the previously-unwrapping paths ─────

    use soroban_sdk::{testutils::Address as _, Env, Vec};

    /// `validate_no_duplicates` must never panic, regardless of list contents or
    /// length — empty, single, duplicate-laden, or large adversarial inputs all
    /// return a typed `Result` instead of an index-out-of-bounds panic.
    #[test]
    fn test_validate_no_duplicates_never_panics() {
        let env = Env::default();

        // Empty and single-element lists: trivially OK.
        let empty: Vec<Address> = Vec::new(&env);
        assert!(InputValidator::validate_no_duplicates(&empty).is_ok());

        let a = Address::generate(&env);
        let single = Vec::from_array(&env, [a.clone()]);
        assert!(InputValidator::validate_no_duplicates(&single).is_ok());

        // Distinct addresses: OK.
        let b = Address::generate(&env);
        let distinct = Vec::from_array(&env, [a.clone(), b.clone()]);
        assert!(InputValidator::validate_no_duplicates(&distinct).is_ok());

        // Duplicates anywhere in the list: typed error, no panic.
        let dupes = Vec::from_array(&env, [a.clone(), b, a]);
        assert_eq!(
            InputValidator::validate_no_duplicates(&dupes),
            Err(ContractError::InvalidInput)
        );

        // Larger adversarial list built dynamically — exercises the nested
        // index access that previously used `.get(i).unwrap()`.
        let mut big: Vec<Address> = Vec::new(&env);
        for _ in 0..64 {
            big.push_back(Address::generate(&env));
        }
        assert!(InputValidator::validate_no_duplicates(&big).is_ok());
    }

    /// `is_whitelisted` / `is_blacklisted` must never panic on any list, including
    /// the empty list where the old `0..len` + `.get(i).unwrap()` loop was safe
    /// only by accident.
    #[test]
    fn test_membership_checks_never_panic() {
        let env = Env::default();
        let target = Address::generate(&env);

        let empty: Vec<Address> = Vec::new(&env);
        assert!(!ContributorGate::is_whitelisted(&target, &empty));
        assert!(!ContributorGate::is_blacklisted(&target, &empty));

        let other = Address::generate(&env);
        let list = Vec::from_array(&env, [other.clone(), target.clone()]);
        assert!(ContributorGate::is_whitelisted(&target, &list));
        assert!(ContributorGate::is_blacklisted(&target, &list));

        let missing = Vec::from_array(&env, [other]);
        assert!(!ContributorGate::is_whitelisted(&target, &missing));
        assert!(!ContributorGate::is_blacklisted(&target, &missing));
    }
}

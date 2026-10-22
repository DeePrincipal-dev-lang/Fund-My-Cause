//! Shared test utilities and fixtures for Fund-My-Cause Soroban contract testing.
//!
//! This module provides common setup helpers to reduce boilerplate across
//! `crowdfund`, `achievements`, and `registry` test files.
//!
//! # Usage
//!
//! In each contract's test module or test files, import and use:
//!
//! ```ignore
//! use common::test_utils::{setup_env, generate_addresses};
//! ```

use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

/// Creates and configures a new test environment with mock authentication.
///
/// # Returns
///
/// A fresh `Env` instance with all authentications mocked (`mock_all_auths()`
/// pre-called so authorization checks pass by default).
pub fn setup_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

#[cfg(test)]
mod tests {
    use super::setup_env;

    #[test]
    fn test_setup_env_creates_environment() {
        let env = setup_env();
        assert_eq!(env.ledger().sequence(), 0);
    }
}

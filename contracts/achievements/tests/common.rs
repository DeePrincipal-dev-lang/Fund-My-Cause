//! Shared test fixtures for the achievements contract integration tests.
//!
//! Provides contract deployment and initialization helpers. Uses shared
//! test utilities from the common crate for environment setup.

#![cfg(test)]
#![allow(dead_code)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use achievements::{AchievementsContract, AchievementsContractClient};

/// Deploy a fresh, uninitialized achievements contract.
///
/// The contract is **not** initialized — callers must call `initialize` themselves.
pub fn deploy(env: &Env) -> AchievementsContractClient {
    let id = env.register(AchievementsContract, ());
    AchievementsContractClient::new(env, &id)
}

/// Deploy and initialize an achievements contract; returns the client, admin,
/// and platform address.
///
/// The environment is pre-configured with mocked authentication via `setup_env()`.
pub fn deploy_and_init(env: &Env) -> (AchievementsContractClient, Address, Address) {
    let client = deploy(env);
    let admin = Address::generate(env);
    let platform = Address::generate(env);
    client.initialize(&admin, &platform);
    (client, admin, platform)
}

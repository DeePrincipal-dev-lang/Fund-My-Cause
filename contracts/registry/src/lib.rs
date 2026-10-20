//! # Registry Contract for Fund-My-Cause
//!
//! This contract manages project registration, lookup, and verification.
//! Entrypoints are wired to business logic in `admin.rs` and `lookup.rs`.

#![no_std]
// The SDK deprecated `Events::publish` in favour of the `#[contractevent]` macro.
// Migrating changes how events are encoded on the wire, so it is a behaviour change
// for every off-chain consumer, not a lint cleanup, and is tracked separately.
#![allow(deprecated)]

mod admin;
mod events;
mod lookup;

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};
use common::CommonError;
use admin::AdminLogic;
use lookup::{LookupLogic, ProjectUpdate};

// ================================================================
// Contract Entrypoints
// ================================================================

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // ── Admin Entrypoints ──────────────────────────────────────────

    /// Initialize the registry
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), CommonError> {
        AdminLogic::initialize(&env, admin, fee_bps, fee_recipient)
    }

    /// Get the current admin
    pub fn get_admin(env: Env) -> Result<Address, CommonError> {
        AdminLogic::get_admin(&env)
    }

    /// Transfer admin
    pub fn transfer_admin(
        env: Env,
        current_admin: Address,
        new_admin: Address,
    ) -> Result<(), CommonError> {
        AdminLogic::transfer_admin(&env, current_admin, new_admin)
    }

    /// Pause the registry
    pub fn pause(env: Env, caller: Address) -> Result<(), CommonError> {
        AdminLogic::pause(&env, caller)
    }

    /// Unpause the registry
    pub fn unpause(env: Env, caller: Address) -> Result<(), CommonError> {
        AdminLogic::unpause(&env, caller)
    }

    /// Check if registry is paused
    pub fn is_paused(env: Env) -> bool {
        AdminLogic::is_paused(&env)
    }

    // ── Lookup Entrypoints ────────────────────────────────────────

    /// Register a new project
    pub fn register_project(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        category: String,
    ) -> Result<u64, CommonError> {
        LookupLogic::register_project(&env, creator, name, description, category)
    }

    /// Get a project by ID
    pub fn get_project(
        env: Env,
        id: u64,
    ) -> Result<lookup::Project, CommonError> {
        LookupLogic::get_project(&env, id)
    }

    /// Get all project IDs
    pub fn get_all_project_ids(env: Env) -> Vec<u64> {
        LookupLogic::get_all_project_ids(&env)
    }

    /// Update a project
    pub fn update_project(
        env: Env,
        id: u64,
        caller: Address,
        name: Option<String>,
        description: Option<String>,
        category: Option<String>,
    ) -> Result<(), CommonError> {
        let updates = ProjectUpdate {
            name,
            description,
            category,
        };
        LookupLogic::update_project(&env, id, caller, updates)
    }

    /// Verify a project (admin only)
    pub fn verify_project(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<(), CommonError> {
        LookupLogic::verify_project(&env, id, caller)
    }

    /// Archive a project (admin only)
    pub fn archive_project(
        env: Env,
        id: u64,
        caller: Address,
    ) -> Result<(), CommonError> {
        LookupLogic::archive_project(&env, id, caller)
    }
}

#[cfg(test)]
mod tests;

//! Registry Event Helpers
//!
//! This module re-exports shared event helpers for the registry contract.
//! All event emission should use these helpers for consistency.

use common::events::EventEmitter;

/// Registry-specific event helpers
pub struct RegistryEvents;

impl RegistryEvents {
    /// Emit registry initialized event
    pub fn initialized(env: &soroban_sdk::Env, admin: soroban_sdk::Address) {
        EventEmitter::registry_initialized(env, admin);
    }

    /// Emit project registered event
    pub fn project_registered(
        env: &soroban_sdk::Env,
        project_id: u64,
        creator: soroban_sdk::Address,
        name: soroban_sdk::String,
        category: soroban_sdk::String,
    ) {
        EventEmitter::project_registered(env, project_id, creator, name, category);
    }

    /// Emit project updated event
    pub fn project_updated(
        env: &soroban_sdk::Env,
        project_id: u64,
        updated_by: soroban_sdk::Address,
    ) {
        EventEmitter::project_updated(env, project_id, updated_by);
    }

    /// Emit project verified event
    pub fn project_verified(
        env: &soroban_sdk::Env,
        project_id: u64,
        verifier: soroban_sdk::Address,
    ) {
        EventEmitter::project_verified(env, project_id, verifier);
    }

    /// Emit project archived event
    pub fn project_archived(
        env: &soroban_sdk::Env,
        project_id: u64,
        archived_by: soroban_sdk::Address,
    ) {
        EventEmitter::project_archived(env, project_id, archived_by);
    }
}

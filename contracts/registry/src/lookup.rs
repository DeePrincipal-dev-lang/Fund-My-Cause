//! # Lookup Business Logic for Registry Contract
//!
//! This module contains all lookup-related business logic for the registry contract.
//! It handles:
//! - Project registration
//! - Project lookup
//! - Project verification
//! - Project updates

use soroban_sdk::{Address, Env, String, Vec};
use common::CommonError;
use crate::admin::AdminLogic;
use crate::events::RegistryEvents;

// ================================================================
// Data Structures
// ================================================================

#[derive(Clone, Debug)]
pub struct Project {
    pub id: u64,
    pub creator: Address,
    pub name: String,
    pub description: String,
    pub category: String,
    pub verified: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone, Debug)]
pub struct ProjectUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
}

// ================================================================
// Lookup Business Logic
// ================================================================

pub struct LookupLogic;

impl LookupLogic {
    /// Register a new project
    pub fn register_project(
        env: &Env,
        creator: Address,
        name: String,
        description: String,
        category: String,
    ) -> Result<u64, CommonError> {
        // Check if registry is paused
        if AdminLogic::is_paused(env) {
            return Err(CommonError::Paused);
        }

        creator.require_auth();

        // Get next project ID
        let id = Self::get_next_id(env)?;

        // Create project
        let project = Project {
            id,
            creator: creator.clone(),
            name: name.clone(),
            description: description.clone(),
            category: category.clone(),
            verified: false,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
        };

        // Store project
        let key = String::from_str(env, &format!("project_{}", id));
        env.storage().set(&key, &project);

        // Add to project list
        let list_key = String::from_str(env, "project_ids");
        let mut ids: Vec<u64> = env.storage().get(&list_key).unwrap_or_else(|| Vec::new(env));
        ids.push_back(id);
        env.storage().set(&list_key, &ids);

        // Emit event via the shared registry/common event schema (see
        // contracts/common/src/events.rs) instead of an ad-hoc tuple, so
        // services/indexer can parse registry events the same way it parses
        // every other contract's events.
        RegistryEvents::project_registered(&env, id, creator, name, category);

        Ok(id)
    }

    /// Get a project by ID
    pub fn get_project(env: &Env, id: u64) -> Result<Project, CommonError> {
        let key = String::from_str(env, &format!("project_{}", id));
        env.storage()
            .get(&key)
            .ok_or(CommonError::NotFound)
    }

    /// Get all project IDs
    pub fn get_all_project_ids(env: &Env) -> Vec<u64> {
        let list_key = String::from_str(env, "project_ids");
        env.storage().get(&list_key).unwrap_or_else(|| Vec::new(env))
    }

    /// Update a project
    pub fn update_project(
        env: &Env,
        id: u64,
        caller: Address,
        updates: ProjectUpdate,
    ) -> Result<(), CommonError> {
        if AdminLogic::is_paused(env) {
            return Err(CommonError::Paused);
        }

        let mut project = Self::get_project(env, id)?;

        // Only creator can update
        if project.creator != caller {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        // Apply updates
        if let Some(name) = updates.name {
            project.name = name;
        }
        if let Some(description) = updates.description {
            project.description = description;
        }
        if let Some(category) = updates.category {
            project.category = category;
        }
        project.updated_at = env.ledger().timestamp();

        // Store updated project
        let key = String::from_str(env, &format!("project_{}", id));
        env.storage().set(&key, &project);

        RegistryEvents::project_updated(&env, id, caller);

        Ok(())
    }

    /// Verify a project (admin only)
    pub fn verify_project(
        env: &Env,
        id: u64,
        caller: Address,
    ) -> Result<(), CommonError> {
        // Check if caller is admin
        let admin = AdminLogic::get_admin(env)?;
        if caller != admin {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        let mut project = Self::get_project(env, id)?;
        // Shared issuance guard (also used by contracts/achievements): a
        // project can only be verified once.
        common::IssuanceValidator::check_not_already_issued(project.verified)?;
        project.verified = true;
        project.updated_at = env.ledger().timestamp();

        let key = String::from_str(env, &format!("project_{}", id));
        env.storage().set(&key, &project);

        RegistryEvents::project_verified(&env, id, caller);

        Ok(())
    }

    /// Archive a project (admin only)
    pub fn archive_project(
        env: &Env,
        id: u64,
        caller: Address,
    ) -> Result<(), CommonError> {
        let admin = AdminLogic::get_admin(env)?;
        if caller != admin {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        // Remove from project list
        let list_key = String::from_str(env, "project_ids");
        let mut ids: Vec<u64> = env.storage().get(&list_key).unwrap_or_else(|| Vec::new(env));
        ids.retain(|&x| x != id);
        env.storage().set(&list_key, &ids);

        // Mark as archived
        let key = String::from_str(env, &format!("project_{}", id));
        let mut project = Self::get_project(env, id)?;
        let archived_key = String::from_str(env, &format!("project_{}_archived", id));
        env.storage().set(&archived_key, &true);

        RegistryEvents::project_archived(&env, id, caller);

        Ok(())
    }

    /// Get next project ID
    pub fn get_next_id(env: &Env) -> Result<u64, CommonError> {
        let key = String::from_str(env, "next_id");
        let next_id: u64 = env.storage().get(&key).unwrap_or(0);
        let new_id = next_id
            .checked_add(1)
            .ok_or(CommonError::Overflow)?;
        env.storage().set(&key, &new_id);
        Ok(new_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, Address};

    fn setup_test_env(env: &Env) -> (Address, Address) {
        let admin = Address::random(env);
        let fee_recipient = Address::random(env);
        AdminLogic::initialize(env, admin.clone(), 100, fee_recipient).unwrap();
        (admin, fee_recipient)
    }

    #[test]
    fn test_register_project() {
        let env = Env::default();
        let (admin, _) = setup_test_env(&env);
        let creator = Address::random(&env);

        let id = LookupLogic::register_project(
            &env,
            creator.clone(),
            String::from_str(&env, "Test Project"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "Technology"),
        ).unwrap();

        assert_eq!(id, 1);

        let project = LookupLogic::get_project(&env, id).unwrap();
        assert_eq!(project.name, String::from_str(&env, "Test Project"));
        assert_eq!(project.creator, creator);
        assert!(!project.verified);
    }

    #[test]
    fn test_update_project() {
        let env = Env::default();
        let (admin, _) = setup_test_env(&env);
        let creator = Address::random(&env);

        let id = LookupLogic::register_project(
            &env,
            creator.clone(),
            String::from_str(&env, "Test Project"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "Technology"),
        ).unwrap();

        let updates = ProjectUpdate {
            name: Some(String::from_str(&env, "Updated Project")),
            description: Some(String::from_str(&env, "Updated Description")),
            category: None,
        };

        let result = LookupLogic::update_project(&env, id, creator, updates);
        assert!(result.is_ok());

        let project = LookupLogic::get_project(&env, id).unwrap();
        assert_eq!(project.name, String::from_str(&env, "Updated Project"));
    }

    #[test]
    fn test_verify_project() {
        let env = Env::default();
        let (admin, _) = setup_test_env(&env);
        let creator = Address::random(&env);

        let id = LookupLogic::register_project(
            &env,
            creator,
            String::from_str(&env, "Test Project"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "Technology"),
        ).unwrap();

        let result = LookupLogic::verify_project(&env, id, admin);
        assert!(result.is_ok());

        let project = LookupLogic::get_project(&env, id).unwrap();
        assert!(project.verified);
    }
}

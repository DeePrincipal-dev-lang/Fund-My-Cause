//! # Admin Business Logic for Registry Contract
//!
//! This module contains all admin-related business logic for the registry contract.
//! It handles:
//! - Initialization
//! - Admin management
//! - Fee configuration
//! - Emergency controls

use crate::events::RegistryEvents;
use soroban_sdk::{Address, Env, Vec};

// ================================================================
// Admin Data Structures
// ================================================================

#[derive(Clone, Debug)]
pub struct AdminState {
    pub admin: Address,
    pub paused: bool,
    pub fee_bps: u32,
    pub fee_recipient: Address,
}

#[derive(Clone, Debug)]
pub struct FeeConfig {
    pub registration_fee_bps: u32,
    pub update_fee_bps: u32,
    pub verify_fee_bps: u32,
    pub fee_recipient: Address,
}

// ================================================================
// Admin Business Logic
// ================================================================

pub struct AdminLogic;

impl AdminLogic {
    /// Initialize the registry with an admin
    pub fn initialize(
        env: &Env,
        admin: Address,
        fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), CommonError> {
        // Check if already initialized
        let key = String::from_str(env, "initialized");
        if env.storage().has(&key) {
            return Err(CommonError::AlreadyInitialized);
        }

        // Store admin
        let admin_key = String::from_str(env, "admin");
        env.storage().set(&admin_key, &admin);

        // Store fee config
        let fee_config = FeeConfig {
            registration_fee_bps: fee_bps,
            update_fee_bps: fee_bps / 2,
            verify_fee_bps: fee_bps / 4,
            fee_recipient: fee_recipient.clone(),
        };
        let fee_key = String::from_str(env, "fee_config");
        env.storage().set(&fee_key, &fee_config);

        // Set paused to false
        let paused_key = String::from_str(env, "paused");
        env.storage().set(&paused_key, &false);

        // Mark as initialized
        env.storage().set(&key, &true);

        // Emit event via the shared registry/common event schema.
        RegistryEvents::initialized(env, admin);

        Ok(())
    }

    /// Get the current admin
    pub fn get_admin(env: &Env) -> Result<Address, CommonError> {
        let key = String::from_str(env, "admin");
        env.storage()
            .get(&key)
            .ok_or(CommonError::NotInitialized)
    }

    /// Transfer admin to a new address
    pub fn transfer_admin(
        env: &Env,
        current_admin: Address,
        new_admin: Address,
    ) -> Result<(), CommonError> {
        // Verify current admin
        let stored_admin = Self::get_admin(env)?;
        if current_admin != stored_admin {
            return Err(CommonError::Unauthorized);
        }

        // Require auth
        current_admin.require_auth();

        // Store new admin
        let key = String::from_str(env, "admin");
        env.storage().set(&key, &new_admin);

        // Emit event
        env.events().publish(
            ("admin_transferred", "v1"),
            (current_admin, new_admin),
        );

        Ok(())
    }

    /// Pause the registry
    pub fn pause(env: &Env, caller: Address) -> Result<(), CommonError> {
        // Verify caller is admin
        let admin = Self::get_admin(env)?;
        if caller != admin {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        let key = String::from_str(env, "paused");
        env.storage().set(&key, &true);

        env.events().publish(
            ("registry_paused", "v1"),
            (caller, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Unpause the registry
    pub fn unpause(env: &Env, caller: Address) -> Result<(), CommonError> {
        let admin = Self::get_admin(env)?;
        if caller != admin {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        let key = String::from_str(env, "paused");
        env.storage().set(&key, &false);

        env.events().publish(
            ("registry_unpaused", "v1"),
            (caller, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Check if registry is paused
    pub fn is_paused(env: &Env) -> bool {
        let key = String::from_str(env, "paused");
        env.storage().get(&key).unwrap_or(false)
    }

    /// Update fee configuration
    pub fn update_fee_config(
        env: &Env,
        caller: Address,
        registration_fee_bps: u32,
        update_fee_bps: u32,
        verify_fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), CommonError> {
        let admin = Self::get_admin(env)?;
        if caller != admin {
            return Err(CommonError::Unauthorized);
        }
        caller.require_auth();

        let fee_config = FeeConfig {
            registration_fee_bps,
            update_fee_bps,
            verify_fee_bps,
            fee_recipient: fee_recipient.clone(),
        };

        let key = String::from_str(env, "fee_config");
        env.storage().set(&key, &fee_config);

        env.events().publish(
            ("fee_config_updated", "v1"),
            (registration_fee_bps, update_fee_bps, verify_fee_bps, fee_recipient),
        );

        Ok(())
    }

    /// Get fee configuration
    pub fn get_fee_config(env: &Env) -> Result<FeeConfig, CommonError> {
        let key = String::from_str(env, "fee_config");
        env.storage()
            .get(&key)
            .ok_or(CommonError::NotInitialized)
    }

    /// Update campaign status (admin only)
    pub fn update_campaign_status(
        env: &Env,
        campaign_id: Address,
        new_status: CampaignStatus,
    ) -> Result<(), CommonError> {
        let admin = Self::get_admin(env)?;
        admin.require_auth();

        // Guard: campaign must already be registered globally
        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&String::from_str(env, "campaigns"))
            .unwrap_or_else(|| Vec::new(env));
        if !campaigns.contains(&campaign_id) {
            return Err(CommonError::NotFound);
        }

        // Get current status and update
        let status_key = String::from_str(env, &format!("campaign_status_{}", campaign_id.to_string()));
        let old_status: CampaignStatus = env.storage().get(&status_key).unwrap_or(CampaignStatus::Pending);
        env.storage().set(&status_key, &new_status);

        env.events().publish(
            ("campaign_status_updated", "v1"),
            (campaign_id, old_status, new_status),
        );

        Ok(())
    }
}

/// See [`crate::RegistryContract::update_status`].
pub(crate) fn update_status(
    env: Env,
    campaign_id: Address,
    old_status: CampaignStatus,
    new_status: CampaignStatus,
) -> Result<(), ContractError> {
    require_initialized(&env)?;

    // Issue #1147: use the shared AccessControl helper instead of the previously
    // inline "read KEY_ADMIN → require_role_auth" pattern. Behaviour is identical:
    // loads the stored admin address and calls require_auth() on it.
    common::AccessControl::require_stored_auth(&env, &KEY_ADMIN)
        .map_err(|_| ContractError::Unauthorized)?;

    // Guard: campaign must already be registered globally
    let campaigns: Vec<Address> = env
        .storage()
        .instance()
        .get(&KEY_CAMPAIGNS)
        .unwrap_or_else(|| Vec::new(&env));
    if !campaigns.contains(&campaign_id) {
        return Err(ContractError::NotFound);
    }

    #[test]
    fn test_initialize_already_initialized() {
        let env = Env::default();
        let admin = Address::random(&env);
        let fee_recipient = Address::random(&env);

        AdminLogic::initialize(&env, admin.clone(), 100, fee_recipient).unwrap();

        let result = AdminLogic::initialize(&env, admin, 100, fee_recipient);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CommonError::AlreadyInitialized);
    }

    #[test]
    fn test_transfer_admin() {
        let env = Env::default();
        let admin = Address::random(&env);
        let fee_recipient = Address::random(&env);
        let new_admin = Address::random(&env);

        AdminLogic::initialize(&env, admin.clone(), 100, fee_recipient).unwrap();

        let result = AdminLogic::transfer_admin(&env, admin.clone(), new_admin.clone());
        assert!(result.is_ok());

        let stored_admin = AdminLogic::get_admin(&env).unwrap();
        assert_eq!(stored_admin, new_admin);
    }

    #[test]
    fn test_transfer_admin_unauthorized() {
        let env = Env::default();
        let admin = Address::random(&env);
        let fee_recipient = Address::random(&env);
        let attacker = Address::random(&env);
        let new_admin = Address::random(&env);

        AdminLogic::initialize(&env, admin, 100, fee_recipient).unwrap();

        let result = AdminLogic::transfer_admin(&env, attacker, new_admin);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CommonError::Unauthorized);
    }

    #[test]
    fn test_pause() {
        let env = Env::default();
        let admin = Address::random(&env);
        let fee_recipient = Address::random(&env);

        AdminLogic::initialize(&env, admin.clone(), 100, fee_recipient).unwrap();

        let result = AdminLogic::pause(&env, admin.clone());
        assert!(result.is_ok());

        assert!(AdminLogic::is_paused(&env));
    }

    #[test]
    fn test_unpause() {
        let env = Env::default();
        let admin = Address::random(&env);
        let fee_recipient = Address::random(&env);

        AdminLogic::initialize(&env, admin.clone(), 100, fee_recipient).unwrap();

        AdminLogic::pause(&env, admin.clone()).unwrap();
        let result = AdminLogic::unpause(&env, admin);
        assert!(result.is_ok());

        assert!(!AdminLogic::is_paused(&env));
    }
}
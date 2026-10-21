//! # Access Control Functions
//!
//! This module handles visibility, whitelist, blacklist, allow-list, and deny-list
//! management, plus ownership transfer, pause/resume and the per-address rate limit.
//! It controls who can contribute to a campaign and the campaign's visibility level.
//!
//! ## Issue #1559 — every crowdfund authorization check
//!
//! Crowdfund no longer performs ad-hoc `Address::require_auth()` calls. Every
//! check is routed through [`common::AccessControl`] so there is one auditable
//! authorization path:
//!
//! | Module / entry points | Authorization check | Address source | Shared helper |
//! |---|---|---|---|
//! | `lifecycle::initialize`, `initialize_from_template` | creator | function argument | `AccessControl::require_role_auth` |
//! | `lifecycle::clone_campaign`, `cancel_campaign`, `archive` | creator | `KEY_CREATOR` | `require_auth_creator` → `require_stored_auth` |
//! | `access::*` (lists, visibility, pause, rate limit, ownership) | creator or admin | `KEY_CREATOR` / `KEY_ADMIN` | `require_auth_creator` / `auth_admin` |
//! | `access::transfer_ownership` | creator | `KEY_CREATOR` | `require_auth_creator` |
//! | `contribute::contribute`, `delegate_contribution`, `contribute_on_behalf`, `revoke_delegation` | contributor / delegator / delegate | function argument | `AccessControl::require_role_auth` |
//! | `refund::refund_partial`, `refund_matching_sponsor` | contributor / creator | argument / `KEY_CREATOR` | `AccessControl::require_role_auth` |
//! | `withdraw::*` | creator or admin | `KEY_CREATOR` / `KEY_ADMIN` | `require_auth_creator` / `auth_admin` |
//! | `metadata::update_metadata`, `update_ipfs_cid` | creator | `KEY_CREATOR` | `require_auth_creator` |
//! | `recurring::setup`, `cancel` | contributor | function argument | `AccessControl::require_role_auth` |
//! | `lib.rs` privileged endpoints (deadline, goal, category, emergency, matching, insurance, milestones, disputes, governance, yield, caps) | creator / admin / approver / sponsor / filer / voter / proposer / governor | `KEY_CREATOR` / `KEY_ADMIN` / function argument | `require_auth_creator` / `auth_admin` / `AccessControl::require_role_auth` |
//!
//! The `access_control_audit` integration test fails if a direct
//! `.require_auth()` call is reintroduced anywhere under `src/`.

use soroban_sdk::{Address, Env};

use crate::{
    errors::ContractError,
    helpers::require_auth_creator,
    storage::{
        DataKey, KEY_ADMIN, KEY_CREATOR, KEY_PAUSE_TIMELOCK, KEY_RATE_LIMIT, KEY_STATUS,
        KEY_UNPAUSE_AFTER, KEY_VISIBILITY, TTL_PERSISTENT_ENTRY,
    },
    types::{
        EventAllowlistRemoved, EventAllowlisted, EventBlacklistRemoved, EventBlacklisted,
        EventDenylistRemoved, EventDenylisted, EventOwnershipTransferred, EventPaused,
        EventPausedWithTimelock, EventRateLimitUpdated, EventResumed, EventStatusChanged,
        EventVisibilityChanged, EventWhitelistOnlySet, EventWhitelistRemoved, EventWhitelisted,
        RateLimit, Status, Visibility,
    },
};

/// Reads the admin address, mapping an un-initialised contract to a typed error.
///
/// #835: `KEY_ADMIN` is absent before `initialize`, so the former `.unwrap()` aborted
/// the host instead of returning a `ContractError` the client could inspect.
///
/// ## Issue #1147
/// Delegates to [`common::AccessControl::require_stored_auth`] — the shared
/// helper that replaced the inline "read KEY_ADMIN → require_auth" pattern
/// duplicated across `access.rs`, `helpers.rs`, and `registry/admin.rs`.
pub(crate) fn auth_admin(env: &Env) -> Result<Address, ContractError> {
    common::AccessControl::require_stored_auth(env, &KEY_ADMIN)
        .map_err(|_| ContractError::InvalidAddress)
}

// === Whitelist Functions

/// Adds an address to the whitelist (creator only).
pub(crate) fn add_to_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    env.storage()
        .persistent()
        .set(&DataKey::Whitelist(address.clone()), &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Whitelist(address.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events()
        .publish(("crowdfund", "whitelisted"), EventWhitelisted { address });
    Ok(())
}

/// Removes an address from the whitelist (creator only).
pub(crate) fn remove_from_whitelist(env: Env, address: Address) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    env.storage()
        .persistent()
        .remove(&DataKey::Whitelist(address.clone()));
    env.events().publish(
        ("crowdfund", "whitelist_removed"),
        EventWhitelistRemoved { address },
    );
    Ok(())
}

/// Enables whitelist-only mode (creator only).
pub(crate) fn set_whitelist_only(env: Env, enabled: bool) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    env.storage()
        .instance()
        .set(&DataKey::WhitelistOnly, &enabled);
    env.events().publish(
        ("crowdfund", "whitelist_only_set"),
        EventWhitelistOnlySet { enabled },
    );
    Ok(())
}

/// Checks if an address is whitelisted.
pub(crate) fn is_whitelisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Whitelist(address))
        .unwrap_or(false)
}

// === Blacklist Functions

/// Adds an address to the blacklist (creator only).
pub(crate) fn add_to_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    env.storage()
        .persistent()
        .set(&DataKey::Blacklist(address.clone()), &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Blacklist(address.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events()
        .publish(("crowdfund", "blacklisted"), EventBlacklisted { address });
    Ok(())
}

/// Removes an address from the blacklist (creator only).
pub(crate) fn remove_from_blacklist(env: Env, address: Address) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    env.storage()
        .persistent()
        .remove(&DataKey::Blacklist(address.clone()));
    env.events().publish(
        ("crowdfund", "blacklist_removed"),
        EventBlacklistRemoved { address },
    );
    Ok(())
}

/// Checks if an address is blacklisted.
pub(crate) fn is_blacklisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Blacklist(address))
        .unwrap_or(false)
}

// === Allow/Deny List Functions

/// Adds an address to the allow list (admin only).
///
/// Alias for `add_to_whitelist` with a dedicated event so indexers can
/// distinguish the two APIs; both write the same `DataKey::Whitelist` entry.
pub(crate) fn add_to_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
    auth_admin(&env)?;
    env.storage()
        .persistent()
        .set(&DataKey::Whitelist(address.clone()), &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Whitelist(address.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events()
        .publish(("crowdfund", "allowlisted"), EventAllowlisted { address });
    Ok(())
}

/// Removes an address from the allow list (admin only).
pub(crate) fn remove_from_allowlist(env: Env, address: Address) -> Result<(), ContractError> {
    auth_admin(&env)?;
    env.storage()
        .persistent()
        .remove(&DataKey::Whitelist(address.clone()));
    env.events().publish(
        ("crowdfund", "allowlist_removed"),
        EventAllowlistRemoved { address },
    );
    Ok(())
}

/// Adds an address to the deny list (admin only).
///
/// Alias for `add_to_blacklist` with a dedicated event.
pub(crate) fn add_to_denylist(env: Env, address: Address) -> Result<(), ContractError> {
    auth_admin(&env)?;
    env.storage()
        .persistent()
        .set(&DataKey::Blacklist(address.clone()), &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Blacklist(address.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events()
        .publish(("crowdfund", "denylisted"), EventDenylisted { address });
    Ok(())
}

/// Removes an address from the deny list (admin only).
#[cfg(test)]
pub(crate) fn remove_from_denylist(env: Env, address: Address) -> Result<(), ContractError> {
    auth_admin(&env)?;
    env.storage()
        .persistent()
        .remove(&DataKey::Blacklist(address.clone()));
    env.events().publish(
        ("crowdfund", "denylist_removed"),
        EventDenylistRemoved { address },
    );
    Ok(())
}

/// Returns `true` if the address is on the allow list.
#[cfg(test)]
pub(crate) fn is_allowlisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Whitelist(address))
        .unwrap_or(false)
}

/// Returns `true` if the address is on the deny list.
#[cfg(test)]
pub(crate) fn is_denylisted(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, bool>(&DataKey::Blacklist(address))
        .unwrap_or(false)
}

// === Visibility Functions

/// Sets the campaign visibility level (creator only).
pub(crate) fn set_visibility(env: Env, visibility: Visibility) -> Result<(), ContractError> {
    require_auth_creator(&env)?;
    let inst = env.storage().instance();
    let old: Visibility = inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public);
    inst.set(&KEY_VISIBILITY, &visibility);
    env.events().publish(
        ("crowdfund", "visibility_changed"),
        EventVisibilityChanged {
            old_visibility: old,
            new_visibility: visibility,
        },
    );
    Ok(())
}

/// Returns the campaign's current visibility level.
pub(crate) fn get_visibility(env: Env) -> Visibility {
    env.storage()
        .instance()
        .get(&KEY_VISIBILITY)
        .unwrap_or(Visibility::Public)
}

// === Ownership Functions

/// Transfers campaign ownership to a new address (creator only).
///
/// Updates both the creator and admin to `new_owner`.
pub(crate) fn transfer_ownership(env: Env, new_owner: Address) -> Result<(), ContractError> {
    // #835: reads KEY_CREATOR with a typed guard, so an un-initialised contract
    // returns InvalidAddress instead of panicking.
    let creator = require_auth_creator(&env)?;

    if new_owner == creator {
        return Err(ContractError::Unauthorized);
    }

    let inst = env.storage().instance();
    inst.set(&KEY_CREATOR, &new_owner);
    inst.set(&KEY_ADMIN, &new_owner);

    env.events().publish(
        ("crowdfund", "ownership_transferred"),
        EventOwnershipTransferred {
            previous_owner: creator,
            new_owner,
        },
    );
    Ok(())
}

// === Pause/Resume Functions

/// Pauses campaign contributions (admin only).
pub(crate) fn pause(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    // #835: defaulting the status lets the admin guard below produce the typed
    // error on an un-initialised contract instead of panicking on the status read.
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }
    auth_admin(&env)?;
    inst.set(&KEY_STATUS, &Status::Paused);
    let now = env.ledger().timestamp();
    // #696: record when unpause is permitted based on configured timelock
    let timelock: u64 = inst.get(&KEY_PAUSE_TIMELOCK).unwrap_or(0);
    let unpause_after = now.saturating_add(timelock);
    inst.set(&KEY_UNPAUSE_AFTER, &unpause_after);
    env.events().publish(
        ("crowdfund", "paused_with_timelock"),
        EventPausedWithTimelock {
            timestamp: now,
            unpause_after,
        },
    );
    env.events()
        .publish(("crowdfund", "paused"), EventPaused { timestamp: now });
    env.events().publish(
        ("crowdfund", "status_changed"),
        EventStatusChanged {
            old_status: Status::Active,
            new_status: Status::Paused,
        },
    );
    Ok(())
}

/// Resumes a paused campaign, allowing contributions again (admin only).
pub(crate) fn resume(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    if status != Status::Paused {
        return Err(ContractError::NotActive);
    }
    auth_admin(&env)?;
    // #696: enforce timelock, cannot unpause before unpause_after
    let unpause_after: u64 = inst.get(&KEY_UNPAUSE_AFTER).unwrap_or(0);
    let now = env.ledger().timestamp();
    if now < unpause_after {
        return Err(ContractError::EmergencyLocked);
    }
    inst.set(&KEY_STATUS, &Status::Active);
    env.events()
        .publish(("crowdfund", "resumed"), EventResumed { timestamp: now });
    env.events().publish(
        ("crowdfund", "status_changed"),
        EventStatusChanged {
            old_status: Status::Paused,
            new_status: Status::Active,
        },
    );
    Ok(())
}

/// Legacy alias for [`resume`].
pub(crate) fn unpause(env: Env) -> Result<(), ContractError> {
    resume(env)
}

// === Rate Limit Functions

/// Sets the per-address contribution rate limit (admin only).
pub(crate) fn set_rate_limit(
    env: Env,
    max_amount: i128,
    window_seconds: u64,
) -> Result<(), ContractError> {
    // #835: KEY_ADMIN is absent before `initialize`; report it rather than panic.
    auth_admin(&env)?;
    let inst = env.storage().instance();

    if max_amount < 0 {
        return Err(ContractError::InvalidRateLimit);
    }
    if max_amount == 0 {
        inst.remove(&KEY_RATE_LIMIT);
        env.events().publish(
            ("crowdfund", "rate_limit_updated"),
            EventRateLimitUpdated {
                max_amount: 0,
                window_seconds: 0,
            },
        );
        return Ok(());
    }
    if window_seconds == 0 {
        return Err(ContractError::InvalidRateLimit);
    }
    inst.set(
        &KEY_RATE_LIMIT,
        &RateLimit {
            max_amount,
            window_seconds,
        },
    );
    env.events().publish(
        ("crowdfund", "rate_limit_updated"),
        EventRateLimitUpdated {
            max_amount,
            window_seconds,
        },
    );
    Ok(())
}

/// Returns the current per-address rate limit configuration, if any.
pub(crate) fn get_rate_limit(env: Env) -> Option<RateLimit> {
    env.storage().instance().get(&KEY_RATE_LIMIT)
}

// === Pause Timelock Functions

/// Sets the timelock duration (in seconds) enforced before unpausing. Admin only.
pub(crate) fn set_pause_timelock(env: Env, timelock_seconds: u64) -> Result<(), ContractError> {
    auth_admin(&env)?;
    env.storage()
        .instance()
        .set(&KEY_PAUSE_TIMELOCK, &timelock_seconds);
    Ok(())
}

//! # Campaign Lifecycle Functions
//!
//! This module handles campaign creation, initialization, cloning, and termination.
//! Functions in this module manage the overall campaign state transitions.

use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    errors::ContractError,
    helpers::require_auth_creator,
    storage::{
        DataKey, KEY_ADMIN, KEY_ARCHIVED, KEY_CATEGORY, KEY_CREATOR, KEY_DEADLINE, KEY_DESC,
        KEY_GOAL, KEY_GOAL_HISTORY, KEY_MAX, KEY_META_HIST, KEY_MIN, KEY_PLATFORM, KEY_SOCIAL,
        KEY_START_TIME, KEY_STATUS, KEY_TITLE, KEY_TOKEN, KEY_TOTAL, KEY_VESTING, KEY_VISIBILITY,
        TTL_PERSISTENT_ENTRY,
    },
    types::{
        CampaignTemplate, Category, EventArchived, EventCampaignCloned, EventCancelled,
        EventInitialized, EventStatusChanged, EventTemplateApplied, GoalAdjustment,
        MetadataVersion, PlatformConfig, Status, TemplateType, VestingSchedule, Visibility,
        EVENT_SCHEMA_VERSION,
    },
    validation::{
        validate_address_not_self, validate_category, validate_deadline_extension,
        validate_fee_bps, validate_goal_not_overflow, validate_initialization,
        validate_string_length,
    },
    CrowdfundContract,
};

// === Initialization

/// Initializes a new crowdfunding campaign (called once per contract instance).
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::AlreadyInitialized)` if already initialized
/// - `Err(ContractError::InvalidGoal)` if goal <= 0
/// - `Err(ContractError::InvalidDeadline)` if deadline <= current time
pub(crate) fn initialize(
    env: Env,
    creator: Address,
    token: Address,
    goal: i128,
    deadline: u64,
    min_contribution: i128,
    max_contribution: i128,
    title: String,
    description: String,
    social_links: Option<Vec<String>>,
    platform_config: Option<PlatformConfig>,
    accepted_tokens: Option<Vec<Address>>,
    category: Category,
    vesting: Option<VestingSchedule>,
    penalty_bps: Option<u32>,
) -> Result<(), ContractError> {
    if env.storage().instance().has(&KEY_CREATOR) {
        return Err(ContractError::AlreadyInitialized);
    }
    common::AccessControl::require_role_auth(&creator);

    validate_initialization(
        goal,
        deadline,
        min_contribution,
        max_contribution,
        None,
        env.ledger().timestamp(),
    )?;
    validate_string_length(&title, 64)?;
    validate_string_length(&description, 512)?;
    validate_category(&category)?;

    if let Some(ref config) = platform_config {
        validate_fee_bps(config.fee_bps)?;
        validate_address_not_self(&creator, &config.address)?;
        env.storage().instance().set(&KEY_PLATFORM, config);
    }

    // === Batch all instance writes in one block to minimise storage overhead
    let storage = env.storage().instance();
    storage.set(&KEY_ADMIN, &creator);
    storage.set(&KEY_CREATOR, &creator);
    storage.set(&KEY_TOKEN, &token);
    storage.set(&KEY_GOAL, &goal);
    storage.set(&KEY_DEADLINE, &deadline);
    storage.set(&KEY_MIN, &min_contribution);
    storage.set(&KEY_MAX, &max_contribution);
    storage.set(&KEY_TITLE, &title);
    storage.set(&KEY_DESC, &description);
    storage.set(&KEY_TOTAL, &0i128);
    storage.set(&KEY_STATUS, &Status::Active);
    storage.set(&KEY_CATEGORY, &category);
    storage.set(&KEY_VISIBILITY, &Visibility::Public);
    storage.set(&DataKey::ContributorCount, &0u32);
    storage.set(&DataKey::LargestContribution, &0i128);
    storage.set(&KEY_START_TIME, &env.ledger().timestamp());

    if let Some(links) = social_links {
        storage.set(&KEY_SOCIAL, &links);
    }
    if let Some(tokens) = accepted_tokens {
        storage.set(&DataKey::AcceptedTokens, &tokens);
    }
    if let Some(v) = vesting {
        storage.set(&KEY_VESTING, &v);
    }
    if let Some(p) = penalty_bps {
        storage.set(&DataKey::PenaltyBps, &p);
    }

    // Persistent writes (separate storage tier)
    // Contributor list now uses indexed keys (DataKey::ContributorIndex) written
    // per-contributor at O(1) cost; KEY_CONTRIBS Vec is no longer maintained.

    let mut history: Vec<GoalAdjustment> = Vec::new(&env);
    history.push_back(GoalAdjustment {
        previous_goal: 0,
        new_goal: goal,
        timestamp: env.ledger().timestamp(),
    });
    env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);
    env.storage().persistent().extend_ttl(
        &KEY_GOAL_HISTORY,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    // Seed metadata version history with version 0 (initial state)
    let mut meta_hist: Vec<MetadataVersion> = Vec::new(&env);
    meta_hist.push_back(MetadataVersion {
        version: 0,
        title: title.clone(),
        description: description.clone(),
        timestamp: env.ledger().timestamp(),
    });
    env.storage().persistent().set(&KEY_META_HIST, &meta_hist);
    env.storage().persistent().extend_ttl(
        &KEY_META_HIST,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    env.events().publish(
        ("crowdfund", "initialized"),
        EventInitialized {
            creator,
            goal,
            deadline,
            category,
            schema_version: EVENT_SCHEMA_VERSION,
        },
    );

    // Index campaign for search
    CrowdfundContract::index_campaign(env)?;

    Ok(())
}

/// Initialises a new campaign from a pre-configured template.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::AlreadyInitialized)` if already initialised
/// - `Err(ContractError::InvalidTemplate)` if template.goal_multiplier is 0
pub(crate) fn initialize_from_template(
    env: Env,
    creator: Address,
    token: Address,
    goal: i128,
    deadline: u64,
    max_contribution: i128,
    title: String,
    description: String,
    template: CampaignTemplate,
    social_links: Option<Vec<String>>,
    platform_config: Option<PlatformConfig>,
    accepted_tokens: Option<Vec<Address>>,
    vesting: Option<VestingSchedule>,
    penalty_bps: Option<u32>,
) -> Result<(), ContractError> {
    if env.storage().instance().has(&KEY_CREATOR) {
        return Err(ContractError::AlreadyInitialized);
    }
    common::AccessControl::require_role_auth(&creator);

    // === Validate template
    if template.suggested_min < 0 {
        return Err(ContractError::BelowMinimum);
    }
    if template.goal_multiplier == 0 {
        return Err(ContractError::InvalidTemplate);
    }
    validate_string_length(&template.name, 64)?;
    validate_string_length(&template.description, 512)?;

    // Derive campaign parameters from template
    let min_contribution = template.suggested_min;
    let category = match template.template_type {
        TemplateType::Charity => Category::Charity,
        TemplateType::Product => Category::Technology,
        TemplateType::Event => Category::Event,
        TemplateType::Personal => Category::Personal,
        TemplateType::Custom => Category::Other,
    };

    // === Validate core parameters
    validate_initialization(
        goal,
        deadline,
        min_contribution,
        max_contribution,
        None,
        env.ledger().timestamp(),
    )?;
    validate_string_length(&title, 64)?;
    validate_string_length(&description, 512)?;

    if let Some(ref config) = platform_config {
        validate_fee_bps(config.fee_bps)?;
        validate_address_not_self(&creator, &config.address)?;
        env.storage().instance().set(&KEY_PLATFORM, config);
    }

    // Store template for reference
    env.storage().instance().set(&DataKey::Template, &template);

    // === Batch all instance writes
    let storage = env.storage().instance();
    storage.set(&KEY_ADMIN, &creator);
    storage.set(&KEY_CREATOR, &creator);
    storage.set(&KEY_TOKEN, &token);
    storage.set(&KEY_GOAL, &goal);
    storage.set(&KEY_DEADLINE, &deadline);
    storage.set(&KEY_MIN, &min_contribution);
    storage.set(&KEY_MAX, &max_contribution);
    storage.set(&KEY_TITLE, &title);
    storage.set(&KEY_DESC, &description);
    storage.set(&KEY_TOTAL, &0i128);
    storage.set(&KEY_STATUS, &Status::Active);
    storage.set(&KEY_CATEGORY, &category);
    storage.set(&DataKey::ContributorCount, &0u32);
    storage.set(&DataKey::LargestContribution, &0i128);

    if let Some(links) = social_links {
        storage.set(&KEY_SOCIAL, &links);
    }
    if let Some(tokens) = accepted_tokens {
        storage.set(&DataKey::AcceptedTokens, &tokens);
    }
    if let Some(v) = vesting {
        storage.set(&KEY_VESTING, &v);
    }
    if let Some(p) = penalty_bps {
        storage.set(&DataKey::PenaltyBps, &p);
    }

    // Persistent writes (separate storage tier)
    // Contributor list uses indexed keys (DataKey::ContributorIndex); no Vec initialisation needed.

    let mut history: Vec<GoalAdjustment> = Vec::new(&env);
    history.push_back(GoalAdjustment {
        previous_goal: 0,
        new_goal: goal,
        timestamp: env.ledger().timestamp(),
    });
    env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);
    env.storage().persistent().extend_ttl(
        &KEY_GOAL_HISTORY,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    env.events().publish(
        ("crowdfund", "initialized"),
        EventInitialized {
            creator,
            goal,
            deadline,
            category,
            schema_version: EVENT_SCHEMA_VERSION,
        },
    );
    env.events().publish(
        ("crowdfund", "template_applied"),
        EventTemplateApplied {
            template_type: template.template_type,
            suggested_min: template.suggested_min,
        },
    );
    Ok(())
}

/// Clones the current campaign's settings into a fresh campaign run.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::InvalidAddress)` if the contract was never initialised
/// - `Err(ContractError::InvalidGoal)` if new_goal <= 0
/// - `Err(ContractError::InvalidDeadline)` if new_deadline <= current time
pub(crate) fn clone_campaign(
    env: Env,
    new_creator: Address,
    new_goal: i128,
    new_deadline: u64,
) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    // #835: an un-initialised contract has no creator to authorise the clone.
    let creator = require_auth_creator(&env)?;

    if new_goal <= 0 {
        return Err(ContractError::InvalidGoal);
    }
    validate_goal_not_overflow(new_goal)?;
    validate_deadline_extension(new_deadline, env.ledger().timestamp())?;

    // Copy metadata from current campaign
    let title: String = inst
        .get(&KEY_TITLE)
        .unwrap_or_else(|| String::from_str(&env, ""));
    let description: String = inst
        .get(&KEY_DESC)
        .unwrap_or_else(|| String::from_str(&env, ""));
    // The remaining settings stay in instance storage untouched, so the clone
    // inherits them; they are read here only to mirror the original ordering.
    let _min_contribution: i128 = inst.get(&KEY_MIN).unwrap_or(0);
    let _max_contribution: i128 = inst.get(&KEY_MAX).unwrap_or(0);
    let _category: Option<Category> = inst.get(&KEY_CATEGORY);
    let _social_links: Option<Vec<String>> = inst.get(&KEY_SOCIAL);
    let _platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
    let _vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);

    // Reset instance storage for new campaign
    // (Contributor indexed keys are per-address and naturally don't carry over;
    // ContributorCount reset to 0 is sufficient to clear the paginated list.)
    inst.set(&KEY_ADMIN, &new_creator);
    inst.set(&KEY_CREATOR, &new_creator);
    inst.set(&KEY_GOAL, &new_goal);
    inst.set(&KEY_DEADLINE, &new_deadline);
    inst.set(&KEY_TOTAL, &0i128);
    inst.set(&KEY_STATUS, &Status::Active);
    inst.set(&DataKey::ContributorCount, &0u32);
    inst.set(&DataKey::LargestContribution, &0i128);

    // Reset goal history
    let mut history: Vec<GoalAdjustment> = Vec::new(&env);
    history.push_back(GoalAdjustment {
        previous_goal: 0,
        new_goal,
        timestamp: env.ledger().timestamp(),
    });
    env.storage().persistent().set(&KEY_GOAL_HISTORY, &history);
    env.storage().persistent().extend_ttl(
        &KEY_GOAL_HISTORY,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    // Reset metadata version history
    let mut meta_hist: Vec<MetadataVersion> = Vec::new(&env);
    meta_hist.push_back(MetadataVersion {
        version: 0,
        title: title.clone(),
        description: description.clone(),
        timestamp: env.ledger().timestamp(),
    });
    env.storage().persistent().set(&KEY_META_HIST, &meta_hist);
    env.storage().persistent().extend_ttl(
        &KEY_META_HIST,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    env.events().publish(
        ("crowdfund", "cloned"),
        EventCampaignCloned {
            original_creator: creator,
            new_creator,
            new_goal,
            new_deadline,
        },
    );
    Ok(())
}

// === Termination

/// Cancels a campaign (creator only).
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::NotActive)` if already Cancelled, Successful or Refunded
/// - `Err(ContractError::InvalidAddress)` if the contract was never initialised
pub(crate) fn cancel_campaign(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    // #835: KEY_STATUS is absent on an un-initialised contract. Defaulting to the
    // value a fresh campaign would hold lets the creator guard below fire with a
    // typed error rather than panicking inside `unwrap()`.
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    // Allow cancellation from Active or Paused state
    if status == Status::Cancelled || status == Status::Successful || status == Status::Refunded {
        return Err(ContractError::NotActive);
    }
    // #835: no creator means the contract was never initialised.
    let creator = require_auth_creator(&env)?;
    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    let old_status = status;
    inst.set(&KEY_STATUS, &Status::Cancelled);
    env.events().publish(
        ("crowdfund", "cancelled"),
        EventCancelled {
            creator,
            total_raised,
        },
    );
    env.events().publish(
        ("crowdfund", "status_changed"),
        EventStatusChanged {
            old_status,
            new_status: Status::Cancelled,
        },
    );
    Ok(())
}

/// Archives a completed campaign for historical reference.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::InvalidAddress)` if the contract was never initialised
/// - `Err(ContractError::NotActive)` if the campaign has not completed yet
pub(crate) fn archive(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    // #835: the creator read comes before the status guard so an un-initialised
    // contract reports InvalidAddress rather than the misleading NotActive that a
    // defaulted status would produce. On an initialised contract both keys are
    // always present, so the reordering is not observable.
    let creator = require_auth_creator(&env)?;
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);

    // Only completed campaigns can be archived
    if status == Status::Active || status == Status::Paused || status == Status::Archived {
        return Err(ContractError::NotActive);
    }

    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    let now = env.ledger().timestamp();

    inst.set(&KEY_STATUS, &Status::Archived);
    inst.set(&KEY_ARCHIVED, &now);

    env.events().publish(
        ("crowdfund", "archived"),
        EventArchived {
            creator,
            total_raised,
            timestamp: now,
        },
    );
    Ok(())
}

/// Returns whether this campaign has been archived.
pub(crate) fn is_archived(env: Env) -> bool {
    env.storage()
        .instance()
        .get::<_, Status>(&KEY_STATUS)
        .map(|s| s == Status::Archived)
        .unwrap_or(false)
}

/// Returns the archival timestamp if the campaign has been archived.
pub(crate) fn get_archived_at(env: Env) -> Option<u64> {
    env.storage().instance().get(&KEY_ARCHIVED)
}

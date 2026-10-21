//! # Contribution Functions
//!
//! This module handles the contribution path: direct contributions, delegated
//! contributions made on a backer's behalf, and delegation management.
//!
//! `contribute` is deliberately written as a thin orchestrator over the private
//! helpers below, in the order the original single-function implementation ran:
//! read state, validate, rate-limit, transfer, apply fees, apply matching,
//! record, emit. The ordering is load-bearing: storage effects are committed
//! before the token interaction only where the original did so, and
//! `tests/adversarial.rs` asserts on that sequence.

use soroban_sdk::{token, Address, Env, String, Vec};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_DEADLINE, KEY_GROSS_TOTAL, KEY_INSURANCE,
        KEY_INSURANCE_POOL, KEY_MAX, KEY_MIN, KEY_PLATFORM, KEY_RATE_LIMIT, KEY_STATUS, KEY_TOKEN,
        KEY_TOTAL, KEY_VISIBILITY, MAX_MESSAGE_LENGTH, TTL_INSTANCE_EXTEND_MAX,
        TTL_INSTANCE_EXTEND_MIN, TTL_PERSISTENT_ENTRY,
    },
    types::{
        ContributionHistory, Delegation, EventContributed, EventContributionRecorded,
        EventDelegatedContribution, EventDelegationCreated, EventDelegationRevoked,
        EventQfContribution, EventRateLimitHit, EventTierAssigned, FeeMode, InsuranceConfig,
        MatchingConfig, PlatformConfig, RateLimit, RewardTier, Status, Visibility,
        EVENT_SCHEMA_VERSION,
    },
    validation::{
        validate_contributor_cap, validate_deadline_not_passed, validate_delegation,
        validate_min_contribution, validate_positive_amount,
    },
};

use common::math::apply_bps;

// === Campaign snapshot

/// Every instance-storage value the contribution path needs, read once up-front.
///
/// The original implementation hoisted all of these reads to the top of
/// `contribute()` to avoid repeated storage lookups, including re-fetching after
/// the token transfer. Collecting them in one struct keeps that single-read
/// property intact now that the logic is split across helpers.
struct CampaignSnapshot {
    status: Status,
    min: i128,
    max: i128,
    deadline: u64,
    default_token: Address,
    rate_limit: Option<RateLimit>,
    visibility: Visibility,
    accepted_tokens: Option<Vec<Address>>,
    total: i128,
    count: u32,
    largest: i128,
    platform_config: Option<PlatformConfig>,
    gross_total: i128,
    insurance_config: Option<InsuranceConfig>,
    matching_config: Option<MatchingConfig>,
}

fn read_campaign_snapshot(env: &Env) -> CampaignSnapshot {
    let inst = env.storage().instance();
    CampaignSnapshot {
        status: inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        min: inst.get(&KEY_MIN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        max: inst.get(&KEY_MAX).unwrap_or(0),
        deadline: inst.get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        default_token: inst.get(&KEY_TOKEN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        rate_limit: inst.get(&KEY_RATE_LIMIT),
        visibility: inst.get(&KEY_VISIBILITY).unwrap_or(Visibility::Public),
        accepted_tokens: inst.get(&DataKey::AcceptedTokens),
        total: inst.get(&KEY_TOTAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        count: inst.get(&DataKey::ContributorCount).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        largest: inst.get(&DataKey::LargestContribution).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound)),
        platform_config: inst.get(&KEY_PLATFORM),
        gross_total: inst.get(&KEY_GROSS_TOTAL).unwrap_or(0),
        insurance_config: inst.get(&KEY_INSURANCE),
        matching_config: inst.get(&DataKey::MatchingConfig),
    }
}

// === Validation

/// Status, deadline, minimum and per-contributor cap checks.
///
/// Returns the contributor's existing balance, read once here and reused by the
/// caller. Checking the minimum before the blacklist/whitelist lookups keeps the
/// common "amount too small" rejection off the persistent-storage path.
fn validate_preconditions(
    env: &Env,
    snap: &CampaignSnapshot,
    contributor: &Address,
    amount: i128,
    now: u64,
) -> Result<i128, ContractError> {
    if snap.status == Status::Paused {
        return Err(ContractError::CampaignPaused);
    }
    if snap.status != Status::Active {
        return Err(ContractError::NotActive);
    }

    validate_deadline_not_passed(now, snap.deadline)?;
    validate_min_contribution(amount, snap.min)?;

    let contrib_key = DataKey::Contribution(contributor.clone());
    let prev_contrib: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);

    validate_contributor_cap(amount, snap.max, prev_contrib)?;

    Ok(prev_contrib)
}

/// Blacklist and whitelist checks against per-address persistent storage.
fn check_access(
    env: &Env,
    snap: &CampaignSnapshot,
    contributor: &Address,
) -> Result<(), ContractError> {
    if env
        .storage()
        .persistent()
        .get::<_, bool>(&DataKey::Blacklist(contributor.clone()))
        .unwrap_or(false)
    {
        return Err(ContractError::Blacklisted);
    }

    let whitelist_only: bool = env
        .storage()
        .instance()
        .get(&DataKey::WhitelistOnly)
        .unwrap_or(false);
    let needs_whitelist = whitelist_only || snap.visibility == Visibility::Private;
    if needs_whitelist
        && !env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Whitelist(contributor.clone()))
            .unwrap_or(false)
    {
        return Err(ContractError::NotWhitelisted);
    }

    Ok(())
}

/// Per-address rolling-window rate limit.
///
/// Emits `rate_limit_hit` and rejects when the window budget would be exceeded;
/// otherwise records the spend against the current or a fresh window.
fn enforce_rate_limit(
    env: &Env,
    snap: &CampaignSnapshot,
    contributor: &Address,
    amount: i128,
    now: u64,
) -> Result<(), ContractError> {
    let Some(ref rl) = snap.rate_limit else {
        return Ok(());
    };
    if rl.max_amount <= 0 || rl.window_seconds == 0 {
        return Ok(());
    }

    let ts_key = DataKey::RateLimitTimestamp(contributor.clone());
    let amt_key = DataKey::RateLimitAmount(contributor.clone());
    let last_ts: u64 = env.storage().persistent().get(&ts_key).unwrap_or(0);

    let in_window = last_ts > 0 && now.saturating_sub(last_ts) < rl.window_seconds;
    let period_amount: i128 = if in_window {
        env.storage().persistent().get(&amt_key).unwrap_or(0)
    } else {
        0
    };
    let new_period = period_amount
        .checked_add(amount)
        .ok_or(ContractError::Overflow)?;
    if new_period > rl.max_amount {
        env.events().publish(
            ("crowdfund", "rate_limit_hit"),
            EventRateLimitHit {
                contributor: contributor.clone(),
                attempted: amount,
                period_amount,
                max_amount: rl.max_amount,
            },
        );
        return Err(ContractError::RateLimitExceeded);
    }
    if in_window {
        env.storage().persistent().set(&amt_key, &new_period);
    } else {
        env.storage().persistent().set(&ts_key, &now);
        env.storage().persistent().set(&amt_key, &amount);
    }

    Ok(())
}

/// Accepts the campaign's default token, or any token on the accepted list.
fn validate_token(snap: &CampaignSnapshot, token: &Address) -> Result<(), ContractError> {
    if let Some(ref whitelist) = snap.accepted_tokens {
        if !whitelist.contains(token) {
            return Err(ContractError::TokenNotAccepted);
        }
    } else if *token != snap.default_token {
        return Err(ContractError::TokenNotAccepted);
    }
    Ok(())
}

// === Fees

/// Deducts the platform fee (#698) and the insurance premium (#433).
///
/// Returns the net amount that counts toward the funding goal. The gross total
/// is tracked separately regardless of fee mode so stats can report both. The
/// insurance portion stays in the contract but is bookkept apart: it does not
/// count toward the goal and is returned to the contributor if the campaign fails.
fn apply_fees(
    env: &Env,
    snap: &CampaignSnapshot,
    contributor: &Address,
    token: &Address,
    amount: i128,
) -> Result<i128, ContractError> {
    let inst = env.storage().instance();

    let new_gross_total = snap
        .gross_total
        .checked_add(amount)
        .ok_or(ContractError::Overflow)?;
    inst.set(&KEY_GROSS_TOTAL, &new_gross_total);

    let contrib_fee: i128 = if let Some(ref config) = snap.platform_config {
        if config.fee_mode == FeeMode::OnContribution {
            let f = apply_bps(amount, config.fee_bps)?;
            if f > 0 {
                token::Client::new(env, token).transfer(
                    &env.current_contract_address(),
                    &config.address,
                    &f,
                );
            }
            f
        } else {
            0
        }
    } else {
        0
    };
    let effective_amount_after_fee = amount - contrib_fee;

    let insurance_fee: i128 = snap
        .insurance_config
        .as_ref()
        .filter(|c| c.enabled)
        .map(|c| apply_bps(effective_amount_after_fee, c.fee_bps).unwrap_or(0))
        .unwrap_or(0);

    if insurance_fee > 0 {
        let fee_key = DataKey::InsuranceFee(contributor.clone());
        let prev_fee: i128 = env.storage().persistent().get(&fee_key).unwrap_or(0);
        let new_fee = prev_fee
            .checked_add(insurance_fee)
            .ok_or(ContractError::Overflow)?;
        env.storage().persistent().set(&fee_key, &new_fee);
        env.storage()
            .persistent()
            .extend_ttl(&fee_key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);

        let pool: i128 = inst.get(&KEY_INSURANCE_POOL).unwrap_or(0);
        let new_pool = pool
            .checked_add(insurance_fee)
            .ok_or(ContractError::Overflow)?;
        inst.set(&KEY_INSURANCE_POOL, &new_pool);
    }

    Ok(effective_amount_after_fee - insurance_fee)
}

// === Matching

/// Applies sponsor matching and writes the new campaign total.
///
/// Returns the matched amount for event reporting. The pool deduction saturates
/// rather than panicking (#856): an exhausted pool must cap the match, not abort
/// the contribution.
fn apply_matching_and_total(
    env: &Env,
    snap: &CampaignSnapshot,
    effective_amount: i128,
) -> Result<i128, ContractError> {
    let inst = env.storage().instance();

    let new_running_total = snap
        .total
        .checked_add(effective_amount)
        .ok_or(ContractError::Overflow)?;

    let mut matched_amount = 0i128;
    if let Some(ref config) = snap.matching_config {
        let match_amount = apply_bps(effective_amount, config.match_ratio)
            .unwrap_or(0);
        let total_matched: i128 = inst.get(&DataKey::TotalMatched).unwrap_or(0);
        let available_match = config
            .max_match
            .checked_sub(total_matched)
            .unwrap_or(0)
            .max(0);
        matched_amount = match_amount.min(available_match).max(0);
        if matched_amount > 0 {
            let new_total_matched = total_matched
                .checked_add(matched_amount)
                .ok_or(ContractError::Overflow)?;
            inst.set(&DataKey::TotalMatched, &new_total_matched);
            // Deduct from the escrowed pool so the accounting stays correct
            let pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
            let new_pool = pool.checked_sub(matched_amount).unwrap_or(0).max(0);
            inst.set(&DataKey::MatchingPool, &new_pool);
        }
    }

    let final_total = new_running_total
        .checked_add(matched_amount)
        .ok_or(ContractError::Overflow)?;
    inst.set(&KEY_TOTAL, &final_total);

    Ok(matched_amount)
}

// === Recording

/// First-time contributor bookkeeping and largest-contribution tracking.
///
/// Returns the contributor count after any insertion, for event reporting.
fn record_contributor(
    env: &Env,
    snap: &CampaignSnapshot,
    contributor: &Address,
    new_contrib: i128,
) -> Result<u32, ContractError> {
    let inst = env.storage().instance();
    let presence_key = DataKey::ContributorPresence(contributor.clone());
    let is_present: bool = env
        .storage()
        .persistent()
        .get(&presence_key)
        .unwrap_or(false);
    if !is_present {
        env.storage().persistent().set(&presence_key, &true);
        env.storage().persistent().extend_ttl(
            &presence_key,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        // O(1) indexed write: store address at its insertion-order index.
        // Previously used an O(n) Vec append into KEY_CONTRIBS; with many
        // contributors that was reading and re-serialising the entire list
        // on every new contribution.
        let index_key = DataKey::ContributorIndex(snap.count);
        env.storage().persistent().set(&index_key, contributor);
        env.storage().persistent().extend_ttl(
            &index_key,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );

        let new_count = snap.count.checked_add(1).ok_or(ContractError::Overflow)?;
        inst.set(&DataKey::ContributorCount, &new_count);
    }

    let updated_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

    if new_contrib > snap.largest {
        inst.set(&DataKey::LargestContribution, &new_contrib);
    }

    Ok(updated_count)
}

/// Appends to the per-contributor contribution history (#419).
fn record_history(env: &Env, contributor: &Address, amount: i128, now: u64, new_contrib: i128) {
    let history_key = DataKey::ContributionHistory(contributor.clone());
    let mut history: Vec<ContributionHistory> = env
        .storage()
        .persistent()
        .get(&history_key)
        .unwrap_or_else(|| Vec::new(env));
    history.push_back(ContributionHistory {
        amount,
        timestamp: now,
        running_total: new_contrib,
    });
    env.storage().persistent().set(&history_key, &history);
    env.storage()
        .persistent()
        .extend_ttl(&history_key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);
}

/// Assigns the highest reward tier the cumulative contribution qualifies for (#418).
fn assign_reward_tier(env: &Env, contributor: &Address, new_contrib: i128) {
    let inst = env.storage().instance();
    let Some(tiers) = inst.get::<_, Vec<RewardTier>>(&DataKey::RewardTiers) else {
        return;
    };

    let mut best: Option<RewardTier> = None;
    for tier in tiers.iter() {
        if new_contrib >= tier.min_amount {
            best = Some(tier);
        } else {
            break; // tiers are sorted ascending, no need to continue
        }
    }

    if let Some(tier) = best {
        env.events().publish(
            ("crowdfund", "tier_assigned"),
            EventTierAssigned {
                contributor: contributor.clone(),
                tier_name: tier.name.clone(),
                min_amount: tier.min_amount,
            },
        );
        env.storage()
            .persistent()
            .set(&DataKey::ContributorTier(contributor.clone()), &tier);
        env.storage().persistent().extend_ttl(
            &DataKey::ContributorTier(contributor.clone()),
            100,
            100,
        );
    }
}

/// Emits the contribution event trio: detailed record (#419), the headline
/// `contributed` event, and the quadratic-funding weighting inputs (#634).
fn emit_contribution_events(
    env: &Env,
    contributor: Address,
    amount: i128,
    now: u64,
    new_contrib: i128,
    matched_amount: i128,
    updated_count: u32,
) {
    env.events().publish(
        ("crowdfund", "contribution_recorded"),
        EventContributionRecorded {
            contributor: contributor.clone(),
            amount,
            timestamp: now,
            running_total: new_contrib,
        },
    );

    env.events().publish(
        ("crowdfund", "contributed"),
        EventContributed {
            contributor: contributor.clone(),
            amount,
            new_total: new_contrib,
            matched_amount,
            schema_version: EVENT_SCHEMA_VERSION,
        },
    );

    env.events().publish(
        ("crowdfund", "qf_contribution"),
        EventQfContribution {
            contributor,
            amount,
            cumulative: new_contrib,
            contributor_count: updated_count,
        },
    );
}

// === Entry points

/// Contributes funds to the campaign.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributor` - The contributing address (must authorize)
/// * `amount` - Contribution amount in stroops
/// * `token` - Token address used for the transfer
/// * `message` - Optional message attached to the contribution
///
/// # Returns
/// * `Ok(())` on success
/// * `Err(ContractError::CampaignPaused)` if the campaign is paused
/// * `Err(ContractError::NotActive)` if the campaign is not Active
/// * `Err(ContractError::RateLimitExceeded)` if the per-address window budget is exceeded
pub(crate) fn contribute(
    env: Env,
    contributor: Address,
    amount: i128,
    token: Address,
    message: Option<String>,
) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&contributor);

    validate_positive_amount(amount)?;

    if let Some(ref msg) = message {
        if msg.len() > MAX_MESSAGE_LENGTH {
            return Err(ContractError::MessageTooLong);
        }
    }

    let snap = read_campaign_snapshot(&env);
    let now = env.ledger().timestamp();

    let prev_contrib = validate_preconditions(&env, &snap, &contributor, amount, now)?;
    check_access(&env, &snap, &contributor)?;
    enforce_rate_limit(&env, &snap, &contributor, amount, now)?;
    validate_token(&snap, &token)?;

    token::Client::new(&env, &token).transfer(
        &contributor,
        env.current_contract_address(),
        &amount,
    );

    let effective_amount = apply_fees(&env, &snap, &contributor, &token, amount)?;

    let new_contrib = prev_contrib
        .checked_add(effective_amount)
        .ok_or(ContractError::Overflow)?;
    let contrib_key = DataKey::Contribution(contributor.clone());
    env.storage().persistent().set(&contrib_key, &new_contrib);
    env.storage()
        .persistent()
        .extend_ttl(&contrib_key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);

    if let Some(msg) = message {
        let msg_key = DataKey::ContributionMessage(contributor.clone());
        env.storage().persistent().set(&msg_key, &msg);
        env.storage()
            .persistent()
            .extend_ttl(&msg_key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);
    }

    let matched_amount = apply_matching_and_total(&env, &snap, effective_amount)?;
    let updated_count = record_contributor(&env, &snap, &contributor, new_contrib)?;

    record_history(&env, &contributor, amount, now, new_contrib);
    assign_reward_tier(&env, &contributor, new_contrib);

    env.storage()
        .instance()
        .extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);

    emit_contribution_events(
        &env,
        contributor,
        amount,
        now,
        new_contrib,
        matched_amount,
        updated_count,
    );

    Ok(())
}

/// Delegates contribution authority to another address (delegator must authorize).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `delegator` - The address delegating authority (must authorize)
/// * `delegate` - The address receiving delegation authority
/// * `amount` - Maximum amount the delegate can contribute on behalf of delegator
///
/// # Returns
/// * `Ok(())` on success
pub(crate) fn delegate_contribution(
    env: Env,
    delegator: Address,
    delegate: Address,
    amount: i128,
) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&delegator);

    validate_delegation(amount)?;

    let delegation = Delegation {
        amount,
        delegate: delegate.clone(),
        active: true,
    };

    env.storage()
        .persistent()
        .set(&DataKey::Delegation(delegator.clone()), &delegation);
    env.storage().persistent().extend_ttl(
        &DataKey::Delegation(delegator.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events().publish(
        ("crowdfund", "delegation_created"),
        EventDelegationCreated {
            delegator,
            delegate,
            amount,
        },
    );
    Ok(())
}

/// Contributes on behalf of a delegator (delegate must authorize).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `delegator` - The address on whose behalf the contribution is made
/// * `delegate` - The delegate address (must authorize)
/// * `amount` - Contribution amount in stroops
/// * `token` - Token address
///
/// # Returns
/// * `Ok(())` on success
pub(crate) fn contribute_on_behalf(
    env: Env,
    delegator: Address,
    delegate: Address,
    amount: i128,
    token: Address,
) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&delegate);

    let delegation: Delegation = env
        .storage()
        .persistent()
        .get(&DataKey::Delegation(delegator.clone()))
        .ok_or(ContractError::DelegationNotFound)?;

    if !delegation.active || delegation.delegate != delegate {
        return Err(ContractError::InvalidDelegation);
    }

    let delegated_key = DataKey::DelegatedContribution(delegator.clone());
    let delegated_so_far: i128 = env.storage().persistent().get(&delegated_key).unwrap_or(0);
    let new_delegated = delegated_so_far
        .checked_add(amount)
        .ok_or(ContractError::Overflow)?;
    if new_delegated > delegation.amount {
        return Err(ContractError::ExceedsMaximum);
    }

    // Perform the contribution as if delegator is contributing
    let min: i128 = env.storage().instance().get(&KEY_MIN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    validate_min_contribution(amount, min)?;

    let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    if status != Status::Active {
        return Err(ContractError::NotActive);
    }

    let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    validate_deadline_not_passed(env.ledger().timestamp(), deadline)?;

    // ── Per-contributor cap (#927: this path previously never enforced ────
    // the campaign's per-contributor max_contribution at all — only the
    // delegation's own `delegation.amount` limit above — so a delegated
    // contribution could silently bypass the campaign cap that direct
    // `contribute()` calls enforce. Reusing the same shared helper closes
    // that gap.
    let max: i128 = env.storage().instance().get(&KEY_MAX).unwrap_or(0);
    let key = DataKey::Contribution(delegator.clone());
    let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
    validate_contributor_cap(amount, max, prev)?;

    // Check whitelist/blacklist
    if env
        .storage()
        .persistent()
        .get::<_, bool>(&DataKey::Blacklist(delegator.clone()))
        .unwrap_or(false)
    {
        return Err(ContractError::Blacklisted);
    }

    let whitelist_only: bool = env
        .storage()
        .instance()
        .get(&DataKey::WhitelistOnly)
        .unwrap_or(false);
    let visibility: Visibility = env
        .storage()
        .instance()
        .get(&KEY_VISIBILITY)
        .unwrap_or(Visibility::Public);
    if (whitelist_only || visibility == Visibility::Private)
        && !env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Whitelist(delegator.clone()))
            .unwrap_or(false)
    {
        return Err(ContractError::NotWhitelisted);
    }

    token::Client::new(&env, &token).transfer(&delegate, env.current_contract_address(), &amount);

    let new_amount = prev.checked_add(amount).ok_or(ContractError::Overflow)?;
    env.storage().persistent().set(&key, &new_amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);

    // The running delegated-spend tally must be persisted, not just computed:
    // without this write the cap check above always compares `amount` against
    // a `delegated_so_far` that is permanently 0, and `extend_ttl` below
    // panics with MissingValue on a key that was never set.
    env.storage()
        .persistent()
        .set(&delegated_key, &new_delegated);
    env.storage().persistent().extend_ttl(
        &delegated_key,
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );

    let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    let new_total = total.checked_add(amount).ok_or(ContractError::Overflow)?;
    env.storage().instance().set(&KEY_TOTAL, &new_total);

    let presence_key = DataKey::ContributorPresence(delegator.clone());
    let is_present: bool = env
        .storage()
        .persistent()
        .get(&presence_key)
        .unwrap_or(false);
    if !is_present {
        env.storage().persistent().set(&presence_key, &true);
        env.storage().persistent().extend_ttl(
            &presence_key,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ContributorCount)
            .unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        // O(1) indexed write, same pattern as contribute()
        let index_key = DataKey::ContributorIndex(count);
        env.storage().persistent().set(&index_key, &delegator);
        env.storage().persistent().extend_ttl(
            &index_key,
            TTL_PERSISTENT_ENTRY,
            TTL_PERSISTENT_ENTRY,
        );
        let new_count = count.checked_add(1).ok_or(ContractError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::ContributorCount, &new_count);
    }

    env.events().publish(
        ("crowdfund", "delegated_contribution"),
        EventDelegatedContribution {
            delegator,
            delegate,
            amount,
        },
    );
    Ok(())
}

/// Revokes a delegation (delegator must authorize).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `delegator` - The delegator address (must authorize)
///
/// # Returns
/// * `Ok(())` on success
pub(crate) fn revoke_delegation(env: Env, delegator: Address) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&delegator);

    let mut delegation: Delegation = env
        .storage()
        .persistent()
        .get(&DataKey::Delegation(delegator.clone()))
        .ok_or(ContractError::DelegationNotFound)?;

    delegation.active = false;
    env.storage()
        .persistent()
        .set(&DataKey::Delegation(delegator.clone()), &delegation);
    env.storage().persistent().extend_ttl(
        &DataKey::Delegation(delegator.clone()),
        TTL_PERSISTENT_ENTRY,
        TTL_PERSISTENT_ENTRY,
    );
    env.events().publish(
        ("crowdfund", "delegation_revoked"),
        EventDelegationRevoked { delegator },
    );
    Ok(())
}

/// Gets delegation info for an address.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `delegator` - The delegator address
///
/// # Returns
/// Optional Delegation info
pub(crate) fn get_delegation(env: Env, delegator: Address) -> Option<Delegation> {
    env.storage()
        .persistent()
        .get(&DataKey::Delegation(delegator))
}

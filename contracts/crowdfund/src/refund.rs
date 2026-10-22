//! # Refund Functions
//!
//! This module handles refunding contributions when campaigns fail to meet their goals
//! or are cancelled. Implements a pull-based refund model where contributors claim their
//! own refunds individually, avoiding gas limits and single points of failure.

use common::math::proportional;
use soroban_sdk::{token, Address, Env, Vec};

use crate::{
    errors::ContractError,
    storage::{
        DataKey, KEY_CREATOR, KEY_DEADLINE, KEY_GOAL, KEY_RELEASED, KEY_STATUS, KEY_TOKEN,
        KEY_TOTAL, MAX_BATCH_REFUND_SIZE, TTL_INSTANCE_EXTEND_MAX, TTL_INSTANCE_EXTEND_MIN,
    },
    types::{
        EventBatchRefundCompleted, EventPartialRefund, EventRefunded, MatchingConfig, Status,
        EVENT_SCHEMA_VERSION,
    },
    validation::{validate_partial_refund, validate_refund_eligibility},
};

/// Refunds a single contributor's contribution.
///
/// Transfers the contributor's full contribution amount back to them.
/// Can only be called when the campaign has not met its goal (after deadline) or has been cancelled.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributor` - The contributor address to refund
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::AlreadyWithdrawn)` if the campaign already paid out
/// - `Err(ContractError::CampaignStillActive)` if the deadline has not passed
/// - `Err(ContractError::GoalReached)` if the goal was met
pub(crate) fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
    // === Batch instance reads up-front
    let inst = env.storage().instance();
    // #835: these keys are absent on an un-initialised contract. Defaulting to the
    // values a fresh campaign would hold lets the eligibility guards below fire with
    // a typed error rather than panicking inside `unwrap()`.
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);

    // `withdraw()` resets KEY_TOTAL to 0 and moves status to `Successful`,
    // which would otherwise make `validate_refund_eligibility` see
    // `total(0) < goal` and treat an already-paid-out campaign as an
    // eligible-for-refund "failed" one — attempting to pay contributors
    // a second time out of a contract balance withdraw() already drained.
    if status == Status::Successful {
        return Err(ContractError::AlreadyWithdrawn);
    }

    if status != Status::Cancelled {
        validate_refund_eligibility(
            env.ledger().timestamp(),
            inst.get(&KEY_DEADLINE).unwrap_or(0),
            inst.get(&KEY_TOTAL).unwrap_or(0),
            inst.get(&KEY_GOAL).unwrap_or(0),
        )?;
    }

    let key = DataKey::Contribution(contributor.clone());
    let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
    if amount > 0 {
        // #695: on cancellation, only the unreleased portion is refundable.
        // released_amount is the total already paid out via milestones; each
        // contributor's refund is proportionally reduced.
        let refund_amount = if status == Status::Cancelled {
            let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
            let released: i128 = inst.get(&KEY_RELEASED).unwrap_or(0);
            if released > 0 && total > 0 {
                // unreleased_ratio = (total - released) / total
                // contributor_refund = amount * unreleased_ratio
                let unreleased = total.saturating_sub(released).max(0);
                proportional(unreleased, total, amount).map_err(|_| ContractError::Overflow)?
            } else {
                amount
            }
        } else {
            amount
        };

        let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
        if refund_amount > 0 {
            token::Client::new(&env, &token_address).transfer(
                &env.current_contract_address(),
                &contributor,
                &refund_amount,
            );
        }
        env.storage().persistent().set(&key, &0i128);
        env.events().publish(
            ("crowdfund", "refunded"),
            EventRefunded {
                contributor,
                amount: refund_amount,
                schema_version: EVENT_SCHEMA_VERSION,
            },
        );
    }
    Ok(())
}

/// Refunds multiple contributors in a single transaction (batch refund).
///
/// Processes refunds for a list of contributors. Stops early if the batch
/// limit is reached to avoid exceeding resource limits.
/// Each contributor is only refunded if eligible (same conditions as `refund_single`).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributors` - List of contributor addresses to refund
///
/// # Returns
/// * `Ok(u32)` - Number of contributors successfully refunded
/// * `Err(ContractError::NotActive)` if the contract was never initialised
/// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
/// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
pub(crate) fn refund_batch(env: Env, contributors: Vec<Address>) -> Result<u32, ContractError> {
    // === Batch instance reads up-front
    let inst = env.storage().instance();
    // #835: an un-initialised contract has no status at all. Distinguish that from
    // a live campaign rather than letting the defaults below imply "failed campaign".
    let status: Status = inst.get(&KEY_STATUS).ok_or(ContractError::NotActive)?;

    // See the matching guard in `refund_single` for why this is needed:
    // without it, a post-withdraw batch refund would see `total(0) < goal`
    // and try to pay contributors out of an already-drained balance.
    if status == Status::Successful {
        return Err(ContractError::AlreadyWithdrawn);
    }

    if status != Status::Cancelled {
        validate_refund_eligibility(
            env.ledger().timestamp(),
            inst.get(&KEY_DEADLINE).unwrap_or(0),
            inst.get(&KEY_TOTAL).unwrap_or(0),
            inst.get(&KEY_GOAL).unwrap_or(0),
        )?;
    }

    // Cache token address once for the whole batch
    let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    let token_client = token::Client::new(&env, &token_address);

    // Cap batch size to avoid resource exhaustion
    let limit = contributors.len().min(MAX_BATCH_REFUND_SIZE);
    let mut refunded: u32 = 0;

    for contributor in contributors.iter().take(limit as usize) {
        let key = DataKey::Contribution(contributor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > 0 {
            token_client.transfer(&env.current_contract_address(), &contributor, &amount);
            env.storage().persistent().set(&key, &0i128);
            env.events().publish(
                ("crowdfund", "refunded"),
                EventRefunded {
                    contributor,
                    amount,
                    schema_version: EVENT_SCHEMA_VERSION,
                },
            );
            refunded += 1;
        }
    }

    // Issue #422: emit a single batch-level event summarising the run
    env.events().publish(
        ("crowdfund", "batch_refund_completed"),
        EventBatchRefundCompleted {
            total_refunded: refunded,
            batch_size: limit,
        },
    );

    Ok(refunded)
}

/// Refunds a partial amount to a contributor (capped at 50% of their balance).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `contributor` - The contributor address (must authorize)
/// * `amount` - The amount to refund
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::RefundLimitExceeded)` if amount exceeds 50% of the balance
pub(crate) fn refund_partial(
    env: Env,
    contributor: Address,
    amount: i128,
) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&contributor);

    let contrib_key = DataKey::Contribution(contributor.clone());
    let total_contrib: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);

    validate_partial_refund(amount, total_contrib)?;

    let inst = env.storage().instance();
    let token: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    token::Client::new(&env, &token).transfer(
        &env.current_contract_address(),
        &contributor,
        &amount,
    );

    let remaining = total_contrib - amount;
    env.storage().persistent().set(&contrib_key, &remaining);

    let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    inst.set(&KEY_TOTAL, &(total - amount));

    env.events().publish(
        ("crowdfund", "partial_refund"),
        EventPartialRefund {
            contributor,
            amount,
            remaining,
        },
    );
    Ok(())
}

/// Refunds unused matching funds back to the sponsor.
///
/// Called after a campaign ends to return any unallocated matching pool funds.
///
/// # Returns
/// - `Ok(())` on success
/// - `Err(ContractError::CampaignStillActive)` if the campaign is Active or Paused
pub(crate) fn refund_matching_sponsor(env: Env) -> Result<(), ContractError> {
    let inst = env.storage().instance();
    let status: Status = inst.get(&KEY_STATUS).unwrap_or(Status::Active);
    if status == Status::Active || status == Status::Paused {
        return Err(ContractError::CampaignStillActive);
    }

    let config: MatchingConfig = match inst.get(&DataKey::MatchingConfig) {
        Some(c) => c,
        None => return Ok(()), // nothing to refund
    };

    let pool: i128 = inst.get(&DataKey::MatchingPool).unwrap_or(0);
    if pool <= 0 {
        return Ok(());
    }

    // Require the sponsor (or creator) to authorise the refund
    let creator: Address = inst
        .get(&KEY_CREATOR)
        .ok_or(ContractError::InvalidAddress)?;
    common::AccessControl::require_role_auth(&creator);

    let token_address: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    token::Client::new(&env, &token_address).transfer(
        &env.current_contract_address(),
        &config.sponsor,
        &pool,
    );

    inst.set(&DataKey::MatchingPool, &0i128);
    inst.extend_ttl(TTL_INSTANCE_EXTEND_MIN, TTL_INSTANCE_EXTEND_MAX);

    env.events().publish(
        ("crowdfund", "matching_sponsor_refunded"),
        (config.sponsor, pool),
    );
    Ok(())
}

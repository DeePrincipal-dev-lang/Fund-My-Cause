//! Recurring contribution module.
//!
//! Handles scheduled/recurring pledge logic: setup, execution, and cancellation.
//! Called from `CrowdfundContract` in `lib.rs`.

use soroban_sdk::{token, Address, Env};

use crate::{
    errors::ContractError,
    storage::{KEY_TOKEN, KEY_TOTAL, TTL_PERSISTENT_ENTRY},
    types::{
        DataKey, EventRecurringCancelled, EventRecurringExecuted, EventRecurringSetup,
        RecurringPlan,
    },
    validation::validate_recurring_plan,
};

pub(crate) fn setup(
    env: &Env,
    contributor: Address,
    amount: i128,
    interval: u64,
    end_date: u64,
) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&contributor);
    validate_recurring_plan(amount, interval, end_date, env.ledger().timestamp())?;

    let plan = RecurringPlan {
        amount,
        interval,
        end_date,
        last_executed: env.ledger().timestamp(),
    };
    let key = DataKey::RecurringPlan(contributor.clone());
    env.storage().persistent().set(&key, &plan);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_PERSISTENT_ENTRY, TTL_PERSISTENT_ENTRY);

    env.events().publish(
        ("crowdfund", "recurring_setup"),
        EventRecurringSetup {
            contributor,
            amount,
            interval,
            end_date,
        },
    );
    Ok(())
}

pub(crate) fn execute(env: &Env, contributor: Address) -> Result<(), ContractError> {
    let key = DataKey::RecurringPlan(contributor.clone());
    let mut plan: RecurringPlan = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(ContractError::InvalidRecurringPlan)?;

    let now = env.ledger().timestamp();
    let next_execution = plan
        .last_executed
        .checked_add(plan.interval)
        .ok_or(ContractError::InvalidRecurringPlan)?;
    if now > plan.end_date || now < next_execution {
        return Err(ContractError::InvalidRecurringPlan);
    }

    plan.last_executed = now;
    env.storage().persistent().set(&key, &plan);

    let inst = env.storage().instance();
    let token: Address = inst.get(&KEY_TOKEN).ok_or(ContractError::InvalidAddress)?;
    token::Client::new(env, &token).transfer(
        &contributor,
        env.current_contract_address(),
        &plan.amount,
    );

    let contrib_key = DataKey::Contribution(contributor.clone());
    let prev: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);
    env.storage().persistent().set(
        &contrib_key,
        &prev
            .checked_add(plan.amount)
            .ok_or(ContractError::Overflow)?,
    );

    let total: i128 = inst.get(&KEY_TOTAL).ok_or(ContractError::InvalidInput)?;
    inst.set(
        &KEY_TOTAL,
        &total
            .checked_add(plan.amount)
            .ok_or(ContractError::Overflow)?,
    );

    env.events().publish(
        ("crowdfund", "recurring_executed"),
        EventRecurringExecuted {
            contributor,
            amount: plan.amount,
        },
    );
    Ok(())
}

pub(crate) fn cancel(env: &Env, contributor: Address) -> Result<(), ContractError> {
    common::AccessControl::require_role_auth(&contributor);
    let key = DataKey::RecurringPlan(contributor.clone());
    env.storage().persistent().remove(&key);
    env.events().publish(
        ("crowdfund", "recurring_cancelled"),
        EventRecurringCancelled { contributor },
    );
    Ok(())
}

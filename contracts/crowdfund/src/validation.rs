/// Validation logic for the crowdfund contract.
///
/// This module contains validation functions for campaign parameters and operations.
use common::math::BASIS_POINTS_MAX;
use crate::errors::ContractError;
use crate::types::Category;
use soroban_sdk::Address;

/// Validates campaign initialization parameters.
///
/// Single source of truth for the goal/deadline/min/max/fee checks shared by
/// every entry point that creates a campaign (`initialize`,
/// `initialize_from_template`) — see the crowdfund README / issue #927 for
/// the audit that found these had drifted into independent, inline copies.
///
/// # Arguments
/// * `goal` - Campaign funding goal
/// * `deadline` - Campaign deadline timestamp
/// * `min_contribution` - Minimum contribution amount
/// * `max_contribution` - Maximum contribution amount
/// * `platform_fee_bps` - Platform fee in basis points
/// * `current_time` - Current ledger timestamp
///
/// # Returns
/// * `Ok(())` if all parameters are valid
/// * `Err(ContractError)` if any parameter is invalid
pub(crate) fn validate_initialization(
    goal: i128,
    deadline: u64,
    min_contribution: i128,
    max_contribution: i128,
    platform_fee_bps: Option<u32>,
    current_time: u64,
) -> Result<(), ContractError> {
    if goal <= 0 {
        return Err(ContractError::InvalidGoal);
    }
    validate_goal_not_overflow(goal)?;
    if deadline <= current_time {
        return Err(ContractError::InvalidDeadline);
    }
    if min_contribution < 0 {
        return Err(ContractError::BelowMinimum);
    }
    if max_contribution < 0 || (max_contribution > 0 && max_contribution < min_contribution) {
        return Err(ContractError::ExceedsMaximum);
    }
    if let Some(fee_bps) = platform_fee_bps {
        if fee_bps > BASIS_POINTS_MAX as u32 {
            return Err(ContractError::InvalidFee);
        }
    }
    Ok(())
}

/// Validates a contribution amount meets the campaign's minimum.
///
/// Split out from [`validate_contribution_amount`] so callers that need to
/// short-circuit before a costlier storage read (e.g. `contribute()` checks
/// this before reading the contributor's persistent running total) can do
/// so without duplicating the comparison.
///
/// # Returns
/// * `Ok(())` if `amount >= min_contribution`
/// * `Err(ContractError::BelowMinimum)` otherwise
pub(crate) fn validate_min_contribution(
    amount: i128,
    min_contribution: i128,
) -> Result<(), ContractError> {
    if amount < min_contribution {
        return Err(ContractError::BelowMinimum);
    }
    Ok(())
}

/// Validates that adding `amount` to `current_contribution` does not push a
/// single contributor's running total past the campaign's per-contributor
/// cap. A `max_contribution` of `0` means "no cap".
///
/// # Returns
/// * `Ok(())` if within the cap (or no cap is set)
/// * `Err(ContractError::ContributorCapExceeded)` if the cap would be exceeded
/// * `Err(ContractError::Overflow)` if the running total would overflow
pub(crate) fn validate_contributor_cap(
    amount: i128,
    max_contribution: i128,
    current_contribution: i128,
) -> Result<(), ContractError> {
    if max_contribution > 0 {
        let new_total = current_contribution
            .checked_add(amount)
            .ok_or(ContractError::Overflow)?;
        if new_total > max_contribution {
            return Err(ContractError::ContributorCapExceeded);
        }
    }
    Ok(())
}

/// Validates campaign deadline has passed.
///
/// # Arguments
/// * `current_time` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
///
/// # Returns
/// * `Ok(())` if deadline has passed
/// * `Err(ContractError::CampaignStillActive)` if deadline hasn't passed
pub(crate) fn validate_deadline_passed(
    current_time: u64,
    deadline: u64,
) -> Result<(), ContractError> {
    if current_time < deadline {
        return Err(ContractError::CampaignStillActive);
    }
    Ok(())
}

/// Validates campaign deadline hasn't passed.
///
/// # Arguments
/// * `current_time` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
///
/// # Returns
/// * `Ok(())` if deadline hasn't passed
/// * `Err(ContractError::CampaignEnded)` if deadline has passed
pub(crate) fn validate_deadline_not_passed(
    current_time: u64,
    deadline: u64,
) -> Result<(), ContractError> {
    if current_time >= deadline {
        return Err(ContractError::CampaignEnded);
    }
    Ok(())
}

/// Validates that a new deadline timestamp is strictly later than a
/// reference point. Used both for extending an existing deadline (reference
/// = the current stored deadline, e.g. `extend_deadline`/`propose_extension`)
/// and for setting a fresh deadline that must simply be in the future
/// (reference = the current ledger time, e.g. `clone_campaign`).
///
/// # Arguments
/// * `new_deadline` - Proposed new deadline
/// * `reference` - The timestamp `new_deadline` must exceed
///
/// # Returns
/// * `Ok(())` if `new_deadline` is later than `reference`
/// * `Err(ContractError::InvalidDeadline)` if it is not
pub(crate) fn validate_deadline_extension(
    new_deadline: u64,
    reference: u64,
) -> Result<(), ContractError> {
    if new_deadline <= reference {
        return Err(ContractError::InvalidDeadline);
    }
    Ok(())
}

/// Validates recurring plan parameters.
///
/// # Arguments
/// * `amount` - Contribution amount
/// * `interval` - Interval in seconds
/// * `end_date` - End date timestamp
/// * `current_time` - Current ledger timestamp
///
/// # Returns
/// * `Ok(())` if parameters are valid
/// * `Err(ContractError::InvalidRecurringPlan)` if parameters are invalid
pub(crate) fn validate_recurring_plan(
    amount: i128,
    interval: u64,
    end_date: u64,
    current_time: u64,
) -> Result<(), ContractError> {
    if amount <= 0 || interval == 0 || end_date <= current_time {
        return Err(ContractError::InvalidRecurringPlan);
    }
    Ok(())
}

/// Validates delegation parameters.
///
/// # Arguments
/// * `amount` - Delegated amount
///
/// # Returns
/// * `Ok(())` if parameters are valid
/// * `Err(ContractError::InvalidDelegation)` if parameters are invalid
pub(crate) fn validate_delegation(amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidDelegation);
    }
    Ok(())
}

/// Validates partial refund amount.
///
/// # Arguments
/// * `refund_amount` - Amount to refund
/// * `total_contribution` - Total contribution by the address
///
/// # Returns
/// * `Ok(())` if refund is valid
/// * `Err(ContractError::RefundLimitExceeded)` if refund exceeds limit
pub(crate) fn validate_partial_refund(
    refund_amount: i128,
    total_contribution: i128,
) -> Result<(), ContractError> {
    if refund_amount > total_contribution / 2 {
        return Err(ContractError::RefundLimitExceeded);
    }
    Ok(())
}

/// Validates a Soroban `String` is non-empty and within `max_len` characters.
///
/// # Arguments
/// * `s` - The string to validate
/// * `max_len` - Maximum allowed length (inclusive)
///
/// # Returns
/// * `Ok(())` if valid
/// * `Err(ContractError::StringEmpty)` if the string is empty
/// * `Err(ContractError::StringTooLong)` if the string exceeds `max_len`
pub(crate) fn validate_string_length(
    s: &soroban_sdk::String,
    max_len: u32,
) -> Result<(), ContractError> {
    let len = s.len();
    if len == 0 {
        return Err(ContractError::StringEmpty);
    }
    if len > max_len {
        return Err(ContractError::StringTooLong);
    }
    Ok(())
}

/// Validates that an `i128` amount is strictly positive (> 0).
///
/// Delegates to `common::validate_positive_amount` — the single canonical
/// implementation shared across contracts.  Maps `CommonError::InvalidInput`
/// onto `ContractError::AmountNotPositive` via the `From<CommonError>` impl
/// in `errors.rs`.
///
/// # Arguments
/// * `amount` - The amount to validate
///
/// # Returns
/// * `Ok(())` if amount > 0
/// * `Err(ContractError::AmountNotPositive)` otherwise
pub(crate) fn validate_positive_amount(amount: i128) -> Result<(), ContractError> {
    common::validate_positive_amount(amount).map_err(|_| ContractError::AmountNotPositive)
}

/// Validates that the platform fee address is not the same as the creator.
///
/// Prevents the creator from routing the platform fee back to themselves,
/// which would be misleading to contributors.
///
/// # Arguments
/// * `creator` - Campaign creator address
/// * `fee_address` - Platform fee recipient address
///
/// # Returns
/// * `Ok(())` if addresses differ
/// * `Err(ContractError::SelfFeeAddress)` if they are the same
pub(crate) fn validate_address_not_self(
    creator: &Address,
    fee_address: &Address,
) -> Result<(), ContractError> {
    if creator == fee_address {
        return Err(ContractError::SelfFeeAddress);
    }
    Ok(())
}

/// Validates a fee in basis points is within the allowed range (0–10 000).
///
/// # Arguments
/// * `fee_bps` - Fee in basis points
///
/// # Returns
/// * `Ok(())` if fee_bps <= BASIS_POINTS_MAX
/// * `Err(ContractError::InvalidFee)` otherwise
pub(crate) fn validate_fee_bps(fee_bps: u32) -> Result<(), ContractError> {
    if fee_bps > BASIS_POINTS_MAX as u32 {
        return Err(ContractError::InvalidFee);
    }
    Ok(())
}

/// Validates that a non-cancelled campaign is refundable (deadline passed, goal not met).
///
/// Call this only when `status != Cancelled`; the cancelled path skips all checks.
/// Combining the deadline and goal checks into one function allows both
/// `refund_single` and `refund_batch` to share the same short-circuit logic.
///
/// # Arguments
/// * `now` - Current ledger timestamp
/// * `deadline` - Campaign deadline timestamp
/// * `total` - Total amount raised
/// * `goal` - Campaign funding goal
///
/// # Returns
/// * `Ok(())` if the campaign is eligible for refunds
/// * `Err(ContractError::CampaignStillActive)` if the deadline has not passed
/// * `Err(ContractError::GoalReached)` if the goal was met
pub(crate) fn validate_refund_eligibility(
    now: u64,
    deadline: u64,
    total: i128,
    goal: i128,
) -> Result<(), ContractError> {
    if now < deadline {
        return Err(ContractError::CampaignStillActive);
    }
    if total >= goal {
        return Err(ContractError::GoalReached);
    }
    Ok(())
}

/// Validates that a goal value will not cause overflow when used in arithmetic.
///
/// Specifically checks that `goal` fits safely within the positive half of `i128`
/// (i.e. <= `i128::MAX / 2`) so that doubling or accumulating totals against it
/// cannot silently wrap.
///
/// # Arguments
/// * `goal` - Campaign funding goal
///
/// # Returns
/// * `Ok(())` if goal is safe
/// * `Err(ContractError::GoalOverflow)` if goal is dangerously large
pub(crate) fn validate_goal_not_overflow(goal: i128) -> Result<(), ContractError> {
    if goal > i128::MAX / 2 {
        return Err(ContractError::GoalOverflow);
    }
    Ok(())
}

/// Validates that a category is one of the allowed on-chain values.
///
/// Because `Category` is a `#[contracttype]` enum, Soroban will reject unknown
/// discriminants at decode time. This function provides an explicit, in-contract
/// check that returns a clear error for any future path that might bypass the
/// normal ABI decode (e.g., direct storage writes in tests or upgrades).
///
/// # Returns
/// * `Ok(())` for any valid `Category` variant
/// * `Err(ContractError::InvalidCategory)` for unrecognised values
pub(crate) fn validate_category(category: &Category) -> Result<(), ContractError> {
    match category {
        Category::Charity
        | Category::Technology
        | Category::Creative
        | Category::Event
        | Category::Personal
        | Category::Other => Ok(()),
        #[allow(unreachable_patterns)]
        _ => Err(ContractError::InvalidCategory),
    }
}

/// Validates a multi-sig governance configuration.
///
/// A configuration is valid only when there is at least one governor, at least
/// one required approval, and the required-approval threshold does not exceed the
/// number of governors (otherwise no proposal could ever be executed).
///
/// # Arguments
/// * `required_approvals` - Minimum approvals needed to execute a proposal
/// * `num_governors` - Number of governor addresses configured
/// * `timelock_delay` - Timelock delay in seconds (currently unrestricted, but
///   validated for presence to keep the signature stable)
///
/// # Returns
/// * `Ok(())` if the configuration is internally consistent
/// * `Err(ContractError::InvalidInput)` otherwise
pub(crate) fn validate_governance_config(
    required_approvals: u32,
    num_governors: u32,
    timelock_delay: u64,
) -> Result<(), ContractError> {
    let _ = timelock_delay; // no upper/lower bound enforced yet
    if num_governors == 0 || required_approvals == 0 || required_approvals > num_governors {
        return Err(ContractError::InvalidInput);
    }
    Ok(())
}

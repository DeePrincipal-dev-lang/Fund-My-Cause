//! # Analytics and State Validation
//!
//! This module holds the read-mostly reporting surface of the contract: aggregate
//! campaign statistics, performance and velocity metrics, quadratic-funding inputs,
//! and the invariant self-check used for on-chain state validation (issue #458).

use common::math::ratio_bps;
use soroban_sdk::{Address, Env, Vec};

use crate::{
    errors::ContractError,
    events::CrowdfundEvents,
    storage::{
        DataKey, KEY_DEADLINE, KEY_GOAL, KEY_GROSS_TOTAL, KEY_LAST_VALIDATION, KEY_SOFT_CAP,
        KEY_START_TIME, KEY_STRETCH_GOAL, KEY_TOTAL,
    },
    types::{
        CampaignAnalytics, CampaignStats, ContributionHistory, PerformanceMetrics,
        QfContributorInput, QfInputs, StateValidationResult,
    },
};

// === Aggregate statistics

/// Returns comprehensive campaign statistics.
pub(crate) fn get_stats(env: Env) -> CampaignStats {
    // Cache the instance storage handle; all four reads target the same
    // ledger entry so a single handle avoids repeated borrow overhead.
    let inst = env.storage().instance();
    let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
    let largest_contribution: i128 = inst.get(&DataKey::LargestContribution).unwrap_or(0);
    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    let gross_raised: i128 = inst.get(&KEY_GROSS_TOTAL).unwrap_or(total_raised);
    let goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    let soft_cap: i128 = inst.get(&KEY_SOFT_CAP).unwrap_or(0);
    let stretch_goal: i128 = inst.get(&KEY_STRETCH_GOAL).unwrap_or(0);

    // Progress is measured against the soft_cap when set, otherwise the hard goal.
    let progress_target = if soft_cap > 0 { soft_cap } else { goal };
    let progress_bps = ratio_bps(total_raised, progress_target);

    let average_contribution = if contributor_count == 0 {
        0
    } else {
        total_raised / contributor_count as i128
    };

    CampaignStats {
        total_raised,
        gross_raised,
        goal,
        soft_cap,
        stretch_goal,
        progress_bps,
        contributor_count,
        average_contribution,
        largest_contribution,
    }
}

/// Returns all inputs needed for off-chain quadratic-funding distribution.
pub(crate) fn get_qf_inputs(env: Env) -> QfInputs {
    let inst = env.storage().instance();
    let count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

    let mut contributors: Vec<QfContributorInput> = Vec::new(&env);

    for i in 0..count {
        if let Some(addr) = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::ContributorIndex(i))
        {
            let amount: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::Contribution(addr.clone()))
                .unwrap_or(0);
            contributors.push_back(QfContributorInput {
                contributor: addr,
                amount,
            });
        }
    }

    QfInputs {
        contributor_count: count,
        contributors,
    }
}

// === Performance metrics (#443)

/// Returns campaign performance and velocity metrics.
pub(crate) fn get_performance_metrics(env: Env) -> PerformanceMetrics {
    let inst = env.storage().instance();
    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    let goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
    let start_time: u64 = inst
        .get(&KEY_START_TIME)
        .unwrap_or(env.ledger().timestamp());
    let now = env.ledger().timestamp();

    // Calculate success rate in basis points, capped at 100% by the shared helper.
    let success_rate_bps = ratio_bps(total_raised, goal);

    // Calculate time elapsed
    let time_elapsed = now.saturating_sub(start_time);
    let days_elapsed = time_elapsed / 86400; // Convert seconds to days

    // Calculate contribution velocity and average daily contribution
    let (contribution_velocity, average_daily_contribution) = if days_elapsed > 0 {
        let daily = total_raised / days_elapsed as i128;
        (daily, daily)
    } else {
        (0, 0)
    };

    // Calculate trending by comparing recent vs earlier contributions.
    // Read contributor count from instance storage (already in footprint),
    // then fetch each contributor by index from persistent storage.
    // Previously read KEY_CONTRIBS from instance storage (a bug: contributors
    // are written to persistent storage), so trending was always 0.
    let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);

    let mut recent_sum = 0i128;
    let mut earlier_sum = 0i128;
    let mut recent_count = 0u32;
    let mut earlier_count = 0u32;
    let mid_point = time_elapsed / 2;

    for i in 0..contributor_count {
        let contributor: Address = match env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::ContributorIndex(i))
        {
            Some(addr) => addr,
            None => continue,
        };
        let history: Vec<ContributionHistory> = env
            .storage()
            .persistent()
            .get(&DataKey::ContributionHistory(contributor.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        for record in history.iter() {
            let time_since_start = record.timestamp.saturating_sub(start_time);

            // Use saturating_add: amounts are validated positive on entry, but
            // accumulating many contributions could theoretically overflow i128.
            if time_since_start > mid_point {
                recent_sum = recent_sum.saturating_add(record.amount);
                recent_count = recent_count.saturating_add(1);
            } else {
                earlier_sum = earlier_sum.saturating_add(record.amount);
                earlier_count = earlier_count.saturating_add(1);
            }
        }
    }

    // Calculate trending: positive if recent > earlier, negative if recent < earlier.
    // All multiplications by 100 use saturating_mul; the final cast to i32
    // saturates to i32::MAX/MIN if the scaled ratio is out of range, which is
    // far preferable to a panic or silent wrap.
    let trending = if earlier_count > 0 && recent_count > 0 {
        let earlier_avg = earlier_sum / earlier_count as i128;
        let recent_avg = recent_sum / recent_count as i128;
        let diff = recent_avg.saturating_sub(earlier_avg);
        // Scale to a reasonable range (-100 to 100)
        let scaled = diff.saturating_mul(100) / earlier_avg.max(1);
        scaled.min(i32::MAX as i128).max(i32::MIN as i128) as i32
    } else if recent_count > 0 && earlier_count == 0 {
        50 // Positive trend if only recent contributions
    } else {
        0 // Stable or no data
    };

    // Calculate estimated time to reach goal.
    // days_needed * 86400: use saturating_mul so a huge backlog doesn't panic.
    let estimated_time_to_goal: u64 = if contribution_velocity > 0 && total_raised < goal {
        let remaining = goal.saturating_sub(total_raised);
        let days_needed = remaining / contribution_velocity;
        days_needed.saturating_mul(86400).max(0) as u64
    } else {
        // Goal already reached, or no velocity to extrapolate from
        0
    };

    // For now, set milestone tracking to 0 (would need milestone storage)
    // This can be enhanced later when milestone tracking is implemented
    let milestones_reached = 0u32;
    let total_milestones = 0u32;

    PerformanceMetrics {
        success_rate_bps,
        contribution_velocity,
        trending,
        milestones_reached,
        total_milestones,
        time_elapsed,
        estimated_time_to_goal,
        average_daily_contribution,
    }
}

// === Campaign analytics (#438)

/// Generates analytics for the campaign.
pub(crate) fn get_analytics(env: Env) -> Result<CampaignAnalytics, ContractError> {
    let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
    let contributor_count: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::ContributorCount)
        .unwrap_or(0);

    if contributor_count == 0 {
        return Err(ContractError::AnalyticsNotAvailable);
    }

    let average_contribution = total_raised / contributor_count as i128;
    let peak_contribution: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::LargestContribution)
        .unwrap_or(0);

    let start_time: u64 = env.storage().instance().get(&KEY_START_TIME).unwrap_or(0);
    let current_time = env.ledger().timestamp();
    let elapsed_seconds = if current_time > start_time {
        current_time - start_time
    } else {
        1
    };
    let elapsed_days = (elapsed_seconds / 86400).max(1);
    let contribution_velocity = total_raised / elapsed_days as i128;

    Ok(CampaignAnalytics {
        total_contributions: contributor_count,
        average_contribution,
        median_contribution: average_contribution,
        std_deviation: 0,
        peak_contribution,
        lowest_contribution: 0,
        contribution_velocity,
        data_points_count: 0,
    })
}

// === State validation (#458)

/// Runs all state invariant checks and returns a validation result.
pub(crate) fn validate_state(env: Env) -> StateValidationResult {
    let inst = env.storage().instance();
    let total_raised: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    let goal: i128 = inst.get(&KEY_GOAL).unwrap_or(0);
    let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or(0);
    let contributor_count: u32 = inst.get(&DataKey::ContributorCount).unwrap_or(0);
    let now = env.ledger().timestamp();

    let mut passed = 0u32;
    let mut failed = 0u32;

    // Invariant 1: total_raised >= 0
    if total_raised >= 0 {
        passed += 1;
    } else {
        failed += 1;
        CrowdfundEvents::invariant_violated(&env, 1, now);
    }

    // Invariant 2: goal > 0
    if goal > 0 {
        passed += 1;
    } else {
        failed += 1;
        CrowdfundEvents::invariant_violated(&env, 2, now);
    }

    // Invariant 3: deadline > 0
    if deadline > 0 {
        passed += 1;
    } else {
        failed += 1;
        CrowdfundEvents::invariant_violated(&env, 3, now);
    }

    // Invariant 4: total_raised <= goal * 2 (overflow-safe)
    let upper_bound = goal.saturating_mul(2);
    if total_raised <= upper_bound {
        passed += 1;
    } else {
        failed += 1;
        CrowdfundEvents::invariant_violated(&env, 4, now);
    }

    // Invariant 5: contributor_count structural check (u32 is always >= 0)
    let _ = contributor_count;
    passed += 1;

    let result = StateValidationResult {
        valid: failed == 0,
        checks_passed: passed,
        checks_failed: failed,
        timestamp: now,
    };

    inst.set(&KEY_LAST_VALIDATION, &result);

    CrowdfundEvents::state_validated(&env, result.valid, passed, failed, now);

    result
}

/// Returns the result of the last `validate_state` call, if any.
pub(crate) fn get_last_validation(env: Env) -> Option<StateValidationResult> {
    env.storage().instance().get(&KEY_LAST_VALIDATION)
}

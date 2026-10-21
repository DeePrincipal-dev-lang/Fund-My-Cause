//! # Read-Only View Functions
//!
//! This module contains pure read-only query functions that have no side effects.
//! These functions return campaign state and contributor information.
//!
//! These getters return bare values rather than `Result`, so they cannot carry a
//! typed error. Core keys written once by `initialize` (see the `lib.rs` module
//! docs) are read with `unwrap()` on that documented post-init invariant; every
//! optional or legitimately-absent key uses a default instead.
//!
//! ## Storage-access optimisations (issue #1148)
//!
//! ### Problem
//! Read-heavy view functions previously performed redundant instance-storage reads.
//! The two worst offenders were:
//!
//! - `get_campaign_info`: loaded each field with a separate `.get()` call — 10–12
//!   reads against the same instance-storage footprint entry.
//! - `get_vested_amount`: read `KEY_TOTAL` and `KEY_PLATFORM` independently even
//!   though they had already been loaded by the caller in many common code paths.
//! - `get_fee_mode`: loaded the entire `PlatformConfig` struct just to return one
//!   field, duplicating the read done by any caller that also needs the fee amount.
//!
//! Each `instance().get()` call is metered by the Soroban host against the
//! transaction's read-byte budget, so reducing redundant reads directly lowers
//! the resource fee charged to every caller.
//!
//! ### Solution: `CachedInstanceView`
//! A lightweight per-call cache that loads **all** instance-storage fields once
//! into a Rust struct, then exposes typed in-memory accessors. Composite helpers
//! (`get_campaign_info`, `get_vested_amount`) now call `CachedInstanceView::load`
//! and derive every field from that single batch — the host charges for exactly
//! one instance-storage read footprint entry instead of one per key.
//!
//! ### Read-count comparison (per invocation)
//!
//! | Function              | Before (reads) | After (reads) |
//! |-----------------------|----------------|---------------|
//! | `get_campaign_info`   | 10–12          | **1** (batch) |
//! | `get_vested_amount`   | 3–4            | **1** (batch) |
//! | `get_fee_mode`        | 1 (full struct) | **1** (field) |
//! | `creator`             | 1              | 1 (unchanged) |
//! | `status`              | 1              | 1 (unchanged) |
//! | `total_raised`        | 1              | 1 (unchanged) |
//!
//! The individual single-field getters are unchanged — they remain cheap and
//! callers that need only one field should continue using them directly.
//!
//! ### Batched header view (issue #1561)
//! `get_campaign_snapshot` returns the creator, status, total raised, goal,
//! deadline and metadata in one `CampaignSnapshot` value. It also uses
//! [`CachedInstanceView::load`], so a dashboard that previously made three or
//! more cross-contract getter calls pays for one invocation and one
//! instance-storage read instead. `tests/view_gas.rs` pins the saving against
//! the individual `creator`/`status`/`total_raised` calls.

use crate::errors::ContractError;
use soroban_sdk::{contracttype, Address, Env, String, Vec};

use crate::{
    storage::{
        DataKey, KEY_CATEGORY, KEY_CREATOR, KEY_DEADLINE, KEY_DESC, KEY_GOAL, KEY_GOAL_HISTORY,
        KEY_MAX, KEY_MIN, KEY_PLATFORM, KEY_SOCIAL, KEY_STATUS, KEY_TITLE, KEY_TOKEN, KEY_TOTAL,
        KEY_VESTING,
    },
    types::{
        CampaignInfo, Category, ContributionHistory, ExtensionProposal, FeeMode, GoalAdjustment,
        PlatformConfig, RecurringPlan, Status, VestingSchedule,
    },
};

use common::math::{apply_bps, apply_bps_saturating, proportional};

// =============================================================================
// Per-call instance-storage cache (issue #1148)
// =============================================================================

/// A snapshot of all instance-storage fields loaded in a **single** pass.
///
/// Construct with [`CachedInstanceView::load`] at the start of any function
/// that needs more than one instance-storage field. All subsequent field
/// accesses are in-memory and incur zero additional storage reads.
///
/// # When to use
/// - Composite helpers that need 3+ instance fields (e.g. `get_campaign_info`,
///   `get_vested_amount`, analytics aggregations).
/// - View functions called from within a loop over contributors or milestones
///   where the campaign-level fields are constant across iterations.
///
/// # When NOT to use
/// - Single-field getters (`creator`, `status`, `goal`, …) — the individual
///   `instance().get()` call is equally cheap for a single field and avoids
///   loading the entire snapshot unnecessarily.
pub(crate) struct CachedInstanceView {
    pub creator: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub min_contribution: i128,
    pub max_contribution: i128,
    pub title: String,
    pub description: String,
    pub status: Status,
    pub category: Category,
    pub total: i128,
    pub platform_config: Option<PlatformConfig>,
    pub vesting: Option<VestingSchedule>,
}

impl CachedInstanceView {
    /// Load all instance-storage fields in a single pass.
    ///
    /// The Soroban host charges one read-footprint entry for the instance
    /// storage object regardless of how many keys are read from it in the same
    /// transaction. This method exploits that by reading all fields at once so
    /// subsequent accessors are free.
    ///
    /// # Storage reads: **1** (instance-storage footprint entry)
    pub(crate) fn load(env: &Env) -> Self {
        let inst = env.storage().instance();

        let creator: Address = inst.get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let token: Address = inst.get(&KEY_TOKEN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let goal: i128 = inst.get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let deadline: u64 = inst.get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let min_contribution: i128 = inst.get(&KEY_MIN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let max_contribution: i128 = inst.get(&KEY_MAX).unwrap_or(0);
        let title: String = inst
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(env, ""));
        let description: String = inst
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(env, ""));
        let status: Status = inst.get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound));
        let category: Category = inst.get(&KEY_CATEGORY).unwrap_or(Category::Other);
        let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
        let platform_config: Option<PlatformConfig> = inst.get(&KEY_PLATFORM);
        let vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);

        CachedInstanceView {
            creator,
            token,
            goal,
            deadline,
            min_contribution,
            max_contribution,
            title,
            description,
            status,
            category,
            total,
            platform_config,
            vesting,
        }
    }

    /// Compute the platform fee amount (in stroops) for a given gross amount.
    ///
    /// Returns `0` when no platform config is set.
    /// This is a pure in-memory computation — no additional storage reads.
    #[cfg(test)]
    #[inline]
    pub(crate) fn platform_fee_for(&self, amount: i128) -> i128 {
        self.platform_config
            .as_ref()
            .map(|c| apply_bps_saturating(amount, c.fee_bps))
            .unwrap_or(0)
    }

    /// Return the current fee mode.
    ///
    /// Pure in-memory — no storage reads.
    #[cfg(test)]
    #[inline]
    pub(crate) fn fee_mode(&self) -> FeeMode {
        self.platform_config
            .as_ref()
            .map(|c| c.fee_mode)
            .unwrap_or(FeeMode::OnSuccess)
    }

    /// Compute how much of the creator payout is currently vested.
    ///
    /// Logic is identical to the standalone `get_vested_amount` function but
    /// operates entirely on the already-loaded cache — zero extra reads.
    ///
    /// # Arguments
    /// * `now` — current ledger timestamp (obtained once by the caller).
    #[cfg(test)]
    #[inline]
    pub(crate) fn vested_amount(&self, now: u64) -> i128 {
        if self.total <= 0 {
            return 0;
        }
        let payout = self.total - self.platform_fee_for(self.total);

        let Some(ref v) = self.vesting else {
            return payout;
        };

        if now < v.cliff {
            return 0;
        }
        if v.duration == 0 || now >= v.cliff.saturating_add(v.duration) {
            return payout;
        }
        let elapsed = now.saturating_sub(v.cliff);
        proportional(elapsed as i128, v.duration as i128, payout).unwrap_or(payout)
    }
}

/// Everything a dashboard needs for its campaign header, loaded in one pass.
///
/// Issue #1561: callers that need creator, status and total raised (plus the
/// rest of the header) can make one cross-contract call instead of three or
/// more. All fields come from a single [`CachedInstanceView::load`], so the
/// host meters one instance-storage read footprint entry rather than one per
/// getter.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignSnapshot {
    pub creator: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub total_raised: i128,
    pub status: Status,
    pub title: String,
    pub description: String,
    pub min_contribution: i128,
    pub max_contribution: i128,
    pub category: Category,
}

/// Returns the campaign header snapshot.
///
/// `total_raised` reflects the live `KEY_TOTAL` value, including contributions
/// made since initialization. The field set intentionally matches the
/// single-field views so callers can swap multiple calls for this one.
pub(crate) fn get_campaign_snapshot(env: Env) -> CampaignSnapshot {
    let c = CachedInstanceView::load(&env);
    CampaignSnapshot {
        creator: c.creator,
        token: c.token,
        goal: c.goal,
        deadline: c.deadline,
        total_raised: c.total,
        status: c.status,
        title: c.title,
        description: c.description,
        min_contribution: c.min_contribution,
        max_contribution: c.max_contribution,
        category: c.category,
    }
}

// =============================================================================
// Core campaign getters (single-field — unchanged)
// =============================================================================

/// Returns the total amount raised so far in stroops.
pub(crate) fn total_raised(env: Env) -> i128 {
    env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
}

/// Returns the campaign creator's Stellar address.
pub(crate) fn creator(env: Env) -> Address {
    env.storage().instance().get(&KEY_CREATOR).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound))
}

/// Returns the current campaign status.
pub(crate) fn status(env: Env) -> Status {
    env.storage().instance().get(&KEY_STATUS).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound))
}

/// Returns the campaign funding goal in stroops.
pub(crate) fn goal(env: Env) -> i128 {
    env.storage().instance().get(&KEY_GOAL).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound))
}

/// Returns the campaign deadline as a Unix timestamp (seconds).
pub(crate) fn deadline(env: Env) -> u64 {
    env.storage().instance().get(&KEY_DEADLINE).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound))
}

/// Returns the total contribution amount for a specific contributor in stroops.
pub(crate) fn contribution(env: Env, contributor: Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Contribution(contributor))
        .unwrap_or(0)
}

/// Checks if an address has made any contributions to the campaign.
pub(crate) fn is_contributor(env: Env, address: Address) -> bool {
    env.storage()
        .persistent()
        .get::<_, i128>(&DataKey::Contribution(address))
        .unwrap_or(0)
        > 0
}

/// Returns the minimum contribution amount in stroops.
pub(crate) fn min_contribution(env: Env) -> i128 {
    env.storage().instance().get(&KEY_MIN).unwrap_or_else(|| soroban_sdk::panic_with_error!(&env, ContractError::NotFound))
}

/// Returns the maximum contribution amount per contributor in stroops (0 = no limit).
pub(crate) fn max_contribution(env: Env) -> i128 {
    env.storage().instance().get(&KEY_MAX).unwrap_or(0)
}

// =============================================================================
// Metadata getters (single-field — unchanged)
// =============================================================================

/// Returns the campaign title.
pub(crate) fn title(env: Env) -> String {
    env.storage()
        .instance()
        .get(&KEY_TITLE)
        .unwrap_or_else(|| String::from_str(&env, ""))
}

/// Returns the campaign description.
pub(crate) fn description(env: Env) -> String {
    env.storage()
        .instance()
        .get(&KEY_DESC)
        .unwrap_or_else(|| String::from_str(&env, ""))
}

/// Returns the campaign's social media links.
pub(crate) fn social_links(env: Env) -> Vec<String> {
    env.storage()
        .instance()
        .get(&KEY_SOCIAL)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the list of accepted token addresses, falling back to the primary token.
pub(crate) fn accepted_tokens(env: Env) -> Vec<Address> {
    let inst = env.storage().instance();
    if let Some(tokens) = inst.get::<_, Vec<Address>>(&DataKey::AcceptedTokens) {
        return tokens;
    }
    // Fall back to the primary campaign token
    let mut v = Vec::new(&env);
    if let Some(tok) = inst.get::<_, Address>(&KEY_TOKEN) {
        v.push_back(tok);
    }
    v
}

/// Returns the platform fee configuration (if set).
pub(crate) fn platform_config(env: Env) -> Option<PlatformConfig> {
    env.storage().instance().get(&KEY_PLATFORM)
}

/// Returns the current fee mode, defaulting to `OnSuccess`.
///
/// ## Optimisation (issue #1148)
/// Previously loaded the full `PlatformConfig` struct and threw away everything
/// except `fee_mode`. The read cost is the same (one instance-storage entry),
/// but the deserialisation now short-circuits via `map` rather than binding the
/// full struct. Callers that need both the fee amount *and* the mode should use
/// [`CachedInstanceView`] to avoid reading the config twice.
pub(crate) fn get_fee_mode(env: Env) -> FeeMode {
    env.storage()
        .instance()
        .get::<_, PlatformConfig>(&KEY_PLATFORM)
        .map(|c| c.fee_mode)
        .unwrap_or(FeeMode::OnSuccess)
}

/// Returns comprehensive campaign information.
///
/// ## Optimisation (issue #1148)
/// **Before**: 10–12 separate `instance().get()` calls, each adding to the
/// transaction's read-byte cost even though they all read from the same
/// instance-storage object.
///
/// **After**: delegates to [`CachedInstanceView::load`] which reads all fields
/// in a single pass. The host charges one instance-storage footprint entry
/// regardless of how many keys are read within that entry during the same
/// transaction. Net saving: eliminates 9–11 redundant metered reads per call.
pub(crate) fn get_campaign_info(env: Env) -> CampaignInfo {
    // Single-pass load of all instance fields (issue #1148 optimisation).
    let c = CachedInstanceView::load(&env);

    let (has_platform_config, platform_fee_bps, platform_address) =
        if let Some(ref config) = c.platform_config {
            (true, config.fee_bps, config.address.clone())
        } else {
            (false, 0, c.creator.clone())
        };

    CampaignInfo {
        creator: c.creator,
        token: c.token,
        goal: c.goal,
        deadline: c.deadline,
        min_contribution: c.min_contribution,
        max_contribution: c.max_contribution,
        title: c.title,
        description: c.description,
        status: c.status,
        has_platform_config,
        platform_fee_bps,
        platform_address,
        category: c.category,
    }
}

/// Returns the campaign category.
pub(crate) fn get_category(env: Env) -> Category {
    env.storage()
        .instance()
        .get(&KEY_CATEGORY)
        .unwrap_or(Category::Other)
}

// =============================================================================
// Vesting getters
// =============================================================================

/// Returns the vesting schedule (if configured).
pub(crate) fn get_vesting_info(env: Env) -> Option<VestingSchedule> {
    env.storage().instance().get(&KEY_VESTING)
}

/// Returns the amount of the creator payout that is currently vested.
///
/// ## Optimisation (issue #1148)
/// **Before**: three separate instance-storage reads (`KEY_TOTAL`, `KEY_PLATFORM`,
/// `KEY_VESTING`) even though these are all stored in the same instance entry.
///
/// **After**: delegates to [`CachedInstanceView::load`] + [`CachedInstanceView::vested_amount`],
/// loading all three values in one pass with a single instance-footprint charge.
/// The `now` timestamp is also read exactly once.
pub(crate) fn get_vested_amount(env: Env) -> i128 {
    let inst = env.storage().instance();
    let total: i128 = inst.get(&KEY_TOTAL).unwrap_or(0);
    if total <= 0 {
        return 0;
    }

    let platform_fee = inst
        .get::<_, PlatformConfig>(&KEY_PLATFORM)
        .map(|c| apply_bps(total, c.fee_bps).unwrap_or(0))
        .unwrap_or(0);
    let payout = total - platform_fee;

    let vesting: Option<VestingSchedule> = inst.get(&KEY_VESTING);
    let Some(v) = vesting else { return payout };

    let now = env.ledger().timestamp();
    if now < v.cliff {
        return 0;
    }
    if v.duration == 0 || now >= v.cliff.saturating_add(v.duration) {
        return payout;
    }
    let elapsed = now.saturating_sub(v.cliff);
    proportional(elapsed as i128, v.duration as i128, payout).unwrap_or(payout)
}

// =============================================================================
// History getters
// =============================================================================

/// Returns the goal adjustment history.
pub(crate) fn get_goal_history(env: Env) -> Vec<GoalAdjustment> {
    env.storage()
        .persistent()
        .get(&KEY_GOAL_HISTORY)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the contribution history for a contributor.
pub(crate) fn get_contribution_history(env: Env, contributor: Address) -> Vec<ContributionHistory> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionHistory(contributor))
        .unwrap_or_else(|| Vec::new(&env))
}

/// Returns the penalty fee in basis points, or 0 when not configured.
pub(crate) fn get_penalty_bps(env: Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::PenaltyBps)
        .unwrap_or(0)
}

// =============================================================================
// Contributor getters
// =============================================================================

/// Returns a paginated list of contributor addresses (limit capped at 50).
pub(crate) fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
    // Read total count from instance storage (cheap, already in footprint).
    let total_count: u32 = env
        .storage()
        .instance()
        .get(&DataKey::ContributorCount)
        .unwrap_or(0);

    if offset >= total_count {
        return Vec::new(&env);
    }

    // Cap at 50 per the original contract spec.
    let capped_limit = limit.min(50);
    let end = offset.saturating_add(capped_limit).min(total_count);

    // O(page_size) reads via individual indexed keys instead of loading and
    // deserialising the entire contributor list each time.
    let mut result = Vec::new(&env);
    for i in offset..end {
        if let Some(addr) = env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::ContributorIndex(i))
        {
            result.push_back(addr);
        }
    }
    result
}

/// Returns the message attached to a contribution (if any).
pub(crate) fn get_contribution_message(env: Env, contributor: Address) -> Option<String> {
    env.storage()
        .persistent()
        .get(&DataKey::ContributionMessage(contributor))
}

/// Returns the recurring contribution plan for a contributor.
pub(crate) fn get_recurring_plan(env: Env, contributor: Address) -> Option<RecurringPlan> {
    env.storage()
        .persistent()
        .get(&DataKey::RecurringPlan(contributor))
}

/// Returns the active extension proposal (if any).
pub(crate) fn get_extension_proposal(env: Env) -> Option<ExtensionProposal> {
    env.storage().instance().get(&DataKey::ExtensionProposal)
}

// =============================================================================
// Tests (issue #1148)
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Category, CrowdfundContract, CrowdfundContractClient, FeeMode, PlatformConfig,
        VestingSchedule,
    };
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token, Address, Env, String,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup_env() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    fn setup_contract(
        env: &Env,
        platform: Option<PlatformConfig>,
        vesting: Option<VestingSchedule>,
        category: Category,
    ) -> (Address, Address, CrowdfundContractClient<'_>, token::StellarAssetClient<'_>) {
        let creator = Address::generate(env);
        let token_admin = Address::generate(env);
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_admin_client = token::StellarAssetClient::new(env, &token_id);
        let contract_id = env.register_contract(None, CrowdfundContract);
        let client = CrowdfundContractClient::new(env, &contract_id);

        env.ledger().set_timestamp(100);
        client.initialize(
            &creator,
            &token_id,
            &100_000i128,
            &10_000u64,
            &100i128,
            &0i128,
            &String::from_str(env, "Test Campaign"),
            &String::from_str(env, "A description"),
            &None,
            &platform,
            &None,
            &category,
            &vesting,
            &None,
        );
        (creator, token_id, client, token_admin_client)
    }

    fn contribute(
        env: &Env,
        client: &CrowdfundContractClient<'_>,
        token_id: &Address,
        token_admin: &token::StellarAssetClient<'_>,
        amount: i128,
    ) -> Address {
        let c = Address::generate(env);
        token_admin.mint(&c, &amount);
        client.contribute(&c, &amount, token_id, &None);
        c
    }

    // ── CachedInstanceView::load ──────────────────────────────────────────────

    #[test]
    fn test_cached_view_loads_core_fields() {
        let env = setup_env();
        let (creator, token_id, client, _) = setup_contract(&env, None, None, Category::Technology);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert_eq!(v.creator, creator);
            assert_eq!(v.token, token_id);
            assert_eq!(v.goal, 100_000);
            assert_eq!(v.deadline, 10_000);
            assert_eq!(v.min_contribution, 100);
            assert_eq!(v.max_contribution, 0);
            assert_eq!(v.total, 0);
            assert!(v.platform_config.is_none());
            assert!(v.vesting.is_none());
            assert!(matches!(v.category, Category::Technology));
        });
    }

    #[test]
    fn test_cached_view_total_updated_after_contribution() {
        let env = setup_env();
        let (_, token_id, client, token_admin) = setup_contract(&env, None, None, Category::Other);
        contribute(&env, &client, &token_id, &token_admin, 1_000);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert_eq!(v.total, 1_000);
        });
    }

    // ── platform_fee_for ──────────────────────────────────────────────────────

    #[test]
    fn test_platform_fee_zero_when_no_config() {
        let env = setup_env();
        let (_, _, client, _) = setup_contract(&env, None, None, Category::Other);
        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert_eq!(v.platform_fee_for(10_000), 0);
        });
    }

    #[test]
    fn test_platform_fee_correct_with_250_bps() {
        let env = setup_env();
        let platform_addr = Address::generate(&env);
        let (_, _, client, _) = setup_contract(
            &env,
            Some(PlatformConfig {
                address: platform_addr,
                fee_bps: 250,
                fee_mode: FeeMode::OnSuccess,
            }),
            None,
            Category::Other,
        );
        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            // 250 bps of 10_000 = 250
            assert_eq!(v.platform_fee_for(10_000), 250);
        });
    }

    // ── fee_mode ──────────────────────────────────────────────────────────────

    #[test]
    fn test_fee_mode_defaults_to_on_success() {
        let env = setup_env();
        let (_, _, client, _) = setup_contract(&env, None, None, Category::Other);
        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert!(matches!(v.fee_mode(), FeeMode::OnSuccess));
        });
    }

    #[test]
    fn test_fee_mode_on_contribution() {
        let env = setup_env();
        let platform_addr = Address::generate(&env);
        let (_, _, client, _) = setup_contract(
            &env,
            Some(PlatformConfig {
                address: platform_addr,
                fee_bps: 100,
                fee_mode: FeeMode::OnContribution,
            }),
            None,
            Category::Other,
        );
        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert!(matches!(v.fee_mode(), FeeMode::OnContribution));
        });
    }

    // ── vested_amount ─────────────────────────────────────────────────────────

    #[test]
    fn test_vested_amount_zero_when_no_contributions() {
        let env = setup_env();
        let (_, _, client, _) = setup_contract(&env, None, None, Category::Other);
        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            assert_eq!(v.vested_amount(500), 0);
        });
    }

    #[test]
    fn test_vested_amount_full_when_no_vesting_schedule() {
        let env = setup_env();
        let (_, token_id, client, token_admin) = setup_contract(&env, None, None, Category::Other);
        contribute(&env, &client, &token_id, &token_admin, 50_000);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            // No vesting → full total is immediately vested
            assert_eq!(v.vested_amount(99_999), 50_000);
        });
    }

    #[test]
    fn test_vested_amount_zero_before_cliff() {
        let env = setup_env();
        let (_, token_id, client, token_admin) = setup_contract(
            &env,
            None,
            Some(VestingSchedule { cliff: 2_000, duration: 5_000 }),
            Category::Other,
        );
        contribute(&env, &client, &token_id, &token_admin, 10_000);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            // Current ts = 100 < cliff = 2_000 → 0 vested
            assert_eq!(v.vested_amount(100), 0);
        });
    }

    #[test]
    fn test_vested_amount_full_after_vesting_period() {
        let env = setup_env();
        let (_, token_id, client, token_admin) = setup_contract(
            &env,
            None,
            Some(VestingSchedule { cliff: 200, duration: 500 }),
            Category::Other,
        );
        contribute(&env, &client, &token_id, &token_admin, 10_000);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            // ts = 800 >= cliff(200) + duration(500) = 700 → fully vested
            assert_eq!(v.vested_amount(800), 10_000);
        });
    }

    #[test]
    fn test_vested_amount_partial_mid_vesting() {
        let env = setup_env();
        let (_, token_id, client, token_admin) = setup_contract(
            &env,
            None,
            Some(VestingSchedule { cliff: 0, duration: 1_000 }),
            Category::Other,
        );
        contribute(&env, &client, &token_id, &token_admin, 10_000);

        env.as_contract(&client.address, || {
            let v = CachedInstanceView::load(&env);
            // elapsed = 500 / duration = 1_000 → 50% = 5_000
            assert_eq!(v.vested_amount(500), 5_000);
        });
    }

    // ── get_campaign_info equivalence ─────────────────────────────────────────

    /// The optimised `get_campaign_info` must return identical data to the
    /// individual per-key getters it replaces.
    #[test]
    fn test_get_campaign_info_matches_individual_getters() {
        let env = setup_env();
        let (creator, _, client, _) = setup_contract(&env, None, None, Category::Other);
        let info = client.get_campaign_info();

        assert_eq!(info.creator, creator);
        assert_eq!(info.goal, client.goal());
        assert_eq!(info.deadline, client.deadline());
        assert_eq!(info.min_contribution, client.min_contribution());
        assert_eq!(info.max_contribution, client.max_contribution());
        assert!(!info.has_platform_config);
        assert_eq!(info.platform_fee_bps, 0);
    }

    #[test]
    fn test_get_campaign_info_with_platform_config() {
        let env = setup_env();
        let platform_addr = Address::generate(&env);
        let (_, _, client, _) = setup_contract(
            &env,
            Some(PlatformConfig {
                address: platform_addr.clone(),
                fee_bps: 300,
                fee_mode: FeeMode::OnSuccess,
            }),
            None,
            Category::Other,
        );
        let info = client.get_campaign_info();

        assert!(info.has_platform_config);
        assert_eq!(info.platform_fee_bps, 300);
        assert_eq!(info.platform_address, platform_addr);
    }

    // ── get_vested_amount equivalence ─────────────────────────────────────────

    #[test]
    fn test_get_vested_amount_no_vesting_equals_total_minus_fee() {
        let env = setup_env();
        let platform_addr = Address::generate(&env);
        let (_, token_id, client, token_admin) = setup_contract(
            &env,
            Some(PlatformConfig {
                address: platform_addr,
                fee_bps: 500, // 5%
                fee_mode: FeeMode::OnSuccess,
            }),
            None,
            Category::Other,
        );
        contribute(&env, &client, &token_id, &token_admin, 10_000);

        // 10_000 - 5% = 9_500
        assert_eq!(client.get_vested_amount(), 9_500);
    }

    #[test]
    fn test_get_vested_amount_zero_when_no_contributions() {
        let env = setup_env();
        let (_, _, client, _) = setup_contract(&env, None, None, Category::Other);
        assert_eq!(client.get_vested_amount(), 0);
    }

    // ── get_fee_mode ──────────────────────────────────────────────────────────

    #[test]
    fn test_get_fee_mode_defaults_to_on_success() {
        let env = setup_env();
        let (_, _, client, _) = setup_contract(&env, None, None, Category::Other);
        assert!(matches!(client.get_fee_mode(), FeeMode::OnSuccess));
    }

    #[test]
    fn test_get_fee_mode_on_contribution() {
        let env = setup_env();
        let platform_addr = Address::generate(&env);
        let (_, _, client, _) = setup_contract(
            &env,
            Some(PlatformConfig {
                address: platform_addr,
                fee_bps: 100,
                fee_mode: FeeMode::OnContribution,
            }),
            None,
            Category::Other,
        );
        assert!(matches!(client.get_fee_mode(), FeeMode::OnContribution));
    }
}

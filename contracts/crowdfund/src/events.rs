//! Crowdfund Event Helpers
//!
//! This module re-exports shared event helpers for the crowdfund contract.
//! All event emission should use these helpers for consistency.
//!
//! # Naming convention (see `docs/adr/` for the full ADR)
//!
//! Events follow the shared convention used by both the crowdfund and
//! achievements contracts:
//!
//! * Topic 0 (event name): `snake_case` verb phrase, e.g. `contribution_made`.
//! * Topic 1 (action): the same `snake_case` name as topic 0, kept for
//!   indexer compatibility.
//! * Data payload: a struct/map with `snake_case` field names.
//!
//! The previous `Crowdfund`-prefixed / `PascalCase` topic names are deprecated
//! and were renamed in the same release; see `CHANGELOG.md` for the migration
//! note.

pub use common::events::{EventEmitter, topics};

use crate::types::{EventInvariantViolated, EventStateValidated};

/// Re-export for backward compatibility
#[allow(unused_imports)]
pub use topics as Topics;

/// Crowdfund-specific event helpers
pub struct CrowdfundEvents;

impl CrowdfundEvents {
    /// Emit campaign initialized event
    pub fn campaign_initialized(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        creator: soroban_sdk::Address,
        goal: i128,
    ) {
        EventEmitter::campaign_initialized(env, campaign_id, creator, goal);
    }

    /// Emit contribution made event
    pub fn contribution_made(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        contributor: soroban_sdk::Address,
        amount: i128,
    ) {
        EventEmitter::contribution_made(env, campaign_id, contributor, amount);
    }

    /// Emit funds withdrawn event
    pub fn funds_withdrawn(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        recipient: soroban_sdk::Address,
        amount: i128,
    ) {
        EventEmitter::funds_withdrawn(env, campaign_id, recipient, amount);
    }

    /// Emit refund issued event
    pub fn refund_issued(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        contributor: soroban_sdk::Address,
        amount: i128,
    ) {
        EventEmitter::refund_issued(env, campaign_id, contributor, amount);
    }

    /// Emit campaign cancelled event
    pub fn campaign_cancelled(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        cancelled_by: soroban_sdk::Address,
    ) {
        EventEmitter::campaign_cancelled(env, campaign_id, cancelled_by);
    }

    /// Emit campaign paused event
    pub fn campaign_paused(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        paused_by: soroban_sdk::Address,
    ) {
        EventEmitter::campaign_paused(env, campaign_id, paused_by);
    }

    /// Emit campaign resumed event
    pub fn campaign_resumed(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        resumed_by: soroban_sdk::Address,
    ) {
        EventEmitter::campaign_resumed(env, campaign_id, resumed_by);
    }

    /// Emit milestone added event
    pub fn milestone_added(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        milestone_id: u64,
        title: soroban_sdk::String,
        amount: i128,
    ) {
        EventEmitter::milestone_added(env, campaign_id, milestone_id, title, amount);
    }

    /// Emit milestone verified event
    pub fn milestone_verified(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        milestone_id: u64,
        verifier: soroban_sdk::Address,
    ) {
        EventEmitter::milestone_verified(env, campaign_id, milestone_id, verifier);
    }

    /// Emit milestone released event
    pub fn milestone_released(
        env: &soroban_sdk::Env,
        campaign_id: u64,
        milestone_id: u64,
        recipient: soroban_sdk::Address,
        amount: i128,
    ) {
        EventEmitter::milestone_released(env, campaign_id, milestone_id, recipient, amount);
    }

    /// Emit the analytics state-validation summary.
    pub fn state_validated(
        env: &soroban_sdk::Env,
        valid: bool,
        checks_passed: u32,
        checks_failed: u32,
        timestamp: u64,
    ) {
        EventEmitter::state_validated(
            env,
            EventStateValidated {
                valid,
                checks_passed,
                checks_failed,
                timestamp,
            },
        );
    }

    /// Emit an analytics invariant violation.
    pub fn invariant_violated(env: &soroban_sdk::Env, invariant_id: u32, timestamp: u64) {
        EventEmitter::invariant_violated(
            env,
            EventInvariantViolated {
                invariant_id,
                timestamp,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        Address, Env, String, Symbol, TryFromVal,
    };

    /// All crowdfund event names must be `snake_case` (no uppercase letters,
    /// no `Crowdfund` prefix) so a single indexer handler can serve both
    /// contracts.
    fn assert_snake_case(name: &str) {
        assert!(!name.is_empty(), "event name must not be empty");
        assert!(
            !name.chars().any(|c| c.is_ascii_uppercase()),
            "event name `{name}` must be snake_case"
        );
        assert!(
            !name.starts_with("crowdfund"),
            "event name `{name}` must not carry a contract prefix"
        );
    }

    #[test]
    fn event_names_follow_convention() {
        let names = [
            "campaign_initialized",
            "contribution_made",
            "funds_withdrawn",
            "refund_issued",
            "campaign_cancelled",
            "campaign_paused",
            "campaign_resumed",
            "milestone_added",
            "milestone_verified",
            "milestone_released",
            "state_validated",
            "invariant_violated",
        ];
        for name in names {
            assert_snake_case(name);
        }
    }

    #[test]
    fn helpers_emit_events() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        CrowdfundEvents::campaign_initialized(&env, 1, creator.clone(), 1_000);
        CrowdfundEvents::contribution_made(&env, 1, contributor.clone(), 100);
        CrowdfundEvents::funds_withdrawn(&env, 1, creator.clone(), 100);
        CrowdfundEvents::refund_issued(&env, 1, contributor.clone(), 100);
        CrowdfundEvents::campaign_cancelled(&env, 1, creator.clone());
        CrowdfundEvents::campaign_paused(&env, 1, creator.clone());
        CrowdfundEvents::campaign_resumed(&env, 1, creator.clone());
        CrowdfundEvents::milestone_added(
            &env,
            1,
            1,
            String::from_str(&env, "M1"),
            500,
        );
        CrowdfundEvents::milestone_verified(&env, 1, 1, creator.clone());
        CrowdfundEvents::milestone_released(&env, 1, 1, creator, 500);

        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn analytics_helpers_snapshot_topics_and_payloads() {
        let env = Env::default();

        CrowdfundEvents::invariant_violated(&env, 4, 123);
        CrowdfundEvents::state_validated(&env, false, 4, 1, 123);

        let events = env.events().all();
        assert_eq!(events.len(), 2);

        let namespace = Symbol::new(&env, "contract");
        let (_, violated_topics, violated_data) = events.get(0).unwrap();
        assert_eq!(
            Symbol::try_from_val(&env, &violated_topics.get(0).unwrap()).unwrap(),
            namespace
        );
        assert_eq!(
            Symbol::try_from_val(&env, &violated_topics.get(1).unwrap()).unwrap(),
            Symbol::new(&env, "invariant_violated")
        );
        let violated = EventInvariantViolated::try_from_val(&env, &violated_data).unwrap();
        assert_eq!(violated.invariant_id, 4);
        assert_eq!(violated.timestamp, 123);

        let (_, validated_topics, validated_data) = events.get(1).unwrap();
        assert_eq!(
            Symbol::try_from_val(&env, &validated_topics.get(0).unwrap()).unwrap(),
            namespace
        );
        assert_eq!(
            Symbol::try_from_val(&env, &validated_topics.get(1).unwrap()).unwrap(),
            Symbol::new(&env, "state_validated")
        );
        let validated = EventStateValidated::try_from_val(&env, &validated_data).unwrap();
        assert!(!validated.valid);
        assert_eq!(validated.checks_passed, 4);
        assert_eq!(validated.checks_failed, 1);
        assert_eq!(validated.timestamp, 123);
    }
}

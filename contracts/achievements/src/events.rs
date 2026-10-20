//! Typed event payloads for the achievements contract.
//!
//! Follows the shared convention documented in `docs/adr/` (issue #1572):
//! topic = `("achievements", event_name)`, where `event_name` is the
//! snake_case form of the struct name with the `Event` prefix stripped
//! (e.g. `EventPointsAwarded` -> `"points_awarded"`). Payloads use named
//! fields (never raw tuples), identifying fields first, `schema_version`
//! last. Only events actually emitted by `lib.rs` are defined here — see
//! each struct's doc comment for its topic and call site.
use soroban_sdk::{contracttype, Address, String};

/// Topic: `("achievements", "initialized")`
#[derive(Clone)]
#[contracttype]
pub struct EventInitialized {
    pub admin: Address,
    pub platform_address: Address,
    pub schema_version: u32,
}

/// Topic: `("achievements", "unlocked")`
#[derive(Clone)]
#[contracttype]
pub struct EventUnlocked {
    pub user: Address,
    pub achievement_type: u32,
    pub points_earned: u32,
    pub new_level: u32,
    pub schema_version: u32,
}

/// Topic: `("achievements", "points_awarded")`
#[derive(Clone)]
#[contracttype]
pub struct EventPointsAwarded {
    pub user: Address,
    pub points: u32,
    pub total_points: u32,
    pub schema_version: u32,
}

/// Topic: `("achievements", "contribution_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventContributionRecorded {
    pub user: Address,
    pub campaign_id: String,
    pub amount: i128,
    pub schema_version: u32,
}

/// Topic: `("achievements", "referral_recorded")`
#[derive(Clone)]
#[contracttype]
pub struct EventReferralRecorded {
    pub referrer: Address,
    pub referee: Address,
    pub points_earned: u32,
    pub schema_version: u32,
}

/// Topic: `("achievements", "streak_updated")`
#[derive(Clone)]
#[contracttype]
pub struct EventStreakUpdated {
    pub user: Address,
    pub new_streak: u32,
    pub schema_version: u32,
}
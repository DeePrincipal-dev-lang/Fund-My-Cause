#![cfg(test)]

//! Public type-path tests for the crowdfund contract (issue #1491).
//!
//! The domain and event types are split across modules inside `src/types/`.
//! Consumers must keep importing them from the crate root, so this test fails
//! to compile if any public type path stops resolving after a refactor.

use crowdfund::{
    CampaignInfo, CampaignStats, Category, ContributionHistory, DataKey, Dispute, FeeMode,
    FundingMilestone, MilestoneStatus, PlatformConfig, RecurringPlan, Status, StreamConfig,
    VestingSchedule, Visibility,
};
use crowdfund::{
    EventCancelled, EventContributed, EventInitialized, EventRefunded, EventWithdrawn,
};

fn assert_type<T>() {}

#[test]
fn domain_type_paths_resolve_from_crate_root() {
    assert_type::<CampaignInfo>();
    assert_type::<CampaignStats>();
    assert_type::<Category>();
    assert_type::<ContributionHistory>();
    assert_type::<DataKey>();
    assert_type::<Dispute>();
    assert_type::<FeeMode>();
    assert_type::<FundingMilestone>();
    assert_type::<MilestoneStatus>();
    assert_type::<PlatformConfig>();
    assert_type::<RecurringPlan>();
    assert_type::<Status>();
    assert_type::<StreamConfig>();
    assert_type::<VestingSchedule>();
    assert_type::<Visibility>();
}

#[test]
fn event_type_paths_resolve_from_crate_root() {
    assert_type::<EventInitialized>();
    assert_type::<EventContributed>();
    assert_type::<EventWithdrawn>();
    assert_type::<EventRefunded>();
    assert_type::<EventCancelled>();
}

//! Consistency checks for the batched `get_campaign_info` view (issue #1486).
//!
//! `get_campaign_info` loads the campaign fields in one pass. These tests pin
//! that its output matches the single-field views a dashboard would otherwise
//! call one at a time, so the combined path cannot drift from them.

#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crowdfund::{Category, FeeMode, PlatformConfig};

mod common;
use common::setup;

#[test]
fn campaign_snapshot_matches_single_field_views() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    let snapshot = client.get_campaign_snapshot();

    assert_eq!(snapshot.creator, client.creator());
    assert_eq!(snapshot.token, campaign.token_id);
    assert_eq!(snapshot.goal, client.goal());
    assert_eq!(snapshot.deadline, client.deadline());
    assert_eq!(snapshot.total_raised, client.total_raised());
    assert_eq!(snapshot.status, client.status());
    assert_eq!(snapshot.title, client.title());
    assert_eq!(snapshot.description, client.description());
    assert_eq!(snapshot.min_contribution, client.min_contribution());
    assert_eq!(snapshot.max_contribution, client.max_contribution());
    assert_eq!(snapshot.category, client.get_category());
}

#[test]
fn campaign_snapshot_tracks_contributions() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    let contributor = Address::generate(&env);
    campaign.token_admin.mint(&contributor, &2_500);
    client.contribute(&contributor, &2_500, &campaign.token_id, &None);

    let snapshot = client.get_campaign_snapshot();
    assert_eq!(snapshot.total_raised, 2_500);
    assert_eq!(snapshot.total_raised, client.total_raised());
}

#[test]
fn campaign_info_matches_single_field_views() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    let info = client.get_campaign_info();

    assert_eq!(info.creator, client.creator());
    assert_eq!(info.goal, client.goal());
    assert_eq!(info.deadline, client.deadline());
    assert_eq!(info.min_contribution, client.min_contribution());
    assert_eq!(info.max_contribution, client.max_contribution());
    assert_eq!(info.title, client.title());
    assert_eq!(info.description, client.description());
    assert_eq!(info.status, client.status());
    assert_eq!(info.category, client.get_category());
    assert_eq!(info.token, campaign.token_id);
    assert!(!info.has_platform_config);
    assert_eq!(info.platform_fee_bps, 0);
}

#[test]
fn campaign_info_matches_views_after_contributions() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    let contributor = Address::generate(&env);
    campaign.token_admin.mint(&contributor, &1_000);
    client.contribute(&contributor, &1_000, &campaign.token_id, &None);

    let info = client.get_campaign_info();
    assert_eq!(info.goal, client.goal());
    assert_eq!(info.status, client.status());
    assert_eq!(client.total_raised(), 1_000);
    assert_eq!(client.contribution(&contributor), 1_000);
}

#[test]
fn campaign_info_reports_platform_config_like_fee_views() {
    let env = Env::default();
    env.mock_all_auths();
    let platform_address = Address::generate(&env);
    let config = PlatformConfig {
        address: platform_address.clone(),
        fee_bps: 250,
        fee_mode: FeeMode::OnSuccess,
    };
    let campaign = setup(&env, 50_000, 1_000_000, Some(config));
    let client = &campaign.client;

    let info = client.get_campaign_info();
    assert!(info.has_platform_config);
    assert_eq!(info.platform_fee_bps, 250);
    assert_eq!(info.platform_address, platform_address);
    assert_eq!(info.category, Category::Other);
    assert_eq!(client.get_fee_mode(), FeeMode::OnSuccess);
}

#[test]
fn campaign_info_title_and_description_are_stored_values() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let info = campaign.client.get_campaign_info();

    assert_eq!(info.title, String::from_str(&env, "Test Campaign"));
    assert_eq!(info.description, String::from_str(&env, "Integration test"));
}

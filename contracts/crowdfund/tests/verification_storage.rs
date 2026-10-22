//! Regression test for issue #1560.
//!
//! `update_verification` previously stored `VerificationStatus` under
//! `DataKey::Contribution`, overwriting the contributor's i128 amount. The
//! dedicated `DataKey::Verification` slot must keep the two values independent.

#![cfg(test)]
#![allow(deprecated)]

use soroban_sdk::Env;

mod common;
use common::{fund, setup};

#[test]
fn verification_update_preserves_contribution_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let campaign = setup(&env, 50_000, 1_000_000, None);
    let client = &campaign.client;

    let contributor = fund(&env, &campaign, 500);
    let before = client.get_verification(&contributor);

    client.update_verification(&contributor, &before);

    assert_eq!(client.get_verification(&contributor), before);
    assert_eq!(client.contribution(&contributor), 500);
    assert_eq!(client.total_raised(), 500);
}

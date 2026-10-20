#![cfg(test)]
#![allow(deprecated)]

//! One test per upgrade step, all built on the shared fixture in `common.rs`
//! (issue #1490).

use soroban_sdk::{testutils::Address as _, Address, Env};

mod common;
use common::setup_upgrade_campaign;

#[test]
fn upgrade_step_migrate_version_succeeds_on_shared_fixture() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup_upgrade_campaign(&env);

    assert!(c.client.try_migrate_version().is_ok());
}

#[test]
fn upgrade_step_migrate_version_preserves_contributions() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup_upgrade_campaign(&env);
    let contributor = Address::generate(&env);

    c.token_admin.mint(&contributor, &1_000);
    c.client
        .contribute(&contributor, &1_000, &c.token_id, &None);

    c.client.migrate_version();

    assert_eq!(c.client.contribution(&contributor), 1_000);
    assert_eq!(c.client.total_raised(), 1_000);
}

#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address, String};

#[test]
fn test_initialize_registry() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);

    let result = RegistryContract::initialize(
        env.clone(),
        admin.clone(),
        100,
        fee_recipient,
    );
    assert!(result.is_ok());

    let stored_admin = RegistryContract::get_admin(env).unwrap();
    assert_eq!(stored_admin, admin);
}

#[test]
fn test_register_and_get_project() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);
    let creator = Address::random(&env);

    RegistryContract::initialize(
        env.clone(),
        admin,
        100,
        fee_recipient,
    ).unwrap();

    let id = RegistryContract::register_project(
        env.clone(),
        creator.clone(),
        String::from_str(&env, "Test Project"),
        String::from_str(&env, "Test Description"),
        String::from_str(&env, "Technology"),
    ).unwrap();

    let project = RegistryContract::get_project(env, id).unwrap();
    assert_eq!(project.name, String::from_str(&env, "Test Project"));
    assert_eq!(project.creator, creator);
}

#[test]
fn test_update_project() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);
    let creator = Address::random(&env);

    RegistryContract::initialize(
        env.clone(),
        admin,
        100,
        fee_recipient,
    ).unwrap();

    let id = RegistryContract::register_project(
        env.clone(),
        creator.clone(),
        String::from_str(&env, "Test Project"),
        String::from_str(&env, "Test Description"),
        String::from_str(&env, "Technology"),
    ).unwrap();

    let result = RegistryContract::update_project(
        env.clone(),
        id,
        creator,
        Some(String::from_str(&env, "Updated Project")),
        Some(String::from_str(&env, "Updated Description")),
        None,
    );
    assert!(result.is_ok());

    let project = RegistryContract::get_project(env, id).unwrap();
    assert_eq!(project.name, String::from_str(&env, "Updated Project"));
}

#[test]
fn test_verify_project() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);
    let creator = Address::random(&env);

    RegistryContract::initialize(
        env.clone(),
        admin.clone(),
        100,
        fee_recipient,
    ).unwrap();

    let id = RegistryContract::register_project(
        env.clone(),
        creator,
        String::from_str(&env, "Test Project"),
        String::from_str(&env, "Test Description"),
        String::from_str(&env, "Technology"),
    ).unwrap();

    let result = RegistryContract::verify_project(env.clone(), id, admin);
    assert!(result.is_ok());

    let project = RegistryContract::get_project(env, id).unwrap();
    assert!(project.verified);
}

#[test]
fn test_pause_registry() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);

    RegistryContract::initialize(
        env.clone(),
        admin.clone(),
        100,
        fee_recipient,
    ).unwrap();

    let result = RegistryContract::pause(env.clone(), admin.clone());
    assert!(result.is_ok());

    let paused = RegistryContract::is_paused(env);
    assert!(paused);
}

#[test]
fn test_archive_project() {
    let env = Env::default();
    let admin = Address::random(&env);
    let fee_recipient = Address::random(&env);
    let creator = Address::random(&env);

    RegistryContract::initialize(
        env.clone(),
        admin.clone(),
        100,
        fee_recipient,
    ).unwrap();

    let id = RegistryContract::register_project(
        env.clone(),
        creator,
        String::from_str(&env, "Test Project"),
        String::from_str(&env, "Test Description"),
        String::from_str(&env, "Technology"),
    ).unwrap();

    let result = RegistryContract::archive_project(env.clone(), id, admin);
    assert!(result.is_ok());

    // Project should no longer be in the list
    let ids = RegistryContract::get_all_project_ids(env);
    assert!(!ids.contains(&id));
}

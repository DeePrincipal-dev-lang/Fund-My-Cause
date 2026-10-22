use criterion::{black_box, criterion_group, criterion_main, Criterion};
use registry::{RegistryContract, RegistryContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn create_registry(env: &Env) -> (RegistryContractClient, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let contract_id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(env, &contract_id);

    client.initialize(&admin);

    (client, admin)
}

fn benchmark_registry_operations(c: &mut Criterion) {
    c.bench_function("register_campaign_single", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            let campaign_id = Address::generate(&env);
            let creator = Address::generate(&env);

            black_box(client.register(
                &campaign_id,
                &creator,
                &String::from_str(&env, "Test Campaign"),
            ))
        })
    });

    c.bench_function("register_campaign_10_sequential", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            for i in 0..10 {
                let campaign_id = Address::generate(&env);
                let creator = Address::generate(&env);

                client.register(
                    &campaign_id,
                    &creator,
                    &String::from_str(&env, &format!("Campaign {}", i)),
                );
            }
        })
    });

    c.bench_function("verify_campaign", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, admin) = create_registry(&env);

            let campaign_id = Address::generate(&env);
            let creator = Address::generate(&env);

            client.register(
                &campaign_id,
                &creator,
                &String::from_str(&env, "Campaign to Verify"),
            );

            // Simulate verification by admin
            black_box(client.verify(&campaign_id, &true))
        })
    });

    c.bench_function("get_campaign_info", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            let campaign_id = Address::generate(&env);
            let creator = Address::generate(&env);

            client.register(
                &campaign_id,
                &creator,
                &String::from_str(&env, "Queryable Campaign"),
            );

            // Query campaign info (read-only, should be optimized)
            black_box(client.get(&campaign_id))
        })
    });

    c.bench_function("search_campaigns_by_creator", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            let creator = Address::generate(&env);

            // Register 5 campaigns for the same creator
            for i in 0..5 {
                let campaign_id = Address::generate(&env);
                client.register(
                    &campaign_id,
                    &creator,
                    &String::from_str(&env, &format!("Creator Campaign {}", i)),
                );
            }

            // Search by creator (uses indexed lookup)
            black_box(client.get_by_creator(&creator))
        })
    });

    c.bench_function("list_all_campaigns_100", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            // Register many campaigns
            for i in 0..100 {
                let campaign_id = Address::generate(&env);
                let creator = Address::generate(&env);
                client.register(
                    &campaign_id,
                    &creator,
                    &String::from_str(&env, &format!("Campaign {}", i)),
                );
            }

            // List all (pagination test)
            black_box(client.list(0, 100))
        })
    });

    c.bench_function("update_campaign_metadata", |b| {
        b.iter(|| {
            let env = Env::default();
            let (client, _admin) = create_registry(&env);

            let campaign_id = Address::generate(&env);
            let creator = Address::generate(&env);

            client.register(
                &campaign_id,
                &creator,
                &String::from_str(&env, "Original Title"),
            );

            // Update metadata
            black_box(
                client.update_metadata(&campaign_id, &String::from_str(&env, "Updated Title")),
            )
        })
    });
}

criterion_group!(benches, benchmark_registry_operations);
criterion_main!(benches);

//! cargo-fuzz target for the crowdfund contract's pure validation logic
//! (`contracts/crowdfund/src/validation.rs`, exposed for fuzzing via the
//! `fuzz_api` module gated behind the `fuzz` feature).
//!
//! Fund-handling entry points (`contribute`, `withdraw`, `refund_single`, ...)
//! all funnel through these validation functions before touching storage, so
//! fuzzing them directly gives fast, Env-free coverage of the
//! malformed/adversarial-input boundary without needing a full Soroban host
//! environment.
//!
//! Run locally with:
//!   cargo install cargo-fuzz
//!   cd contracts/crowdfund/fuzz
//!   cargo +nightly fuzz run fuzz_validation
//!
//! See `contracts/crowdfund/README.md` for corpus seeding and CI notes.

#![no_main]

use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;
use crowdfund::fuzz_api;

#[derive(Debug, Arbitrary)]
struct ValidationInput {
    goal: i128,
    deadline: u64,
    min_contribution: i128,
    max_contribution: i128,
    platform_fee_bps: Option<u32>,
    current_time: u64,
    contribution_amount: i128,
    current_contributor_total: i128,
}

fuzz_target!(|input: ValidationInput| {
    // None of these should ever panic, regardless of how adversarial the
    // input is — they should only ever return Ok(()) or a typed
    // ContractError. A panic here is the bug this harness exists to catch.
    let _ = fuzz_api::validate_initialization(
        input.goal,
        input.deadline,
        input.min_contribution,
        input.max_contribution,
        input.platform_fee_bps,
        input.current_time,
    );

    let _ = fuzz_api::validate_min_contribution(input.contribution_amount, input.min_contribution);

    let _ = fuzz_api::validate_contributor_cap(
        input.contribution_amount,
        input.max_contribution,
        input.current_contributor_total,
    );
});

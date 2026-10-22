//! Test suite entry point for the quadratic-funding matching engine.
//!
//! Submodules:
//! - `qf_tests`: existing baseline unit tests for `QuadraticFunding::calculate`.
//! - `invariants`: existing invariant-focused regression tests.
//! - `property_and_edge_cases`: Issue coverage for zero/single/max-value
//!   inputs plus `proptest`-driven property tests over randomized inputs,
//!   confirming checked-arithmetic overflow handling.
mod invariants;
mod property_and_edge_cases;
mod qf_tests;

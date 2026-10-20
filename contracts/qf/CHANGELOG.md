# qf Changelog

All notable changes to the qf (quadratic funding) contract are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-28

### Added
- Initial implementation of the quadratic funding calculation library
- Core `QuadraticFunding::calculate` function with integer-arithmetic formula
- `QFInput` and `QFResult` contract-type structs for cross-contract invocation
- `QFContract::calculate_qf` Soroban entry point
- Babylonian method integer square root implementation
- `QFError` enum with 7 variants covering all error conditions
- Property-based tests using `proptest`
  - Deterministic calculation property
  - Zero-contribution zero-funding property
  - Invariant tests: total distributed ≤ pool, no negative payouts, monotonicity
- Negative-path tests for invalid inputs (zero pool, negative pool, empty contributions, below threshold)
- Deterministic re-invocation test verifying no state mutation

### Security
- All arithmetic uses `checked_mul`/`checked_div` to prevent overflow
- Returns `QFError::Overflow` on arithmetic failure
- Input validation for pool amounts and contributions

### Design
- Pure mathematical computation library per ADR-004
- No persistent storage, no access control, no initialization required
- Stateless and permissionless — authorization boundary lives in caller (`crowdfund`)
- Independent of `contracts/common` crate

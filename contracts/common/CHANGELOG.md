# common Changelog

All notable changes to the common crate are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-28

### Added
- Initial extraction of shared RBAC and error-handling primitives per issue #834
- `CommonError` enum (`Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`, `AlreadyExists`, `NotInitialized`)
- `AccessControl` struct with `require_role_auth`, `require_stored_auth`, `require_persistent_auth`, `is_stored_role`
- `EventEmitter` struct with domain-specific event emission methods
- `topics` module with 27 `Symbol` constants for event topic definitions
- `validate_positive_amount` function
- `EVENT_SCHEMA_VERSION` constant for event schema versioning
- `test_utils::setup_env` helper for test environments
- `math` module with shared basis-point arithmetic utilities (`apply_bps`, `apply_bps_saturating`, `proportional`, `BASIS_POINTS_MAX`, `REWARD_DIVISOR`)
- Property-based unit tests for all math functions

### Changed
- Extracted shared auth checks from crowdfund into `access_control.rs` per issue #1147
- Consolidated event emission patterns via `events.rs` per issue #1250
- Centralized metadata keys and hardened upgrade guards per issue #2febe313
- Removed dead `rbac.rs` and `AccessControl::require_role`/`is_member` per issue #923
- Fixed duplicate `[features]` section in `Cargo.toml`
- Added `math` module to extract shared fee/ratio calculations from crowdfund per issue #1340
- Renamed crowdfund `ContributionRecord` → `ContributionHistory` and `Milestone` → `FundingMilestone` per issue #1338
- Removed dead `Milestone` struct from achievements contract per issue #1338

### Security
- `CommonError` provides base error variants with `From<CommonError> for ContractError` mapping
- `AccessControl` ensures role-based authorization checks are consistent
- `validate_positive_amount` prevents zero/negative amount operations

### Testing
- Added access-control unit tests per issues #1165, #1167, #1168
- Added property tests for math functions verifying no precision loss
- Added tests for overflow/underflow handling in all math utilities

### Documentation
- Added comprehensive `README.md` with crate overview and adoption status
- Added ADR-004 reference for Soroban contract module boundaries
- Documented versioning policy for contract upgrades

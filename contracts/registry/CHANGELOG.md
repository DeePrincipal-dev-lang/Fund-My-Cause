# registry Changelog

All notable changes to the registry contract are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-28

### Added
- Initial implementation of the campaign registry/discovery contract
- Project registration, update, verification, and archiving
- Admin management with role-based access control
- Lookup and search functionality
- `FeeConfig` struct for registration fees (`registration_fee_bps`, `update_fee_bps`, `verify_fee_bps`)

### Changed
- Split `lib.rs` entrypoints from business logic per issue #1251
- Extracted shared auth checks into `common::AccessControl` per issue #1147
- Consolidated event emission patterns via `contracts/common/src/events.rs` per issue #1250
- Added privilege escalation coverage for all `admin.rs` functions per issue #1146
- Replaced `unwrap()` calls with proper error handling per issue #933
- Gas optimization and dead-code removal per issue #1251
- Resolved issues #966–#969

### Fixed
- Made CI checks pass per issue #54672ea3
- Resolved issues #958–#961 (unit tests, validation hardening)
- Fixed registry access-control tests per issue #926

### Security
- Added privilege escalation tests for all admin functions per issue #1146
- Implemented `AccessControl::require_stored_auth` for admin verification
- Replaced `unwrap()` calls with proper error handling

### Testing
- Added admin access-control tests per issue #926
- Added privilege escalation test suite
- Added regression suites and validation hardening per issue #0da0202c
- Added `lookup.rs` integration tests
- Added `privilege_escalation.rs` tests

### Documentation
- Added `README.md` with contract overview and usage
- Added `REGRESSION_DETECTION.md` for benchmark monitoring

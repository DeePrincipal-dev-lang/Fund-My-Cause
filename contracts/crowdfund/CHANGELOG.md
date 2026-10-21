# crowdfund Changelog

All notable changes to the crowdfund contract are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Replaced duplicated proportional calculations in vesting, stream claims, cancellation refunds, and rewards with `common::math::proportional` (#1558).
- Reused `common::math::ratio_bps` for campaign progress and success-rate analytics (#1558).

## [0.1.0] - 2026-03-28

### Added
- Initial release of the crowdfund contract
- Core crowdfunding lifecycle (initialize, contribute, withdraw, refund)
- Platform fee configuration with basis-point based rates
- Recurring contribution support
- Delegation and authorization model
- Campaign metadata and category management

### Changed
- **Event naming/topic migration (issue #1572):** Event names and topics are now aligned with the achievements contract under a single documented convention (see `docs/adr/`). Indexers must update their handlers:
  - Event names use `PascalCase` (e.g. `CampaignInitialized`, `ContributionReceived`, `CampaignWithdrawn`, `RefundIssued`).
  - Topic 0 is the event name as a `Symbol`; topic 1 is the primary subject (e.g. campaign id or contributor address).
  - Previously emitted names/topics are no longer emitted; replaying historical ledgers requires mapping the old names to the new ones.
- Decomposed monolithic `lib.rs` into modular files (`access`, `analytics`, `contribute`, `lifecycle`, `metadata`, `recurring`, `refund`, `security`, `storage`, `validation`, `views`, `withdraw`) per issues #1137–#1144
- Extracted shared access control checks into `common::AccessControl` per issue #1147
- Guarded all previously unguarded arithmetic against overflow per issue #1145
- Optimized storage access patterns in `views.rs` per issue #1148
- Consolidated event emission patterns via `contracts/common/src/events.rs` per issue #1250

### Fixed
- Resolved compile errors from prior merge conflicts
- Fixed panic regression sources identified via `tests/panic_regression.rs`
- Wired refund module into contract implementation
- Made CI checks pass

### Security
- Added WASM and benchmark safeguards
- Centralized metadata keys and hardened upgrade guards

### Testing
- Added panic regression tests per issue #1249
- Added adversarial and invariant test suites
- Added arithmetic safety tests with property-based testing
- Added regression suites and validation hardening

### Documentation
- Added comprehensive rustdoc comments to all public entry points
- Added `MUTATION_TESTING.md` and `OPTIMIZATIONS.md`

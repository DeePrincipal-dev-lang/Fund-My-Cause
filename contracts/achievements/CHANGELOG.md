# achievements Changelog

All notable changes to the achievements contract are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Re-exported `common::AchievementsError` as `ContractError`, keeping achievement error codes 1–17 stable while removing the duplicate local enum (#1557).
- Reused `common::math::proportional` and `REWARD_DIVISOR` for contribution point conversion (#1558).
- Aligned event naming and topic conventions with the crowdfund contract per issue #1572
  - Event symbols now follow the documented convention in `docs/adr/` (see ADR on event naming)
  - **Migration note:** off-chain indexers and consumers must update event/topic filters to match the
    renamed events. Old event names are no longer emitted; re-index historical ledgers if a unified
    handler is required across achievements and crowdfund contracts.

## [0.1.0] - 2026-03-28

### Added
- Initial implementation of the achievements/NFT badge contract
- 13 achievement types with tiered rarity system (common → legendary)
- Gamification points system with level calculation
- Leaderboard functionality (points, contributions, achievements, referrals)
- Challenge and activity tracking system
- AchievementRecord v2 compact storage format
- Contribution points calculation (1 point per million stroops)
- Streak calculation for daily contributions

### Changed
- Optimized storage layout to reduce ledger footprint per issue #920
  - Eliminated 3 redundant fields from stored `AchievementNFT`
  - Dropped `DataKey::Level` (derived on-the-fly)
  - Removed `user` and `nft_id` from stored value (recomputed at read time)
  - Net savings: up to 1 ledger entry + ~1,404 bytes per fully-unlocked user
- Replaced `unwrap()` calls with proper error handling per issue #933
- Removed duplicate test setup boilerplate across contracts per issue #935
- Replaced deprecated `register_contract` with `register` in tests
- Added `ContributionRecord` and `Milestone` domain structs

### Fixed
- Resolved issues #966–#969 (test cleanup, edge cases, load test results)
- Fixed achievements state machine per issue #924
- Resolved issues #950, #951, #952 (test cleanup, achievements edge cases)
- Fixed 7 pre-existing leaderboard unit test failures

### Testing
- Added unit tests for issues #958–#961
- Added access-control tests per issue #926
- Added concurrent claims tests
- Added leaderboard property tests
- Added adversarial tests
- Added benchmark groups in `achievements_benchmarks.rs`

### Documentation
- Added comprehensive rustdoc comments to all public entry points per issue #934
- Added `CONTRIBUTION_RECORD` and `REFERRAL_RECORD` documentation

### Security
- Replaced deprecated `register_contract` with `register` in tests
- Fixed privilege escalation coverage per issue #1146

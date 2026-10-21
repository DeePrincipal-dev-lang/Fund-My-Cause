# Fund-My-Cause Achievements Contract

A Soroban smart contract for managing user achievements, NFT badges, points, leaderboards, and
gamification on the Fund My Cause platform.

## What it does

| Entry point | Auth | Description |
|-------------|------|-------------|
| `initialize(admin, platform)` | `admin.require_auth()` | One-time setup |
| `unlock_achievement(user, type, metadata)` | `user.require_auth()` | User claims a self-declared achievement (types 2, 5, 6, 8–13) |
| `record_contribution(user, campaign_id, amount)` | `user.require_auth()` | Records a contribution; auto-unlocks threshold achievements |
| `record_referral(referrer, referee)` | `referrer.require_auth()` | Records a referral; auto-unlocks Referral Champion |
| `update_streak(user)` | `user.require_auth()` | Bumps the daily contribution streak |
| `award_user_points(user, points)` | admin | Manually award points (admin only) |
| `get_achievements(user)` | none | Returns all `AchievementNFT` for the user |
| `get_points(user)` | none | Returns accumulated points |
| `get_level(user)` | none | Returns derived level (1–100, from points) |
| `get_leaderboard(type, limit)` | none | Top-N leaderboard for a given type |

---

## Coverage Baseline (Issue #959)

> **Note:** The `cargo` toolchain is not installed in the development container.
> This baseline was established by code-review analysis of
> `contracts/achievements/src/*.rs` against the test files in
> `contracts/achievements/tests/` and the inline `#[cfg(test)]` blocks inside
> `src/leaderboard.rs`. Run `cargo llvm-cov -p achievements` in CI
> (see `.github/workflows/contract-coverage.yml`) to obtain the precise
> machine-measured figure.

| Module | Functions | Covered | Estimated line coverage | Notes |
|--------|-----------|---------|------------------------|-------|
| `src/leaderboard.rs` | `add_leaderboard_entry`, `get_leaderboard`, `get_user_rank`, `update_leaderboard_entry`, `reindex_user`, `get_score`, `get_index`, `set_index` | All | ~97% | Extensive inline `#[cfg(test)]` block covers sort order, limit truncation, accumulation, and type independence |
| `src/achievements.rs` | `get_user_achievements`, `has_achievement`, `store_achievement_record`, `count_achievements`, `get_achievement_unlock_time` *(dead code)*, `get_achievement_holders` *(dead code)* | Partial | ~78% | `get_achievement_unlock_time` and `get_achievement_holders` are `#[allow(dead_code)]` and have no tests |
| `src/points.rs` | `award_points`, `get_user_points`, `get_user_level`, `calculate_level_from_points`, `deduct_points` *(dead code)*, `reset_points` *(dead code)* | Partial | ~60% | `deduct_points` and `reset_points` are `#[allow(dead_code)]` — no tests exist for them |
| `src/lib.rs` | All public entry points + `store_achievement`, `try_auto_unlock`, `generate_nft_id` | Partial | ~80% | `update_streak` and `record_referral` are not tested by integration tests |
| `src/validation.rs` | Achievement type validation, point calculation | All | ~95% | Covered by unlock tests (valid/invalid type, boundary values) |
| `src/errors.rs` | `ContractError` (re-export of `common::AchievementsError`) | All variants reachable | ~100% | Shared enum in `common`; all error paths exercised via `try_*` calls |
| `src/storage.rs` | `DataKey` variants | All | ~90% | Storage keys exercised through all entry points |
| `src/types.rs` | Type definitions | ~85% | ~85% | `AchievementNFT` v1 compatibility path in `read_achievement_entry` not tested |
| **Combined estimate** | | | **~80%** | Two modules below 70% — see follow-up issues below |

### Modules below 70% coverage

#### 1. `src/points.rs` — Estimated ~60%

The `deduct_points` and `reset_points` functions are marked `#[allow(dead_code)]` with no test coverage:

- `deduct_points`: contains an `InsufficientPoints` error branch that is never exercised.
- `reset_points`: has no test at all.

**Filed follow-up:** Add unit tests for `deduct_points` (success path, `InsufficientPoints` error path) and `reset_points` within a `#[cfg(test)]` block in `src/points.rs`. Scope: ~6 new test cases, ~30 min effort.

#### 2. `src/achievements.rs` — Estimated ~78%

The dead-code functions `get_achievement_unlock_time` and `get_achievement_holders` are not tested. Additionally, the v1→v2 backwards-compatibility path in `read_achievement_entry` (the `AchievementNFT` fallback branch) has no test.

**Filed follow-up:** Add a test that stores a v1 `AchievementNFT` directly via `env.storage().instance().set(…)` and then calls `get_achievements(user)` to exercise the fallback decode path. Scope: ~3 test cases, ~45 min effort.

### Other low-coverage paths (not below 70%, but notable)

- `src/lib.rs`: `update_streak` and `record_referral` entry points have no integration tests in `contracts/achievements/tests/`. The auto-unlock path triggered by `record_contribution` once the referral counter crosses the threshold is also untested.
- `src/types.rs`: The `AchievementNFT` v1 legacy struct is defined but the backwards-compatibility decode in `read_achievement_entry` is not directly tested (estimated 0% for that branch).

---

## Running tests locally

```bash
# Requires Rust + wasm32 target
cargo test -p achievements
```

## Running coverage locally

```bash
cargo llvm-cov -p achievements --summary-only
```

See [`.github/workflows/contract-coverage.yml`](../../.github/workflows/contract-coverage.yml)
for the full CI pipeline. The workspace threshold is **80%** — achievements is estimated to be
right at that boundary; the dead-code functions in `points.rs` are the most likely cause of a
CI failure if the threshold is applied per-contract.

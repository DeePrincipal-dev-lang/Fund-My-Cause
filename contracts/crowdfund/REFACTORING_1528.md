# Refactoring #1528: Split lib.rs into Domain Modules

## Overview

This document outlines the systematic refactoring to reduce `lib.rs` from 3,899 lines to <800 lines while preserving the public contract ABI.

## Current State

- **File**: `contracts/crowdfund/src/lib.rs`
- **Size**: 3,899 lines
- **Functions**: 157 pub fn entry points
- **Structure**: Single massive `#[contractimpl]` block containing all public methods

## Target State

- **Size**: <800 lines (reduction of ~80%)
- **Structure**: Thin dispatcher that:
  1. Declares `#[contract]` and `#[contractimpl]` blocks
  2. Delegates each method to domain modules
  3. Re-exports types and helpers
  4. Maintains exact ABI surface

## Refactoring Strategy

### Phase 1: Create Dispatcher Module Structure

The existing domain modules are well-organized. Consolidate their public entry points by:

1. **Keep existing modules as-is**: 
   - `lifecycle.rs` - initialization, cancellation, archiving
   - `contribute.rs` - contributions and delegation
   - `refund.rs` - refunds and matching sponsor logic
   - `withdraw.rs` - withdrawal and streaming
   - `access.rs` - whitelist, blacklist, pause/resume
   - `views.rs` - read-only getters (25+ functions)
   - `analytics.rs` - stats, metrics, validation
   - `metadata.rs` - title, description, IPFS CID
   - `recurring.rs` - scheduled contributions
   - `helpers.rs` - shared utilities
   - `validation.rs` - input validation
   - `security.rs` - security primitives
   - `types.rs` - type definitions
   - `errors.rs` - error types
   - `events.rs` - event definitions
   - `storage.rs` - storage keys and constants

2. **Create dispatcher sub-module** (optional):
   - `contracts/crowdfund/src/dispatcher/mod.rs` - routes methods to domain modules
   - Or keep dispatching inline in lib.rs but heavily compress it

### Phase 2: Move Function Delegations

**Pattern**:
```rust
// BEFORE (in lib.rs)
pub fn contribute(env: Env, ...) -> Result<(), ContractError> {
    validate_preconditions(...)?;
    check_access(...)?;
    // ... 50+ lines of logic
}

// AFTER (in lib.rs)
pub fn contribute(env: Env, contributor: Address, amount: i128, token: Address, message: Option<String>) -> Result<(), ContractError> {
    contribute::contribute(env, contributor, amount, token, message)
}
```

### Phase 3: Reduce lib.rs to ~800 Lines

The new lib.rs will contain:

```rust
// 1. Module declarations (50 lines)
mod access;
mod analytics;
mod contribute;
// ... etc

// 2. Re-exports (150 lines)
pub use errors::ContractError;
pub use security::{...};
pub use storage::{...};
pub use types::{...};

// 3. #[contract] declaration (5 lines)
#[contract]
pub struct CrowdfundContract;

// 4. #[contractimpl] with 157 one-liner delegations (600 lines)
#[contractimpl]
impl CrowdfundContract {
    pub fn initialize(...) -> Result<(), ContractError> {
        lifecycle::initialize(...)
    }
    
    pub fn contribute(...) -> Result<(), ContractError> {
        contribute::contribute(...)
    }
    
    // ... 155 more simple delegations
}
```

## Function Categorization

### By Domain (157 functions total)

| Domain | Count | Functions |
|--------|-------|-----------|
| **lifecycle** | 7 | initialize, initialize_from_template, clone_campaign, cancel_campaign, archive, extend_deadline, adjust_goal |
| **contribute** | 5 | contribute, delegate_contribution, contribute_on_behalf, revoke_delegation, setup_recurring |
| **refund** | 4 | refund_single, refund_batch, refund_partial, refund_matching_sponsor |
| **withdraw** | 6 | withdraw, set_stream_config, claim_stream, setup_matching, get_matching_config, get_total_matched |
| **access** | 14+ | add_to_whitelist, set_whitelist_only, add_to_blacklist, set_visibility, pause, resume, set_rate_limit, ... |
| **views** | 25+ | total_raised, creator, status, goal, contribution, title, description, get_campaign_info, get_stats, ... |
| **metadata** | 3 | update_metadata, update_ipfs_cid, get_ipfs_cid |
| **analytics** | 6 | get_stats, get_qf_inputs, get_performance_metrics, get_analytics, validate_state, get_last_validation |
| **recurring** | 3 | setup_recurring, execute_recurring, cancel_recurring |
| **Governance / Disputes** | 8 | file_dispute, vote_on_dispute, resolve_dispute, ... |
| **Milestones** | 4 | set_milestones, get_milestones, verify_milestone, ... |
| **Emergency / Verification** | 12+ | initiate_emergency_withdrawal, approve_emergency_withdrawal, update_verification, ... |
| **Utilities / Debug** | 10+ | validate_state, debug_snapshot, debug_log, record_execution, ... |
| **Insurance / Yield / Governance** | 30+ | enable_insurance, configure_yield, setup_governance, ... |

## Verification Checklist

Before considering the refactoring complete:

- [ ] All 157 functions still have the same public signature
- [ ] No breaking changes to function parameter order or names
- [ ] All events are still published with identical structure
- [ ] Storage keys and constants are unchanged
- [ ] Type definitions remain identical
- [ ] Error types have identical variants
- [ ] `cargo test --workspace` passes
- [ ] WASM build succeeds (`cargo build --target wasm32-unknown-unknown --release`)
- [ ] ABI diff is empty (run before/after ABI extraction)

## Build Verification

```bash
# Before refactoring
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize --source-dir target/wasm32-unknown-unknown/release

# After refactoring
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize --source-dir target/wasm32-unknown-unknown/release

# Compare exported function names and signatures
# Must be identical between before and after
```

## Safety Considerations

### What WILL Change (Acceptable)

- File structure (functions moved to separate files)
- Compilation internal structure
- Binary layout (likely, due to Rust compiler inlining decisions)
- Internal indirection (delegation calls to other modules)

### What MUST NOT Change (Critical)

- Public function signatures (names, parameters, return types)
- Error types and variants
- Event structures and payloads
- Storage keys and key format
- Type definitions and field order
- Any behavior observable from outside the contract

## Implementation Notes

1. **No new helper functions**: Don't add utility wrappers beyond simple delegation.
2. **Preserve doc comments**: Keep all `///` documentation as-is.
3. **Maintain error handling**: Each delegation should still return the same error types.
4. **Event emission**: Ensure all events are still emitted inside domain modules, not in dispatcher.
5. **Authorization checks**: All auth checks (require_auth, auth_admin, etc.) must remain in domain modules.

## Testing Strategy

1. **Unit tests**: Run `cargo test` to verify domain module logic is unchanged.
2. **Integration tests**: Verify end-to-end flows still work.
3. **ABI comparison**: Extract contract ABI before and after, confirm no exported function changes.
4. **Gas/performance**: Run adversarial test suite to confirm no performance regression.

## References

- Issue #1528: Split contracts/crowdfund/src/lib.rs (4,177 lines) into domain modules
- Issue #835: Unwrap audit — documents safe vs unsafe unwrap() usage
- Issue #1148: Storage read optimizations with CachedInstanceView
- ADR patterns: Function categorization follows domain boundaries established in existing modules

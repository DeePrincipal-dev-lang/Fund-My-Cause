# Shared Error Enum Consolidation Audit

## Scope

Audit of the error enums defined by each contract crate:

- `contracts/common/src/error.rs` — `CommonError` (the shared base)
- `contracts/crowdfund/src/errors.rs` — `ContractError`
- `contracts/qf/src/lib.rs` — `QFError`
- `contracts/achievements/src/errors.rs` — `ContractError`
- `contracts/registry/src/errors.rs` — `ContractError`

## Findings

`contracts/common/src/error.rs` already defines the shared base variants
(`Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`,
`AlreadyExists`, `NotInitialized`), and `crowdfund`, `achievements`, and
`registry` already implement `From<common::CommonError>` to compose those
shared variants into their own contract-specific error space while
preserving their existing, stable on-chain discriminants (each contract's
`#[contracterror]` enum keeps its own numbering rather than being replaced
by the shared enum, since Soroban error codes are part of the on-chain
interface and must not be renumbered).

Two gaps were found and fixed as part of this pass:

1. **Non-exhaustive `From` impls.** `CommonError` has six variants, but the
   `From<CommonError>` implementations in `contracts/crowdfund/src/errors.rs`
   and `contracts/achievements/src/errors.rs` only matched five —
   `NotInitialized` was missing from both `match` arms. This is a compile
   error under exhaustive matching and was the most concrete outstanding
   issue blocking full adoption of the shared error module. Fixed by adding:
   - `crowdfund`: `CommonError::NotInitialized -> ContractError::Unauthorized`
     (crowdfund has no dedicated "not initialized" variant; calls before
     init are already rejected the same way as unauthorized calls).
   - `achievements`: same mapping, same rationale.
   - `registry`: `CommonError::NotInitialized -> ContractError::NotInitialized`
     (registry already has an exact-match variant).

2. **`contracts/qf` did not participate in the shared error module at all.**
   `QFError` (in `contracts/qf/src/lib.rs`) is a small, calculation-focused
   enum with no auth/init/lookup concept (the QF contract's only entry point,
   `calculate_qf`, is a pure computation with no storage or `require_auth`).
   Added `common` as a dependency of the `qf` crate and implemented
   `From<common::CommonError> for QFError`, mapping each shared variant to
   the closest existing domain-specific case, so any future stateful QF
   entry point can reuse the conversion instead of introducing a parallel
   `Unauthorized`/`NotFound` pair.

## Result

| Crate | Composes `CommonError`? | Notes |
|---|---|---|
| `contracts/common` | n/a (defines it) | Base enum: `Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`, `AlreadyExists`, `NotInitialized` |
| `contracts/crowdfund` | Yes | Fixed missing `NotInitialized` arm |
| `contracts/achievements` | Yes | Fixed missing `NotInitialized` arm |
| `contracts/registry` | Yes | Fixed missing `NotInitialized` arm (exact match available) |
| `contracts/qf` | Yes (new) | Added `common` dependency + `From` impl |

## Acceptance criteria status

- [x] Shared error module exists in `contracts/common` (`CommonError` in
      `contracts/common/src/error.rs`, pre-existing).
- [x] All contracts (`crowdfund`, `qf`, `achievements`, `registry`) reference
      it for common variants via `From<common::CommonError>`, with the two
      non-exhaustive-match gaps and the missing `qf` integration fixed in
      this pass.

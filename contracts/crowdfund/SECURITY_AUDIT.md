# Fund-Movement Entry Point Security Audit

Scope: every public entry point in `contracts/crowdfund` that moves funds
(`contribute`, `withdraw`, `refund_single` and related refund/streaming
paths) or mutates fund-relevant state, per the security-review task.

## Authorization review

| Entry point | Required signer | Enforcement |
|---|---|---|
| `contribute` | contributor | `contributor.require_auth()` before token transfer |
| `withdraw` | campaign creator | `creator.require_auth()` (creator loaded from storage, not caller-supplied) |
| `refund_single` | contributor requesting refund | `contributor.require_auth()` |
| `claim_stream` | stream beneficiary | `require_auth()` on the beneficiary address |
| `update_status` (registry, cross-referenced) | admin | admin address loaded from storage, `require_auth()` |

No entry point was found to accept an address parameter and skip
`require_auth`/`require_auth_for_args` on it before using that address to
authorize a fund movement. `contracts/crowdfund/src/access.rs` and
`contracts/crowdfund/src/security.rs` centralize the reentrancy-guard and
role checks used by these entry points.

## Checks-effects-interactions review

- `withdraw` (`contracts/crowdfund/src/withdraw.rs`) batches its storage
  reads up front, validates status/deadline/goal (checks), and the existing
  code comments already flag prior overflow hardening
  (`// Issue #1145: use checked_mul to prevent overflow`). The audit
  confirmed the released/withdrawn flag is written to storage before the
  `token_client.transfer` call, preventing a reentrant token from replaying
  the withdrawal.
- `refund_single` validates eligibility and computes the refundable amount
  before any transfer, and marks the contribution as refunded prior to
  invoking the token transfer.
- `contribute` updates running totals and per-contributor state before
  calling `token_client.transfer_from`/`transfer`, so a malicious token
  cannot re-enter mid-call and see stale totals.

## Regression tests added

New tests in `contracts/crowdfund/tests/security_audit_regression.rs`:

- `contribute_requires_contributor_auth`
- `withdraw_requires_creator_auth`
- `refund_requires_contributor_auth`
- `withdraw_cannot_be_replayed_after_success`
- `withdraw_before_goal_reached_is_rejected_without_transfer`

These pin the current audited behavior down as regressions for future
changes to the authorization or ordering of fund-moving entry points.

## Acceptance criteria status

- [x] All entry points confirmed to enforce correct authorization.
- [x] Checks-effects-interactions order verified for fund-moving functions.
- [x] New tests added covering the authorization and ordering guarantees
      above (no gap requiring a code fix was found during this pass; the
      existing `require_auth` placement and effects-before-transfer ordering
      were already correct and are now regression-tested).

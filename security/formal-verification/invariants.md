# Core Safety Invariants

This document defines the core safety invariants for the **crowdfund** and **qf** (quadratic funding) contracts, along with their formal specifications, verification methods, and current status.

---

## Crowdfund Invariants

### 1. Fund Conservation Invariant

**Statement**: `total_raised == sum(contributions[address])` for all contributors. No funds are created or destroyed by the contract.

**Formal spec**:
```
INVARIANT: For all addresses a: stored_contribution(a) == sum(transactions[a])
INVARIANT: total_refunded + total_withdrawn + fees_collected <= total_contributed
```

**Verification method**: Property-based testing via proptest (150 cases).
**Test file**: `contracts/crowdfund/tests/invariants.rs`
**Status**: Implemented and passing.

**Test coverage**:
- `prop_conservation_refunds_equal_contributions_on_failed_campaign` — verifies that on a failed campaign, every contributor is refunded exactly what they contributed and the contract balance reaches zero.
- `prop_conservation_withdrawal_equals_contributions_no_fee` — verifies that on a successful campaign without fees, the creator receives exactly the total contributions.
- `prop_conservation_withdrawal_with_fee_sums_to_contributions` — verifies that `creator_payout + fee_collected == total_contributed` when a platform fee is active.
- `prop_conservation_double_refund_does_not_exceed_contribution` — verifies that replaying a refund does not return more than the original contribution.
- `prop_conservation_partial_refunds_balance_tracks_remaining` — verifies that after any subset of refunds, the contract balance equals the sum of unrefunded contributions.

---

### 2. Refund Safety Invariant

**Statement**: `refund_single(addr)` can only be called when `status == Failed` or `status == Cancelled`. After refund: `contribution(addr) == 0`.

**Formal spec**:
```
INVARIANT: status == Failed OR status == Cancelled -> refund_allowed
INVARIANT: After refund_single(addr): contribution(addr) == 0
```

**Verification method**: Deterministic tests in `contracts/crowdfund/tests/invariants.rs`.
**Test file**: `test_invariant_no_double_refund`, `test_invariant_contribution_zero_after_refund`
**Status**: Implemented and passing.

**Test coverage**:
- `test_invariant_no_double_refund` — verifies that calling `refund_single` twice on the same contributor returns the same balance the second time (idempotent), and that `contribution(addr)` remains 0 after the first refund.
- `test_invariant_contribution_zero_after_refund` — verifies that after a refund, the contributor's stored contribution is 0 and the contract balance reflects the refund.

---

### 3. Access Control Invariant

**Statement**: Only the creator can call `withdraw()`, `update_metadata()`, `cancel_campaign()`. Only the admin can call `pause()`, `resume()`.

**Formal spec**:
```
INVARIANT: caller == creator AND status == Success -> withdraw_allowed
INVARIANT: caller == admin -> pause_allowed
```

**Verification method**: Negative-path tests in `contracts/crowdfund/tests/adversarial.rs`.
**Status**: Partially implemented.

**Known gaps**: Full formal verification of access control across all function entry points is partially covered. Adversarial tests verify that unauthorized callers cannot perform sensitive operations, but complete coverage of all role-based transitions requires additional test cases.

---

### 4. State Transition Validity Invariant

**Statement**: Campaign status can only transition through valid directions. No invalid transitions such as `Success -> Failed` or `Failed -> Active` are possible.

**Formal spec**:
```
INVARIANT: IsValidStatusTransition(old_status, new_status)
Valid transitions:
  Active -> Success (deadline passed AND goal reached)
  Active -> Failed (deadline passed AND goal not reached)
  Active -> Cancelled (creator before deadline)
  Success -> Archived (after withdrawal period)
  Failed -> Archived (after refund period)
```

**Verification method**: Deterministic tests in `contracts/crowdfund/src/invariant_test.rs` and TLA+ specification in `properties.tla` (`StatusConsistency` invariant).
**Test file**: `contracts/crowdfund/src/invariant_test.rs`
**Status**: Implemented and passing.

---

## QF Invariants

### 1. Pool Conservation Invariant

**Statement**: `total_distributed <= matching_pool`. No matching funds are created.

**Formal spec**:
```
INVARIANT: total_distributed <= input.matching_pool
INVARIANT: remaining_pool >= 0
```

**Verification method**: Property-based testing via proptest.
**Test file**: `contracts/qf/src/tests/invariants.rs`
**Status**: Implemented and passing.

**Test coverage**:
- `invariant_total_distributed_leq_pool` — verifies across 100+ randomized cases that total distributed never exceeds the matching pool and remaining pool is non-negative.
- `invariant_conservative_pooling` — verifies that the sum of all allocations does not exceed the pool across randomized inputs.

---

### 2. Non-Negative Payouts Invariant

**Statement**: All allocations in `QFResult.allocations` are non-negative.

**Formal spec**:
```
INVARIANT: For all recipients r: allocations[r] >= 0
INVARIANT: total_distributed >= 0
```

**Verification method**: Property-based testing via proptest.
**Test file**: `contracts/qf/src/tests/invariants.rs`
**Status**: Implemented and passing.

**Test coverage**:
- `invariant_no_negative_payouts` — verifies across 100+ randomized cases that every allocation value is non-negative.
- `test_invariant_one_recipient_full_pool` — edge case verifying that a single recipient receives a non-negative allocation.

---

### 3. Monotonicity Invariant

**Statement**: More contributions -> More funding. Increasing any contribution value cannot decrease any recipient's allocation.

**Formal spec**:
```
INVARIANT: contributions' >= contributions -> allocations' >= allocations
```

**Verification method**: Property-based testing via proptest.
**Test file**: `contracts/qf/src/tests/invariants.rs`
**Status**: Implemented (weak form - tested via `invariant_monotonicity`).

**Test coverage**:
- `invariant_monotonicity` — verifies that when a recipient has more contributions than another, the total distributed is non-negative and within bounds. This is a weaker form of monotonicity; the full strong monotonicity property (that increasing contributions strictly increases allocations) is not yet proven due to the complexity of the quadratic funding formula.

---

### 4. Zero Contributions → Zero Funding Invariant

**Statement**: If all contributions are zero, no funding is distributed.

**Formal spec**:
```
INVARIANT: All contributions == 0 -> total_distributed == 0 AND error == NoContributions
```

**Verification method**: Property-based testing via proptest.
**Test file**: `contracts/qf/src/tests/invariants.rs`
**Status**: Implemented and passing.

**Test coverage**:
- `invariant_zero_contrib_zero_funding` — verifies that zero contributions always result in a `NoContributions` error.
- `test_invariant_equal_contributions_equal_payouts` — verifies that equal contributions lead to approximately equal payouts (fairness property).

---

## Verification Approach and Limitations

### Tools Used

| Tool | Purpose | Status |
|------|---------|--------|
| **proptest** | Property-based testing for runtime invariant verification | Active |
| **TLA+** (`properties.tla`) | Formal specification of state machine properties | Active |
| **Deterministic tests** | Edge case and specific scenario verification | Active |
| **TLA+ Model Checker** | Exhaustive state exploration (not yet run) | Planned |
| **Coq** | Interactive theorem proving for critical properties | Planned |

### Coverage Summary

| Invariant | Contract | Method | Status |
|-----------|----------|--------|--------|
| Fund Conservation | Crowdfund | Proptest (150 cases) | Passing |
| Refund Safety | Crowdfund | Deterministic | Passing |
| Access Control | Crowdfund | Adversarial tests | Partial |
| State Transitions | Crowdfund | Deterministic + TLA+ | Passing |
| Pool Conservation | QF | Proptest | Passing |
| Non-Negative Payouts | QF | Proptest | Passing |
| Monotonicity | QF | Proptest (weak form) | Passing (weak) |
| Zero Contributions | QF | Proptest | Passing |

### Known Limitations

1. **Front-running attacks** — Stellar/Soroban network behavior (e.g., transaction ordering) is outside contract scope and cannot be verified by these invariants.
2. **Sybil attacks** — Identity verification is off-chain; invariant checks assume honest participant behavior.
3. **Oracle failures** — External price feeds and data sources are assumed honest; no formal model of oracle failure modes.
4. **Strong monotonicity** — The full monotonicity property for QF (that increasing any contribution strictly increases any recipient's allocation) has not been proven; only a weak form is tested.
5. **TLA+ model checking** — The `properties.tla` specifications have been written but have not been executed through a TLA+ model checker (e.g., TLC). Automated verification against these specs is a future enhancement.
6. **Concurrent operations** — While Soroban is single-threaded, multi-contract interactions and cross-contract calls are not fully covered by current invariant tests.
7. **Storage overflow** — Edge cases involving maximum storage values and integer overflows require additional formal treatment.

### Future Enhancements

1. **Automated Proof Generation** — Use formal methods tools to generate proofs from TLA+ specs.
2. **Symbolic Execution** — Explore all possible execution paths using tools like K-Framework.
3. **Model Checking** — Run TLC model checker against `properties.tla` for exhaustive state verification.
4. **Theorem Proving** — Use Coq or Lean for interactive proofs of the most critical properties (e.g., fund conservation).
5. **Full Monotonicity Proof** — Formal proof of the strong monotonicity property for QF allocations.
6. **Adversarial Coverage** — Expand `adversarial.rs` to cover all access control edge cases and role-based transitions.

# Formal Verification Specifications

This directory contains formal specifications for critical properties of the Fund-My-Cause smart contract.

## Overview

Formal verification provides mathematical guarantees that the contract behaves correctly under all inputs and conditions. This is especially important for financial contracts where bugs can result in loss of funds.

## Specifications

### 1. Conservation of Funds

**Property**: Total funds tracked by the contract equals total contributions minus refunds.

**Mathematical Form**:
```
invariant: total_raised >= total_refunded
invariant: total_withdrawn <= total_raised
invariant: total_raised + total_withdrawn >= 0
```

**Why It Matters**: Prevents money creation/destruction bugs.

**Verification Method**: Check after each contribution, withdrawal, and refund operation.

### 2. State Transition Validity

**Property**: Campaign status can only transition in valid directions.

**Valid Transitions**:
```
Active -> Success (if deadline passed and goal reached)
Active -> Failed (if deadline passed and goal not reached)
Active -> Cancelled (by creator before deadline)
Success -> Archived (after withdrawal period)
Failed -> Archived (after refund period)
```

**Invalid Transitions**: 
- Success -> Failed
- Failed -> Active
- Archived -> any state

**Verification Method**: Guard state transitions with precondition checks.

### 3. Access Control

**Property**: Only authorized addresses can perform sensitive operations.

**Rules**:
```
withdraw() requires: caller == creator AND status == Success
refund_single() requires: status == Failed AND caller has_contribution
update_metadata() requires: caller == creator AND status == Active
initialize() requires: called once AND caller == creator
```

**Verification Method**: Access control lists enforced at function entry.

### 4. Reentrancy Safety

**Property**: No function can be called recursively while state is inconsistent.

**Implementation**: 
```
acquire_lock() -> execute_function() -> release_lock()
```

**Verification Method**: Lock state is checked and validated.

### 5. Deadline Enforcement

**Property**: Campaign phases are locked to correct time periods.

**Rules**:
```
contributions allowed: current_time < deadline
withdrawals allowed: current_time >= deadline AND status == Success
refunds allowed: current_time >= deadline AND status == Failed
```

**Verification Method**: Time checks at start of operations.

### 6. Input Bounds

**Property**: All numeric inputs are within safe bounds.

**Constraints**:
```
goal > 0 AND goal <= i128::MAX
deadline > now
min_contribution >= 0
platform_fee <= 10000 basis points
```

**Verification Method**: Input validation before state modification.

### 7. Contribution Tracking

**Property**: Individual contributions are correctly tracked and can be refunded.

**Invariant**:
```
for all addresses a:
  sum(contributions[a]) == current_balance[a]
sum(all contributions) == total_raised
```

**Verification Method**: Balance verification on query operations.

## Tools for Verification

### Runtime Verification
- **Slither** - Static analysis for Rust contracts
  ```bash
  slither contracts/crowdfund/src/lib.rs
  ```

### Manual Specification
- **TLA+** - Temporal Logic of Actions for state machine verification
- **Coq** - Proof assistant for critical properties

### Dynamic Testing
- **Fuzz Testing** - Random input generation to find edge cases
- **Property-Based Testing** - Test assertions that should hold for all inputs

## Critical Functions to Verify

### 1. `initialize()`
```
Pre: not initialized
Post: 
  - status == Active
  - deadline > now
  - goal > 0
  - creator is set
  - token is set
```

### 2. `contribute(amount)`
```
Pre: 
  - status == Active
  - deadline > now
  - amount >= min_contribution
Post:
  - total_raised increased by amount
  - contributor balance increased by amount
  - contributor is in contributors list
```

### 3. `withdraw()`
```
Pre:
  - caller == creator
  - deadline <= now
  - total_raised >= goal
  - status == Success
Post:
  - creator balance increased
  - funds transferred
  - status cannot change after
```

### 4. `refund_single(contributor)`
```
Pre:
  - deadline <= now
  - status == Failed
  - contribution[contributor] > 0
Post:
  - contributor balance decreased by contribution
  - contributor receives funds
  - contribution[contributor] == 0
```

## Testing Strategy

### Unit Tests (80% coverage target)
- Individual function behavior
- Edge case handling
- Error conditions

### Integration Tests
- Multi-step workflows (contribute -> withdraw)
- State consistency across operations
- Concurrent operations handling

### Fuzz Tests
- Random input generation
- Invariant checking after each operation
- Coverage-guided exploration

### Property-Based Tests
- `prop_conservation_of_funds`
- `prop_status_transitions_valid`
- `prop_access_control_enforced`
- `prop_refunds_equal_contributions`

## Proof of Key Properties

### Property: Funds Cannot Be Created

```
Proof Sketch:
1. Funds only enter through contribute(): total += contribution
2. Funds only leave through withdraw() or refund_single()
   - withdraw(): total -= amount (when goal reached)
   - refund_single(): contributor_balance -= contribution
3. All operations preserve: total_in >= total_out
Therefore: No funds created
```

### Property: All Contributors Can Recover Funds if Goal Not Met

```
Proof Sketch:
1. If goal not met, status becomes Failed
2. Each contributor c can call refund_single() if:
   - status == Failed
   - contribution[c] > 0
3. Refund amount = contribution[c]
4. No authorization needed beyond proving contribution exists
Therefore: All can always refund
```

## Limitations

### Properties We Cannot Formally Verify
- **Front-running attacks** - Stellar/Soroban network behavior is outside contract scope
- **Sybil attacks** - Identity verification is off-chain
- **Oracle failures** - External price feeds are assumed honest

### Properties Requiring External Verification
- **Token contract correctness** - Assuming XLM and whitelisted tokens are secure
- **Stellar runtime security** - Assuming Soroban VM is secure

## Future Enhancements

1. **Automated Proof Generation** - Use formal methods tools to generate proofs
2. **Symbolic Execution** - Explore all possible execution paths
3. **Model Checking** - Verify finite-state properties exhaustively
4. **Theorem Proving** - Interactive proofs for complex properties

## References

- [Soroban Security Model](https://soroban.stellar.org/docs/learn/security)
- [Formal Methods for Smart Contracts](https://arxiv.org/abs/1911.04640)
- [Proof Techniques for Security](https://en.wikipedia.org/wiki/Formal_verification)

## Verified Invariants

This section documents which invariants have been formally specified and verified, and which remain gaps.

### Specified and Verified

The following invariants are formally specified in `properties.tla` (TLA+) and verified through property-based tests using **proptest**:

| # | Invariant | Contract | Spec File | Test File | Method | Status |
|---|-----------|----------|-----------|-----------|--------|--------|
| 1 | Conservation of Funds | Crowdfund | `properties.tla` (ConservationOfFunds) | `contracts/crowdfund/tests/invariants.rs` | Proptest (150 cases) | Passing |
| 2 | Refund Safety | Crowdfund | `properties.tla` (StatusConsistency) | `contracts/crowdfund/tests/invariants.rs`, `contracts/crowdfund/tests/adversarial.rs` | Deterministic + Proptest | Passing |
| 3 | Access Control | Crowdfund | `properties.tla` (implicit) | `contracts/crowdfund/tests/adversarial.rs` | Negative-path tests | Partial |
| 4 | State Transitions | Crowdfund | `properties.tla` (ValidTransitions) | `contracts/crowdfund/src/invariant_test.rs` | Deterministic | Passing |
| 5 | Pool Conservation | QF | `properties.tla` (ConservationOfFunds) | `contracts/qf/src/tests/invariants.rs` | Proptest | Passing |
| 6 | Non-Negative Payouts | QF | `properties.tla` (NonNegativeContributions) | `contracts/qf/src/tests/invariants.rs` | Proptest | Passing |
| 7 | Monotonicity | QF | `properties.tla` (weak form) | `contracts/qf/src/tests/invariants.rs` | Proptest (weak) | Passing (weak) |

Detailed invariant specifications are documented in [`invariants.md`](./invariants.md).

### Tools Used

- **proptest** — Property-based testing for runtime invariant verification with configurable case counts (100–150 cases per property).
- **TLA+** (`properties.tla`) — Formal temporal logic specifications for state machine properties including ConservationOfFunds, ValidTransitions, StatusConsistency, and NonNegativeContributions.
- **Deterministic tests** — Edge case and specific scenario verification in `contracts/crowdfund/src/invariant_test.rs` and `contracts/crowdfund/tests/invariants.rs`.
- **Adversarial tests** — Negative-path and attack scenario testing in `contracts/crowdfund/tests/adversarial.rs`.

### Coverage and Limitations

**Covered**:
- All core financial conservation laws for both crowdfund and qf contracts.
- State transition validity and deadline enforcement.
- Refund idempotency and double-spend prevention.
- Platform fee conservation (creator + fee == contributions).

**Known Gaps**:
- **Front-running attacks** — Stellar/Soroban network transaction ordering is outside contract scope.
- **Sybil attacks** — Identity verification is off-chain; invariants assume honest participants.
- **Oracle failures** — External data feeds are assumed honest; no formal model of oracle failure.
- **Strong monotonicity** — Only a weak form of monotonicity is tested for QF; the full strong property is not yet proven.
- **TLA+ model checking** — `properties.tla` specs have not been run through a TLC model checker; this is planned as a future enhancement.
- **Concurrent cross-contract interactions** — Multi-contract call sequences are not fully covered by current invariant tests.
- **Storage overflow** — Edge cases with maximum storage values require additional formal treatment.
- **Complete access control verification** — Full formal verification of all role-based transitions across every function entry point is partially implemented.

### Future Enhancements

1. **Automated Proof Generation** — Use formal methods tools to generate proofs from TLA+ specs.
2. **Symbolic Execution** — Explore all possible execution paths using tools like K-Framework.
3. **Model Checking** — Run TLC model checker against `properties.tla` for exhaustive state verification.
4. **Theorem Proving** — Use Coq or Lean for interactive proofs of the most critical properties.
5. **Full Monotonicity Proof** — Formal proof of the strong monotonicity property for QF allocations.
6. **Adversarial Coverage** — Expand `adversarial.rs` to cover all access control edge cases and role-based transitions.
7. **Coq Verification** — Move critical invariants (fund conservation, refund safety) from proptest to Coq for machine-checked proofs.

# Pull-Based Refund Model

How Fund-My-Cause handles refunds when a campaign fails or is cancelled, and why this design was chosen over the alternative.

---

## The Two Models

### Push-based (what we don't do)

A single transaction loops over every contributor and sends each one their money back:

```
refund_all() {
    for contributor in contributors {
        transfer(contract → contributor, amount[contributor])
    }
}
```

This is simple to reason about but breaks in practice:

- **Gas / resource ceiling** — Soroban enforces per-transaction CPU and memory limits. A campaign with thousands of contributors will hit those limits and the transaction will be rejected. There is no way to refund everyone atomically.
- **Single point of failure** — one bad address or one failed sub-transfer aborts the entire transaction. Every contributor is blocked until the root cause is fixed.
- **Griefing vector** — a malicious contributor can deliberately make their account unrefundable (e.g. by closing it), permanently bricking the refund for everyone else.

### Pull-based (what we do)

Each contributor calls `refund_single` themselves to claim their own money:

```
refund_single(contributor) {
    verify eligibility
    amount = storage[contributor]
    transfer(contract → contributor, amount)
    storage[contributor] = 0
}
```

Every refund is an independent transaction. One failure has zero effect on anyone else.

---

## Eligibility

`refund_single` succeeds when either condition is true:

1. **Campaign cancelled** — creator called `cancel_campaign()`, status is `Cancelled`
2. **Goal not reached** — `ledger.timestamp() >= deadline` AND `total_raised < goal`

```rust
pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
    let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();

    if status != Status::Cancelled {
        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() < deadline {
            return Err(ContractError::CampaignStillActive);
        }
        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
        if total >= goal {
            return Err(ContractError::GoalReached);
        }
    }

    let key = DataKey::Contribution(contributor.clone());
    let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
    if amount > 0 {
        let token_address: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address)
            .transfer(&env.current_contract_address(), &contributor, &amount);
        env.storage().persistent().set(&key, &0i128);
        env.events().publish(("campaign", "refunded"), (contributor, amount));
    }
    Ok(())
}
```

Key details:
- Returns `Ok(())` even when `amount == 0` — idempotent, safe to call multiple times
- Sets the stored amount to `0` after transfer — prevents double-refund
- No status transition: the campaign stays `Active` (or `Cancelled`) while individual refunds are claimed; the `Refunded` status is a logical state derived from the deadline/goal check, not a stored transition

---

## Gas Efficiency

Each `refund_single` call touches exactly:

| Operation | Storage type | Cost |
|---|---|---|
| Read `KEY_STATUS` | Instance | cheap |
| Read `KEY_DEADLINE` / `KEY_GOAL` / `KEY_TOTAL` | Instance | cheap |
| Read `DataKey::Contribution(addr)` | Persistent | moderate |
| `token.transfer(contract → contributor)` | Cross-contract | moderate |
| Write `DataKey::Contribution(addr) = 0` | Persistent | moderate |

The cost is constant regardless of how many other contributors exist. A campaign with 10,000 contributors costs the same per-refund as one with 10.

A push-based `refund_all` would scale linearly — and would fail entirely past a few hundred contributors due to Soroban's per-transaction resource limits.

---

## Scalability

Contributor data is stored in **persistent storage** keyed by address:

```rust
// Written on each contribution
env.storage().persistent().set(&DataKey::Contribution(contributor.clone()), &new_amount);
env.storage().persistent().extend_ttl(&key, 100, 100);
```

There is no hard cap on the number of contributors. The `contributor_list` view function paginates with a cap of 50 per call to avoid memory pressure, but the underlying storage is unbounded.

---

## Edge Cases

### Contributor has already claimed

`refund_single` reads the stored amount and only transfers if `amount > 0`. A second call is a no-op — no error, no double-transfer.

### Contributor never contributed

`unwrap_or(0)` means an address with no contribution record gets `amount = 0` and the function returns `Ok(())` without touching the token contract.

### Campaign succeeded but contributor calls refund

```rust
if total >= goal {
    return Err(ContractError::GoalReached);
}
```

Blocked. Funds belong to the creator once the goal is met.

### Deadline not yet passed and campaign not cancelled

```rust
if env.ledger().timestamp() < deadline {
    return Err(ContractError::CampaignStillActive);
}
```

Blocked. Contributors cannot pull funds out of an active campaign.

### Persistent storage entry expires (TTL)

Soroban persistent entries have a TTL. The contract extends TTL on every contribution:

```rust
env.storage().persistent().extend_ttl(&key, 100, 100);
```

If a contributor waits a very long time after a failed campaign and their entry has expired, `get` returns `None`, `unwrap_or(0)` returns `0`, and the refund silently does nothing. The tokens would be stranded in the contract. Mitigation: contributors should claim refunds promptly after a campaign fails, and the frontend should surface this urgency.

### Creator cancels after partial contributions

`cancel_campaign` sets status to `Cancelled` immediately. All contributors can then call `refund_single` at any time. There is no race condition — each contributor's balance is independent.

---

## Frontend Integration

The frontend checks eligibility before building the transaction:

```ts
// Eligible if cancelled, or deadline passed and goal not met
const canRefund =
  status === "Cancelled" ||
  (Date.now() / 1000 >= deadline && totalRaised < goal);

if (canRefund && contribution > 0) {
  await contract.refund_single({ contributor: address });
}
```

The `contribution()` view function lets the UI show each user their claimable balance without a transaction:

```ts
const claimable = await contract.contribution({ contributor: address });
```

---

## Test Coverage

`refund_single` (the flow above) is exercised end-to-end in
`e2e/refund-flow.spec.ts`, including a multi-contributor scenario proving the
pull-based property directly: several independent wallet identities each
claim their own refund from the same failed campaign without waiting on or
being blocked by one another.

`refund_batch` and `refund_partial` (also defined on `CrowdfundContract` in
`contracts/crowdfund/src/lib.rs`) have no frontend surface — `apps/interface`
only ever builds `refund_single` transactions — so there is nothing for a
browser-level E2E test to drive for either. Their coverage lives at the
contract level instead, in `contracts/crowdfund/src/test.rs`:

- `refund_batch`: `refund_batch_refunds_multiple_contributors`,
  `refund_batch_skips_already_refunded`,
  `refund_batch_fails_when_campaign_still_active`,
  `refund_batch_rejects_before_deadline_when_not_cancelled`,
  `refund_batch_rejects_when_goal_reached`
- `refund_partial`: `refund_partial_within_limit_succeeds`,
  `refund_partial_exceeding_50_percent_is_rejected`,
  `refund_partial_updates_total_raised`

If a batch-claim or partial-refund UI is ever built, `e2e/refund-flow.spec.ts`
should gain a matching scenario and this note should be trimmed accordingly.

---

## Summary

| Property | Pull-based (this contract) | Push-based |
|---|---|---|
| Scales to N contributors | ✅ O(1) per refund | ❌ O(N), hits resource limit |
| One failure blocks others | ✅ No | ❌ Yes |
| Griefing resistance | ✅ Yes | ❌ No |
| Contributor must act | ⚠️ Yes | ✅ No |
| TTL expiry risk | ⚠️ Yes (claim promptly) | ✅ N/A |

The trade-off is that contributors must initiate their own refund. The frontend makes this a single button click, and the contract is safe to call multiple times, so the UX cost is minimal compared to the reliability gains.

# Gas Optimization & Event Documentation

## WASM Size Budget

The release profile in the workspace root is intentionally optimized for a small wasm payload:

- `opt-level = "z"`
- `lto = true`
- `codegen-units = 1`
- `strip = "symbols"`
- `panic = "abort"`

For the crowdfund contract, the practical size budget is 256 KiB for the release artifact in CI. This keeps deployment costs predictable on Stellar while preserving the full security and upgrade surface.

Local verification:

```bash
python scripts/check_wasm_size.py --artifact target/wasm32-unknown-unknown/release/crowdfund.wasm --budget 262144
```

A build that exceeds the threshold should be treated as a size regression and investigated before deployment.

## Storage Optimization Techniques

### 1. Batch Instance Reads (contribute, withdraw, refund_single, refund_batch)

**Before:** Each validation step called `env.storage().instance().get(...)` independently,
paying the storage-access overhead on every call.

**After:** All instance-storage reads are hoisted to the top of the function into a single
`let inst = env.storage().instance();` binding, then all `.get()` calls are made through
that binding before any branching logic.

```rust
// Before — repeated storage handle creation
let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
let min: i128      = env.storage().instance().get(&KEY_MIN).unwrap();
let deadline: u64  = env.storage().instance().get(&KEY_DEADLINE).unwrap();

// After — single handle, all reads up-front
let inst = env.storage().instance();
let status: Status = inst.get(&KEY_STATUS).unwrap();
let min: i128      = inst.get(&KEY_MIN).unwrap();
let deadline: u64  = inst.get(&KEY_DEADLINE).unwrap();
```

### 2. Eliminate Redundant Persistent Reads (contribute)

**Before:** `DataKey::Contribution(contributor)` was read twice — once for the max-cap
check and again after the token transfer.

**After:** The contributor's existing balance is read once into `prev_contrib` and reused
for both the cap check and the post-transfer write.

### 3. Cache `ledger().timestamp()` (contribute)

**Before:** `env.ledger().timestamp()` was called separately for the deadline check and
the rate-limit window check.

**After:** Called once into `let now = env.ledger().timestamp();` and reused.

### 4. Eliminate Duplicate `extend_ttl` (withdraw)

**Before:** `env.storage().instance().extend_ttl(17280, 518400)` was called twice in
`withdraw()` — once before the status write and once after.

**After:** A single `inst.extend_ttl(17280, 518400)` call after all writes.

### 5. Batch Instance Writes (initialize)

**Before:** Each field was written with a separate `env.storage().instance().set(...)` call.

**After:** All writes go through a single `let storage = env.storage().instance();` binding.

### 6. Token Address Cached in refund_batch

**Before:** `env.storage().instance().get(&KEY_TOKEN)` was called inside the loop for
every contributor.

**After:** The token address and `token::Client` are created once before the loop and
reused for all transfers.

### 7. Conditional Writes Only When Needed

`LargestContribution` and `ContributorCount` are only written when the value actually
changes, avoiding unnecessary storage writes.

### 8. Hoist `KEY_PLATFORM`, `KEY_GROSS_TOTAL`, `KEY_INSURANCE`, `MatchingConfig` into Upfront Batch (contribute)

**Before:** Four instance-storage reads occurred after the token transfer:
- `inst.get(&KEY_GROSS_TOTAL)` — read inside the fee tracking block
- `inst.get::<_, PlatformConfig>(&KEY_PLATFORM)` — re-fetched inside the fee block
- `inst.get::<_, InsuranceConfig>(&KEY_INSURANCE)` — re-fetched inside the insurance block
- `inst.get::<_, MatchingConfig>(&DataKey::MatchingConfig)` — re-fetched inside the matching block

**After:** All four reads are hoisted into the single upfront batch alongside the existing
reads (`KEY_STATUS`, `KEY_MIN`, etc.), giving a single contiguous ledger-entry access
before any branching or token operations.

```rust
// Before — scattered mid-function reads
let gross_total: i128 = inst.get(&KEY_GROSS_TOTAL).unwrap_or(0);            // after transfer
if let Some(ref config) = inst.get::<_, PlatformConfig>(&KEY_PLATFORM) {…}  // after transfer
let insurance_fee = inst.get::<_, InsuranceConfig>(&KEY_INSURANCE)…;        // after fee calc
if let Some(config) = inst.get::<_, MatchingConfig>(&DataKey::MatchingConfig) {…} // later

// After — all reads in the upfront batch
let platform_config: Option<PlatformConfig>  = inst.get(&KEY_PLATFORM);
let gross_total: i128                        = inst.get(&KEY_GROSS_TOTAL).unwrap_or(0);
let insurance_config: Option<InsuranceConfig> = inst.get(&KEY_INSURANCE);
let matching_config: Option<MatchingConfig>  = inst.get(&DataKey::MatchingConfig);
```

**Gas impact:** Eliminates 4 redundant instance-storage handle dereferences that
previously occurred post-transfer. On Soroban, each `storage().instance()` read incurs
a ledger-entry access overhead; batching them together amortises this cost.

**Benchmark:** `contribute_with_platform_fee` was added to `contract_benchmarks.rs`
to exercise and document the before/after on the `OnContribution` fee path.

---

## Event Reference

All state-changing operations emit structured events using typed payload structs defined
in `types.rs`. This makes events indexable and forward-compatible.

| Topic | Payload Type | Emitted When |
|---|---|---|
| `("campaign", "initialized")` | `EventInitialized` | Campaign created via `initialize()` |
| `("campaign", "contributed")` | `EventContributed` | Contribution accepted via `contribute()` |
| `("campaign", "withdrawn")` | `EventWithdrawn` | Creator withdraws via `withdraw()` |
| `("campaign", "refunded")` | `EventRefunded` | Full refund claimed via `refund_single()` or `refund_batch()` |
| `("campaign", "partial_refund")` | `EventPartialRefund` | Partial refund via `refund_partial()` |
| `("campaign", "status_changed")` | `EventStatusChanged` | Any status transition (cancel, pause, unpause) |
| `("campaign", "cancelled")` | `()` | Campaign cancelled via `cancel_campaign()` |
| `("campaign", "paused")` | `()` | Campaign paused via `pause()` |
| `("campaign", "unpaused")` | `()` | Campaign resumed via `unpause()` |
| `("campaign", "metadata_updated")` | `EventMetadataUpdated` | Metadata updated via `update_metadata()` |
| `("campaign", "deadline_extended")` | `EventDeadlineExtended` | Deadline extended via `extend_deadline()` |
| `("campaign", "extension_proposed")` | `EventExtensionProposed` | Extension proposal created |
| `("campaign", "extension_voted")` | `EventExtensionVoted` | Vote cast on extension |
| `("campaign", "extension_executed")` | `EventExtensionExecuted` | Extension executed after voting |
| `("campaign", "recurring_setup")` | `EventRecurringSetup` | Recurring plan created |
| `("campaign", "recurring_executed")` | `EventRecurringExecuted` | Recurring contribution triggered |
| `("campaign", "recurring_cancelled")` | `EventRecurringCancelled` | Recurring plan cancelled |
| `("campaign", "delegation_created")` | `EventDelegationCreated` | Delegation created |
| `("campaign", "delegated_contribution")` | `EventDelegatedContribution` | Contribution made via delegation |
| `("campaign", "delegation_revoked")` | `EventDelegationRevoked` | Delegation revoked |
| `("campaign", "whitelisted")` | `EventWhitelisted` | Address added to whitelist |
| `("campaign", "whitelist_removed")` | `EventWhitelistRemoved` | Address removed from whitelist |
| `("campaign", "blacklisted")` | `EventBlacklisted` | Address added to blacklist |
| `("campaign", "blacklist_removed")` | `EventBlacklistRemoved` | Address removed from blacklist |
| `("campaign", "whitelist_only_set")` | `EventWhitelistOnlySet` | Whitelist-only mode toggled |
| `("campaign", "rate_limit_updated")` | `EventRateLimitUpdated` | Rate limit changed |
| `("campaign", "emergency_initiated")` | `EventEmergencyInitiated` | Emergency withdrawal initiated |
| `("campaign", "emergency_executed")` | `EventEmergencyExecuted` | Emergency withdrawal executed |
| `("campaign", "emergency_cancelled")` | `()` | Emergency withdrawal cancelled |
| `("insurance", "enabled")` | `EventInsuranceEnabled` | Insurance enabled |
| `("insurance", "payout")` | `EventInsurancePayout` | Insurance payout processed |
| `("registry", "registered")` | `Address` | Campaign registered in registry |

### Event Payload Fields

**EventContributed**
- `contributor` — address that contributed
- `amount` — amount contributed in this transaction
- `new_total` — contributor's cumulative total after this contribution
- `matched_amount` — sponsor-matched amount added (0 if no matching)

**EventWithdrawn**
- `creator` — campaign creator address
- `total` — total raised before fee deduction
- `fee` — platform fee deducted (0 if no platform config)
- `payout` — net amount transferred to creator

**EventRefunded**
- `contributor` — address receiving the refund
- `amount` — refund amount

**EventPartialRefund**
- `contributor` — address receiving the partial refund
- `amount` — amount refunded
- `remaining` — contributor's remaining balance after refund

**EventStatusChanged**
- `old_status` — previous campaign status
- `new_status` — new campaign status

**EventDeadlineExtended**
- `old_deadline` — previous deadline timestamp
- `new_deadline` — new deadline timestamp

**EventExtensionVoted**
- `contributor` — voter address
- `approve` — true = vote for, false = vote against
- `vote_weight` — voting weight (equal to contributor's total contribution)

**EventExtensionExecuted**
- `new_deadline` — the new deadline that was set
- `votes_for` — total weighted votes in favour
- `votes_against` — total weighted votes against

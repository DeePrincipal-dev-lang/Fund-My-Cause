# ADR-007: Stellar Contract Upgrade Strategy & State Migration

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Smart Contract Engineering Team, Security Maintainers

---

## Context

Decentralized crowdfunding contracts manage user funds, contributor pledges, platform fees, and milestone distributions on the Stellar blockchain. Over the lifecycle of Fund-My-Cause, contract logic inevitably requires bug fixes, gas optimizations, security hardening (such as reentrancy guards and circuit breakers), and storage layout evolutions.

However, smart contract upgrades introduce significant security and operational risks:
1. **Address Immutability:** External consumers (the Next.js frontend, mobile wallet adapters, indexers, and registry contracts) store contract IDs. Changing contract IDs on every release would break bookmarks, deep links, indexer history, and active crowdfunding pledges.
2. **State & Fund Safety:** Contributor pledges and campaign parameters stored in instance/persistent storage must remain intact and accessible across code versions without loss of funds.
3. **Decentralization & Governance:** Upgrades must be restricted to authorized administrators or multi-sig controllers and be fully auditable on-chain.

We needed a defined, test-verified upgrade and migration strategy for `contracts/crowdfund` and `contracts/registry`.

---

## Decision

We adopt **Soroban native in-place WASM upgradeability** (`env.deployer().update_current_contract_wasm(...)`) coupled with **additive storage versioning** and **lazy/explicit state migration functions**.

### 1. Upgrade Mechanism (`contracts/crowdfund` & `contracts/registry`)

- **In-Place Bytecode Replacement:** The deployed contract exposes an `upgrade` entry point gated by admin authorization:
  ```rust
  pub fn upgrade(env: Env, new_wasm_hash: soroban_sdk::BytesN<32>) {
      let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
      admin.require_auth();
      env.deployer().update_current_contract_wasm(new_wasm_hash);
  }
  ```
- **Storage Preservation:** All instance and persistent storage keys remain untouched at the same contract address.
- **Compile-Time & Runtime Versioning:** Contracts export a compile-time `CONTRACT_VERSION: u32` constant via a `version()` view function, synchronized with Cargo semantic versioning.

### 2. State Migration Strategy

- **Additive Changes (Default):** New features introduce new storage keys with default/fallback handling (e.g., `unwrap_or_default()`), requiring zero storage migration steps.
- **Breaking Data Restructuring:** For struct field changes or enum migrations, a temporary admin-guarded `migrate` function is invoked immediately after bytecode deployment and removed in the subsequent release.
- **Continuous Backward Compatibility Testing:** Storage layout stability and cross-version migrations are tested via `contracts/crowdfund/tests/upgrade_tests.rs`.

---

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **1. Native Soroban in-place WASM update (`update_current_contract_wasm`)** | • Preserves contract address<br>• Zero transfer of escrowed funds needed<br>• Native runtime support with minimal gas overhead<br>• Preserves indexer history | • Requires disciplined storage key discipline<br>• Admin key must be secured with multi-sig | **Accepted (Chosen)** |
| **2. EVM-style Proxy Pattern (ERC-1967 / DELEGATECALL)** | • Familiar to Ethereum developers | • Unnecessary complexity in Soroban<br>• Extra call indirection and gas costs<br>• Soroban host natively supports WASM replacement | **Rejected** |
| **3. Immutable Non-Upgradeable Contracts** | • Maximum trust minimization<br>• Impossible for admin to change rules maliciously | • Critical bugs cannot be patched<br>• Requires migrating entire campaign balances to new contracts on every feature release | **Rejected** |
| **4. Factory Deprecate & Redeploy (New Address per Release)** | • Clean isolation between versions | • Breaks external URLs and registry discovery<br>• High friction for ongoing active campaigns<br>• Indexers must reconcile multiple contract addresses per campaign | **Rejected** |

---

## Consequences

### Positive
- **Stable Contract Identifiers:** Frontends, indexers, and registry contracts retain identical contract IDs across contract logic updates.
- **Safe Escrow Management:** Crowdfunding balances remain locked in the contract instance without requiring risky balance transfers between contracts.
- **Test-Driven Upgrade Verification:** All upgrade paths are covered by automated unit and migration tests in `upgrade_tests.rs`.
- **Auditable On-Chain Upgrades:** WASM hash updates emit standard Stellar ledger events for full transparency.

### Negative / Trade-offs
- **Admin Key Security Requirement:** The `KEY_ADMIN` key becomes a high-value security target, requiring hardware security or multi-sig protection for production deployments.
- **Storage Key Immutability:** Developers must ensure existing symbol keys (e.g., `"GOAL"`, `"CREATOR"`, `"TOKEN"`) are never repurposed or renamed without an explicit migration path.

---

## References

- [Contract Upgrade Guide](../contract-upgrades.md)
- [Contract Upgrade Testing Guide](../contract-upgrade-testing.md)
- [Crowdfund Upgrade Test Suite (Rust)](../../contracts/crowdfund/tests/upgrade_tests.rs)
- [Stellar Developer Docs: Upgrading Contracts](https://developers.stellar.org/docs/learn/smart-contract-internals/contract-upgrades)

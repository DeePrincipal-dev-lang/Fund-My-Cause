# ADR-006: Unify Frontend Chain Read Paths via GraphQL API

- **Status:** Proposed
- **Date:** 2026-08-22
- **Deciders:** Core Engineering Team

## Context

In the initial architecture of Fund-My-Cause, `apps/interface` had two distinct, independent mechanisms for reading Stellar / Soroban on-chain state, documented as **Seam 1** in `docs/assets/architecture-data-flow.mmd`:

1. **Direct RPC / Horizon Path (`apps/interface/src/lib/soroban.ts`):** Components and hooks invoked functions such as `fetchCampaignView`, `fetchCampaign`, `fetchContribution`, `fetchContributorList`, `fetchAllCampaigns`, and `fetchTransactionHistory`. These functions constructed temporary in-browser `SorobanRpc.Server` and `Horizon.Server` instances to perform view simulations (`simulateTransaction`) and account operation queries directly against the Stellar RPC and Horizon endpoints.
2. **GraphQL API Read Path (`services/graphql-api`):** The Apollo Server service exposed queries (`campaign`, `campaigns`, `campaignDetail`, `contributions`, `user`, `stats`) backed by `ContractService` (which also performs `simulateTransaction` calls to Soroban RPC) fronted by a Redis cache and DataLoader batching.

Having two parallel frontend read paths introduced several critical problems:

- **State Divergence & Inconsistency:** Pages and components querying via direct Soroban RPC could read different state from those querying via `graphql-api`. Direct RPC reads bypassed Redis cache invalidations triggered during mutation workflows (such as `recordContribution`), leading to UI tearing.
- **Duplicated Transformation Logic:** Data normalization helpers (`normalizeCampaignInfo`, `normalizeCampaignStats`, status parsing, BigInt conversion) were maintained separately in both `apps/interface/src/lib/soroban.ts` and `services/graphql-api/src/services/contract.ts` / `resolvers.ts`.
- **Client Bundle Bloat & RPC Rate Limits:** Executing unfiltered contract view simulations and unbounded Horizon operation requests directly from client browsers increased client bundle sizes and exposed public RPC nodes to uncoordinated client queries without server-side caching or rate-limiting protections.
- **Maintenance Overhead:** Developers had to decide on an ad-hoc basis which read path to use for new views, violating the architecture outlined in ADR-003.

## Decision

Standardize on **Option (a): Funnel all browser chain state reads through `graphql-api`**.

1. **Deprecate and remove read-only query functions from `apps/interface/src/lib/soroban.ts`:**
   - `fetchCampaignView`, `fetchCampaign`, `fetchContribution`, `fetchContributorList`, `fetchAllCampaigns`, `getStaticCampaignIds`, and `fetchTransactionHistory` are deprecated and replaced by typed GraphQL queries in `apps/interface/src/lib/graphql/` (leveraging `client.ts` and codegen types).
2. **Preserve `apps/interface/src/lib/soroban/` strictly as the Client-Side Transaction Pipeline:**
   - Client-side transaction preparation, offline authorization assembly, fee estimation, simulation, and signed submission cannot be offloaded to a central server without custody of user private keys.
   - The following functions remain client-side, now split across `lib/soroban/client.ts` (shared Horizon/RPC connections), `lib/soroban/tx-builders.ts`, and `lib/soroban/submit.ts` (re-exported from `lib/soroban/index.ts`):
     - Transaction builders: `buildInitializeTx`, `buildWithdrawTx`, `buildCancelTx`, `buildPauseTx`, `buildUnpauseTx`, `buildRefundTx`, `buildUpdateMetadataTx`, `buildContributeTx`.
     - Transaction simulation & fee estimation: `simulateTx`.
     - Signed transaction broadcast: `submitSignedTx`.
3. **Enhance `services/graphql-api` and frontend GraphQL client:**
   - All frontend queries consume the typed GraphQL SDK generated from `services/graphql-api/src/schema.ts`.
   - `ContractService` and Redis in `services/graphql-api` serve as the single source of truth for contract state reads.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Status Quo (Dual Paths)** | No immediate code migration required. | Inconsistent data models; cache invalidation bypass; duplicate parsing logic; uncoordinated RPC load from client browsers; documented architectural seam. |
| **Option (a): Unified GraphQL API Read Path (Selected)** | Single source of truth; centralized Redis caching; DataLoader batching; shared schema & TypeScript codegen; smaller client bundle; consistent data models workspace-wide; clean separation of reads (GraphQL) vs writes (client-side Soroban). | Extra network hop for uncached reads; frontend read availability depends on `graphql-api` health. |
| **Option (b): Shared Read SDK / Package shared between frontend and API** | Deduplicates serialization code; allows direct browser RPC calls without `graphql-api`. | Does not solve cache divergence; bypasses Redis; puts RPC node rate-limiting burdens on browser clients; still leaves two ways to read chain state in the architecture. |

## Consequences

**Good:**
- **Single Source of Truth:** All UI views (campaign details, lists, dashboards, profile views, leaderboards, transaction history) receive consistent data structures from a single API layer.
- **Centralized Caching & RPC Protection:** `services/graphql-api` caches contract responses in Redis and coalesces duplicate requests via DataLoader, drastically reducing redundant RPC calls to Stellar nodes.
- **Smaller Client Bundle:** Frontend client no longer bundles redundant Soroban view decoding libraries for read flows.
- **Clear Architectural Separation:** The boundary between reads (GraphQL API + Redis) and writes (client-side unsigned XDR construction + Freighter / WalletConnect signing + Horizon submission) is sharp and unambiguous.

**Bad / trade-offs:**
- **Network Hop Overhead:** An uncached read involves browser $\rightarrow$ `graphql-api` $\rightarrow$ Soroban RPC, adding a minor server latency overhead compared to a direct browser-to-RPC call. This is mitigated by Redis caching and server-to-RPC proximity in production deployments.
- **Service Dependency:** `apps/interface` read operations depend on `graphql-api` service uptime. Health checks (`/healthz`, `/readyz`, `/status`) and observability are required to ensure high availability.

## References

- [Issue #1053](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/1053) — Unify the two frontend $\rightarrow$ chain read paths (`lib/soroban.ts` vs `graphql-api`)
- [ADR-002](./ADR-002-off-chain-indexer-architecture.md) — Off-chain indexer architecture
- [ADR-003](./ADR-003-graphql-api-for-frontend-queries.md) — GraphQL API for frontend queries
- [`docs/assets/architecture-data-flow.mmd`](../assets/architecture-data-flow.mmd) — Data flow diagram and Seam 1 resolution
- [`apps/interface/src/lib/soroban/`](../../apps/interface/src/lib/soroban/) — Client-side transaction pipeline
- [`services/graphql-api/src/services/contract.ts`](../../services/graphql-api/src/services/contract.ts) — Server-side contract read service

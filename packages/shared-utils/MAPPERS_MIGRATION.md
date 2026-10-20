# DTO Mapper Consolidation Guide (Issue #1132)

This guide explains how to consolidate duplicate DTO mapping logic between services by using the shared mappers from `@fund-my-cause/shared-utils`.

## Problem Statement

Both `services/graphql-api` and `services/indexer` independently map raw Soroban contract data to domain DTOs (Data Transfer Objects). This creates risk of:

- **Shape divergence**: Different field naming, missing fields, or type mismatches
- **Maintenance burden**: Changes to the contract schema require updates in multiple places
- **Inconsistent defaults**: Null/undefined handling differs between services
- **Redundant testing**: Mappers are tested separately in each service

## Solution

The `@fund-my-cause/shared-utils` package provides centralized DTO mappers:

- `mapCampaignFromRaw()` - Maps raw contract campaign info + stats to a consistent Campaign DTO
- `mapContribution()` - Maps contribution data from any source to a consistent Contribution DTO
- `mapCampaignStatus()` - Maps raw status strings to canonical CampaignStatus enum values

## Usage

### Mapping Campaign Data

```typescript
import {
  mapCampaignFromRaw,
  type RawCampaignInfo,
  type RawCampaignStats,
} from "@fund-my-cause/shared-utils";

// Get raw data from Soroban contract
const rawInfo: RawCampaignInfo = await contractService.getCampaignInfo(id);
const stats: RawCampaignStats = await contractService.getStats(id);

// Map to consistent DTO
const campaign = mapCampaignFromRaw(contractId, rawInfo, stats);

// campaign now has:
// - Consistent camelCase field names
// - Bigint values preserved for currency fields
// - ISO 8601 deadline string
// - Consistent status mapping
// - All optional fields with sensible defaults
```

### Mapping Contribution Data

```typescript
import { mapContribution } from "@fund-my-cause/shared-utils";

// Accept contribution data from any source
// (contract events, GraphQL input, indexer payload, etc.)
const rawContribution = {
  id: "contrib_123",
  campaignId: "campaign_456",
  contributor: "GB...",
  amount: 1000000,  // Can be number, string, or bigint
  timestamp: "2024-01-15T10:30:00Z",  // Can be string, number (ms), or bigint (seconds)
  transactionHash: "0xabc123",
};

// Map to consistent DTO
const contribution = mapContribution(rawContribution, "fallback_id");

// contribution.amount is guaranteed to be bigint
// contribution.timestamp is guaranteed to be ISO 8601 string
```

### Status Mapping

```typescript
import { mapCampaignStatus } from "@fund-my-cause/shared-utils";

const status = mapCampaignStatus("Active");  // → "Active"
const unknownStatus = mapCampaignStatus("Unknown");  // → "Active" (defaults)
```

## Migration Steps

### For graphql-api

1. Replace inline status mapping with `mapCampaignStatus()`
2. Replace manual campaign mapping with `mapCampaignFromRaw()`
3. Replace manual contribution mapping with `mapContribution()`
4. Remove now-redundant mapping test files
5. Import types from shared-utils: `MappedCampaign`, `MappedContribution`

### For indexer

1. When loading campaign data from contract, use `mapCampaignFromRaw()`
2. When storing contributions, use `mapContribution()` to normalize incoming data
3. Import mappers from `@fund-my-cause/shared-utils`
4. Update any existing mapper implementations to use shared versions
5. Update tests to use contract tests in `mapper-contract.test.ts`

## Shape Contract

The shape parity contract tests in `mapper-contract.test.ts` verify:

- ✓ All required fields are present
- ✓ Field names use consistent camelCase
- ✓ Bigint values are preserved for currency fields
- ✓ Timestamps are converted to ISO 8601 strings
- ✓ Optional fields have sensible defaults
- ✓ Unknown enums default to 'Active' instead of throwing
- ✓ Shape consistency across multiple mapper invocations

Run the contract tests to verify shape parity after any changes:

```bash
npm test --workspace=packages/shared-utils -- src/__tests__/mapper-contract.test.ts
```

## Field Mapping Reference

### Campaign Fields

| Raw Field | Mapped Field | Type | Notes |
|-----------|--------------|------|-------|
| (contractId arg) | id | string | Uses contractId argument |
| (contractId arg) | contractId | string | Uses contractId argument |
| creator | creator | string | |
| token | token | string | |
| goal | goal | bigint | Preserved from stats if available |
| (stats.total_raised) | raised | bigint | From stats; defaults to 0n |
| deadline | deadline | string | Converted to ISO 8601 |
| status | status | CampaignStatus | Mapped via mapCampaignStatus() |
| category | category | string | |
| min_contribution | minContribution | bigint | |
| max_contribution | maxContribution | bigint | |
| (stats.contributor_count) | totalContributors | number | From stats; defaults to 0 |
| has_platform_config | hasRBACEnabled | boolean | |
| platform_fee_bps | platformFeeBps | number \| undefined | Only if has_platform_config |
| (auto) | createdAt | string | Current ISO timestamp |
| (auto) | updatedAt | string | Current ISO timestamp |

### Contribution Fields

| Raw Field | Mapped Field | Type | Notes |
|-----------|--------------|------|-------|
| id | id | string | Fallback to fallbackId, then 'unknown' |
| campaignId | campaignId | string | Defaults to '' |
| contributor | contributor | string | Defaults to '' |
| amount | amount | bigint | Accepts bigint/string/number; coerced to bigint |
| timestamp | timestamp | string | Accepts string/number/bigint; converted to ISO 8601 |
| transactionHash | transactionHash | string | Defaults to '' |

## Benefits

✓ **Single source of truth** for DTO shapes across services
✓ **Reduced divergence risk** through centralized, tested mappers
✓ **Type safety** through shared TypeScript interfaces
✓ **Easier maintenance** when contract schema changes
✓ **Better testing** through contract tests verifying shape parity
✓ **Cleaner services** with less redundant mapping code
✓ **Consistent defaults** across all services

## Related Issues

- #903 - Extract shared DTO mappers
- #1124 - Resolver orphan audit
- #1130 - Remove unused GraphQL types
- #1131 - Modularize monitoring alert rules
- #1132 - Consolidate duplicate DTO mapping logic

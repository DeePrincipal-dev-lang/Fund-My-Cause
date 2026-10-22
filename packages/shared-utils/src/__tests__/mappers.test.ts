/**
 * Unit tests for packages/shared-utils/src/mappers.ts (#903).
 *
 * Covers:
 *  - mapCampaignStatus: all known values, unknown value default, empty string
 *  - mapCampaignFromRaw: complete mapping, null/undefined optional fields,
 *    bigint preservation, deadline conversion, status delegation
 *  - mapContribution: complete data, fallback id, undefined fields, bigint
 *    amount, bigint timestamp (Soroban epoch), string timestamp pass-through
 */

import { describe, it, expect } from "vitest";
import {
  mapCampaignStatus,
  mapCampaignFromRaw,
  mapContribution,
} from "../mappers";
import type {
  RawCampaignInfo,
  RawCampaignStats,
  RawContributionData,
} from "../mappers";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRawInfo(
  overrides: Partial<RawCampaignInfo> = {},
): RawCampaignInfo {
  return {
    creator: "GCREATOR",
    token: "native",
    goal: 1_000_000_000n,
    deadline: 1_800_000_000n, // Unix epoch seconds
    min_contribution: 10_000_000n,
    max_contribution: 0n,
    title: "Test Campaign",
    description: "A test campaign",
    status: "Active",
    category: "Technology",
    has_platform_config: false,
    platform_fee_bps: 0,
    platform_address: "",
    ...overrides,
  };
}

function makeRawStats(
  overrides: Partial<RawCampaignStats> = {},
): RawCampaignStats {
  return {
    total_raised: 500_000_000n,
    goal: 1_000_000_000n,
    contributor_count: 5,
    ...overrides,
  };
}

// ── mapCampaignStatus ──────────────────────────────────────────────────────

describe("mapCampaignStatus", () => {
  it("maps 'Active' to 'Active'", () => {
    expect(mapCampaignStatus("Active")).toBe("Active");
  });

  it("maps 'Successful' to 'Successful'", () => {
    expect(mapCampaignStatus("Successful")).toBe("Successful");
  });

  it("maps 'Refunded' to 'Refunded'", () => {
    expect(mapCampaignStatus("Refunded")).toBe("Refunded");
  });

  it("maps 'Cancelled' to 'Cancelled'", () => {
    expect(mapCampaignStatus("Cancelled")).toBe("Cancelled");
  });

  it("maps 'Paused' to 'Paused'", () => {
    expect(mapCampaignStatus("Paused")).toBe("Paused");
  });

  it("maps 'Archived' to 'Archived'", () => {
    expect(mapCampaignStatus("Archived")).toBe("Archived");
  });

  it("defaults unknown string to 'Active'", () => {
    expect(mapCampaignStatus("UNKNOWN_STATUS")).toBe("Active");
  });

  it("defaults empty string to 'Active'", () => {
    expect(mapCampaignStatus("")).toBe("Active");
  });

  it("is case-sensitive (lower 'active' defaults to 'Active')", () => {
    expect(mapCampaignStatus("active")).toBe("Active");
  });
});

// ── mapCampaignFromRaw ─────────────────────────────────────────────────────

describe("mapCampaignFromRaw", () => {
  it("maps a complete raw campaign object correctly", () => {
    const info = makeRawInfo();
    const stats = makeRawStats();
    const campaign = mapCampaignFromRaw("CCONTRACT123", info, stats);

    expect(campaign.id).toBe("CCONTRACT123");
    expect(campaign.contractId).toBe("CCONTRACT123");
    expect(campaign.title).toBe("Test Campaign");
    expect(campaign.description).toBe("A test campaign");
    expect(campaign.creator).toBe("GCREATOR");
    expect(campaign.token).toBe("native");
    expect(campaign.category).toBe("Technology");
    expect(campaign.status).toBe("Active");
    expect(campaign.hasRBACEnabled).toBe(false);
    expect(campaign.platformFeeBps).toBeUndefined();
  });

  it("preserves bigint values for goal, raised, minContribution, maxContribution", () => {
    const info = makeRawInfo({
      goal: 5_000_000_000n,
      min_contribution: 50_000_000n,
      max_contribution: 500_000_000n,
    });
    const stats = makeRawStats({
      total_raised: 2_500_000_000n,
      goal: 5_000_000_000n,
    });
    const campaign = mapCampaignFromRaw("CCONTRACT456", info, stats);

    expect(campaign.goal).toBe(5_000_000_000n);
    expect(campaign.raised).toBe(2_500_000_000n);
    expect(campaign.minContribution).toBe(50_000_000n);
    expect(campaign.maxContribution).toBe(500_000_000n);
  });

  it("converts deadline bigint (Unix epoch seconds) to ISO string", () => {
    // 1_700_000_000 seconds = 2023-11-14T22:13:20.000Z
    const info = makeRawInfo({ deadline: 1_700_000_000n });
    const campaign = mapCampaignFromRaw("C1", info);
    expect(campaign.deadline).toBe(
      new Date(1_700_000_000 * 1000).toISOString(),
    );
  });

  it("delegates status mapping to mapCampaignStatus", () => {
    const info = makeRawInfo({ status: "Successful" });
    const campaign = mapCampaignFromRaw("C2", info);
    expect(campaign.status).toBe("Successful");
  });

  it("defaults to 'Active' for unknown status", () => {
    const info = makeRawInfo({ status: "NotReal" });
    const campaign = mapCampaignFromRaw("C3", info);
    expect(campaign.status).toBe("Active");
  });

  it("includes platform fee when has_platform_config is true", () => {
    const info = makeRawInfo({
      has_platform_config: true,
      platform_fee_bps: 250,
      platform_address: "GPLATFORM",
    });
    const campaign = mapCampaignFromRaw("C4", info);
    expect(campaign.platformFeeBps).toBe(250);
    expect(campaign.hasRBACEnabled).toBe(true);
  });

  it("omits platformFeeBps when has_platform_config is false", () => {
    const info = makeRawInfo({
      has_platform_config: false,
      platform_fee_bps: 250,
    });
    const campaign = mapCampaignFromRaw("C5", info);
    expect(campaign.platformFeeBps).toBeUndefined();
  });

  it("uses goal from stats when both info and stats provide goal", () => {
    const info = makeRawInfo({ goal: 100n });
    const stats = makeRawStats({ goal: 999n });
    const campaign = mapCampaignFromRaw("C6", info, stats);
    expect(campaign.goal).toBe(999n);
  });

  it("falls back to info.goal when stats are absent", () => {
    const info = makeRawInfo({ goal: 777n });
    const campaign = mapCampaignFromRaw("C7", info);
    expect(campaign.goal).toBe(777n);
  });

  it("defaults totalContributors to 0 when stats absent", () => {
    const info = makeRawInfo();
    const campaign = mapCampaignFromRaw("C8", info);
    expect(campaign.totalContributors).toBe(0);
  });

it("defaults raised to 0n when stats absent", () => {
     const info = makeRawInfo();
     const campaign = mapCampaignFromRaw("C9", info);
     expect(campaign.raised).toBe(0n);
   });

   it("defaults missing optional info fields to their fallback values", () => {
     const minimalInfo = {
       creator: "GCREATOR",
       token: "native",
       goal: 1_000_000_000n,
       deadline: 0n,
       min_contribution: 0n,
       max_contribution: 0n,
       title: "Test Campaign",
       description: "A test campaign",
       status: "Active",
       category: "Technology",
       has_platform_config: false,
       platform_fee_bps: 0,
       platform_address: "",
     } as RawCampaignInfo;
     const campaign = mapCampaignFromRaw("C10", minimalInfo);
     expect(campaign.deadline).toBe(new Date(0).toISOString());
     expect(campaign.minContribution).toBe(0n);
     expect(campaign.maxContribution).toBe(0n);
     expect(campaign.token).toBe("native");
     expect(campaign.hasRBACEnabled).toBe(false);
   });
 });

// ── mapContribution ────────────────────────────────────────────────────────

describe("mapContribution", () => {
  it("maps complete raw contribution data correctly", () => {
    const raw: RawContributionData = {
      id: "contrib-001",
      campaignId: "CCAMPAIGN1",
      contributor: "GCONTRIBUTOR",
      amount: 100_000_000n,
      timestamp: "2024-01-01T00:00:00.000Z",
      transactionHash: "0xABCDEF",
    };
    const result = mapContribution(raw);

    expect(result.id).toBe("contrib-001");
    expect(result.campaignId).toBe("CCAMPAIGN1");
    expect(result.contributor).toBe("GCONTRIBUTOR");
    expect(result.amount).toBe(100_000_000n);
    expect(result.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(result.transactionHash).toBe("0xABCDEF");
  });

  it("uses fallbackId when id is missing", () => {
    const raw: RawContributionData = { campaignId: "C1" };
    const result = mapContribution(raw, "fallback-id-123");
    expect(result.id).toBe("fallback-id-123");
  });

  it("uses 'unknown' when both id and fallbackId are absent", () => {
    const raw: RawContributionData = {};
    const result = mapContribution(raw);
    expect(result.id).toBe("unknown");
  });

  it("handles undefined fields with sensible defaults", () => {
    const raw: RawContributionData = {};
    const result = mapContribution(raw);
    expect(result.campaignId).toBe("");
    expect(result.contributor).toBe("");
    expect(result.amount).toBe(0n);
    expect(result.transactionHash).toBe("");
    // timestamp defaults to epoch 0
    expect(result.timestamp).toBe(new Date(0).toISOString());
  });

  it("coerces string amount to bigint", () => {
    const raw: RawContributionData = { amount: "500000000" };
    const result = mapContribution(raw);
    expect(result.amount).toBe(500_000_000n);
  });

  it("coerces number amount to bigint", () => {
    const raw: RawContributionData = { amount: 250_000_000 };
    const result = mapContribution(raw);
    expect(result.amount).toBe(250_000_000n);
  });

  it("defaults amount to 0n for unparseable value", () => {
    const raw: RawContributionData = { amount: "not-a-number" as any };
    const result = mapContribution(raw);
    expect(result.amount).toBe(0n);
  });

  it("converts bigint Soroban epoch timestamp to ISO string", () => {
    // 1_700_000_000 seconds Unix epoch
    const raw: RawContributionData = { timestamp: 1_700_000_000n };
    const result = mapContribution(raw);
    expect(result.timestamp).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("passes ISO string timestamps through unchanged", () => {
    const isoStr = "2024-06-15T12:00:00.000Z";
    const raw: RawContributionData = { timestamp: isoStr };
    const result = mapContribution(raw);
    expect(result.timestamp).toBe(isoStr);
  });

  it("treats numeric timestamp as milliseconds (JS convention)", () => {
    const ms = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z in ms
    const raw: RawContributionData = { timestamp: ms };
    const result = mapContribution(raw);
    expect(result.timestamp).toBe(new Date(ms).toISOString());
  });

  it("handles empty string amount gracefully", () => {
    const raw: RawContributionData = { amount: "" as any };
    const result = mapContribution(raw);
    expect(result.amount).toBe(0n);
  });

  it("handles all fields present with null values", () => {
    const raw: RawContributionData = {
      id: null as any,
      campaignId: null as any,
      contributor: null as any,
      amount: null as any,
      timestamp: null as any,
      transactionHash: null as any,
    };
    const result = mapContribution(raw);
    expect(result.id).toBe("unknown");
    expect(result.campaignId).toBe("");
    expect(result.contributor).toBe("");
    expect(result.amount).toBe(0n);
    expect(result.timestamp).toBe(new Date(0).toISOString());
    expect(result.transactionHash).toBe("");
  });
});

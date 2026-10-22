/**
 * Contract tests for shared DTO mappers (Issue #1132)
 *
 * Verifies that both services (graphql-api and indexer) produce consistent
 * Campaign and Contribution shapes when using the shared mappers.
 *
 * This prevents shape divergence caused by inconsistent field naming,
 * missing fields, or different default values between services.
 */

import { describe, it, expect } from "vitest";
import {
  mapCampaignFromRaw,
  mapCampaignStatus,
  mapContribution,
  type RawCampaignInfo,
  type RawCampaignStats,
  type MappedCampaign,
  type MappedContribution,
} from "../mappers.js";
import type { CampaignStatus } from "@fund-my-cause/types";

describe("Mapper contract tests — shape parity (Issue #1132)", () => {
  describe("Campaign shape consistency", () => {
    it("should produce a Campaign with all required fields", () => {
      const rawInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Test Campaign",
        description: "A test campaign",
        status: "Active",
        category: "tech",
        has_platform_config: true,
        platform_fee_bps: 250,
        platform_address: "platform_address",
      };

      const stats: RawCampaignStats = {
        total_raised: 5000000n,
        goal: 10000000n,
        contributor_count: 5,
      };

      const mapped = mapCampaignFromRaw("CTEST123456789", rawInfo, stats);

      // Verify all required fields exist
      expect(mapped).toHaveProperty("id");
      expect(mapped).toHaveProperty("contractId");
      expect(mapped).toHaveProperty("title");
      expect(mapped).toHaveProperty("description");
      expect(mapped).toHaveProperty("creator");
      expect(mapped).toHaveProperty("goal");
      expect(mapped).toHaveProperty("raised");
      expect(mapped).toHaveProperty("deadline");
      expect(mapped).toHaveProperty("status");
      expect(mapped).toHaveProperty("category");
      expect(mapped).toHaveProperty("minContribution");
      expect(mapped).toHaveProperty("totalContributors");
      expect(mapped).toHaveProperty("token");
      expect(mapped).toHaveProperty("hasRBACEnabled");
      expect(mapped).toHaveProperty("createdAt");
      expect(mapped).toHaveProperty("updatedAt");
    });

    it("should use camelCase field names consistently", () => {
      const rawInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Test Campaign",
        description: "A test campaign",
        status: "Active",
        category: "tech",
        has_platform_config: true,
        platform_fee_bps: 250,
        platform_address: "platform_address",
      };

      const mapped = mapCampaignFromRaw("CTEST123456789", rawInfo);

      // Verify no snake_case fields exist
      expect(mapped).not.toHaveProperty("min_contribution");
      expect(mapped).not.toHaveProperty("max_contribution");
      expect(mapped).not.toHaveProperty("has_platform_config");
      expect(mapped).not.toHaveProperty("platform_fee_bps");

      // Verify camelCase equivalents exist
      expect(mapped).toHaveProperty("minContribution");
      expect(mapped).toHaveProperty("maxContribution");
      expect(mapped).toHaveProperty("hasRBACEnabled");
      expect(mapped).toHaveProperty("platformFeeBps");
    });

    it("should preserve bigint values for currency fields", () => {
      const rawInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Test Campaign",
        description: "A test campaign",
        status: "Active",
        category: "tech",
        has_platform_config: false,
        platform_fee_bps: 0,
        platform_address: "platform_address",
      };

      const stats: RawCampaignStats = {
        total_raised: 5000000n,
        goal: 10000000n,
        contributor_count: 5,
      };

      const mapped = mapCampaignFromRaw("CTEST123456789", rawInfo, stats);

      expect(typeof mapped.goal).toBe("bigint");
      expect(typeof mapped.raised).toBe("bigint");
      expect(typeof mapped.minContribution).toBe("bigint");
      expect(mapped.goal).toBe(10000000n);
      expect(mapped.raised).toBe(5000000n);
      expect(mapped.minContribution).toBe(1000000n);
    });

    it("should convert deadline to ISO 8601 string", () => {
      const rawInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Test Campaign",
        description: "A test campaign",
        status: "Active",
        category: "tech",
        has_platform_config: false,
        platform_fee_bps: 0,
        platform_address: "platform_address",
      };

      const mapped = mapCampaignFromRaw("CTEST123456789", rawInfo);

      expect(typeof mapped.deadline).toBe("string");
      expect(mapped.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Verify it's a valid ISO string
      expect(() => new Date(mapped.deadline)).not.toThrow();
    });

    it("should handle optional fields with sensible defaults", () => {
      const minimalInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Minimal Campaign",
        description: "",
        status: "Unknown", // Unknown status should default to 'Active'
        category: "",
        has_platform_config: false,
        platform_fee_bps: 0,
        platform_address: "platform_address",
      };

      const mapped = mapCampaignFromRaw("CTEST123456789", minimalInfo);

      expect(mapped.status).toBe("Active"); // Unknown → Active
      expect(mapped.description).toBe("");
      expect(mapped.category).toBe("");
      expect(mapped.platformFeeBps).toBeUndefined(); // undefined when has_platform_config is false
    });
  });

  describe("Campaign status mapping consistency", () => {
    const statusMappings: Array<[string, CampaignStatus]> = [
      ["Active", "Active"],
      ["Successful", "Successful"],
      ["Refunded", "Refunded"],
      ["Cancelled", "Cancelled"],
      ["Paused", "Paused"],
      ["Archived", "Archived"],
    ];

    statusMappings.forEach(([raw, expected]) => {
      it(`should map '${raw}' to '${expected}'`, () => {
        expect(mapCampaignStatus(raw)).toBe(expected);
      });
    });

    it("should default unknown statuses to 'Active'", () => {
      expect(mapCampaignStatus("Unknown")).toBe("Active");
      expect(mapCampaignStatus("")).toBe("Active");
      expect(mapCampaignStatus("NotAStatus")).toBe("Active");
    });
  });

  describe("Contribution shape consistency", () => {
    it("should produce a Contribution with all required fields", () => {
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000n,
        timestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      // Verify all required fields exist
      expect(mapped).toHaveProperty("id");
      expect(mapped).toHaveProperty("campaignId");
      expect(mapped).toHaveProperty("contributor");
      expect(mapped).toHaveProperty("amount");
      expect(mapped).toHaveProperty("timestamp");
      expect(mapped).toHaveProperty("transactionHash");
    });

    it("should convert bigint amounts correctly", () => {
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000n,
        timestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      expect(typeof mapped.amount).toBe("bigint");
      expect(mapped.amount).toBe(1000000n);
    });

    it("should handle string amounts by converting to bigint", () => {
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: "1000000",
        timestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      expect(typeof mapped.amount).toBe("bigint");
      expect(mapped.amount).toBe(1000000n);
    });

    it("should handle numeric amounts by converting to bigint", () => {
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000,
        timestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      expect(typeof mapped.amount).toBe("bigint");
      expect(mapped.amount).toBe(1000000n);
    });

    it("should handle string timestamps by preserving them", () => {
      const isoString = "2024-01-15T10:30:00Z";
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000n,
        timestamp: isoString,
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      expect(mapped.timestamp).toBe(isoString);
    });

    it("should handle bigint timestamps (Unix epoch seconds)", () => {
      const epochSeconds = 1705318200n; // 2024-01-15T10:30:00Z
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000n,
        timestamp: epochSeconds,
        transactionHash: "0xabc123",
      };

      const mapped = mapContribution(raw);

      expect(typeof mapped.timestamp).toBe("string");
      expect(mapped.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should handle missing or null fields with defaults", () => {
      const raw = {
        id: undefined,
        campaignId: undefined,
        contributor: undefined,
        amount: undefined,
        timestamp: undefined,
        transactionHash: undefined,
      };

      const mapped = mapContribution(raw, "fallback_id");

      expect(mapped.id).toBe("fallback_id");
      expect(mapped.campaignId).toBe("");
      expect(mapped.contributor).toBe("");
      expect(mapped.amount).toBe(0n);
      expect(mapped.transactionHash).toBe("");
    });
  });

  describe("Shape parity across multiple calls", () => {
    it("should produce identical Campaign shapes for identical inputs", () => {
      const rawInfo: RawCampaignInfo = {
        creator: "creator_address",
        token: "native",
        goal: 10000000n,
        deadline: 1700000000n,
        min_contribution: 1000000n,
        max_contribution: 1000000000n,
        title: "Test Campaign",
        description: "A test campaign",
        status: "Active",
        category: "tech",
        has_platform_config: true,
        platform_fee_bps: 250,
        platform_address: "platform_address",
      };

      const stats: RawCampaignStats = {
        total_raised: 5000000n,
        goal: 10000000n,
        contributor_count: 5,
      };

      const mapped1 = mapCampaignFromRaw("CTEST123456789", rawInfo, stats);
      const mapped2 = mapCampaignFromRaw("CTEST123456789", rawInfo, stats);

      // Shape should be identical (field names, types, presence)
      expect(Object.keys(mapped1).sort()).toEqual(Object.keys(mapped2).sort());

      // Values should match (except timestamps which may differ by ms)
      expect(mapped1.id).toBe(mapped2.id);
      expect(mapped1.contractId).toBe(mapped2.contractId);
      expect(mapped1.title).toBe(mapped2.title);
      expect(mapped1.goal).toBe(mapped2.goal);
      expect(mapped1.raised).toBe(mapped2.raised);
    });

    it("should produce identical Contribution shapes for identical inputs", () => {
      const raw = {
        id: "contrib_1",
        campaignId: "campaign_1",
        contributor: "contributor_address",
        amount: 1000000n,
        timestamp: "2024-01-15T10:30:00Z",
        transactionHash: "0xabc123",
      };

      const mapped1 = mapContribution(raw);
      const mapped2 = mapContribution(raw);

      // Shape should be identical
      expect(Object.keys(mapped1).sort()).toEqual(Object.keys(mapped2).sort());

      // Values should match exactly
      expect(mapped1).toEqual(mapped2);
    });
  });
});

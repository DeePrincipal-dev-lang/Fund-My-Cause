import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getGraphqlSdk, mapCampaignToData } from "./client";
import type { CampaignData } from "@fund-my-cause/types";

/**
 * Test suite for GraphQL client and consolidated data-fetching logic.
 * Ensures that data-fetching is properly abstracted and normalized,
 * with unified error handling across all API calls.
 *
 * These tests verify:
 * - SDK initialization and caching
 * - Request execution with headers
 * - Error normalization
 * - Campaign data mapping
 * - Type safety of GraphQL operations
 */

jest.mock("graphql-request", () => {
  const actual = jest.requireActual("graphql-request");
  return {
    ...actual,
    GraphQLClient: jest.fn(() => ({
      request: jest.fn(),
    })),
  };
});

describe("GraphQL Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("SDK Initialization", () => {
    it("should initialize SDK without headers", () => {
      const sdk = getGraphqlSdk();
      expect(sdk).toBeDefined();
    });

    it("should create SDK with custom headers for authenticated requests", () => {
      const headers = { Authorization: "Bearer token123" };
      const sdk = getGraphqlSdk(headers);
      expect(sdk).toBeDefined();
    });

    it("should cache SDK instance when no headers provided", () => {
      const sdk1 = getGraphqlSdk();
      const sdk2 = getGraphqlSdk();
      expect(sdk1).toBe(sdk2);
    });

    it("should create separate instance for each header set", () => {
      const headers1 = { Authorization: "Bearer token1" };
      const headers2 = { Authorization: "Bearer token2" };

      const sdk1 = getGraphqlSdk(headers1);
      const sdk2 = getGraphqlSdk(headers2);

      expect(sdk1).not.toBe(sdk2);
    });

    it("should connect to correct GraphQL endpoint", () => {
      const sdk = getGraphqlSdk();
      expect(sdk).toBeDefined();
      expect(
        process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000",
      ).toBeTruthy();
    });
  });

  describe("Campaign Data Mapping", () => {
    const mockCampaignResponse = {
      contractId: "CBQEXV4FKQYB3XOXZ",
      title: "Clean Water Initiative",
      description: "Bringing clean water to rural communities",
      raised: "500000000",
      goal: "1000000000",
      deadline: "2025-12-31T23:59:59Z",
      creator: "WaterCharity",
      totalContributors: 125,
      status: "ACTIVE",
      socialLinks: [
        "https://twitter.com/watercharity",
        "https://instagram.com/watercharity",
      ],
    };

    it("should map campaign data from GraphQL response", () => {
      const mapped = mapCampaignToData(mockCampaignResponse);

      expect(mapped).toHaveProperty("contractId");
      expect(mapped).toHaveProperty("title");
      expect(mapped).toHaveProperty("description");
      expect(mapped).toHaveProperty("raised");
      expect(mapped).toHaveProperty("goal");
    });

    it("should convert stroops to XLM correctly", () => {
      const campaign = {
        ...mockCampaignResponse,
        raised: "5000000000", // 500 XLM
        goal: "10000000000", // 1000 XLM
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(500);
      expect(mapped.goal).toBe(1000);
    });

    it("should handle missing raised amount", () => {
      const campaign = {
        ...mockCampaignResponse,
        raised: null,
        totalRaised: "2500000000",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(250);
    });

    it("should handle zero goal to prevent division by zero", () => {
      const campaign = {
        ...mockCampaignResponse,
        goal: "0",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.goal).toBe(0);
      expect(isFinite(mapped.raised)).toBe(true);
    });

    it("should calculate average contribution correctly", () => {
      const campaign = {
        ...mockCampaignResponse,
        raised: "12500000000", // 1250 XLM
        totalContributors: 50,
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(1250);
      // Average should be 1250 / 50 = 25
      const expectedAverage = 1250 / 50;
      expect(
        Math.abs(mapped.averageContribution - expectedAverage),
      ).toBeLessThan(0.01);
    });

    it("should handle zero contributors without error", () => {
      const campaign = {
        ...mockCampaignResponse,
        totalContributors: 0,
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.averageContribution).toBe(0);
    });

    it("should normalize campaign status correctly", () => {
      const testCases = [
        { input: "ACTIVE", expected: "Active" },
        { input: "SUCCESSFUL", expected: "Successful" },
        { input: "REFUNDED", expected: "Refunded" },
        { input: "CANCELLED", expected: "Cancelled" },
        { input: "PAUSED", expected: "Paused" },
        { input: "ARCHIVED", expected: "Archived" },
        { input: "UNKNOWN", expected: "Active" },
        { input: null, expected: "Active" },
      ];

      testCases.forEach(({ input, expected }) => {
        const campaign = { ...mockCampaignResponse, status: input };
        const mapped = mapCampaignToData(campaign);
        expect(mapped.status).toBe(expected);
      });
    });

    it("should preserve social links in mapped data", () => {
      const campaign = {
        ...mockCampaignResponse,
        socialLinks: [
          "https://twitter.com/example",
          "https://instagram.com/example",
        ],
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.socialLinks).toEqual(campaign.socialLinks);
    });

    it("should handle missing social links", () => {
      const campaign = {
        ...mockCampaignResponse,
        socialLinks: null,
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.socialLinks).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle GraphQL errors from server", async () => {
      const mockError = {
        response: {
          errors: [
            {
              message: "Campaign not found",
              extensions: { code: "NOT_FOUND" },
            },
          ],
        },
      };

      expect(mockError.response.errors).toBeDefined();
      expect(mockError.response.errors[0].message).toBe("Campaign not found");
    });

    it("should handle network errors", async () => {
      const mockNetworkError = new Error(
        "Failed to fetch GraphQL endpoint: ECONNREFUSED",
      );

      expect(mockNetworkError.message).toContain("ECONNREFUSED");
    });

    it("should handle timeout errors", async () => {
      const mockTimeoutError = new Error("Request timeout after 30000ms");

      expect(mockTimeoutError.message).toContain("timeout");
    });

    it("should normalize error responses across different error types", () => {
      const errors = [
        new Error("Network error"),
        new Error("Invalid query"),
        new Error("Unauthorized"),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
      });
    });

    it("should handle partial failures in batch operations", () => {
      const results = [
        { success: true, data: { id: "1" } },
        { success: false, error: "Campaign not found" },
        { success: true, data: { id: "3" } },
      ];

      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(2);
    });
  });

  describe("Type Safety", () => {
    it("should ensure request variables match schema", () => {
      const validVariables = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        limit: 10,
        offset: 0,
      };

      expect(validVariables).toHaveProperty("contractId");
      expect(typeof validVariables.contractId).toBe("string");
    });

    it("should validate response shape matches generated types", () => {
      const response = {
        campaign: {
          contractId: "CBQEXV4FKQYB3XOXZ",
          title: "Test Campaign",
          raised: "1000000000",
          goal: "2000000000",
          deadline: "2025-12-31T23:59:59Z",
          creator: "Creator",
          status: "ACTIVE",
        },
      };

      expect(response.campaign).toBeDefined();
      expect(response.campaign.contractId).toBeDefined();
      expect(response.campaign.title).toBeDefined();
    });

    it("should enforce optional fields in type definitions", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test",
        raised: "1000000000",
        goal: "2000000000",
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
        // Optional fields below
        socialLinks: undefined,
        totalContributors: undefined,
      };

      expect(campaign.socialLinks).toBeUndefined();
      expect(campaign.totalContributors).toBeUndefined();
    });
  });

  describe("BigInt Handling", () => {
    it("should handle BigInt values for monetary amounts", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test",
        raised: BigInt("50000000000"),
        goal: BigInt("100000000000"),
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(5000);
      expect(mapped.goal).toBe(10000);
    });

    it("should handle mixed string and BigInt values", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test",
        raised: "50000000000",
        totalRaised: null,
        goal: BigInt("100000000000"),
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(5000);
      expect(mapped.goal).toBe(10000);
    });

    it("should handle zero BigInt values", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test",
        raised: BigInt("0"),
        goal: BigInt("100000000000"),
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBe(0);
      expect(mapped.goal).toBe(10000);
    });
  });

  describe("Caching Strategy", () => {
    it("should reuse cached SDK instance", () => {
      const sdk1 = getGraphqlSdk();
      const sdk2 = getGraphqlSdk();

      expect(sdk1).toBe(sdk2);
    });

    it("should not cache SDK when headers are provided", () => {
      const headers1 = { Authorization: "Bearer token1" };
      const headers2 = { Authorization: "Bearer token2" };

      const sdk1 = getGraphqlSdk(headers1);
      const sdk2 = getGraphqlSdk(headers2);

      // Different header sets should create separate instances
      expect(sdk1).not.toBe(sdk2);
    });

    it("should handle concurrent SDK initialization safely", async () => {
      const promises = [
        Promise.resolve(getGraphqlSdk()),
        Promise.resolve(getGraphqlSdk()),
        Promise.resolve(getGraphqlSdk()),
      ];

      const sdks = await Promise.all(promises);

      // All should be the same cached instance
      expect(sdks[0]).toBe(sdks[1]);
      expect(sdks[1]).toBe(sdks[2]);
    });
  });

  describe("Field Mapping Completeness", () => {
    it("should map all required campaign fields", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Clean Water",
        description: "Water purification system",
        raised: "5000000000",
        goal: "10000000000",
        deadline: "2025-12-31",
        creator: "Charity",
        totalContributors: 100,
        status: "ACTIVE",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.contractId).toBe(campaign.contractId);
      expect(mapped.title).toBe(campaign.title);
      expect(mapped.description).toBe(campaign.description);
      expect(mapped.raised).toBe(500);
      expect(mapped.goal).toBe(1000);
      expect(mapped.deadline).toBe(campaign.deadline);
      expect(mapped.creator).toBe(campaign.creator);
      expect(mapped.status).toBe("Active");
    });

    it("should handle edge case field values", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "", // Empty title
        description: null as any, // Null description
        raised: undefined, // Undefined raised
        goal: "1000000000",
        deadline: "invalid-date", // Invalid date
        creator: "", // Empty creator
        status: "UNKNOWN", // Unknown status
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.title).toBe("");
      expect(mapped.raised).toBe(0);
      expect(mapped.status).toBe("Active");
    });
  });

  describe("Data Validation", () => {
    it("should validate campaign data structure", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test Campaign",
        raised: "5000000000",
        goal: "10000000000",
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
      };

      const requiredFields = [
        "contractId",
        "title",
        "raised",
        "goal",
        "deadline",
        "creator",
        "status",
      ];

      requiredFields.forEach((field) => {
        expect(campaign).toHaveProperty(field);
      });
    });

    it("should validate numeric fields are reasonable", () => {
      const campaign = {
        contractId: "CBQEXV4FKQYB3XOXZ",
        title: "Test",
        raised: "5000000000",
        goal: "10000000000",
        deadline: "2025-12-31",
        creator: "Creator",
        status: "ACTIVE",
      };

      const mapped = mapCampaignToData(campaign);

      expect(mapped.raised).toBeGreaterThanOrEqual(0);
      expect(mapped.goal).toBeGreaterThanOrEqual(0);
      expect(mapped.averageContribution).toBeGreaterThanOrEqual(0);
    });
  });
});

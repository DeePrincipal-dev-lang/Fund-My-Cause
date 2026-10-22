import { describe, it, expect } from "vitest";
import { campaignResolvers } from "./campaign.js";
import { contributionResolvers } from "./contribution.js";
import { userResolvers } from "./user.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolver pagination boundaries", () => {
  describe("Pagination Boundaries", () => {
    it("Query.campaigns clamps page size to 100 maximum", async () => {
      const context = createMockContext();
      (context.contractService.getCampaigns as any).mockResolvedValue([]);
      (context.contractService.getCampaignCount as any).mockResolvedValue(0);

      await (campaignResolvers.Query as any).campaigns(
        null,
        { first: 9999 },
        context,
      );

      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 101, offset: 0 } }),
      );
    });

    it("Query.campaigns enforces minimum page size of 1", async () => {
      const context = createMockContext();
      (context.contractService.getCampaigns as any).mockResolvedValue([]);
      (context.contractService.getCampaignCount as any).mockResolvedValue(0);

      await (campaignResolvers.Query as any).campaigns(
        null,
        { first: 0 },
        context,
      );

      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 2, offset: 0 } }),
      );
    });

    it("Query.activeCampaigns clamps to 100 and includes N+1 for cursor detection", async () => {
      const context = createMockContext();
      const campaigns = Array(101)
        .fill(null)
        .map((_, i) => sampleCampaign({ id: `camp_${i}` }));
      (context.dataLoader.campaignsByStatus.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (campaignResolvers.Query as any).activeCampaigns(
        null,
        { first: 150 },
        context,
      );

      expect(context.dataLoader.campaignsByStatus.load).toHaveBeenCalledWith({
        status: "Active",
        limit: 101,
        afterSortKey: undefined,
        afterId: undefined,
      });
      expect(result.edges.length).toBe(100);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it("Query.contributions returns empty page info for empty results", async () => {
      const context = createMockContext();
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue(
        [],
      );

      const result = await (contributionResolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1", first: 20 },
        context,
      );

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.startCursor).toBeNull();
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("Query.contributions respects first parameter for page size", async () => {
      const context = createMockContext();
      const contributions = Array(30)
        .fill(null)
        .map((_, i) => ({
          id: `contrib_${i}`,
          timestamp: new Date().toISOString(),
          amount: 1000n,
          campaignId: "camp_1",
        }));
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (contributionResolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1", first: 10 },
        context,
      );

      expect(result.edges.length).toBe(10);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("User.campaigns field resolver supports pagination", async () => {
      const context = createMockContext();
      const campaigns = Array(25)
        .fill(null)
        .map((_, i) => sampleCampaign({ id: `camp_${i}` }));
      (context.dataLoader.userCampaigns.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (userResolvers.User as any).campaigns(
        { address: "GUSER123" },
        { first: 10 },
        context,
      );

      expect(result.edges.length).toBe(10);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(context.dataLoader.userCampaigns.load).toHaveBeenCalledWith(
        "GUSER123",
      );
    });

    it("User.contributions field resolver clamps to maximum page size", async () => {
      const context = createMockContext();
      const contributions = Array(150)
        .fill(null)
        .map((_, i) => ({
          id: `contrib_${i}`,
          timestamp: new Date().toISOString(),
          amount: 1000n,
        }));
      (context.dataLoader.userContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (userResolvers.User as any).contributions(
        { address: "GUSER123" },
        { first: 200 },
        context,
      );

      expect(result.edges.length).toBe(100);
      expect(context.dataLoader.userContributions.load).toHaveBeenCalledWith(
        "GUSER123",
      );
    });
  });
});

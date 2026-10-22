import { describe, it, expect } from "vitest";
import { campaignResolvers } from "./campaign.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolvers/campaign discovery", () => {
  describe("Query.activeCampaigns", () => {
    it("delegates to the campaignsByStatus dataloader", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.dataLoader.campaignsByStatus.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (campaignResolvers.Query as any).activeCampaigns(
        null,
        { limit: 5 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.dataLoader.campaignsByStatus.load).toHaveBeenCalledWith({
        status: "Active",
        limit: 5,
      });
    });
  });

  describe("Query.trendingCampaigns", () => {
    it("returns cached trending campaigns without calling the contract service", async () => {
      const context = createMockContext();
      const cached = [sampleCampaign()];
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (campaignResolvers.Query as any).trendingCampaigns(
        null,
        { limit: 10 },
        context,
      );

      expect(result).toBe(cached);
      expect(
        context.contractService.getTrendingCampaigns,
      ).not.toHaveBeenCalled();
    });

    it("fetches and caches trending campaigns on a miss", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.contractService.getTrendingCampaigns as any).mockResolvedValue(
        campaigns,
      );

      const result = await (campaignResolvers.Query as any).trendingCampaigns(
        null,
        { limit: 10 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.cache.set).toHaveBeenCalledWith(
        "trending:10",
        campaigns,
        1800,
      );
    });
  });

  describe("Query.searchCampaigns", () => {
    it("delegates to contractService.searchCampaigns", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.contractService.searchCampaigns as any).mockResolvedValue(
        campaigns,
      );

      const result = await (campaignResolvers.Query as any).searchCampaigns(
        null,
        { query: "water", limit: 5 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.contractService.searchCampaigns).toHaveBeenCalledWith(
        "water",
        5,
      );
    });
  });

  describe("Query.campaignDetail", () => {
    it("assembles campaign, contributors, updates, and milestones", async () => {
      const context = createMockContext();
      const campaign = sampleCampaign();
      const contributors = [{ address: "a", amount: 1n }];
      const updates = [{ id: "u1" }];
      const milestones = [{ id: "m1" }];

      (context.dataLoader.campaigns.load as any).mockResolvedValue(campaign);
      (context.dataLoader.campaignContributors.load as any).mockResolvedValue(
        contributors,
      );
      (context.dataLoader.campaignUpdates.load as any).mockResolvedValue(
        updates,
      );
      (context.dataLoader.campaignMilestones.load as any).mockResolvedValue(
        milestones,
      );

      const result = await (campaignResolvers.Query as any).campaignDetail(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toEqual({ campaign, contributors, updates, milestones });
    });

    it("throws a GraphQLError when the campaign is not found", async () => {
      const context = createMockContext();
      (context.dataLoader.campaigns.load as any).mockResolvedValue(null);

      await expect(
        (campaignResolvers.Query as any).campaignDetail(
          null,
          { id: "missing" },
          context,
        ),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
    });
  });
});

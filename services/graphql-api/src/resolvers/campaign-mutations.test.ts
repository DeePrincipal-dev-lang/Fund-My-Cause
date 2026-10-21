import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import { campaignResolvers } from "./campaign.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolvers/campaign mutations", () => {
  describe("Mutation.createCampaign", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (campaignResolvers.Mutation as any).createCampaign(
          null,
          { input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.createCampaign).not.toHaveBeenCalled();
    });

    it("creates the campaign and invalidates related caches when authenticated", async () => {
      const context = createMockContext({
        user: { address: "GCREATOR", isAuthenticated: true },
      });
      const campaign = sampleCampaign();
      (context.contractService.createCampaign as any).mockResolvedValue(
        campaign,
      );

      const validInput = {
        title: "New Campaign",
        description: "A great cause worth funding.",
        goal: 10000n,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        category: "Technology",
        minContribution: 10n,
      };

      const result = await (campaignResolvers.Mutation as any).createCampaign(
        null,
        { input: validInput },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.contractService.createCampaign).toHaveBeenCalledWith(
        context.user,
        validInput,
      );
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
    });
  });

  describe("Mutation.updateCampaign", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (campaignResolvers.Mutation as any).updateCampaign(
          null,
          { id: "camp_1", input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.updateCampaign).not.toHaveBeenCalled();
    });

    it("updates the campaign, invalidates caches, and publishes an update event", async () => {
      const context = createMockContext({
        user: { address: "GCREATOR", isAuthenticated: true },
      });
      const campaign = sampleCampaign({ id: "camp_1" });
      (context.contractService.updateCampaign as any).mockResolvedValue(
        campaign,
      );

      const result = await (campaignResolvers.Mutation as any).updateCampaign(
        null,
        { id: "camp_1", input: { title: "Updated" } },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.cache.del).toHaveBeenCalledWith("campaign:camp_1");
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "campaign_updated:camp_1",
        campaign,
      );
    });
  });
});

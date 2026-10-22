import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import { contributionResolvers } from "./contribution.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolvers/contribution", () => {
  it("exposes contribution Query fields", () => {
    const q = contributionResolvers.Query as any;
    expect(typeof q.contribution).toBe("function");
    expect(typeof q.contributions).toBe("function");
  });
  it("exposes recordContribution mutation", () => {
    const m = contributionResolvers.Mutation as any;
    expect(typeof m.recordContribution).toBe("function");
  });

  describe("Query.contribution / contributions", () => {
    it("contribution loads by id via the dataloader", async () => {
      const context = createMockContext();
      const contribution = { id: "contrib_1" };
      (context.dataLoader.contributions.load as any).mockResolvedValue(
        contribution,
      );

      const result = await (contributionResolvers.Query as any).contribution(
        null,
        { id: "contrib_1" },
        context,
      );

      expect(result).toBe(contribution);
    });

    it("contributions loads by campaignId when provided", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c1" }];
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (contributionResolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1" },
        context,
      );

      expect(result).toBe(contributions);
      expect(context.dataLoader.userContributions.load).not.toHaveBeenCalled();
    });

    it("contributions loads by contributor when campaignId is absent", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c2" }];
      (context.dataLoader.userContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (contributionResolvers.Query as any).contributions(
        null,
        { contributor: "GADDR" },
        context,
      );

      expect(result).toBe(contributions);
    });

    it("throws when neither campaignId nor contributor is provided", async () => {
      const context = createMockContext();

      await expect(
        (contributionResolvers.Query as any).contributions(null, {}, context),
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe("Mutation.recordContribution", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (contributionResolvers.Mutation as any).recordContribution(
          null,
          { input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.recordContribution).not.toHaveBeenCalled();
    });

    it("records the contribution, invalidates caches, and publishes contribution + progress events", async () => {
      const context = createMockContext({
        user: { address: "GCONTRIBUTOR", isAuthenticated: true },
      });
      const input = {
        campaignId: "camp_1",
        contributor: "GCONTRIBUTOR",
        amount: 20000000n, // 2 XLM in stroops
        transactionHash: "hash",
      };
      const contribution = { id: "contrib_1", ...input };
      const campaign = sampleCampaign({
        id: "camp_1",
        raised: 5000n,
        goal: 10000n,
      });

      (context.contractService.recordContribution as any).mockResolvedValue(
        contribution,
      );
      (context.contractService.getCampaign as any).mockResolvedValue(campaign);

      const result = await (
        contributionResolvers.Mutation as any
      ).recordContribution(null, { input }, context);

      expect(result).toBe(contribution);
      expect(context.cache.del).toHaveBeenCalledWith("campaign:camp_1");
      expect(context.cache.del).toHaveBeenCalledWith("platform:stats");
      expect(context.cache.del).toHaveBeenCalledWith("user:GCONTRIBUTOR");
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "contribution:camp_1",
        contribution,
      );
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "progress:camp_1",
        expect.objectContaining({ campaignId: "camp_1", percentageFunded: 50 }),
      );
    });

    it("does not publish a progress event when the campaign can no longer be found", async () => {
      const context = createMockContext({
        user: { address: "GCONTRIBUTOR", isAuthenticated: true },
      });
      const input = {
        campaignId: "camp_missing",
        contributor: "GCONTRIBUTOR",
        amount: 20000000n, // 2 XLM in stroops
        transactionHash: "hash",
      };
      const contribution = { id: "contrib_1", ...input };

      (context.contractService.recordContribution as any).mockResolvedValue(
        contribution,
      );
      (context.contractService.getCampaign as any).mockResolvedValue(null);

      await (contributionResolvers.Mutation as any).recordContribution(
        null,
        { input },
        context,
      );

      expect(context.pubsub.publish).toHaveBeenCalledTimes(1); // only the contribution event
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "contribution:camp_missing",
        contribution,
      );
    });
  });
});

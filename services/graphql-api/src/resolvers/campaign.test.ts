import { describe, it, expect } from "vitest";
import { campaignResolvers } from "./campaign.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolvers/campaign", () => {
  it("exposes the campaign Query fields", () => {
    const q = campaignResolvers.Query as any;
    for (const f of [
      "campaign",
      "campaigns",
      "activeCampaigns",
      "trendingCampaigns",
      "searchCampaigns",
      "campaignDetail",
    ]) {
      expect(typeof q[f]).toBe("function");
    }
  });
  it("exposes Campaign field resolvers", () => {
    const c = campaignResolvers.Campaign as any;
    expect(typeof c.percentageFunded).toBe("function");
    expect(typeof c.daysRemaining).toBe("function");
  });
  it("exposes CampaignDetail.topContributors", () => {
    const cd = campaignResolvers.CampaignDetail as any;
    expect(typeof cd.topContributors).toBe("function");
  });
  it("exposes createCampaign and updateCampaign mutations", () => {
    const m = campaignResolvers.Mutation as any;
    expect(typeof m.createCampaign).toBe("function");
    expect(typeof m.updateCampaign).toBe("function");
  });

  describe("Query.campaign", () => {
    it("returns the cached campaign without touching the contract service", async () => {
      const context = createMockContext();
      const cached = sampleCampaign();
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (campaignResolvers.Query as any).campaign(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toBe(cached);
      expect(context.contractService.getCampaign).not.toHaveBeenCalled();
    });

    it("fetches from the contract service on a cache miss and populates the cache", async () => {
      const context = createMockContext();
      const campaign = sampleCampaign();
      (context.contractService.getCampaign as any).mockResolvedValue(campaign);

      const result = await (campaignResolvers.Query as any).campaign(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.cache.set).toHaveBeenCalledWith(
        "campaign:camp_1",
        campaign,
        300,
      );
    });

    it("throws a GraphQLError when the campaign does not exist", async () => {
      const context = createMockContext();
      (context.contractService.getCampaign as any).mockResolvedValue(null);

      await expect(
        (campaignResolvers.Query as any).campaign(
          null,
          { id: "missing" },
          context,
        ),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
      expect(context.cache.set).not.toHaveBeenCalled();
    });
  });

  describe("Query.campaigns", () => {
    it("returns the cached connection on a cache hit", async () => {
      const context = createMockContext();
      const cached = { edges: [], pageInfo: {}, totalCount: 0 };
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (campaignResolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 20, offset: 0 } },
        context,
      );

      expect(result).toBe(cached);
      expect(context.contractService.getCampaigns).not.toHaveBeenCalled();
    });

    it("builds a cursor-paginated connection from contract service results on a cache miss", async () => {
      const context = createMockContext();
      // Two campaigns, resolver requests limit+1 (21) — only 2 come back, so hasNextPage = false.
      const campaigns = [
        sampleCampaign({ id: "a" }),
        sampleCampaign({ id: "b" }),
      ];
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(2);

      const result = await (campaignResolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 20, offset: 0 } },
        context,
      );

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node).toBe(campaigns[0]);
      // Cursors are now HMAC-signed base64url strings (not plain base64 offsets).
      expect(typeof result.edges[0].cursor).toBe("string");
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
      expect(result.pageInfo.hasNextPage).toBe(false); // 2 returned < limit+1 (21)
      expect(context.cache.set).toHaveBeenCalledWith(
        expect.any(String),
        result,
        600,
      );
    });

    it("sets hasNextPage true when N+1 items are returned", async () => {
      const context = createMockContext();
      // Resolver requests pageSize+1 (limit=2 → requests 3). Return 3 items → hasNextPage = true.
      const campaigns = Array.from({ length: 3 }, (_, i) =>
        sampleCampaign({ id: `c${i}` }),
      );
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(50);

      const result = await (campaignResolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 2, offset: 4 } },
        context,
      );

      expect(result.edges).toHaveLength(2); // sliced to pageSize
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(true); // offset > 0
    });

    it("accepts first/after cursor arguments and decodes the cursor", async () => {
      const context = createMockContext();
      // Import encodeCursor to build a valid cursor for the test.
      const { encodeCursor } = await import("../services/cursor-pagination.js");
      const validCursor = encodeCursor({
        id: "camp_prev",
        sortKey: "2024-01-01T00:00:00.000Z",
      });

      const campaigns = [sampleCampaign({ id: "x" })];
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(1);

      const result = await (campaignResolvers.Query as any).campaigns(
        null,
        { first: 10, after: validCursor },
        context,
      );

      expect(result.edges).toHaveLength(1);
      // hasPreviousPage is true when after cursor is present
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it("throws BAD_USER_INPUT for a tampered cursor", async () => {
      const context = createMockContext();
      await expect(
        (campaignResolvers.Query as any).campaigns(
          null,
          { first: 10, after: "tampered.invalidsig" },
          context,
        ),
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT" },
      });
    });

    it("clamps first to a maximum of 100", async () => {
      const context = createMockContext();
      const campaigns = Array.from({ length: 5 }, (_, i) =>
        sampleCampaign({ id: `d${i}` }),
      );
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(5);

      await (campaignResolvers.Query as any).campaigns(
        null,
        { first: 9999 },
        context,
      );

      // Resolver clamps to 100; passes limit=101 to getCampaigns (N+1 trick).
      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 101, offset: 0 } }),
      );
    });
  });
});

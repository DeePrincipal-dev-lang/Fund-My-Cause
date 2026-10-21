import { describe, it, expect, vi } from "vitest";
import { campaignResolvers } from "./campaign.js";
import { sampleCampaign } from "./test-helpers.js";

describe("resolvers/campaign fields", () => {
  describe("Campaign field resolvers", () => {
    it("percentageFunded computes raised/goal as a whole percentage", () => {
      const campaign = sampleCampaign({ goal: 200n, raised: 50n });
      const result = (campaignResolvers.Campaign as any).percentageFunded(
        campaign,
      );
      expect(result).toBe(25);
    });

    it("percentageFunded returns 0 when goal is zero", () => {
      const campaign = sampleCampaign({ goal: 0n, raised: 0n });
      const result = (campaignResolvers.Campaign as any).percentageFunded(
        campaign,
      );
      expect(result).toBe(0);
    });

    it("daysRemaining rounds up remaining whole days", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const campaign = sampleCampaign({
        deadline: new Date("2026-01-03T12:00:00.000Z").toISOString(),
      });
      const result = (campaignResolvers.Campaign as any).daysRemaining(
        campaign,
      );

      expect(result).toBe(3); // 2.5 days rounds up to 3

      vi.useRealTimers();
    });

    it("daysRemaining clamps to 0 for a past deadline", () => {
      const campaign = sampleCampaign({
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      const result = (campaignResolvers.Campaign as any).daysRemaining(
        campaign,
      );
      expect(result).toBe(0);
    });
  });

  describe("CampaignDetail.topContributors field resolver", () => {
    it("ranks contributors by amount descending and computes percentage of raised", () => {
      const parent = {
        campaign: sampleCampaign({ raised: 100n }),
        contributors: [
          { address: "a", amount: 10n },
          { address: "b", amount: 50n },
          { address: "c", amount: 40n },
        ],
      };

      const result = (campaignResolvers.CampaignDetail as any).topContributors(
        parent,
        {
          limit: 10,
        },
      );

      expect(result.map((c: any) => c.address)).toEqual(["b", "c", "a"]);
      expect(result[0]).toMatchObject({
        rank: 1,
        address: "b",
        percentage: 50,
      });
      expect(result[1]).toMatchObject({
        rank: 2,
        address: "c",
        percentage: 40,
      });
    });

    it("respects the limit argument", () => {
      const parent = {
        campaign: sampleCampaign({ raised: 100n }),
        contributors: [
          { address: "a", amount: 10n },
          { address: "b", amount: 50n },
          { address: "c", amount: 40n },
        ],
      };

      const result = (campaignResolvers.CampaignDetail as any).topContributors(
        parent,
        {
          limit: 1,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("b");
    });
  });
});

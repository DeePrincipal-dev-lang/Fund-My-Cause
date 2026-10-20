import { describe, it, expect } from "vitest";
import { campaignResolvers } from "./campaign.js";

describe("resolvers/campaign (#1388)", () => {
  it("exposes the campaign Query fields", () => {
    const q = campaignResolvers.Query as any;
    for (const f of ["campaign", "campaigns", "activeCampaigns", "trendingCampaigns", "searchCampaigns", "campaignDetail"]) {
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
});

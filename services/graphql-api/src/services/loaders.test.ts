import { describe, expect, it, vi } from "vitest";
import { createLoaders, type DataSources } from "./loaders.js";

function makeDataSources(overrides: Partial<DataSources> = {}): DataSources {
  return {
    getUsersByIds: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id, address: `addr-${id}` }))),
    getCampaignsByIds: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id, ownerId: `owner-${id}` }))),
    getContributionsByCampaignIds: vi.fn(async (ids: readonly string[]) =>
      ids.flatMap((id) => [{ id: `c-${id}-1`, campaignId: id, userId: "u1" }])
    ),
    ...overrides,
  };
}

describe("createLoaders", () => {
  it("batches concurrent user lookups into a single data-source call (regression guard for N+1)", async () => {
    const dataSources = makeDataSources();
    const loaders = createLoaders(dataSources);

    const [a, b, c] = await Promise.all([
      loaders.userById.load("1"),
      loaders.userById.load("2"),
      loaders.userById.load("1"),
    ]);

    expect(dataSources.getUsersByIds).toHaveBeenCalledTimes(1);
    expect(a?.id).toBe("1");
    expect(b?.id).toBe("2");
    expect(c?.id).toBe("1");
  });

  it("batches campaign -> contributions fan-out for a nested query shape", async () => {
    const dataSources = makeDataSources();
    const loaders = createLoaders(dataSources);

    const campaignIds = ["c1", "c2", "c3"];
    const results = await Promise.all(campaignIds.map((id) => loaders.contributionsByCampaignId.load(id)));

    expect(dataSources.getContributionsByCampaignIds).toHaveBeenCalledTimes(1);
    expect(dataSources.getContributionsByCampaignIds).toHaveBeenCalledWith(campaignIds);
    results.forEach((contribs, i) => {
      expect(contribs[0].campaignId).toBe(campaignIds[i]);
    });
  });

  it("keeps query count bounded regardless of result-set size (campaign -> contributions -> users)", async () => {
    const dataSources = makeDataSources();
    const loaders = createLoaders(dataSources);

    const campaignIds = Array.from({ length: 25 }, (_, i) => `campaign-${i}`);
    const contributionLists = await Promise.all(
      campaignIds.map((id) => loaders.contributionsByCampaignId.load(id))
    );
    const userIds = contributionLists.flat().map((c) => c.userId);
    await Promise.all(userIds.map((id) => loaders.userById.load(id)));

    // Regardless of 25 campaigns fanning out to N contributions each,
    // batching must keep this at exactly one call per entity type.
    expect(dataSources.getContributionsByCampaignIds).toHaveBeenCalledTimes(1);
    expect(dataSources.getUsersByIds).toHaveBeenCalledTimes(1);
  });

  it("returns null for missing records without breaking batching", async () => {
    const dataSources = makeDataSources({
      getCampaignsByIds: vi.fn(async () => []),
    });
    const loaders = createLoaders(dataSources);

    const result = await loaders.campaignById.load("missing");
    expect(result).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { statsResolvers } from "./stats.js";
import { createMockContext } from "./test-helpers.js";

describe("resolvers/stats", () => {
  describe("Query.stats", () => {
    it("returns cached stats without calling the contract service", async () => {
      const context = createMockContext();
      const stats = { totalCampaigns: 1 };
      (context.cache.get as any).mockResolvedValue(stats);

      const result = await (statsResolvers.Query as any).stats(
        null,
        null,
        context,
      );

      expect(result).toBe(stats);
      expect(context.contractService.getStats).not.toHaveBeenCalled();
    });

    it("fetches and caches stats on a miss", async () => {
      const context = createMockContext();
      const stats = { totalCampaigns: 42 };
      (context.contractService.getStats as any).mockResolvedValue(stats);

      const result = await (statsResolvers.Query as any).stats(
        null,
        null,
        context,
      );

      expect(result).toBe(stats);
      expect(context.cache.set).toHaveBeenCalledWith(
        "platform:stats",
        stats,
        1800,
      );
    });
  });
});

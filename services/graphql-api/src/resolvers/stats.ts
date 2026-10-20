/** Statistics domain resolver (#1388). */
import type { IResolvers } from "@graphql-tools/utils";
import type { Context } from "../types.js";

export const statsResolvers: IResolvers<any, Context> = {
  Query: {
    async stats(_, __, context: Context) {
      const cacheKey = "platform:stats";
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;
      const stats = await context.contractService.getStats();
      await context.cache.set(cacheKey, stats, 1800);
      return stats;
    },
  },
};

/** Statistics domain resolver (#1388). */
import type { IResolvers } from "@graphql-tools/utils";
import type { Context } from "../types.js";
import { CACHE_TTL, CacheKeys } from "../services/cache.js";

export const statsResolvers: IResolvers<any, Context> = {
  Query: {
    async stats(_, __, context: Context) {
      const cacheKey = CacheKeys.platformStats;
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;
      const stats = await context.contractService.getStats();
      await context.cache.set(cacheKey, stats, CACHE_TTL.platformStats);
      return stats;
    },
  },
};

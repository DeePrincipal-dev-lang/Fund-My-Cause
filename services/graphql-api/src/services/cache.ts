import type { RedisClientType } from "redis";

/**
 * TTLs for every cache entry written by graphql-api.
 *
 * Keep these values in sync with `CACHE_POLICY.md`; tests assert the TTLs
 * passed by the resolvers so a change here is visible in review.
 */
export const CACHE_TTL = {
  /** Single campaign snapshot; mutations invalidate it immediately. */
  campaign: 300,
  /** Campaign list/connection; short enough to absorb new campaigns quickly. */
  campaignList: 600,
  /** Trending list; ranking changes slowly and is expensive to compute. */
  trendingCampaigns: 1800,
  /** Platform-wide statistics; aggregate values tolerate a 30 minute window. */
  platformStats: 1800,
  /** User profile; refreshed on contribution and read expiry. */
  user: 600,
} as const;

/** Canonical cache key builders — the only place key shapes are defined. */
export const CacheKeys = {
  campaign: (id: string) => `campaign:${id}`,
  campaigns: (params: {
    filter?: unknown;
    limit: number;
    offset: number;
    sort?: unknown;
  }) => `campaigns:${JSON.stringify(params)}`,
  trendingCampaigns: (limit: number) => `trending:${limit}`,
  platformStats: "platform:stats",
  user: (address: string) => `user:${address}`,
  campaignListPattern: "campaigns:*",
  trendingPattern: "trending:*",
} as const;

/**
 * Invalidate every cache entry affected by a campaign create/update.
 *
 * Campaign mutations change list ordering, trending inputs, and platform
 * totals. The single-campaign entry is only present for updates; creates
 * clear the aggregate keys and statistics.
 */
export async function invalidateCampaignCaches(
  cache: {
    del: (key: string) => Promise<void>;
    delPattern: (pattern: string) => Promise<void>;
  },
  options: { campaignId?: string } = {},
): Promise<void> {
  if (options.campaignId) {
    await cache.del(CacheKeys.campaign(options.campaignId));
  }
  await cache.delPattern(CacheKeys.campaignListPattern);
  await cache.delPattern(CacheKeys.trendingPattern);
  await cache.del(CacheKeys.platformStats);
}

/**
 * Redis cache service for storing and retrieving data with TTL support
 */
export class CacheService {
  constructor(private redis: RedisClientType) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete specific cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete cache keys matching pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error(
        `Cache pattern delete error for pattern ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment value (for counters)
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrBy(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushDb();
    } catch (error) {
      console.error("Cache clear error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsed: string;
    connected: boolean;
  }> {
    try {
      const dbsize = await this.redis.dbSize();
      const info = await this.redis.info("memory");
      const memoryUsed =
        info
          ?.split("\r\n")
          .find((line) => line.includes("used_memory_human"))
          ?.split(":")
          .pop() || "unknown";

      return {
        keyCount: dbsize,
        memoryUsed,
        connected: true,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        keyCount: 0,
        memoryUsed: "unknown",
        connected: false,
      };
    }
  }
}

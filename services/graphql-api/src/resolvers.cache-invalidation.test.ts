import { describe, it, expect, vi } from "vitest";
import { resolvers } from "./resolvers.js";
import { CacheService } from "./services/cache.js";
import type { Context } from "./types.js";

/**
 * Regression test for the del() vs delPattern() cache-invalidation bug.
 *
 * Real Redis DEL does not glob-match wildcard keys — `del("campaigns:*")`
 * is a no-op against a key literally named "campaigns:*". This fake mirrors
 * that exact semantic (unlike a plain vi.fn() mock, which can't catch the
 * bug because it doesn't care what string was passed to del()) so the test
 * only passes if the resolver actually calls delPattern() for wildcard keys.
 */
class FakeRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async setEx(key: string, _ttl: number, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

function buildContext(
  redis: FakeRedis,
  overrides: Partial<Context> = {},
): Context {
  return {
    cache: new CacheService(redis as any),
    contractService: {
      createCampaign: vi.fn(),
      updateCampaign: vi.fn(),
      recordContribution: vi.fn(),
      getCampaign: vi.fn().mockResolvedValue(null),
    },
    dataLoader: {} as any,
    pubsub: { publish: vi.fn().mockResolvedValue(undefined) } as any,
    authService: {} as any,
    user: { address: "GCREATOR", isAuthenticated: true },
    redis: redis as any,
    traceId: "fmc-00000000-0000000000000000",
    log: mockLog,
    ...overrides,
  } as Context;
}

describe("cache-invalidation regression (del() vs delPattern())", () => {
  it("actually evicts cached campaign lists and trending after createCampaign", async () => {
    const redis = new FakeRedis();
    const context = buildContext(redis);

    // Seed the exact list/trending/stats cache entries the Query resolvers
    // would have written on a prior read.
    await context.cache.set("campaigns:{}", [{ id: "old" }], 600);
    await context.cache.set("trending:10", [{ id: "old" }], 1800);
    await context.cache.set("platform:stats", { totalCampaigns: 1 }, 1800);

    (context.contractService.createCampaign as any).mockResolvedValue({
      id: "new",
    });

    await (resolvers.Mutation as any).createCampaign(
      null,
      {
        input: {
          title: "New Campaign",
          description: "A great cause worth funding.",
          goal: 10000n,
          deadline: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          category: "Technology",
          minContribution: 10n,
        },
      },
      context,
    );

    expect(redis.has("campaigns:{}")).toBe(false);
    expect(redis.has("trending:10")).toBe(false);
    expect(redis.has("platform:stats")).toBe(false);
  });

  it("actually evicts cached campaign lists and trending after updateCampaign", async () => {
    const redis = new FakeRedis();
    const context = buildContext(redis);

    await context.cache.set("campaign:camp_1", { id: "camp_1" }, 300);
    await context.cache.set("campaigns:{}", [{ id: "camp_1" }], 600);
    await context.cache.set("trending:10", [{ id: "camp_1" }], 1800);
    await context.cache.set("platform:stats", { totalCampaigns: 1 }, 1800);

    (context.contractService.updateCampaign as any).mockResolvedValue({
      id: "camp_1",
    });

    await (resolvers.Mutation as any).updateCampaign(
      null,
      { id: "camp_1", input: { title: "Updated" } },
      context,
    );

    expect(redis.has("campaign:camp_1")).toBe(false);
    expect(redis.has("campaigns:{}")).toBe(false);
    expect(redis.has("trending:10")).toBe(false);
    expect(redis.has("platform:stats")).toBe(false);
  });

  it("actually evicts cached campaign lists and trending after recordContribution", async () => {
    const redis = new FakeRedis();
    const context = buildContext(redis, {
      user: { address: "GCONTRIBUTOR", isAuthenticated: true },
    });

    await context.cache.set("campaign:camp_1", { id: "camp_1" }, 300);
    await context.cache.set("platform:stats", { totalCampaigns: 1 }, 1800);
    await context.cache.set("user:GCONTRIBUTOR", { address: "G" }, 600);
    await context.cache.set("campaigns:{}", [{ id: "camp_1" }], 600);
    await context.cache.set("trending:10", [{ id: "camp_1" }], 1800);

    const input = {
      campaignId: "camp_1",
      contributor: "GCONTRIBUTOR",
      amount: 20000000n, // 2 XLM in stroops
      transactionHash: "hash",
    };
    (context.contractService.recordContribution as any).mockResolvedValue({
      id: "contrib_1",
      ...input,
    });

    await (resolvers.Mutation as any).recordContribution(
      null,
      { input },
      context,
    );

    expect(redis.has("campaign:camp_1")).toBe(false);
    expect(redis.has("platform:stats")).toBe(false);
    expect(redis.has("user:GCONTRIBUTOR")).toBe(false);
    expect(redis.has("campaigns:{}")).toBe(false);
    expect(redis.has("trending:10")).toBe(false);
  });
});

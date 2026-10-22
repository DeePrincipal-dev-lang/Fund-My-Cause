/**
 * Bucket isolation between the general request limiter and the per-mutation
 * limiters in the single RateLimiterService (#1463).
 *
 * Mutation limits must not drain the general request budget, and a mutation
 * bucket must be scoped to its own key so one wallet cannot exhaust another's.
 */
import { describe, it, expect } from "vitest";
import { RateLimiterService, MUTATION_LIMITS } from "./rate-limiter.js";

describe("rate limiter bucket isolation (#1463)", () => {
  it("exhausting a mutation bucket does not consume the request budget", async () => {
    const svc = new RateLimiterService();
    const { points } = MUTATION_LIMITS.createCampaign;
    for (let i = 0; i < points; i++) {
      await svc.checkMutationLimit("createCampaign", "wallet-a");
    }

    // Request limit is 100 per minute; all 100 should still be available.
    for (let i = 0; i < 100; i++) {
      await expect(svc.checkRequestLimit("wallet-a")).resolves.toBeUndefined();
    }
  });

  it("a mutation bucket is scoped per key", async () => {
    const svc = new RateLimiterService();
    const { points } = MUTATION_LIMITS.recordContribution;
    for (let i = 0; i < points; i++) {
      await svc.checkMutationLimit("recordContribution", "wallet-a");
    }

    await expect(
      svc.checkMutationLimit("recordContribution", "wallet-b"),
    ).resolves.toBeUndefined();
  });

  it("each mutation has its own bucket", async () => {
    const svc = new RateLimiterService();
    const { points } = MUTATION_LIMITS.createCampaign;
    for (let i = 0; i < points; i++) {
      await svc.checkMutationLimit("createCampaign", "wallet-a");
    }

    await expect(
      svc.checkMutationLimit("recordContribution", "wallet-a"),
    ).resolves.toBeUndefined();
  });

  it("mutation key prefixes are unique so Redis buckets never collide", () => {
    const prefixes = Object.values(MUTATION_LIMITS).map((cfg) => cfg.keyPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("an unknown mutation name is not limited", async () => {
    const svc = new RateLimiterService();
    await expect(
      svc.checkMutationLimit("nonexistent" as any, "wallet-a"),
    ).resolves.toBeUndefined();
  });
});

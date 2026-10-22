/**
 * Error-response contract for rate-limit rejections (#1462).
 *
 * Every rate-limit rejection in RateLimiterService must expose the same
 * client-readable fields: an Error whose `retryAfter` is a whole number of
 * seconds, at least 1, so clients can back off the same way for every route.
 */
import { describe, it, expect } from "vitest";
import { RateLimiterService, MUTATION_LIMITS } from "./rate-limiter.js";

async function captureError(fn: () => Promise<void>): Promise<any> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to be rate limited");
}

async function exhaust(count: number, fn: () => Promise<void>): Promise<void> {
  for (let i = 0; i < count; i++) {
    await fn();
  }
}

describe("rate-limit error contract (#1462)", () => {
  it("checkRequestLimit rejects with a numeric retryAfter of at least 1 second", async () => {
    const svc = new RateLimiterService();
    const key = "contract-request";
    await exhaust(100, () => svc.checkRequestLimit(key));

    const err = await captureError(() => svc.checkRequestLimit(key));
    expect(err).toBeInstanceOf(Error);
    expect(Number.isInteger(err.retryAfter)).toBe(true);
    expect(err.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("checkIpLimit rejects with a numeric retryAfter of at least 1 second", async () => {
    const svc = new RateLimiterService();
    const key = "203.0.113.7";
    await exhaust(1000, () => svc.checkIpLimit(key));

    const err = await captureError(() => svc.checkIpLimit(key));
    expect(err).toBeInstanceOf(Error);
    expect(Number.isInteger(err.retryAfter)).toBe(true);
    expect(err.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("checkUserLimit rejects with a numeric retryAfter of at least 1 second", async () => {
    const svc = new RateLimiterService();
    const key = "GCONTRACTADDR";
    await exhaust(10000, () => svc.checkUserLimit(key));

    const err = await captureError(() => svc.checkUserLimit(key));
    expect(err).toBeInstanceOf(Error);
    expect(Number.isInteger(err.retryAfter)).toBe(true);
    expect(err.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it.each(Object.keys(MUTATION_LIMITS) as (keyof typeof MUTATION_LIMITS)[])(
    "checkMutationLimit(%s) rejects with retryAfter and the mutation name",
    async (mutation) => {
      const svc = new RateLimiterService();
      const key = "GCONTRACTADDR";
      await exhaust(MUTATION_LIMITS[mutation].points, () =>
        svc.checkMutationLimit(mutation, key),
      );

      const err = await captureError(() =>
        svc.checkMutationLimit(mutation, key),
      );
      expect(err).toBeInstanceOf(Error);
      expect(Number.isInteger(err.retryAfter)).toBe(true);
      expect(err.retryAfter).toBeGreaterThanOrEqual(1);
      expect(err.mutation).toBe(mutation);
    },
  );
});

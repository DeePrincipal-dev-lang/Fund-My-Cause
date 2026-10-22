import { describe, it, expect, beforeEach, vi } from "vitest";
import { GraphQLError } from "graphql";
import { createRateLimitMiddleware } from "./rate-limiter.js";
import { RateLimiterService } from "../services/rate-limiter.js";
import type { Context } from "../types.js";

describe("GraphQL Mutation Rate Limiting Middleware Unit Tests", () => {
  let rateLimiter: RateLimiterService;
  let mockResolver: vi.Mock;
  let mockInfo: any;

  beforeEach(() => {
    rateLimiter = new RateLimiterService();
    mockResolver = vi.fn().mockResolvedValue({ success: true, id: "test-123" });
    mockInfo = { fieldName: "createCampaign" };
  });

  it("passes execution to target resolver when within allowed rate limits", async () => {
    const middleware = createRateLimitMiddleware(rateLimiter, { scope: "ip" });
    const mockContext = { ip: "192.168.1.100" } as unknown as Context;

    const result = await middleware(
      mockResolver,
      {},
      { input: { title: "Test" } },
      mockContext,
      mockInfo,
    );

    expect(result).toEqual({ success: true, id: "test-123" });
    expect(mockResolver).toHaveBeenCalledTimes(1);
  });

  it("throws GraphQLError with TOO_MANY_REQUESTS code when IP rate limit is exceeded", async () => {
    const middleware = createRateLimitMiddleware(rateLimiter, { scope: "ip" });
    const mockContext = { ip: "203.0.113.42" } as unknown as Context;

    // Exhaust rate limit for IP
    await (rateLimiter as any).ipLimiter.consume("203.0.113.42", 1000);

    await expect(
      middleware(mockResolver, {}, {}, mockContext, mockInfo),
    ).rejects.toThrowError(GraphQLError);

    try {
      await middleware(mockResolver, {}, {}, mockContext, mockInfo);
    } catch (err: any) {
      expect(err.extensions.code).toBe("TOO_MANY_REQUESTS");
      expect(err.extensions.http.status).toBe(429);
      expect(err.extensions.details.operationName).toBe("createCampaign");
    }

    expect(mockResolver).not.toHaveBeenCalled();
  });

  it("enforces user-scoped rate limiting for authenticated users", async () => {
    const middleware = createRateLimitMiddleware(rateLimiter, {
      scope: "user",
    });
    const mockContext = {
      user: {
        address: "GUSERADDRESS99999999999999999999",
        isAuthenticated: true,
      },
    } as unknown as Context;

    const result = await middleware(
      mockResolver,
      {},
      {},
      mockContext,
      mockInfo,
    );
    expect(result).toEqual({ success: true, id: "test-123" });

    // Exhaust user rate limit
    // Note: the first middleware call above already consumed 1 point, so only 9999 remain.
    await (rateLimiter as any).userLimiter.consume(
      "GUSERADDRESS99999999999999999999",
      9999,
    );

    await expect(
      middleware(mockResolver, {}, {}, mockContext, mockInfo),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("throws UNAAUTHENTICATED GraphQLError when user scope is configured but no user present in context", async () => {
    const middleware = createRateLimitMiddleware(rateLimiter, {
      scope: "user",
    });
    const unauthenticatedContext = {} as Context;

    await expect(
      middleware(mockResolver, {}, {}, unauthenticatedContext, mockInfo),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("supports operation-scoped rate limits with custom keyPrefix", async () => {
    const middleware = createRateLimitMiddleware(rateLimiter, {
      scope: "operation",
      keyPrefix: "custom_op",
    });
    const mockContext = { ip: "10.0.0.1" } as unknown as Context;

    const result = await middleware(
      mockResolver,
      {},
      {},
      mockContext,
      mockInfo,
    );
    expect(result).toEqual({ success: true, id: "test-123" });

    // Exhaust operation key
    // Note: the first middleware call above already consumed 1 point, so only 99 remain.
    const opKey = "custom_op:createCampaign:10.0.0.1";
    await (rateLimiter as any).limiter.consume(opKey, 99);

    await expect(
      middleware(mockResolver, {}, {}, mockContext, mockInfo),
    ).rejects.toThrow("Rate limit exceeded");
  });
});

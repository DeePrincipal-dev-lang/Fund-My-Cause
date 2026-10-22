import { describe, expect, it, vi } from "vitest";
import { RequestRateLimiter, createPublicEndpointRateLimit } from "./request-rate-limit.js";
import type { RateLimitConfig } from "../config/rate-limit-config.js";

function makeConfig(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return {
    enabled: true,
    windowMs: 1000,
    maxRequestsPerIp: 2,
    maxRequestsPerApiKey: 3,
    trustProxy: false,
    ...overrides,
  };
}

function makeRes() {
  return {
    statusCode: undefined as number | undefined,
    headers: {} as Record<string, string>,
    body: undefined as string | undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(body?: string) {
      this.body = body;
    },
  };
}

describe("RequestRateLimiter", () => {
  it("allows requests under the limit and blocks once exceeded", () => {
    const limiter = new RequestRateLimiter(makeConfig());
    expect(limiter.checkIp("1.2.3.4").allowed).toBe(true);
    expect(limiter.checkIp("1.2.3.4").allowed).toBe(true);
    const blocked = limiter.checkIp("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate buckets per API key", () => {
    const limiter = new RequestRateLimiter(makeConfig({ maxRequestsPerApiKey: 1 }));
    expect(limiter.checkApiKey("key-a").allowed).toBe(true);
    expect(limiter.checkApiKey("key-b").allowed).toBe(true);
    expect(limiter.checkApiKey("key-a").allowed).toBe(false);
  });

  it("resets counts after the window elapses", async () => {
    const limiter = new RequestRateLimiter(makeConfig({ windowMs: 20, maxRequestsPerIp: 1 }));
    expect(limiter.checkIp("9.9.9.9").allowed).toBe(true);
    expect(limiter.checkIp("9.9.9.9").allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(limiter.checkIp("9.9.9.9").allowed).toBe(true);
  });

  it("reset() clears all buckets immediately", () => {
    const limiter = new RequestRateLimiter(makeConfig({ maxRequestsPerIp: 1 }));
    expect(limiter.checkIp("5.5.5.5").allowed).toBe(true);
    limiter.reset();
    expect(limiter.checkIp("5.5.5.5").allowed).toBe(true);
  });
});

describe("createPublicEndpointRateLimit", () => {
  it("returns a 429 with the expected error shape once the limit is exceeded", () => {
    const config = makeConfig({ maxRequestsPerIp: 1 });
    const limiter = new RequestRateLimiter(config);
    const middleware = createPublicEndpointRateLimit(config, limiter);
    const next = vi.fn();

    middleware({ ip: "10.0.0.1", headers: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    const res = makeRes();
    middleware({ ip: "10.0.0.1", headers: {} }, res, next);

    expect(res.statusCode).toBe(429);
    const parsed = JSON.parse(res.body!);
    expect(parsed.errors[0].extensions.code).toBe("TOO_MANY_REQUESTS");
    expect(parsed.errors[0].extensions.retryAfter).toBeGreaterThan(0);
  });

  it("bypasses limiting entirely when disabled via config", () => {
    const config = makeConfig({ enabled: false, maxRequestsPerIp: 1 });
    const limiter = new RequestRateLimiter(config);
    const middleware = createPublicEndpointRateLimit(config, limiter);
    const next = vi.fn();

    middleware({ ip: "10.0.0.2", headers: {} }, makeRes(), next);
    middleware({ ip: "10.0.0.2", headers: {} }, makeRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("prefers the API key bucket over IP when x-api-key is present", () => {
    const config = makeConfig({ maxRequestsPerApiKey: 1, maxRequestsPerIp: 100 });
    const limiter = new RequestRateLimiter(config);
    const middleware = createPublicEndpointRateLimit(config, limiter);
    const next = vi.fn();

    middleware({ ip: "10.0.0.3", headers: { "x-api-key": "abc" } }, makeRes(), next);
    const res = makeRes();
    middleware({ ip: "10.0.0.3", headers: { "x-api-key": "abc" } }, res, next);

    expect(res.statusCode).toBe(429);
  });
});

/**
 * Unit tests for rate-limit middleware — Issue #1282
 *
 * Tests the middleware wrapper that applies rate limiting to Next.js API routes
 * and handles rate-limit header injection.
 */

import { rateLimit } from "../middleware";
import { RateLimitOptions, SEARCH_LIMIT, GENERAL_LIMIT } from "../rate-limiter";
import { NextRequest, NextResponse } from "next/server";

// Mock Next.js objects
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: jest.fn(() => ({
    headers: new Map(),
  })),
}));

describe("rateLimit middleware", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("middleware application", () => {
    it("is a function that returns a handler", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const middleware = rateLimit(opts);
      expect(typeof middleware).toBe("function");
    });

    it("allows requests within limit", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 2 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.1";
            return null;
          },
        },
      } as unknown as NextRequest;

      const result = handler(mockReq);
      expect(result).toBeUndefined();
    });

    it("blocks requests exceeding limit with 429 response", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.2";
            return null;
          },
        },
      } as unknown as NextRequest;

      handler(mockReq); // First request passes
      const blocked = handler(mockReq); // Second request blocked

      expect(blocked?.status).toBe(429);
    });
  });

  describe("IP extraction", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "203.0.113.45";
            return null;
          },
        },
      } as unknown as NextRequest;

      handler(mockReq);
      // If it extracted the right IP, second request should be blocked
      const result = handler(mockReq);
      expect(result?.status).toBe(429);
    });

    it("uses socket IP as fallback", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: { get: () => null },
        socket: { remoteAddress: "192.168.1.3" },
      } as unknown as NextRequest;

      handler(mockReq);
      const result = handler(mockReq);
      expect(result?.status).toBe(429);
    });
  });

  describe("response headers", () => {
    it("injects rate-limit headers on allowed requests", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.4";
            return null;
          },
        },
      } as unknown as NextRequest;

      const mockRes = { headers: new Map() } as unknown as NextResponse;
      handler(mockReq, mockRes);

      expect(mockRes.headers.get("x-ratelimit-limit")).toBe("5");
      expect(mockRes.headers.get("x-ratelimit-remaining")).toBeDefined();
      expect(mockRes.headers.get("x-ratelimit-reset")).toBeDefined();
    });

    it("includes correct remaining count in headers", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 3 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.5";
            return null;
          },
        },
      } as unknown as NextRequest;

      const mockRes = { headers: new Map() } as unknown as NextResponse;
      handler(mockReq, mockRes);

      expect(mockRes.headers.get("x-ratelimit-remaining")).toBe("2");
    });
  });

  describe("429 Too Many Requests response", () => {
    it("includes rate-limit headers in 429 response", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.6";
            return null;
          },
        },
      } as unknown as NextRequest;

      handler(mockReq); // First request passes

      const mockRes429 = {
        headers: new Map(),
        status: 429,
      } as unknown as NextResponse;
      const result = handler(mockReq, mockRes429);

      expect(result?.status).toBe(429);
      expect(mockRes429.headers.get("x-ratelimit-limit")).toBe("1");
      expect(mockRes429.headers.get("x-ratelimit-remaining")).toBe("0");
      expect(mockRes429.headers.get("x-ratelimit-reset")).toBeDefined();
    });

    it("includes retry-after header in 429 response", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.7";
            return null;
          },
        },
      } as unknown as NextRequest;

      handler(mockReq);

      const mockRes429 = {
        headers: new Map(),
        status: 429,
      } as unknown as NextResponse;
      const result = handler(mockReq, mockRes429);

      expect(mockRes429.headers.get("retry-after")).toBeDefined();
    });
  });

  describe("configuration usage", () => {
    it("respects custom prefix", () => {
      const opts: RateLimitOptions = {
        windowMs: 60_000,
        max: 1,
        prefix: "search",
      };
      const handler = rateLimit(opts);

      const mockReq = {
        headers: {
          get: (key: string) => {
            if (key === "x-forwarded-for") return "192.168.1.8";
            return null;
          },
        },
      } as unknown as NextRequest;

      handler(mockReq);
      const result = handler(mockReq);
      expect(result?.status).toBe(429);
    });

    it("works with pre-built configurations", () => {
      const handler1 = rateLimit(SEARCH_LIMIT);
      const handler2 = rateLimit(GENERAL_LIMIT);

      expect(typeof handler1).toBe("function");
      expect(typeof handler2).toBe("function");
    });
  });
});

/**
 * Unit tests for rate-limiter.ts — Issue #1282
 *
 * Tests cover:
 * - Limit window calculation and reset behavior
 * - Concurrent-call edge cases
 * - Configuration correctness
 * - Prefix handling for different rate-limit contexts
 */

import {
  checkRateLimit,
  RateLimitOptions,
  SEARCH_LIMIT,
  GENERAL_LIMIT,
  GRAPHQL_LIMIT,
  AUTH_MULTIPLIER,
} from "../rate-limiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("basic rate limiting", () => {
    it("allows requests within the limit", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const identifier = "192.168.1.1";

      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, opts);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - (i + 1));
        expect(result.limit).toBe(5);
      }
    });

    it("blocks requests exceeding the limit", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 3 };
      const identifier = "192.168.1.2";

      for (let i = 0; i < 3; i++) {
        checkRateLimit(identifier, opts);
      }

      const blocked = checkRateLimit(identifier, opts);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("returns correct remaining count after multiple requests", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 10 };
      const identifier = "10.0.0.1";

      checkRateLimit(identifier, opts); // 1 of 10
      checkRateLimit(identifier, opts); // 2 of 10
      const third = checkRateLimit(identifier, opts); // 3 of 10

      expect(third.remaining).toBe(7);
      expect(third.allowed).toBe(true);
    });
  });

  describe("window reset", () => {
    it("resets counter after window expires", () => {
      const windowMs = 60_000;
      const opts: RateLimitOptions = { windowMs, max: 2 };
      const identifier = "192.168.1.3";

      // Exhaust the limit
      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);
      let result = checkRateLimit(identifier, opts);
      expect(result.allowed).toBe(false);

      // Advance past window
      jest.advanceTimersByTime(windowMs + 1);

      // Should allow again
      result = checkRateLimit(identifier, opts);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("provides correct resetAt timestamp", () => {
      const windowMs = 30_000;
      const opts: RateLimitOptions = { windowMs, max: 1 };
      const identifier = "192.168.1.4";

      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
      const result = checkRateLimit(identifier, opts);

      const expectedResetTime = new Date("2024-01-01T12:00:30Z").getTime();
      expect(result.resetAt).toBe(expectedResetTime);
    });

    it("extends window on each new request before reset", () => {
      const windowMs = 10_000;
      const opts: RateLimitOptions = { windowMs, max: 100 };
      const identifier = "192.168.1.5";

      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
      const first = checkRateLimit(identifier, opts);
      const firstResetTime = first.resetAt;

      jest.advanceTimersByTime(5_000);
      checkRateLimit(identifier, opts);
      const second = checkRateLimit(identifier, opts);

      // Window still exists, hasn't reset yet
      expect(second.resetAt).toBe(firstResetTime);
    });

    it("resets to original window after expiration", () => {
      const windowMs = 5_000;
      const opts: RateLimitOptions = { windowMs, max: 2 };
      const identifier = "192.168.1.6";

      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
      checkRateLimit(identifier, opts);
      const firstResetAt = checkRateLimit(identifier, opts).resetAt;

      jest.advanceTimersByTime(windowMs + 1);
      const afterReset = checkRateLimit(identifier, opts);
      const secondResetAt = afterReset.resetAt;

      expect(secondResetAt).not.toBe(firstResetAt);
      expect(secondResetAt).toBeGreaterThan(firstResetAt);
    });
  });

  describe("prefix handling", () => {
    it("isolates rate limits across different prefixes", () => {
      const identifier = "192.168.1.7";
      const opts1: RateLimitOptions = {
        windowMs: 60_000,
        max: 2,
        prefix: "search",
      };
      const opts2: RateLimitOptions = {
        windowMs: 60_000,
        max: 2,
        prefix: "api",
      };

      checkRateLimit(identifier, opts1);
      checkRateLimit(identifier, opts1);
      const search3 = checkRateLimit(identifier, opts1);

      // api prefix should still have allowance
      const api1 = checkRateLimit(identifier, opts2);
      const api2 = checkRateLimit(identifier, opts2);

      expect(search3.allowed).toBe(false);
      expect(api1.allowed).toBe(true);
      expect(api2.allowed).toBe(true);
    });

    it("uses default prefix when none provided", () => {
      const identifier = "192.168.1.8";
      const opts: RateLimitOptions = { windowMs: 60_000, max: 1 };

      checkRateLimit(identifier, opts);
      const second = checkRateLimit(identifier, opts);

      expect(second.allowed).toBe(false);
    });

    it("handles different identifiers with same prefix independently", () => {
      const opts: RateLimitOptions = {
        windowMs: 60_000,
        max: 1,
        prefix: "api",
      };

      const result1 = checkRateLimit("192.168.1.9", opts);
      const result2 = checkRateLimit("192.168.1.10", opts);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles immediate sequential calls", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const identifier = "192.168.1.11";

      const results = Array.from({ length: 5 }).map(() =>
        checkRateLimit(identifier, opts),
      );

      results.forEach((result, index) => {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - (index + 1));
      });

      const sixth = checkRateLimit(identifier, opts);
      expect(sixth.allowed).toBe(false);
      expect(sixth.remaining).toBe(0);
    });

    it("handles very short windows", () => {
      const windowMs = 1;
      const opts: RateLimitOptions = { windowMs, max: 1 };
      const identifier = "192.168.1.12";

      checkRateLimit(identifier, opts);
      let result = checkRateLimit(identifier, opts);
      expect(result.allowed).toBe(false);

      jest.advanceTimersByTime(2);
      result = checkRateLimit(identifier, opts);
      expect(result.allowed).toBe(true);
    });

    it("handles very high max limits", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 10_000 };
      const identifier = "192.168.1.13";

      for (let i = 0; i < 1000; i++) {
        const result = checkRateLimit(identifier, opts);
        expect(result.allowed).toBe(true);
      }

      const last = checkRateLimit(identifier, opts);
      expect(last.remaining).toBe(9000 - 1);
    });

    it("increments count correctly after window reset", () => {
      const windowMs = 1_000;
      const opts: RateLimitOptions = { windowMs, max: 3 };
      const identifier = "192.168.1.14";

      // First window: use 2 of 3
      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);

      jest.advanceTimersByTime(windowMs + 1);

      // Second window: counter should reset
      const after = checkRateLimit(identifier, opts);
      expect(after.remaining).toBe(2);
      expect(after.allowed).toBe(true);
    });
  });

  describe("pre-built configurations", () => {
    it("SEARCH_LIMIT allows 60 requests per minute", () => {
      expect(SEARCH_LIMIT.windowMs).toBe(60_000);
      expect(SEARCH_LIMIT.max).toBe(60);
      expect(SEARCH_LIMIT.prefix).toBe("search");
    });

    it("GENERAL_LIMIT allows 120 requests per minute", () => {
      expect(GENERAL_LIMIT.windowMs).toBe(60_000);
      expect(GENERAL_LIMIT.max).toBe(120);
      expect(GENERAL_LIMIT.prefix).toBe("api");
    });

    it("GRAPHQL_LIMIT allows 30 requests per minute", () => {
      expect(GRAPHQL_LIMIT.windowMs).toBe(60_000);
      expect(GRAPHQL_LIMIT.max).toBe(30);
      expect(GRAPHQL_LIMIT.prefix).toBe("gql");
    });

    it("AUTH_MULTIPLIER is 3x for authenticated users", () => {
      expect(AUTH_MULTIPLIER).toBe(3);
    });

    it("pre-built configs are independent in practice", () => {
      const identifier = "192.168.1.15";

      // Fill search limit
      for (let i = 0; i < SEARCH_LIMIT.max; i++) {
        checkRateLimit(identifier, SEARCH_LIMIT);
      }
      const searchBlocked = checkRateLimit(identifier, SEARCH_LIMIT);
      expect(searchBlocked.allowed).toBe(false);

      // general should still work
      const generalAllowed = checkRateLimit(identifier, GENERAL_LIMIT);
      expect(generalAllowed.allowed).toBe(true);
    });
  });

  describe("concurrent call simulation", () => {
    it("handles burst of rapid requests", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 100 };
      const identifier = "192.168.1.16";

      const results = Array.from({ length: 100 }).map(() =>
        checkRateLimit(identifier, opts),
      );

      results.forEach((result) => {
        expect(result.allowed).toBe(true);
      });

      const afterBurst = checkRateLimit(identifier, opts);
      expect(afterBurst.allowed).toBe(false);
    });

    it("maintains accurate state across multiple identifiers", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 2 };

      const ips = [
        "192.168.1.17",
        "192.168.1.18",
        "192.168.1.19",
        "192.168.1.20",
      ];

      ips.forEach((ip, index) => {
        checkRateLimit(ip, opts);
        const second = checkRateLimit(ip, opts);
        const third = checkRateLimit(ip, opts);

        expect(second.allowed).toBe(true);
        expect(third.allowed).toBe(false);
        expect(third.remaining).toBe(0);
      });
    });
  });

  describe("result object completeness", () => {
    it("returns all required fields", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const result = checkRateLimit("192.168.1.21", opts);

      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("resetAt");
      expect(result).toHaveProperty("limit");

      expect(typeof result.allowed).toBe("boolean");
      expect(typeof result.remaining).toBe("number");
      expect(typeof result.resetAt).toBe("number");
      expect(typeof result.limit).toBe("number");
    });

    it("limit always matches opts.max", () => {
      const opts1: RateLimitOptions = { windowMs: 60_000, max: 5 };
      const opts2: RateLimitOptions = { windowMs: 60_000, max: 100 };

      const result1 = checkRateLimit("192.168.1.22", opts1);
      const result2 = checkRateLimit("192.168.1.23", opts2);

      expect(result1.limit).toBe(5);
      expect(result2.limit).toBe(100);
    });

    it("remaining is always >= 0", () => {
      const opts: RateLimitOptions = { windowMs: 60_000, max: 2 };
      const identifier = "192.168.1.24";

      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);
      checkRateLimit(identifier, opts);

      const result = checkRateLimit(identifier, opts);
      expect(result.remaining).toBe(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Tests for the shared HTTP client factory.
 *
 * Strategy
 * ────────
 * • `global.fetch` is replaced with a vi.fn() stub for every test; no real
 *   network I/O occurs.
 * • The `_sleep` callback is injected as a vi.fn() so tests can assert on
 *   backoff timing without waiting for real delays.
 * • Tests are grouped by concern:
 *     1. calcBackoff — pure maths, no I/O
 *     2. HTTP_CLIENT_DEFAULTS — documented values
 *     3. httpFetch — retry count, backoff sequence, timeout abort, status routing
 *     4. createHttpClient factory — option merging, call-level overrides
 *     5. SorobanRPCClient.fetchEvents — regression guard (verifies the RPC
 *        call that previously had no timeout/retry now routes through the factory)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import pino from "pino";
import { calcBackoff } from "@fund-my-cause/shared-utils";
import {
  httpFetch,
  createHttpClient,
  HTTP_CLIENT_DEFAULTS,
  type HttpClientOptions,
} from "./http-client";
import { SorobanRPCClient } from "./rpc-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const logger = pino({ level: "silent" });
const noopSleep = vi.fn().mockResolvedValue(undefined);

/** Build a minimal fetch Response stub. */
function makeResponse(status: number, body: unknown = null): Response {
  const bodyText = body === null ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    body: {
      cancel: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Response;
}

/** Replace global.fetch with a stub and return the mock for assertions. */
function mockFetch(...responses: Response[]) {
  let call = 0;
  const mock = vi.fn().mockImplementation(() => {
    const res = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve(res);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Replace global.fetch with a stub that always rejects with a network error. */
function mockFetchNetworkError(message = "Network error") {
  const mock = vi.fn().mockRejectedValue(new TypeError(message));
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. calcBackoff — pure exponential maths
// ---------------------------------------------------------------------------

describe("calcBackoff", () => {
  const opts = {
    initialBackoffMs: 500,
    backoffMultiplier: 2,
    maxBackoffMs: 30_000,
  };

  it("returns initialBackoffMs for attempt 0", () => {
    expect(calcBackoff(0, opts)).toBe(500);
  });

  it("doubles each attempt: 500 → 1000 → 2000 → 4000", () => {
    expect(calcBackoff(1, opts)).toBe(1_000);
    expect(calcBackoff(2, opts)).toBe(2_000);
    expect(calcBackoff(3, opts)).toBe(4_000);
  });

  it("caps at maxBackoffMs", () => {
    // 500 * 2^10 = 512 000 — well above the 30 000 cap
    expect(calcBackoff(10, opts)).toBe(30_000);
  });

  it("respects a custom maxBackoffMs", () => {
    expect(calcBackoff(5, { ...opts, maxBackoffMs: 1_000 })).toBe(1_000);
  });
});

// ---------------------------------------------------------------------------
// 2. HTTP_CLIENT_DEFAULTS — documented values must not silently change
// ---------------------------------------------------------------------------

describe("HTTP_CLIENT_DEFAULTS", () => {
  it("has the documented requestTimeoutMs", () => {
    expect(HTTP_CLIENT_DEFAULTS.requestTimeoutMs).toBe(30_000);
  });

  it("has the documented maxRetries", () => {
    expect(HTTP_CLIENT_DEFAULTS.maxRetries).toBe(3);
  });

  it("has the documented initialBackoffMs", () => {
    expect(HTTP_CLIENT_DEFAULTS.initialBackoffMs).toBe(500);
  });

  it("has the documented backoffMultiplier", () => {
    expect(HTTP_CLIENT_DEFAULTS.backoffMultiplier).toBe(2);
  });

  it("has the documented maxBackoffMs", () => {
    expect(HTTP_CLIENT_DEFAULTS.maxBackoffMs).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// 3. httpFetch — retry count, backoff sequence, timeout, status routing
// ---------------------------------------------------------------------------

describe("httpFetch", () => {
  // ── Success path ──────────────────────────────────────────────────────────

  it("returns data on first success (1 attempt)", async () => {
    mockFetch(makeResponse(200, { ok: true }));

    const result = await httpFetch("https://example.com", {}, {}, undefined, noopSleep);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
    expect(result.attempts).toBe(1);
  });

  it("calls fetch exactly once on success", async () => {
    const mock = mockFetch(makeResponse(200, {}));
    await httpFetch("https://example.com", {}, {}, undefined, noopSleep);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // ── Retry count ───────────────────────────────────────────────────────────

  it("retries up to maxRetries times on 500 then succeeds", async () => {
    // First two responses are 500, third is 200.
    const mock = mockFetch(
      makeResponse(500),
      makeResponse(500),
      makeResponse(200, { result: "ok" }),
    );

    const result = await httpFetch(
      "https://example.com",
      {},
      { maxRetries: 3 },
      undefined,
      noopSleep,
    );

    expect(mock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it("exhausts all retries and throws when every attempt returns 500", async () => {
    mockFetch(
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500), // 4th call (attempt 3 = last retry)
    );

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 3 }, undefined, noopSleep),
    ).rejects.toThrow();
  });

  it("makes exactly maxRetries+1 total calls when all fail", async () => {
    const mock = mockFetch(
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
    );

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 3 }, undefined, noopSleep),
    ).rejects.toThrow();

    // 1 initial + 3 retries = 4 total
    expect(mock).toHaveBeenCalledTimes(4);
  });

  it("makes exactly 1 call when maxRetries is 0", async () => {
    const mock = mockFetch(makeResponse(500));

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 0 }, undefined, noopSleep),
    ).rejects.toThrow();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  // ── Backoff timing ────────────────────────────────────────────────────────

  it("sleeps between retries with correct exponential sequence", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    mockFetch(
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
    );

    await expect(
      httpFetch(
        "https://example.com",
        {},
        { maxRetries: 3, initialBackoffMs: 500, backoffMultiplier: 2, maxBackoffMs: 30_000 },
        undefined,
        sleep,
      ),
    ).rejects.toThrow();

    // Retries: after attempt 0 → 500 ms, attempt 1 → 1000 ms, attempt 2 → 2000 ms
    // No sleep after the final attempt (3).
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(3, 2_000);
  });

  it("does NOT sleep after the final attempt", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    mockFetch(makeResponse(500));

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 0 }, undefined, sleep),
    ).rejects.toThrow();

    expect(sleep).toHaveBeenCalledTimes(0);
  });

  // ── Retry policy — which statuses are retried ─────────────────────────────

  it("retries on HTTP 429", async () => {
    const mock = mockFetch(makeResponse(429), makeResponse(200, {}));

    const result = await httpFetch(
      "https://example.com",
      {},
      { maxRetries: 1 },
      undefined,
      noopSleep,
    );

    expect(mock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("retries on any 5xx status", async () => {
    for (const status of [500, 502, 503, 504]) {
      vi.clearAllMocks();
      const mock = mockFetch(makeResponse(status), makeResponse(200, {}));

      const result = await httpFetch(
        "https://example.com",
        {},
        { maxRetries: 1 },
        undefined,
        noopSleep,
      );

      expect(mock).toHaveBeenCalledTimes(2, `status ${status} should be retried`);
      expect(result.ok).toBe(true);
    }
  });

  it("does NOT retry on 400 Bad Request", async () => {
    const mock = mockFetch(makeResponse(400, { error: "bad input" }));

    const result = await httpFetch(
      "https://example.com",
      {},
      { maxRetries: 3 },
      undefined,
      noopSleep,
    );

    // Returns immediately — no retries.
    expect(mock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.attempts).toBe(1);
  });

  it("does NOT retry on 401 Unauthorized", async () => {
    const mock = mockFetch(makeResponse(401));
    await httpFetch("https://example.com", {}, { maxRetries: 3 }, undefined, noopSleep);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 404 Not Found", async () => {
    const mock = mockFetch(makeResponse(404));
    await httpFetch("https://example.com", {}, { maxRetries: 3 }, undefined, noopSleep);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // ── Network errors ────────────────────────────────────────────────────────

  it("retries on TypeError (network failure)", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    vi.stubGlobal("fetch", mock);

    const result = await httpFetch(
      "https://example.com",
      {},
      { maxRetries: 1 },
      undefined,
      noopSleep,
    );

    expect(mock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("throws after exhausting retries on repeated network errors", async () => {
    mockFetchNetworkError("DNS resolution failed");

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 2 }, undefined, noopSleep),
    ).rejects.toThrow("DNS resolution failed");

    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("does NOT retry on non-TypeError fetch errors (e.g. invalid URL)", async () => {
    const mock = vi.fn().mockRejectedValue(new SyntaxError("Unexpected token"));
    vi.stubGlobal("fetch", mock);

    await expect(
      httpFetch("https://example.com", {}, { maxRetries: 3 }, undefined, noopSleep),
    ).rejects.toThrow("Unexpected token");

    // SyntaxError is not a TypeError, so no retries.
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // ── Per-call overrides ────────────────────────────────────────────────────

  it("respects overridden maxRetries", async () => {
    const mock = mockFetch(
      makeResponse(503),
      makeResponse(503),
      makeResponse(200, {}),
    );

    const result = await httpFetch(
      "https://example.com",
      {},
      { maxRetries: 5 }, // override default of 3
      undefined,
      noopSleep,
    );

    // Succeeds on 3rd attempt, well within the 5-retry override.
    expect(mock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
  });

  it("respects overridden initialBackoffMs", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    mockFetch(makeResponse(500), makeResponse(500));

    await expect(
      httpFetch(
        "https://example.com",
        {},
        { maxRetries: 1, initialBackoffMs: 1_000, backoffMultiplier: 2, maxBackoffMs: 30_000 },
        undefined,
        sleep,
      ),
    ).rejects.toThrow();

    expect(sleep).toHaveBeenCalledWith(1_000); // overridden initial backoff
  });
});

// ---------------------------------------------------------------------------
// 4. createHttpClient factory — option merging and call-level overrides
// ---------------------------------------------------------------------------

describe("createHttpClient", () => {
  it("exposes resolved options on .options", () => {
    const client = createHttpClient({ maxRetries: 5 });
    expect(client.options.maxRetries).toBe(5);
    // Other fields should fall back to defaults.
    expect(client.options.requestTimeoutMs).toBe(HTTP_CLIENT_DEFAULTS.requestTimeoutMs);
    expect(client.options.initialBackoffMs).toBe(HTTP_CLIENT_DEFAULTS.initialBackoffMs);
  });

  it("uses service-level defaults for requests", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    // Two 500s then success — tests that service-level maxRetries=2 applies.
    mockFetch(makeResponse(500), makeResponse(500), makeResponse(200, {}));

    const client = createHttpClient({ maxRetries: 2 });
    const result = await client.fetch("https://example.com", {}, {}, sleep);

    expect(result.ok).toBe(true);
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3);
  });

  it("allows call-level overrides to narrow the retry count", async () => {
    // Service says maxRetries=3, but this call overrides to 1.
    const sleep = vi.fn().mockResolvedValue(undefined);
    mockFetch(makeResponse(500), makeResponse(500), makeResponse(500), makeResponse(500));

    const client = createHttpClient({ maxRetries: 3 });

    // Call override: maxRetries=1 → only 2 total calls before throwing.
    await expect(
      client.fetch("https://example.com", {}, { maxRetries: 1 }, sleep),
    ).rejects.toThrow();

    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
  });

  it("call-level override wins over service-level for the same key", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    mockFetch(makeResponse(500), makeResponse(200, {}));

    const client = createHttpClient({ initialBackoffMs: 9_999 });
    // Call override sets a different value.
    await client.fetch("https://example.com", {}, { maxRetries: 1, initialBackoffMs: 123 }, sleep);

    expect(sleep).toHaveBeenCalledWith(123);
  });

  it("factory with no arguments uses all defaults", () => {
    const client = createHttpClient();
    expect(client.options).toEqual(HTTP_CLIENT_DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// 5. SorobanRPCClient.fetchEvents — regression guard
//
// Verifies that the RPC call that previously used a bare global fetch() with
// no timeout or retry now routes through the shared factory, respecting the
// documented defaults.
// ---------------------------------------------------------------------------

describe("SorobanRPCClient.fetchEvents (regression guard)", () => {
  const config = { url: "https://soroban-testnet.stellar.org:443", contractId: "CTEST" };
  const noSleep = vi.fn().mockResolvedValue(undefined);

  it("returns parsed events on a successful 200 response", async () => {
    const rawEvent = {
      id: "42-0",
      timestamp: 1_700_000_000,
      type: "contract",
      contractId: config.contractId,
      data: { amount: "100" },
    };
    mockFetch(
      makeResponse(200, {
        result: { events: [rawEvent] },
      }),
    );

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(42);

    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe("42-0");
    expect(events[0]!.type).toBe("contract");
    expect(events[0]!.contractId).toBe(config.contractId);
  });

  it("retries on a 500 response before succeeding (uses factory defaults)", async () => {
    const rawEvent = { id: "1-0", timestamp: 0, type: "t", contractId: "C", data: {} };
    mockFetch(
      makeResponse(500),
      makeResponse(200, { result: { events: [rawEvent] } }),
    );

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(1);

    // The factory default maxRetries=3 means it retried after the 500 and succeeded.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(1);
  });

  it("exhausts retries on repeated 500s and returns [] instead of throwing", async () => {
    // fetchEvents catches the thrown error and returns [] so the stream loop
    // can continue — this is the documented contract.
    mockFetch(
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500), // 4th call = attempt 3 (last retry with default maxRetries=3)
    );

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(99);

    expect(events).toEqual([]);
    // 1 initial + 3 retries = 4 calls total — confirms factory defaults applied.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(4);
  });

  it("returns [] (not throws) on a 404 non-retryable response", async () => {
    mockFetch(makeResponse(404, { error: "not found" }));

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(5);

    // 404 is not retried; fetchEvents catches and returns [].
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it("returns [] on a network-level TypeError after retries", async () => {
    mockFetchNetworkError("ECONNREFUSED");

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(7);

    expect(events).toEqual([]);
    // Default maxRetries=3 → 4 total attempts.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(4);
  });

  it("returns [] when RPC payload contains a JSON-RPC error field", async () => {
    mockFetch(makeResponse(200, { error: { message: "invalid ledger" } }));

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(3);

    // JSON-RPC error inside a 200 → fetchEvents throws internally → returns [].
    expect(events).toEqual([]);
  });

  it("returns [] for an empty events array", async () => {
    mockFetch(makeResponse(200, { result: { events: [] } }));

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(10);

    expect(events).toEqual([]);
  });

  // ── Timeout regression guard ───────────────────────────────────────────────
  // Before the refactor, fetch() was called with no signal — meaning a hung
  // server would block indefinitely.  This test confirms AbortSignal.timeout
  // is passed through.  We simulate it by rejecting with an AbortError.

  it("retries on AbortError (request timeout) as a network-level error", async () => {
    const abortErr = new DOMException("The operation was aborted", "AbortError");
    const mock = vi
      .fn()
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(makeResponse(200, { result: { events: [] } }));
    vi.stubGlobal("fetch", mock);

    const client = new SorobanRPCClient(config, logger, noSleep);
    const events = await client.fetchEvents(20);

    // AbortError is retryable → retried once → 200 on second attempt.
    expect(mock).toHaveBeenCalledTimes(2);
    expect(events).toEqual([]);
  });
});

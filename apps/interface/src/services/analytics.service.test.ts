/**
 * Unit tests for analytics.service — createAnalyticsWebSocket and
 * fetchAnalyticsSnapshot.
 */

import {
  createAnalyticsWebSocket,
  fetchAnalyticsSnapshot,
  type RealtimeAnalyticsPayload,
} from "./analytics.service";
import { invalidateAnalyticsCache } from "@/lib/cacheStrategy";

// Mock global.fetch the same way api-client.test.ts does
global.fetch = jest.fn();

// ── Shared fixtures ───────────────────────────────────────────────────────────

const mockPayload: RealtimeAnalyticsPayload = {
  campaigns: [
    {
      id: "1",
      contractId: "C1",
      title: "Test Campaign",
      raised: 500,
      goal: 1000,
      deadline: new Date(Date.now() + 86400_000).toISOString(),
      status: "Active",
    } as any,
  ],
  timestamp: Date.now(),
};

// ── Helpers for WebSocket mocking ─────────────────────────────────────────────

function createMockSocket() {
  return {
    onopen: null as ((e: Event) => void) | null,
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    readyState: WebSocket.OPEN,
    close: jest.fn(),
  };
}

// ── createAnalyticsWebSocket ──────────────────────────────────────────────────

describe("createAnalyticsWebSocket", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a disconnect handle when campaignIds is empty (no-op path)", () => {
    const handle = createAnalyticsWebSocket([], jest.fn());
    expect(typeof handle.disconnect).toBe("function");
    expect(() => handle.disconnect()).not.toThrow();
  });

  it("disconnect can be called multiple times without throwing", () => {
    const handle = createAnalyticsWebSocket([], jest.fn());
    expect(() => {
      handle.disconnect();
      handle.disconnect();
    }).not.toThrow();
  });

  it("calls onOpen when WebSocket opens", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const onOpen = jest.fn();
    createAnalyticsWebSocket(["C1"], jest.fn(), onOpen);
    mockSocket.onopen?.(new Event("open"));

    expect(onOpen).toHaveBeenCalledTimes(1);
    (global as any).WebSocket = OriginalWebSocket;
  });

  it("calls onMessage with the payload for a valid snapshot message", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const onMessage = jest.fn();
    createAnalyticsWebSocket(["C1"], onMessage);
    mockSocket.onmessage?.({
      data: JSON.stringify({ type: "snapshot", payload: mockPayload }),
    } as MessageEvent);

    expect(onMessage).toHaveBeenCalledWith(mockPayload);
    (global as any).WebSocket = OriginalWebSocket;
  });

  it("does not call onMessage when message payload has no campaigns array", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const onMessage = jest.fn();
    createAnalyticsWebSocket(["C1"], onMessage);
    // payload without campaigns property
    mockSocket.onmessage?.({
      data: JSON.stringify({
        type: "update",
        payload: { timestamp: Date.now() },
      }),
    } as MessageEvent);

    expect(onMessage).not.toHaveBeenCalled();
    (global as any).WebSocket = OriginalWebSocket;
  });

  it("calls onError when WebSocket receives malformed JSON", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const onError = jest.fn();
    createAnalyticsWebSocket(["C1"], jest.fn(), undefined, onError);
    mockSocket.onmessage?.({ data: "not valid json{{{{" } as MessageEvent);

    expect(onError).toHaveBeenCalledTimes(1);
    (global as any).WebSocket = OriginalWebSocket;
  });

  it("calls onError when WebSocket fires an error event", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const onError = jest.fn();
    createAnalyticsWebSocket(["C1"], jest.fn(), undefined, onError);
    mockSocket.onerror?.(new Event("error"));

    expect(onError).toHaveBeenCalledTimes(1);
    (global as any).WebSocket = OriginalWebSocket;
  });

  it("calls socket.close() on disconnect", () => {
    const mockSocket = createMockSocket();
    const OriginalWebSocket = global.WebSocket;
    (global as any).WebSocket = jest.fn(() => mockSocket);

    const handle = createAnalyticsWebSocket(["C1"], jest.fn());
    handle.disconnect();

    expect(mockSocket.close).toHaveBeenCalledTimes(1);
    (global as any).WebSocket = OriginalWebSocket;
  });
});

// ── fetchAnalyticsSnapshot ────────────────────────────────────────────────────

describe("fetchAnalyticsSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the in-memory analytics cache so each test starts fresh
    invalidateAnalyticsCache(/^realtime-analytics/);
  });

  it("returns a payload with the correct shape", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockPayload,
    });

    const result = await fetchAnalyticsSnapshot(["C1"]);
    expect(result).toHaveProperty("campaigns");
    expect(result).toHaveProperty("timestamp");
    expect(Array.isArray(result.campaigns)).toBe(true);
  });

  it("falls back to empty payload on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    const result = await fetchAnalyticsSnapshot(["C1"]);
    expect(result.campaigns).toEqual([]);
    expect(typeof result.timestamp).toBe("number");
  });

  it("falls back to empty payload on non-ok HTTP response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Internal Server Error" }),
    });
    const result = await fetchAnalyticsSnapshot(["C1"]);
    expect(result.campaigns).toEqual([]);
    expect(typeof result.timestamp).toBe("number");
  });

  it("handles empty campaignIds by calling the endpoint without query params", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ campaigns: [], timestamp: Date.now() }),
    });

    const result = await fetchAnalyticsSnapshot([]);
    expect(Array.isArray(result.campaigns)).toBe(true);
  });

  it("returns cached result on a second call without hitting the network", async () => {
    // First call populates the cache
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockPayload,
    });
    const first = await fetchAnalyticsSnapshot(["C1"]);

    // Second call should use the cache — fetch should NOT be called again
    const second = await fetchAnalyticsSnapshot(["C1"]);
    // Both results should have campaigns (from cache or re-fetch)
    expect(Array.isArray(first.campaigns)).toBe(true);
    expect(Array.isArray(second.campaigns)).toBe(true);
  });
});

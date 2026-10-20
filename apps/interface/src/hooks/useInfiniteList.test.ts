/**
 * Unit tests for useInfiniteList
 *
 * Coverage:
 *  - Initial page loads on sentinel intersection
 *  - Multi-page accumulation (page boundary)
 *  - hasMore=false stops further fetches
 *  - Error sets error state
 *  - Auto-retry with exponential back-off
 *  - Manual retry resets back-off counter
 *  - reset() returns to initial state
 *  - Cursor-based pagination forwards nextCursor correctly
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useInfiniteList } from "../useInfiniteList";

// ── IntersectionObserver mock ────────────────────────────────────────────────

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;
const observerCallbacks = new Map<Element, ObserverCallback>();
let mockObserve: jest.Mock;
let mockDisconnect: jest.Mock;

/** Test-only extension so we can stash the observer callback on window. */
interface TestWindow extends Window {
  __lastObserverCallback?: ObserverCallback;
}

beforeEach(() => {
  mockObserve = jest.fn((el: Element) => {
    const cb = (window as TestWindow).__lastObserverCallback;
    if (cb) observerCallbacks.set(el, cb);
  });
  mockDisconnect = jest.fn();

  window.IntersectionObserver = jest.fn((cb: ObserverCallback) => {
    (window as TestWindow).__lastObserverCallback = cb;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
    } as unknown as IntersectionObserver;
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  observerCallbacks.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Helper: trigger intersection on all observed sentinels.
function intersect() {
  observerCallbacks.forEach((cb) => {
    cb([{ isIntersecting: true } as IntersectionObserverEntry]);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useInfiniteList", () => {
  it("starts with empty items, isLoading=false, hasMore=true", () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], hasMore: false });
    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("loads first page when sentinel intersects", async () => {
    const page1 = ["a", "b", "c"];
    const fetcher = jest
      .fn()
      .mockResolvedValue({ items: page1, hasMore: false });

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    act(() => intersect());

    await waitFor(() => expect(result.current.items).toEqual(page1));
    expect(result.current.hasMore).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(1, undefined);
  });

  it("accumulates items across multiple pages (page boundary)", async () => {
    const pages = [
      { items: [1, 2, 3], hasMore: true },
      { items: [4, 5, 6], hasMore: true },
      { items: [7], hasMore: false },
    ];
    let call = 0;
    const fetcher = jest.fn().mockImplementation(async () => pages[call++]);

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    // Page 1
    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(3));

    // Page 2
    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(6));

    // Page 3
    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(7));

    expect(result.current.hasMore).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(2, 2, undefined);
    expect(fetcher).toHaveBeenNthCalledWith(3, 3, undefined);
  });

  it("does not fetch when hasMore is false", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({ items: ["x"], hasMore: false });

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    // Load page 1
    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    // Try to trigger again — should be a no-op.
    act(() => intersect());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });

  it("sets error state when fetcher rejects", async () => {
    jest.useFakeTimers();
    const err = new Error("Network failure");
    const fetcher = jest.fn().mockRejectedValue(err);

    const { result } = renderHook(() =>
      useInfiniteList({ fetcher, maxRetries: 0 }),
    );

    act(() => intersect());

    await waitFor(() => expect(result.current.error).toEqual(err));
    expect(result.current.isLoading).toBe(false);
  });

  it("auto-retries with exponential back-off on failure", async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn().mockRejectedValue(new Error("oops"));

    const { result } = renderHook(() =>
      useInfiniteList({ fetcher, maxRetries: 2, retryBaseDelay: 100 }),
    );

    act(() => intersect());
    // Allow initial attempt to settle.
    await act(async () => {
      await Promise.resolve();
    });

    // First retry after 100 ms.
    act(() => jest.advanceTimersByTime(100));
    await act(async () => {
      await Promise.resolve();
    });

    // Second retry after 200 ms.
    act(() => jest.advanceTimersByTime(200));
    await act(async () => {
      await Promise.resolve();
    });

    // All 3 calls (initial + 2 retries) should have happened.
    expect(fetcher).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("manual retry resets back-off and calls fetcher again", async () => {
    jest.useFakeTimers();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValue({ items: ["ok"], hasMore: false });

    const { result } = renderHook(() =>
      useInfiniteList({ fetcher, maxRetries: 0 }),
    );

    // Trigger initial failure.
    act(() => intersect());
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Manual retry should succeed.
    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.items).toEqual(["ok"]));
    expect(result.current.error).toBeNull();
  });

  it("reset() returns the list to its initial state", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({ items: ["a"], hasMore: true });

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.reset());

    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("forwards cursor to subsequent page fetches", async () => {
    const pages = [
      { items: ["a"], hasMore: true, nextCursor: "cursor-1" },
      { items: ["b"], hasMore: false, nextCursor: undefined },
    ];
    let call = 0;
    const fetcher = jest.fn().mockImplementation(async () => pages[call++]);

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => intersect());
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(fetcher).toHaveBeenNthCalledWith(2, 2, "cursor-1");
  });

  it("does not start a new load while one is already in-flight", async () => {
    let resolve!: () => void;
    const fetcher = jest.fn().mockImplementation(
      () =>
        new Promise<{ items: string[]; hasMore: false }>((res) => {
          resolve = () => res({ items: ["x"], hasMore: false });
        }),
    );

    const { result } = renderHook(() => useInfiniteList({ fetcher }));

    // Trigger once — load starts.
    act(() => intersect());
    expect(result.current.isLoading).toBe(true);

    // Trigger again while in-flight.
    act(() => intersect());

    // Resolve the pending request.
    await act(async () => {
      resolve();
      await Promise.resolve();
    });

    // Fetcher should only have been called once.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

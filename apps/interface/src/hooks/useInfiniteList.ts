"use client";

/**
 * useInfiniteList
 * ───────────────
 * A single shared hook that combines infinite-scroll sentinel observation
 * with generic paged-list state management.
 *
 * It encapsulates:
 *   - holding the accumulated items array
 *   - tracking the current page / cursor
 *   - intersecting a sentinel element to auto-load the next page
 *   - auto-retry with exponential back-off on failure
 *   - a manual retry / reset API
 *
 * Usage
 * ─────
 * ```tsx
 * const { items, sentinelRef, isLoading, hasMore, error, retry } =
 *   useInfiniteList({
 *     fetcher: async (page) => {
 *       const res = await fetchCampaigns({ page, pageSize: 12 });
 *       return { items: res.campaigns, hasMore: res.hasNextPage };
 *     },
 *   });
 *
 * return (
 *   <>
 *     {items.map((c) => <CampaignCard key={c.id} campaign={c} />)}
 *     <div ref={sentinelRef} />
 *     {isLoading && <Spinner />}
 *     {error && <RetryButton onClick={retry} />}
 *   </>
 * );
 * ```
 *
 * Cursor-based pagination
 * ───────────────────────
 * To use cursors instead of page numbers, supply an `initialCursor` (usually
 * `undefined`) and have your fetcher return `{ items, hasMore, nextCursor }`.
 * The hook will forward the cursor on subsequent pages:
 *
 * ```tsx
 * const { items, sentinelRef } = useInfiniteList({
 *   fetcher: async (_page, cursor) => {
 *     const res = await gqlClient.campaigns({ after: cursor, first: 20 });
 *     return {
 *       items: res.edges.map((e) => e.node),
 *       hasMore: res.pageInfo.hasNextPage,
 *       nextCursor: res.pageInfo.endCursor,
 *     };
 *   },
 * });
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfiniteListPage<T> {
  /** Items for this page. */
  items: T[];
  /** Whether more pages exist after this one. */
  hasMore: boolean;
  /**
   * Optional cursor to pass to the next call.
   * When omitted the hook uses a 1-based page counter instead.
   */
  nextCursor?: string;
}

export interface UseInfiniteListOptions<T> {
  /**
   * Async function that fetches one page of data.
   *
   * @param page    1-based page number (always provided; use when your API is offset-based)
   * @param cursor  Cursor from the previous page (undefined for the first page)
   */
  fetcher: (
    page: number,
    cursor: string | undefined,
  ) => Promise<InfiniteListPage<T>>;

  /** Initial cursor value (typically `undefined`). */
  initialCursor?: string;

  /** IntersectionObserver threshold. Defaults to 0.1. */
  threshold?: number;
  /** IntersectionObserver rootMargin. Defaults to "100px". */
  rootMargin?: string;

  /** Maximum auto-retry attempts per failed page. Defaults to 3. */
  maxRetries?: number;
  /** Base delay (ms) for exponential back-off. Defaults to 1 000. */
  retryBaseDelay?: number;
}

export interface UseInfiniteListReturn<T> {
  /** Accumulated list of all items fetched so far. */
  items: T[];
  /**
   * Attach to a sentinel element at the bottom of the list.
   * When the sentinel enters the viewport the next page is loaded.
   */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** True while any page is loading. */
  isLoading: boolean;
  /** Whether more pages remain after the last successful fetch. */
  hasMore: boolean;
  /** The error from the last failed page load, or null. */
  error: Error | null;
  /** Manually retry the last failed page load (resets back-off counter). */
  retry: () => void;
  /** Reset the list back to its initial empty state. */
  reset: () => void;
}

// ── Implementation ────────────────────────────────────────────────────────────

export function useInfiniteList<T>(
  options: UseInfiniteListOptions<T>,
): UseInfiniteListReturn<T> {
  const {
    fetcher,
    initialCursor,
    threshold = 0.1,
    rootMargin = "100px",
    maxRetries = 3,
    retryBaseDelay = 1_000,
  } = options;

  // ── State ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Mutable refs (don't trigger re-renders) ────────────────────────────────
  const pageRef = useRef(1);
  const cursorRef = useRef<string | undefined>(initialCursor);
  const isLoadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep stable reference to fetcher so effects re-run only when it changes.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── Core load function ─────────────────────────────────────────────────────

  const loadNextPage = useCallback(
    async (isRetry = false) => {
      // Guard: skip if already loading or nothing more to fetch.
      if (isLoadingRef.current) return;
      if (!isRetry && !hasMore) return;

      isLoadingRef.current = true;
      setIsLoading(true);

      if (!isRetry) {
        retryCountRef.current = 0;
      }
      setError(null);

      try {
        const page = await fetcherRef.current(
          pageRef.current,
          cursorRef.current,
        );

        setItems((prev) => [...prev, ...page.items]);
        setHasMore(page.hasMore);
        cursorRef.current = page.nextCursor;
        pageRef.current += 1;
        retryCountRef.current = 0;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);

        // Exponential back-off auto-retry.
        if (retryCountRef.current < maxRetries) {
          const delay = retryBaseDelay * 2 ** retryCountRef.current;
          retryCountRef.current += 1;
          clearRetryTimer();
          retryTimerRef.current = setTimeout(() => {
            isLoadingRef.current = false;
            void loadNextPage(true);
          }, delay);
        }
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [hasMore, maxRetries, retryBaseDelay, clearRetryTimer],
  );

  // ── IntersectionObserver ───────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !error && hasMore) {
          void loadNextPage();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, threshold, rootMargin, error, hasMore]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => clearRetryTimer(), [clearRetryTimer]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    clearRetryTimer();
    retryCountRef.current = 0;
    isLoadingRef.current = false;
    setError(null);
    void loadNextPage(false);
  }, [clearRetryTimer, loadNextPage]);

  const reset = useCallback(() => {
    clearRetryTimer();
    setItems([]);
    setIsLoading(false);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
    retryCountRef.current = 0;
    pageRef.current = 1;
    cursorRef.current = initialCursor;
  }, [clearRetryTimer, initialCursor]);

  return { items, sentinelRef, isLoading, hasMore, error, retry, reset };
}

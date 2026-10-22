/**
 * Rate limiting utilities.
 *
 * Configuration options:
 * - `limit`: maximum number of calls allowed within a single window.
 * - `windowMs`: length of the sliding window in milliseconds.
 * - `now`: optional clock injection (defaults to `Date.now`) for deterministic tests.
 *
 * Behavior:
 * - Calls are tracked per key. When the number of calls within the current
 *   window reaches `limit`, further calls are rejected until the window resets.
 * - The window resets once `windowMs` has elapsed since the first call in the
 *   window, at which point the counter is cleared and a fresh window begins.
 * - Concurrent calls are evaluated synchronously against the same window state,
 *   so a burst that exceeds `limit` is throttled deterministically.
 */

export interface RateLimitOptions {
  /** Maximum number of calls allowed within a single window. */
  limit: number;
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** Optional clock injection for deterministic testing. */
  now?: () => number;
}

export interface RateLimitResult {
  /** Whether the call is allowed under the current window. */
  allowed: boolean;
  /** Remaining calls in the current window. */
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetInMs: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

export interface RateLimiter {
  /**
   * Evaluate a call for the given key, consuming a slot when allowed.
   */
  check(key: string): RateLimitResult;
  /** Reset the window state for a key (or all keys when omitted). */
  reset(key?: string): void;
}

/**
 * Create a rate limiter that tracks call counts per key within a sliding window.
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const windows = new Map<string, WindowState>();

  function check(key: string): RateLimitResult {
    const current = now();
    let state = windows.get(key);

    if (!state || current - state.windowStart >= windowMs) {
      state = { count: 0, windowStart: current };
      windows.set(key, state);
    }

    const resetInMs = Math.max(0, state.windowStart + windowMs - current);

    if (state.count >= limit) {
      return { allowed: false, remaining: 0, resetInMs };
    }

    state.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - state.count),
      resetInMs,
    };
  }

  function reset(key?: string): void {
    if (key === undefined) {
      windows.clear();
      return;
    }
    windows.delete(key);
  }

  return { check, reset };
}

/**
 * Shared retry-with-backoff primitives.
 *
 * Both the indexer HTTP client and the RPC client need the same exponential
 * backoff schedule, but they classify failures differently:
 *
 * - HTTP responses are retryable based on status (429 / 5xx).
 * - RPC errors are retryable based on status or timeout metadata.
 *
 * `retryWithBackoff` owns the retry loop and delay calculation; callers own the
 * decision about which failures should be retried.
 */

export interface BackoffOptions {
  /** Delay (ms) before the first retry. */
  initialBackoffMs: number;
  /** Multiplier applied to the backoff after each retry. */
  backoffMultiplier: number;
  /** Upper bound (ms) on any single inter-attempt delay. */
  maxBackoffMs: number;
}

export interface RetryWithBackoffOptions extends BackoffOptions {
  /** Maximum number of retries after the first attempt. */
  maxRetries: number;
  /**
   * Decide whether the failed attempt should be retried.
   *
   * `attempt` is zero-based and identifies the attempt that just failed.
   */
  shouldRetry: (error: unknown, attempt: number) => boolean;
  /** Injectable delay function — used by tests to avoid real waiting. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Calculates the capped exponential backoff delay for a given attempt index.
 * attempt=0 → initialBackoffMs, attempt=1 → initialBackoffMs*multiplier, …
 */
export function calcBackoff(attempt: number, opts: BackoffOptions): number {
  const raw = opts.initialBackoffMs * Math.pow(opts.backoffMultiplier, attempt);
  return Math.min(raw, opts.maxBackoffMs);
}

/** Promisified sleep, injectable by callers that need deterministic tests. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `operation` with bounded exponential-backoff retries.
 *
 * The helper retries only when `shouldRetry` returns true and attempts remain.
 * Non-retryable errors are rethrown immediately; once retries are exhausted the
 * last error is rethrown so callers can preserve their existing error contract.
 */
export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryWithBackoffOptions,
): Promise<T> {
  const { maxRetries, shouldRetry } = options;

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError("maxRetries must be a non-negative integer");
  }

  const wait = options.sleep ?? sleep;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      await wait(calcBackoff(attempt, options));
    }
  }

  // The loop always either returns, throws, or exhausts the attempts above.
  throw lastError ?? new Error("Retry operation failed without an error");
}

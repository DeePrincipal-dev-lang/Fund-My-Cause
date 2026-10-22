import { retryWithBackoff, sleep } from "@fund-my-cause/shared-utils";

/** Retry configuration options. */
export interface RetryOptions {
  /** Maximum number of retry attempts. @default 3 */
  maxRetries?: number;
  /** Initial delay in milliseconds between retries. @default 1000 */
  baseDelayMs?: number;
  /** Multiplier applied to delay between retries. @default 2 */
  backoffMultiplier?: number;
  /** Maximum delay in milliseconds between retries. @default 30000 */
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry. @default [500, 502, 503, 504] */
  retryableStatusCodes?: number[];
  /** Whether to retry on timeout errors. @default true */
  retryOnTimeout?: boolean;
}

/** Result of a retry operation. */
export interface RetryResult<T> {
  /** The final response data. */
  data: T;
  /** Total number of attempts made (including the initial attempt). */
  attempts: number;
  /** Total time spent in retries in milliseconds. */
  totalDelayMs: number;
}

/** Error thrown when all retry attempts are exhausted. */
export class RetryExhaustedError extends Error {
  constructor(message: string, public readonly attempts: number, public readonly lastError: Error) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * - Retries on timeout errors if `retryOnTimeout` is true
 * - Retries on HTTP 5xx status codes listed in `retryableStatusCodes`
 * - Does NOT retry on 4xx status codes (client errors)
 * - Uses exponential backoff: baseDelay * multiplier^(attempt-1), capped at maxDelay
 *
 * The loop and backoff schedule are provided by
 * `@fund-my-cause/shared-utils/retry`; this wrapper preserves the RPC client's
 * existing result and error contract.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
    retryableStatusCodes = [500, 502, 503, 504],
    retryOnTimeout = true,
  } = options;

  let attempts = 0;
  let totalDelayMs = 0;
  let lastError: Error = new Error("No attempts made");

  const data = await retryWithBackoff(
    async (attempt) => {
      attempts = attempt + 1;

      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt >= maxRetries) {
          throw new RetryExhaustedError(
            `All ${maxRetries + 1} retry attempts exhausted: ${lastError.message}`,
            maxRetries + 1,
            lastError,
          );
        }

        throw lastError;
      }
    },
    {
      maxRetries,
      initialBackoffMs: baseDelayMs,
      backoffMultiplier,
      maxBackoffMs: maxDelayMs,
      shouldRetry: (error) =>
        shouldRetryError(error as Error, { retryableStatusCodes, retryOnTimeout }),
      sleep: async (ms) => {
        totalDelayMs += ms;
        await sleep(ms);
      },
    },
  );

  return { data, attempts, totalDelayMs };
}

function shouldRetryError(
  error: Error,
  options: { retryableStatusCodes: number[]; retryOnTimeout: boolean },
): boolean {
  const statusCode = (error as { status?: number; status_code?: number }).status
    ?? (error as { status_code?: number }).status_code;

  if (statusCode !== undefined) {
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
    return options.retryableStatusCodes.includes(statusCode);
  }

  if (options.retryOnTimeout) {
    const isTimeout = error.message.toLowerCase().includes("timeout")
      || error.name === "TimeoutError"
      || error.name === "AbortError";
    if (isTimeout) return true;
  }

  return false;
}

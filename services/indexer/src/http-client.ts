/**
 * Shared HTTP client factory for the indexer service.
 *
 * Documented defaults
 * ───────────────────
 * REQUEST_TIMEOUT_MS   30 000  Total time allowed for a single attempt (AbortSignal.timeout)
 * MAX_RETRIES          3       Attempts after the first failure (4 total calls at most)
 * INITIAL_BACKOFF_MS   500     First inter-attempt delay
 * BACKOFF_MULTIPLIER   2       Each subsequent delay is doubled (500 → 1 000 → 2 000)
 * MAX_BACKOFF_MS       30 000  Upper cap on any single delay
 *
 * Retry policy
 * ────────────
 * Retried:     network / timeout errors, HTTP 429, HTTP 5xx
 * Not retried: HTTP 4xx (except 429) — these are caller errors and won't self-heal
 *
 * Trace-ID propagation
 * ────────────────────
 * Pass a `traceId` string to `createHttpClient` (or directly to `httpFetch`)
 * and the client will attach it as the `X-Trace-ID` request header on every
 * outbound call, including retries.  This ensures the same trace ID that was
 * generated (or accepted) by the graphql-api is visible in downstream service
 * logs without any per-call boilerplate.
 *
 * Per-call overrides
 * ──────────────────
 * Pass a Partial<HttpClientOptions> as the third argument to `httpFetch` to
 * override any default for that specific call.  This exists for the handful of
 * calls that genuinely need different behaviour (e.g. a longer timeout when
 * streaming large payloads).  Every override should be accompanied by a comment
 * explaining why the default is insufficient.
 */

import { retryWithBackoff } from "@fund-my-cause/shared-utils";
import { TRACE_ID_HEADER } from "./trace.js";

export { calcBackoff } from "@fund-my-cause/shared-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpClientOptions {
  /** Total time (ms) allowed for a single HTTP attempt before it is aborted. */
  requestTimeoutMs: number;
  /** Maximum number of retries after the first failure (0 = no retries). */
  maxRetries: number;
  /** Delay (ms) before the first retry. */
  initialBackoffMs: number;
  /** Multiplier applied to the backoff after each retry. */
  backoffMultiplier: number;
  /** Upper bound (ms) on any single inter-attempt delay. */
  maxBackoffMs: number;
}

export interface HttpClientResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  /** Total attempts made (1 = no retries were needed). */
  attempts: number;
}

// ---------------------------------------------------------------------------
// Defaults (exported so tests and callers can reference them by name)
// ---------------------------------------------------------------------------

export const HTTP_CLIENT_DEFAULTS: Readonly<HttpClientOptions> = {
  requestTimeoutMs: 30_000,
  maxRetries: 3,
  initialBackoffMs: 500,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the error or HTTP status warrants a retry.
 *
 * Network-level errors (TypeError from fetch, AbortError) are always retried.
 * HTTP 429 Too Many Requests and any 5xx server error are retried.
 * All other HTTP errors (4xx) are not retried — they will not self-heal.
 */
function isRetryable(error: unknown, status?: number): boolean {
  if (status !== undefined) {
    return status === 429 || status >= 500;
  }
  // Network / timeout errors thrown by fetch
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "AbortError")
  );
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Executes a fetch request with automatic retry, exponential backoff,
 * per-attempt timeouts, and optional X-Trace-ID propagation.
 *
 * @param url      Destination URL
 * @param init     Standard RequestInit (method, headers, body, …)
 * @param overrides  Per-call option overrides. Document why in a comment at the call site.
 * @param traceId  When provided, sets the X-Trace-ID header on every attempt.
 *                 Callers that already set the header in `init` take precedence.
 * @param _sleep   Injectable sleep function — used by unit tests to avoid real delays.
 */
export async function httpFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  overrides: Partial<HttpClientOptions> = {},
  traceId?: string,
  _sleep?: (ms: number) => Promise<void>,
): Promise<HttpClientResult<T>> {
  const opts: HttpClientOptions = { ...HTTP_CLIENT_DEFAULTS, ...overrides };

  // Merge the trace ID header into the caller-supplied headers once so it
  // is present on every attempt, including retries.  Caller-supplied values
  // always win — we only inject when the header is absent.
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (traceId && !headers[TRACE_ID_HEADER]) {
    headers[TRACE_ID_HEADER] = traceId;
  }
  const initWithTrace: RequestInit = { ...init, headers };

  let lastStatus: number | undefined;

  return retryWithBackoff(
    async (attempt) => {
      // Each attempt gets its own AbortSignal so a timed-out attempt does not
      // poison subsequent ones.
      const signal = AbortSignal.timeout(opts.requestTimeoutMs);

      let response: Response;
      try {
        response = await fetch(url, { ...initWithTrace, signal });
        lastStatus = response.status;
      } catch (err) {
        lastStatus = undefined;
        throw err;
      }

      if (!isRetryable(undefined, response.status)) {
        // Success or a non-retryable client error — return immediately.
        const data = (await response.json().catch(() => null)) as T;
        return {
          ok: response.ok,
          status: response.status,
          data,
          attempts: attempt + 1,
        };
      }

      // Retryable HTTP status — consume body to free the connection, then retry.
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    },
    {
      maxRetries: opts.maxRetries,
      initialBackoffMs: opts.initialBackoffMs,
      backoffMultiplier: opts.backoffMultiplier,
      maxBackoffMs: opts.maxBackoffMs,
      shouldRetry: (error) => isRetryable(error, lastStatus),
      sleep: _sleep,
    },
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a pre-configured fetch wrapper with service-level defaults baked in.
 * Individual calls can still override specific options via the `overrides`
 * parameter.
 *
 * Pass `traceId` once at construction time so every outbound request from
 * this client carries the same X-Trace-ID header automatically.  This is the
 * recommended pattern for request-scoped clients: create one client per
 * inbound request, pass the resolved trace ID, then discard the client when
 * the request completes.
 *
 * Usage:
 *   const client = createHttpClient({ requestTimeoutMs: 60_000 }, traceId);
 *   const result = await client.fetch<MyType>(url, { method: "POST", body: "…" });
 */
export function createHttpClient(
  serviceDefaults: Partial<HttpClientOptions> = {},
  traceId?: string,
) {
  const merged: HttpClientOptions = { ...HTTP_CLIENT_DEFAULTS, ...serviceDefaults };

  return {
    /** The resolved options this client was created with. */
    options: merged as Readonly<HttpClientOptions>,

    /** The trace ID bound to this client instance (may be undefined). */
    traceId,

    fetch<T = unknown>(
      url: string,
      init: RequestInit = {},
      callOverrides: Partial<HttpClientOptions> = {},
      _sleep?: (ms: number) => Promise<void>,
    ): Promise<HttpClientResult<T>> {
      // Call-level overrides are layered on top of the service-level defaults.
      return httpFetch<T>(
        url,
        init,
        { ...serviceDefaults, ...callOverrides },
        traceId,
        _sleep,
      );
    },
  };
}

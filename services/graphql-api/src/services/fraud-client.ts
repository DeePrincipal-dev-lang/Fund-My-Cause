/**
 * HTTP client for the fraud-detection service.
 *
 * Wraps the two endpoints that graphql-api needs to call:
 *  - POST /contributions  (notify of a new contribution for real-time scanning)
 *  - POST /scan           (trigger an async full scan)
 *
 * X-Trace-ID propagation
 * ──────────────────────
 * Pass the current request's traceId when calling any method.  The header is
 * set on the outbound request so the fraud-detection service can bind it to its
 * own log lines — making the same trace ID appear across both services.
 *
 * Failure policy
 * ──────────────
 * Fraud-detection is a best-effort side-effect: a network error, timeout, or
 * non-2xx response is logged as a warning but never throws, so a fraud-service
 * outage cannot block donation recording. Requests are bounded by a timeout,
 * retried a limited number of times for timeouts/5xx responses, and guarded by
 * a shared circuit breaker. When the breaker is open the call is skipped and
 * logged; recording the contribution remains the source of truth.
 */

import { TRACE_ID_HEADER } from "@fund-my-cause/shared-utils";
import {
  CircuitBreaker,
  CircuitOpenError,
  withRetry,
} from "@fund-my-cause/rpc-client";
import type pino from "pino";

const DEFAULT_FRAUD_SERVICE_URL =
  process.env.FRAUD_DETECTION_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 100;
const DEFAULT_RETRY_MAX_DELAY_MS = 500;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

/** Minimal shape of a contribution event forwarded to fraud-detection. */
export interface ContributionNotification {
  campaignId: string;
  contributor: string;
  amount: string; // stringified bigint — fraud service treats it as opaque
  transactionHash: string;
  timestamp: number; // Unix epoch seconds
}

/** Configuration for {@link FraudClient}; all fields have safe defaults. */
export interface FraudClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  breaker?: CircuitBreaker;
  fetchImpl?: typeof fetch;
}

/** 5xx responses are retryable; withRetry reads `status` from the error. */
class RetryableFraudHttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`fraud-detection returned HTTP ${status} for ${url}`);
    this.name = "FraudHttpError";
    this.status = status;
  }
}

/**
 * Bounded, circuit-broken client for the fraud-detection service.
 *
 * Inject `fetchImpl` and `breaker` in tests. The exported module-level
 * functions use a single shared client so one outage trips one breaker for the
 * whole process rather than one per request.
 */
export class FraudClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly breaker: CircuitBreaker;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FraudClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_FRAUD_SERVICE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs =
      options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.retryMaxDelayMs =
      options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
    this.breaker =
      options.breaker ??
      new CircuitBreaker({
        failureThreshold: DEFAULT_FAILURE_THRESHOLD,
        cooldownMs: DEFAULT_COOLDOWN_MS,
      });
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Notify the fraud-detection service about a new contribution so it can
   * run real-time heuristics synchronously (if it supports that) or queue
   * the data for the next background scan.
   *
   * Never throws — failures are logged at warn level.
   */
  async notifyContribution(
    payload: ContributionNotification,
    traceId: string,
    log: pino.Logger,
  ): Promise<void> {
    await this.send(
      "contribution notification",
      "/contributions",
      payload,
      traceId,
      log,
    );
  }

  /**
   * Trigger an asynchronous full fraud scan.
   * Never throws — failures are logged at warn level.
   */
  async triggerFraudScan(traceId: string, log: pino.Logger): Promise<void> {
    await this.send("scan trigger", "/scan", undefined, traceId, log);
  }

  private async send(
    operation: string,
    path: string,
    payload: ContributionNotification | undefined,
    traceId: string,
    log: pino.Logger,
  ): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    try {
      const { data: res, attempts } = await this.breaker.call(() =>
        withRetry(() => this.post(url, payload, traceId), {
          maxRetries: this.maxRetries,
          baseDelayMs: this.retryBaseDelayMs,
          maxDelayMs: this.retryMaxDelayMs,
        }),
      );

      if (!res.ok) {
        log.warn(
          { trace_id: traceId, status: res.status, url, attempts },
          `fraud-detection: ${operation} returned non-2xx`,
        );
        return;
      }

      log.debug(
        { trace_id: traceId, url, attempts },
        `fraud-detection: ${operation} sent`,
      );
    } catch (err) {
      log.warn(
        {
          trace_id: traceId,
          err,
          url,
          circuitOpen: err instanceof CircuitOpenError,
        },
        `fraud-detection: ${operation} failed (service unavailable)`,
      );
    }
  }

  private async post(
    url: string,
    payload: ContributionNotification | undefined,
    traceId: string,
  ): Promise<Response> {
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TRACE_ID_HEADER]: traceId,
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    // 4xx is a payload/configuration problem, not a transient outage: return
    // it so the caller logs it without retrying or tripping the breaker.
    if (res.status >= 500) {
      throw new RetryableFraudHttpError(res.status, url);
    }
    return res;
  }
}

const defaultClient = new FraudClient();

/** Notify fraud-detection via the process-wide client. Never throws. */
export function notifyContribution(
  payload: ContributionNotification,
  traceId: string,
  log: pino.Logger,
): Promise<void> {
  return defaultClient.notifyContribution(payload, traceId, log);
}

/** Trigger a full scan via the process-wide client. Never throws. */
export function triggerFraudScan(
  traceId: string,
  log: pino.Logger,
): Promise<void> {
  return defaultClient.triggerFraudScan(traceId, log);
}

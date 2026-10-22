import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import pino from "pino";
import { createHttpClient, type HttpClientOptions } from "./http-client.js";
import { createRpcServer } from "@fund-my-cause/rpc-client";
import {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitBreakerOptions,
  type CircuitBreakerMetrics,
} from "@fund-my-cause/shared-utils";
import type { IndexerEvent } from "@fund-my-cause/types";

// Re-exported so the rest of the indexer keeps importing IndexerEvent from
// here, while the definition itself lives in @fund-my-cause/types alongside
// the other shared domain types.
export type { IndexerEvent };

export interface SorobanRPCConfig {
  url: string;
  /** Primary contract ID (kept for backward compatibility). Ignored when `contractIds` is set. */
  contractId: string;
  /**
   * Full set of contract IDs to subscribe to (#1125). Lets the indexer
   * ingest events from multiple contract types in a single stream — e.g. the
   * crowdfund contract and the registry contract — so each can be routed to
   * its own handler module under `handlers/<contractType>/`. Falls back to
   * `[contractId]` when omitted or empty.
   */
  contractIds?: string[];
  /** Optional circuit breaker tuning. Defaults: failureThreshold=5, cooldownMs=30_000 */
  circuitBreaker?: CircuitBreakerOptions;
}

// ---------------------------------------------------------------------------
// RPC-specific HTTP client
// ---------------------------------------------------------------------------
// The Soroban JSON-RPC endpoint is a long-lived, poll-heavy connection.
// We keep the shared defaults (30 s timeout, 3 retries, 500 ms initial backoff)
// but document them here explicitly so reviewers can see the effective policy
// without having to cross-reference http-client.ts.
//
// If you need to diverge from these for a specific call (e.g. a one-off
// maintenance endpoint with a known-slow response), pass callOverrides as the
// third argument to rpcHttpClient.fetch().
const RPC_HTTP_OPTIONS: Partial<HttpClientOptions> = {
  // requestTimeoutMs: 30_000  ← default; kept explicit for visibility
  // maxRetries:       3        ← default
  // initialBackoffMs: 500      ← default
  // backoffMultiplier: 2       ← default
  // maxBackoffMs:     30_000   ← default
};

// Poll / stream delays — separate from the HTTP client; these throttle ledger
// polling rather than controlling retry behaviour.
const POLL_INTERVAL_MS = 5_000; // wait between ledger polls when no error
const STREAM_RETRY_DELAY_MS = 10_000; // wait after a stream-level error

export class SorobanRPCClient {
  private server: SorobanRpc.Server;
  private logger: pino.Logger;
  private config: SorobanRPCConfig;
  private lastLedger: number = 0;
  private readonly circuitBreaker: CircuitBreaker;
  /** Set to true after the first successful connect() call. */
  private _connected: boolean = false;

  /**
   * Injectable sleep used by unit tests to skip real delays.
   * Production code uses the default (real setTimeout).
   */
  private readonly _sleep: (ms: number) => Promise<void>;

  constructor(
    config: SorobanRPCConfig,
    logger: pino.Logger,
    _sleep?: (ms: number) => Promise<void>,
  ) {
    this.config = config;
    this.logger = logger;
    this._sleep = _sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    // Use the shared factory — allowHttp is derived from the URL scheme.
    this.server = createRpcServer({ url: config.url });
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker ?? {});
  }

  /**
   * Connect to Soroban RPC and verify connectivity.
   * Uses the SDK's own HTTP transport (rpc.Server) which manages its own
   * connection lifecycle. The 10 s reconnect loop in index.ts covers the
   * case where this returns false.
   */
  async connect(): Promise<boolean> {
    try {
      const status = await this.server.getLatestLedger();
      this.lastLedger = status.sequence;
      this.logger.info({ ledger: this.lastLedger }, "Connected to Soroban RPC");
      this._connected = true;
      return true;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to connect to Soroban RPC",
      );
      return false;
    }
  }

  /**
   * Returns true if the RPC client has successfully connected at least once.
   * Used by /readyz to report whether the downstream dependency is reachable.
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Stream contract events starting from lastLedger.
   * Yields batches of events as they are discovered.
   *
   * On a stream-level error (e.g. unexpected exception from fetchEvents) the
   * generator waits STREAM_RETRY_DELAY_MS before the next poll. This is
   * intentionally separate from the per-request retry logic inside
   * fetchEvents() — the stream loop is a coarse outer circuit-breaker, while
   * the HTTP client handles fine-grained per-attempt retries.
   */
  async *streamEvents(): AsyncGenerator<IndexerEvent[]> {
    let currentLedger = this.lastLedger;

    while (true) {
      try {
        const events = await this.fetchEvents(currentLedger);

        if (events.length > 0) {
          this.logger.debug(
            { ledger: currentLedger, eventCount: events.length },
            "Fetched events",
          );
          yield events;
        }

        currentLedger += 1;
        this.lastLedger = currentLedger;

        await this._sleep(POLL_INTERVAL_MS);
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Error streaming events",
        );
        await this._sleep(STREAM_RETRY_DELAY_MS);
      }
    }
  }

  /**
   * Fetch contract events for a specific ledger sequence.
   *
   * The outbound HTTP call is wrapped in the circuit breaker. If the breaker
   * is OPEN (i.e. Horizon/RPC has been repeatedly failing) the call is
   * short-circuited and an empty array is returned immediately so the stream
   * loop can continue without blocking.
   *
   * Uses the shared HTTP client factory — timeout, retry count, and backoff
   * all follow the documented defaults in http-client.ts unless overridden
   * through RPC_HTTP_OPTIONS above.
   *
   * Returns an empty array (rather than throwing) so the stream loop above
   * can silently skip ledgers that have no events or produced a transient
   * error, and move on. Permanent errors (e.g. malformed URL) will still
   * throw after exhausting retries.
   */
  async fetchEvents(ledgerSequence: number): Promise<IndexerEvent[]> {
    // Create a fresh client per call. createHttpClient is lightweight —
    // it merges options and returns a thin wrapper; it does not open sockets.
    const client = createHttpClient(RPC_HTTP_OPTIONS);

    try {
      const result = await this.circuitBreaker.call(() =>
        client.fetch<{
          result?: { events: unknown[] };
          error?: { message: string };
        }>(
          this.config.url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getEvents",
              params: {
                startLedger: ledgerSequence,
                filters: [
                  {
                    type: "contract",
                    contractIds:
                      this.config.contractIds && this.config.contractIds.length > 0
                        ? this.config.contractIds
                        : [this.config.contractId],
                  },
                ],
              },
            }),
          },
          {},
          this._sleep,
        ),
      );

      if (!result.ok) {
        this.logger.warn(
          { ledger: ledgerSequence, status: result.status },
          "RPC request failed with non-retryable status",
        );
        return [];
      }

      if (result.data?.error) {
        throw new Error(`RPC error: ${result.data.error.message}`);
      }

      const events = result.data?.result?.events ?? [];
      return events.map((e: unknown) => this.parseEvent(e));
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        this.logger.warn(
          {
            ledger: ledgerSequence,
            circuitState: this.circuitBreaker.currentState,
          },
          "Circuit breaker OPEN — skipping RPC call for ledger",
        );
        return [];
      }

      this.logger.warn(
        {
          ledger: ledgerSequence,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to fetch events for ledger",
      );
      return [];
    }
  }

  /**
   * Return the current circuit breaker metrics.
   * Useful for exposing via the /health or /stats endpoints.
   */
  getCircuitBreakerMetrics(): CircuitBreakerMetrics {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Parse a raw RPC event object into a typed IndexerEvent.
   *
   * ## Timestamp normalisation (#911)
   *
   * Soroban RPC returns `close_time` / `timestamp` values as **Unix seconds**
   * (uint32). We multiply by 1 000 to convert to UTC milliseconds so that
   * `IndexerEvent.timestamp` is always ms-since-epoch, consistent with
   * `Date.now()` and the rest of the Fund-My-Cause codebase.
   *
   * When the field is absent we fall back to `Date.now()` (ms) so the
   * convention is preserved regardless.
   */
  private parseEvent(rawEvent: unknown): IndexerEvent {
    const event = rawEvent as Record<string, unknown>;

    const rawTimestamp = event.timestamp as number | undefined;
    const timestampMs =
      rawTimestamp != null
        ? rawTimestamp * 1000 // seconds → milliseconds
        : Date.now(); // fallback: current UTC ms

    return {
      id: `${event.id}`,
      timestamp: timestampMs,
      type: `${event.type}`,
      contractId: `${event.contractId}`,
      data: (event.data as Record<string, unknown>) ?? {},
    };
  }
}

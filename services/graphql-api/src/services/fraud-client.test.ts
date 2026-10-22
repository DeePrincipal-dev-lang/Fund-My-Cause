import { beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "@fund-my-cause/rpc-client";
import { FraudClient, type ContributionNotification } from "./fraud-client.js";

const log = {
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

const payload: ContributionNotification = {
  campaignId: "camp_1",
  contributor: "GCONTRIBUTOR",
  amount: "20000000",
  transactionHash: "hash",
  timestamp: 1_700_000_000,
};

function makeClient(overrides: ConstructorParameters<typeof FraudClient>[0]) {
  return new FraudClient({
    baseUrl: "http://fraud.test",
    timeoutMs: 100,
    maxRetries: 0,
    retryBaseDelayMs: 0,
    retryMaxDelayMs: 0,
    ...overrides,
  });
}

describe("FraudClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the trace ID and payload to the contribution endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    const client = makeClient({ fetchImpl: fetchImpl as any });

    await client.notifyContribution(payload, "trace-123", log);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://fraud.test/contributions");
    expect(init.headers).toMatchObject({ "x-trace-id": "trace-123" });
    expect(init.body).toBe(JSON.stringify(payload));
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ trace_id: "trace-123", attempts: 1 }),
      "fraud-detection: contribution notification sent",
    );
  });

  it("retries a 5xx response with bounded backoff", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const client = makeClient({
      fetchImpl: fetchImpl as any,
      maxRetries: 1,
    });

    await client.notifyContribution(payload, "trace-123", log);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 2 }),
      expect.any(String),
    );
  });

  it("does not retry or trip the breaker on a 4xx response", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    } as Response);
    const client = makeClient({
      fetchImpl: fetchImpl as any,
      maxRetries: 1,
      breaker,
    });

    await client.notifyContribution(payload, "trace-123", log);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(breaker.currentState).toBe("CLOSED");
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400 }),
      expect.stringContaining("non-2xx"),
    );
  });

  it("aborts a slow request at the configured timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            reject(signal.reason ?? new Error("aborted"));
          });
        }),
    );
    const client = makeClient({
      fetchImpl: fetchImpl as any,
      timeoutMs: 10,
    });

    await client.notifyContribution(payload, "trace-123", log);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ trace_id: "trace-123" }),
      expect.stringContaining("failed"),
    );
  });

  it("skips requests once the circuit breaker is open", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 60_000,
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const client = makeClient({ fetchImpl: fetchImpl as any, breaker });

    await client.notifyContribution(payload, "trace-123", log);
    await client.notifyContribution(payload, "trace-123", log);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(breaker.currentState).toBe("OPEN");
    expect(log.warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ circuitOpen: true }),
      expect.stringContaining("failed"),
    );
  });

  it("triggers a scan without a request body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    const client = makeClient({ fetchImpl: fetchImpl as any });

    await client.triggerFraudScan("trace-123", log);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://fraud.test/scan");
    expect(init.body).toBeUndefined();
  });
});

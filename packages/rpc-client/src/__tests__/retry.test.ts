import { describe, it, expect, vi } from "vitest";
import { withRetry, RetryExhaustedError } from "../retry.js";

describe("withRetry", () => {
  it("returns data on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(1);
    expect(result.totalDelayMs).toBe(0);
  });

  it("retries on 5xx errors and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 503 }))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 0 });
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(3);
  });

  it("does not retry on 4xx errors", async () => {
    const fn = vi.fn().mockRejectedValue(
      Object.assign(new Error("Bad request"), { status: 400 })
    );

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("Bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 404 errors", async () => {
    const fn = vi.fn().mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 })
    );

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("Not found");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on timeout errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request timeout"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 1, baseDelayMs: 0 });
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(2);
  });

  it("does not retry on timeout when retryOnTimeout is false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Request timeout"));

    await expect(withRetry(fn, { maxRetries: 1, retryOnTimeout: false })).rejects.toThrow("timeout");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws RetryExhaustedError when all retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(
      Object.assign(new Error("Server error"), { status: 500 })
    );

    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("applies exponential backoff with increasing delays", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 100, backoffMultiplier: 2 });
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(3);
    expect(result.totalDelayMs).toBe(300);
  });

  it("caps delay at maxDelayMs", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockRejectedValueOnce(Object.assign(new Error("Server error"), { status: 500 }))
      .mockResolvedValue("success");

    await withRetry(fn, { maxRetries: 5, baseDelayMs: 0, maxDelayMs: 15000 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Some random error"));
    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("Some random error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

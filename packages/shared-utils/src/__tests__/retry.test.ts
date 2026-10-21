import { describe, expect, it, vi } from "vitest";
import { calcBackoff, retryWithBackoff, sleep } from "../retry.js";

const backoff = {
  initialBackoffMs: 100,
  backoffMultiplier: 2,
  maxBackoffMs: 1_000,
};

describe("calcBackoff", () => {
  it("starts at the initial delay and doubles per attempt", () => {
    expect(calcBackoff(0, backoff)).toBe(100);
    expect(calcBackoff(1, backoff)).toBe(200);
    expect(calcBackoff(2, backoff)).toBe(400);
  });

  it("caps the delay at maxBackoffMs", () => {
    expect(calcBackoff(10, backoff)).toBe(1_000);
    expect(calcBackoff(5, { ...backoff, maxBackoffMs: 150 })).toBe(150);
  });
});

describe("retryWithBackoff", () => {
  it("returns the first successful result without sleeping", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await retryWithBackoff(operation, {
      ...backoff,
      maxRetries: 3,
      shouldRetry: () => true,
      sleep: wait,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledWith(0);
    expect(wait).not.toHaveBeenCalled();
  });

  it("retries with exponential backoff and passes the attempt index", async () => {
    const attempts: number[] = [];
    const operation = vi.fn(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 2) {
        throw new Error(`transient ${attempt}`);
      }
      return "ok";
    });
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await retryWithBackoff(operation, {
      ...backoff,
      maxRetries: 3,
      shouldRetry: () => true,
      sleep: wait,
    });

    expect(result).toBe("ok");
    expect(attempts).toEqual([0, 1, 2]);
    expect(wait).toHaveBeenNthCalledWith(1, 100);
    expect(wait).toHaveBeenNthCalledWith(2, 200);
  });

  it("rethrows non-retryable errors immediately without sleeping", async () => {
    const error = new Error("bad request");
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(operation, {
        ...backoff,
        maxRetries: 3,
        shouldRetry: () => false,
        sleep: wait,
      }),
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("rethrows the last error after exhausting retries", async () => {
    const errors = [new Error("first"), new Error("last")];
    const operation = vi.fn(async (attempt: number) => {
      throw errors[attempt]!;
    });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(operation, {
        ...backoff,
        maxRetries: 1,
        shouldRetry: () => true,
        sleep: wait,
      }),
    ).rejects.toBe(errors[1]);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("supports maxRetries=0", async () => {
    const error = new Error("no retries");
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryWithBackoff(operation, {
        ...backoff,
        maxRetries: 0,
        shouldRetry: () => true,
        sleep: wait,
      }),
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("rejects an invalid negative retry count", async () => {
    await expect(
      retryWithBackoff(async () => "unreachable", {
        ...backoff,
        maxRetries: -1,
        shouldRetry: () => true,
      }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it("uses the default sleep when no injectable delay is supplied", async () => {
    vi.useFakeTimers();
    try {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce("ok");

      const promise = retryWithBackoff(operation, {
        ...backoff,
        maxRetries: 1,
        shouldRetry: () => true,
      });

      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sleep", () => {
  it("resolves only after the requested delay", async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const promise = sleep(25).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(24);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

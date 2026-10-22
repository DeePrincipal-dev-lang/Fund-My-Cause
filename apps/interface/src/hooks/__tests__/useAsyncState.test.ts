import { renderHook, act } from "@testing-library/react";
import { useAsync, AsyncStatus } from "../useAsync";

describe("useAsync - normalized error handling", () => {
  describe("success state", () => {
    it("transitions from idle to success", async () => {
      const asyncFn = jest.fn().mockResolvedValue({ id: 1, name: "test" });

      const { result } = renderHook(() => useAsync(asyncFn));

      expect(result.current.status).toBe("idle");
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe("success");
      expect(result.current.data).toEqual({ id: 1, name: "test" });
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it("transitions to loading before success", async () => {
      const asyncFn = jest.fn(
        () => new Promise((r) => setTimeout(() => r("data"), 50)),
      );

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        const promise = result.current.execute();

        // Check loading state
        expect(result.current.status).toBe("loading");
        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();

        await promise;
      });

      expect(result.current.status).toBe("success");
    });
  });

  describe("error state", () => {
    it("transitions from idle to error on promise rejection", async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error("Fetch failed"));

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBe("Fetch failed");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(true);
    });

    it("handles non-Error exceptions", async () => {
      const asyncFn = jest.fn().mockRejectedValue("String error");

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("String error");
      expect(result.current.isError).toBe(true);
    });

    it("normalizes error message from various error types", async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBe("Network timeout");
      expect(typeof result.current.error).toBe("string");
    });
  });

  describe("loading state", () => {
    it("exposes isLoading flag correctly", async () => {
      const asyncFn = jest.fn(
        () => new Promise((r) => setTimeout(() => r("data"), 50)),
      );

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        const promise = result.current.execute();
        expect(result.current.isLoading).toBe(true);
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("state transitions", () => {
    it("handles multiple sequential executions", async () => {
      const asyncFn = jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBe(1);
      expect(result.current.isSuccess).toBe(true);

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBe(2);
      expect(result.current.isSuccess).toBe(true);
    });

    it("clears data when transitioning to loading", async () => {
      const asyncFn = jest
        .fn()
        .mockResolvedValueOnce("first")
        .mockResolvedValueOnce("second");

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBe("first");

      const promise = act(async () => {
        return result.current.execute();
      });

      expect(result.current.data).toBeNull();

      await promise;
    });
  });

  describe("reset functionality", () => {
    it("resets to idle state", async () => {
      const asyncFn = jest.fn().mockResolvedValue("data");

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe("success");
      expect(result.current.data).toBe("data");

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it("ignores late responses after reset", async () => {
      const asyncFn = jest.fn(
        () => new Promise((r) => setTimeout(() => r("late"), 100)),
      );

      const { result } = renderHook(() => useAsync(asyncFn));

      let responsePromise: Promise<unknown>;
      act(() => {
        responsePromise = result.current.execute();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.status).toBe("idle");

      await act(async () => {
        await responsePromise;
      });

      // State should remain idle, not update to success
      expect(result.current.status).toBe("idle");
      expect(result.current.data).toBeNull();
    });
  });

  describe("status type", () => {
    it("provides all valid status values", async () => {
      const asyncFn = jest.fn().mockResolvedValue("test");

      const { result } = renderHook(() => useAsync(asyncFn));

      const statuses: AsyncStatus[] = [];

      // Collect status through lifecycle
      statuses.push(result.current.status);

      let statusDuringLoad: AsyncStatus;
      await act(async () => {
        const promise = result.current.execute();
        statusDuringLoad = result.current.status;
        await promise;
      });

      statuses.push(statusDuringLoad!);
      statuses.push(result.current.status);

      expect(statuses).toContain("idle");
      expect(statuses).toContain("loading");
      expect(statuses).toContain("success");
    });

    it("provides error status on failure", async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error("failed"));

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.status).toBe("error");
    });
  });

  describe("memoization", () => {
    it("returns stable execute function", () => {
      const asyncFn = jest.fn();
      const { result, rerender } = renderHook(() => useAsync(asyncFn));

      const execute1 = result.current.execute;

      rerender();

      const execute2 = result.current.execute;

      expect(execute1).toBe(execute2);
    });

    it("returns stable reset function", () => {
      const asyncFn = jest.fn();
      const { result, rerender } = renderHook(() => useAsync(asyncFn));

      const reset1 = result.current.reset;

      rerender();

      const reset2 = result.current.reset;

      expect(reset1).toBe(reset2);
    });
  });

  describe("error handling patterns", () => {
    it("always has error as null or string", async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error("test error"));

      const { result } = renderHook(() => useAsync(asyncFn));

      expect(result.current.error).toBeNull();

      await act(async () => {
        await result.current.execute();
      });

      expect(typeof result.current.error).toBe("string");
    });

    it("provides consistent error shape in success and error states", async () => {
      const asyncFn = jest.fn().mockResolvedValue("success");

      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      // Success state should have error: null
      expect(result.current.error).toBeNull();
      expect("error" in result.current).toBe(true);
    });
  });
});

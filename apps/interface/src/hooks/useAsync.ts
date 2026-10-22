import { useState, useCallback, useRef } from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  status: AsyncStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseAsyncReturn<T> extends AsyncState<T> {
  /** Execute the async function. Ignores stale responses if the hook unmounts or re-runs. */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Reset state back to idle */
  reset: () => void;
}

const IDLE: AsyncState<never> = {
  data: null,
  error: null,
  status: "idle",
  isLoading: false,
  isSuccess: false,
  isError: false,
};

/**
 * Manages the lifecycle of an async operation: idle → loading → success | error.
 * Automatically ignores stale responses when a newer call is in flight.
 *
 * @param asyncFn - async function to execute
 * @returns state + execute + reset
 *
 * @example
 * const { data, isLoading, error, execute } = useAsync(fetchCampaigns);
 * useEffect(() => { execute(); }, [execute]);
 */
export function useAsync<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>(IDLE as AsyncState<T>);
  const callIdRef = useRef(0);

  // Memoize execution callback so callers can safely include `execute` in useEffect dependency arrays.
  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      const callId = ++callIdRef.current;
      setState({ data: null, error: null, status: "loading", isLoading: true, isSuccess: false, isError: false });
      try {
        const result = await asyncFn(...args);
        if (callId === callIdRef.current) {
          setState({ data: result, error: null, status: "success", isLoading: false, isSuccess: true, isError: false });
        }
        return result;
      } catch (err) {
        if (callId === callIdRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ data: null, error: message, status: "error", isLoading: false, isSuccess: false, isError: true });
        }
        return null;
      }
    },
    [asyncFn],
  );

  const reset = useCallback(() => {
    callIdRef.current++;
    setState(IDLE as AsyncState<T>);
  }, []);

  return { ...state, execute, reset };
}

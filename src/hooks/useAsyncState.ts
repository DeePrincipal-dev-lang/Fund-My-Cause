import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared result/error shape used by hooks under `src/hooks`.
 *
 * Hooks that previously threw, returned `null`, or only logged errors should
 * expose this discriminated union so consumers can handle success and failure
 * consistently.
 */
export type AsyncResult<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

export interface UseAsyncStateOptions<T> {
  /** Initial data to expose before the first run resolves. */
  initialData?: T | null;
  /** When false, the async function is not invoked automatically on mount. */
  immediate?: boolean;
}

export interface UseAsyncStateReturn<T, A extends unknown[]> {
  status: AsyncResult<T>['status'];
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  run: (...args: A) => Promise<AsyncResult<T>>;
  reset: () => void;
}

/**
 * Normalizes async error handling for hooks.
 *
 * Instead of throwing, returning `null`, or silently logging, the wrapped
 * async function resolves to a discriminated {@link AsyncResult} and the hook
 * exposes `data`/`error`/`status` for consumers.
 */
export function useAsyncState<T, A extends unknown[] = []>(
  asyncFn: (...args: A) => Promise<T>,
  options: UseAsyncStateOptions<T> = {},
): UseAsyncStateReturn<T, A> {
  const { initialData = null, immediate = false } = options;

  const [result, setResult] = useState<AsyncResult<T>>({
    status: 'idle',
    data: initialData,
    error: null,
  });

  const mountedRef = useRef(true);
  const asyncFnRef = useRef(asyncFn);
  asyncFnRef.current = asyncFn;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<AsyncResult<T>> => {
    setResult((prev) => ({
      status: 'loading',
      data: prev.status === 'success' ? prev.data : initialData,
      error: null,
    }));

    try {
      const data = await asyncFnRef.current(...args);
      const next: AsyncResult<T> = { status: 'success', data, error: null };
      if (mountedRef.current) {
        setResult(next);
      }
      return next;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const next: AsyncResult<T> = { status: 'error', data: null, error };
      if (mountedRef.current) {
        setResult(next);
      }
      return next;
    }
  }, [initialData]);

  const reset = useCallback(() => {
    setResult({ status: 'idle', data: initialData, error: null });
  }, [initialData]);

  useEffect(() => {
    if (immediate) {
      void run(...([] as unknown as A));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return {
    status: result.status,
    data: result.data,
    error: result.error,
    isLoading: result.status === 'loading',
    isError: result.status === 'error',
    isSuccess: result.status === 'success',
    run,
    reset,
  };
}

export default useAsyncState;

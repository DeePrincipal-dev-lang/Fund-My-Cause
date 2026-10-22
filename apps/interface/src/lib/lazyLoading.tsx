/**
 * Lazy loading utilities for components and data.
 * Uses Intersection Observer for efficient viewport detection.
 */

import { useEffect, useRef, useState } from "react";

interface LazyLoadOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

/**
 * Hook to detect when an element enters the viewport.
 */
export function useIntersectionObserver(
  options: LazyLoadOptions = {},
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [options]);

  return [ref, isVisible];
}

/**
 * Hook for lazy loading data when element becomes visible.
 */
export function useLazyLoad<T>(
  loader: () => Promise<T>,
  options: LazyLoadOptions = {},
): [React.RefObject<HTMLDivElement | null>, T | null, boolean, Error | null] {
  const [ref, isVisible] = useIntersectionObserver(options);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    setLoading(true);
    loader()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [isVisible, loader]);

  return [ref, data, loading, error];
}

/**
 * Lazy load component wrapper.
 */
export function LazyComponent({
  children,
  fallback = null,
  options,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  options?: LazyLoadOptions;
}) {
  const [ref, isVisible] = useIntersectionObserver(options);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
}

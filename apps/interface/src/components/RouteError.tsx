"use client";

import { ErrorFallback, type ErrorBoundaryLevel } from "@fund-my-cause/components";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  level?: ErrorBoundaryLevel;
}

/**
 * Standard fallback for Next route-segment `error.tsx` files. Next generates
 * an error boundary per segment and passes it `{ error, reset }` — this just
 * renders that through the shared `ErrorFallback` so every route shows the
 * same look and the same retry action instead of a bespoke one-off per route.
 */
export function RouteError({ error, reset, level = "section" }: RouteErrorProps) {
  return <ErrorFallback error={error} reset={reset} level={level} />;
}

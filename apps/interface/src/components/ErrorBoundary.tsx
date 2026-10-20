"use client";

/**
 * Shared ErrorBoundary component — Issue #1285
 *
 * Error boundary for Next.js that catches errors in child components
 * and displays a user-friendly error page with recovery options.
 * Can be used in both Client and Server components via error.tsx.
 */

import React, { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error("Error boundary caught:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.reset)
      ) : (
        <DefaultErrorFallback error={this.state.error} reset={this.reset} />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error UI for when no custom fallback is provided
 */
export function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <h1>Something went wrong</h1>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Hook to use error boundary functionality in functional components via error.tsx
 * Pattern: export function error({ error, reset }: ErrorPageProps) { ... }
 */
export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

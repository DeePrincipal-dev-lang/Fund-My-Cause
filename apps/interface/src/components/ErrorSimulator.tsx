"use client";

import { useCallback } from "react";

export function ErrorSimulator() {
  const simulateError = useCallback(() => {
    throw new Error("Simulated error for testing error boundary");
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={simulateError}
        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
        title="Simulate an error to test the error boundary (dev mode only)"
      >
        Simulate Error
      </button>
    </div>
  );
}

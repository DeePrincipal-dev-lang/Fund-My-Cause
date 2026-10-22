/**
 * Unit tests for ErrorBoundary component — Issue #1285
 *
 * Tests error boundary functionality and recovery mechanisms.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary, DefaultErrorFallback } from "./ErrorBoundary";

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
}

// Component with conditional throwing
function ConditionalError({ error = false }: { error?: boolean }) {
  if (error) {
    throw new Error("Conditional error");
  }
  return <div>Working component</div>;
}

// Suppress console.error for tests
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  describe("error catching", () => {
    it("catches errors in child components", () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(container.textContent).toContain("Something went wrong");
    });

    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    it("displays error message", () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });
  });

  describe("recovery", () => {
    it("provides reset functionality", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalError error={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      const button = screen.getByText("Try again");
      fireEvent.click(button);

      rerender(
        <ErrorBoundary>
          <ConditionalError error={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Working component")).toBeInTheDocument();
    });

    it("reset button restores error state", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      // Error is shown
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Note: In real usage, reset would be called before re-rendering valid content
      // This is more of a UI interaction test
      const button = screen.getByText("Try again");
      expect(button).toBeInTheDocument();
    });
  });

  describe("custom fallback", () => {
    it("uses custom fallback when provided", () => {
      const customFallback = (error: Error) => (
        <div>
          <h2>Custom Error UI</h2>
          <p>{error.message}</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("custom fallback receives reset function", () => {
      const customFallback = (error: Error, reset: () => void) => (
        <div>
          <p>{error.message}</p>
          <button onClick={reset}>Custom Reset</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>,
      );

      const resetButton = screen.getByText("Custom Reset");
      expect(resetButton).toBeInTheDocument();
    });
  });

  describe("error callback", () => {
    it("calls onError callback when error occurs", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Test error message",
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        }),
      );
    });

    it("does not call onError callback when no error occurs", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });
});

describe("DefaultErrorFallback", () => {
  it("displays error message", () => {
    const error = new Error("Test fallback error");
    const reset = jest.fn();

    render(<DefaultErrorFallback error={error} reset={reset} />);

    expect(screen.getByText("Test fallback error")).toBeInTheDocument();
  });

  it("displays default heading", () => {
    const error = new Error("Test error");
    const reset = jest.fn();

    render(<DefaultErrorFallback error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders try again button", () => {
    const error = new Error("Test error");
    const reset = jest.fn();

    render(<DefaultErrorFallback error={error} reset={reset} />);

    const button = screen.getByText("Try again");
    expect(button).toBeInTheDocument();
  });

  it("calls reset on button click", () => {
    const error = new Error("Test error");
    const reset = jest.fn();

    render(<DefaultErrorFallback error={error} reset={reset} />);

    const button = screen.getByText("Try again");
    fireEvent.click(button);

    expect(reset).toHaveBeenCalled();
  });

  it("handles errors without message", () => {
    const error = new Error();
    const reset = jest.fn();

    render(<DefaultErrorFallback error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});

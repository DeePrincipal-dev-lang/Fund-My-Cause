import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorState } from "../ErrorState";

describe("ErrorState Component", () => {
  describe("Rendering", () => {
    it("should render the error state container with title", () => {
      render(<ErrorState title="Something went wrong" />);

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should render title and description", () => {
      render(
        <ErrorState
          title="Failed to load"
          description="Please try again later"
        />,
      );

      expect(screen.getByText("Failed to load")).toBeInTheDocument();
      expect(screen.getByText("Please try again later")).toBeInTheDocument();
    });

    it("should render error details when provided", () => {
      render(<ErrorState title="Error" error="Database connection timeout" />);

      expect(
        screen.getByText("Database connection timeout"),
      ).toBeInTheDocument();
    });

    it("should render icon when provided", () => {
      render(
        <ErrorState
          title="Error"
          icon={<svg data-testid="error-icon">Error Icon</svg>}
        />,
      );

      expect(screen.getByTestId("error-state-icon")).toBeInTheDocument();
      expect(screen.getByTestId("error-icon")).toBeInTheDocument();
    });

    it("should not render icon when not provided", () => {
      render(<ErrorState title="Error" />);

      expect(screen.queryByTestId("error-state-icon")).not.toBeInTheDocument();
    });

    it("should not render description when not provided", () => {
      render(<ErrorState title="Error" />);

      const descriptions = screen.queryAllByText(/try/i);
      expect(descriptions.length).toBe(0);
    });

    it("should not render error details when not provided", () => {
      render(<ErrorState title="Error" description="Something failed" />);

      const errorTexts = screen.queryAllByText(/timeout|connection/i);
      expect(errorTexts.length).toBe(0);
    });
  });

  describe("Action buttons", () => {
    it("should render action buttons when provided", () => {
      const mockRetry = vi.fn();
      const mockGoHome = vi.fn();

      render(
        <ErrorState
          title="Error"
          actions={[
            { label: "Retry", onClick: mockRetry, variant: "primary" },
            { label: "Go Home", onClick: mockGoHome, variant: "secondary" },
          ]}
        />,
      );

      expect(screen.getByTestId("error-state-action-0")).toBeInTheDocument();
      expect(screen.getByTestId("error-state-action-1")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
      expect(screen.getByText("Go Home")).toBeInTheDocument();
    });

    it("should not render action buttons when not provided", () => {
      render(<ErrorState title="Error" />);

      expect(
        screen.queryByTestId("error-state-action-0"),
      ).not.toBeInTheDocument();
    });

    it("should not render action buttons when empty array", () => {
      render(<ErrorState title="Error" actions={[]} />);

      expect(
        screen.queryByTestId("error-state-action-0"),
      ).not.toBeInTheDocument();
    });

    it("should call action callback when button is clicked", () => {
      const mockRetry = vi.fn();

      render(
        <ErrorState
          title="Error"
          actions={[{ label: "Retry", onClick: mockRetry }]}
        />,
      );

      const button = screen.getByTestId("error-state-action-0");
      fireEvent.click(button);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple button clicks", () => {
      const mockRetry = vi.fn();

      render(
        <ErrorState
          title="Error"
          actions={[{ label: "Retry", onClick: mockRetry }]}
        />,
      );

      const button = screen.getByTestId("error-state-action-0");
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockRetry).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple action buttons independently", () => {
      const mockRetry = vi.fn();
      const mockCancel = vi.fn();

      render(
        <ErrorState
          title="Error"
          actions={[
            { label: "Retry", onClick: mockRetry },
            { label: "Cancel", onClick: mockCancel },
          ]}
        />,
      );

      const retryButton = screen.getByTestId("error-state-action-0");
      const cancelButton = screen.getByTestId("error-state-action-1");

      fireEvent.click(retryButton);
      fireEvent.click(cancelButton);
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(2);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("Button variants", () => {
    it("should apply primary variant styling", () => {
      render(
        <ErrorState
          title="Error"
          actions={[{ label: "Retry", onClick: vi.fn(), variant: "primary" }]}
        />,
      );

      const button = screen.getByTestId("error-state-action-0");
      expect(button).toHaveClass("bg-red-600", "hover:bg-red-700");
    });

    it("should apply secondary variant styling", () => {
      render(
        <ErrorState
          title="Error"
          actions={[
            { label: "Cancel", onClick: vi.fn(), variant: "secondary" },
          ]}
        />,
      );

      const button = screen.getByTestId("error-state-action-0");
      expect(button).toHaveClass("bg-gray-200", "hover:bg-gray-300");
    });

    it("should default to primary variant when not specified", () => {
      render(
        <ErrorState
          title="Error"
          actions={[{ label: "Retry", onClick: vi.fn() }]}
        />,
      );

      const button = screen.getByTestId("error-state-action-0");
      expect(button).toHaveClass("bg-red-600");
    });
  });

  describe("Styling", () => {
    it("should apply custom className to container", () => {
      render(<ErrorState title="Error" className="custom-error-class" />);

      const errorState = screen.getByTestId("error-state");
      expect(errorState).toHaveClass("custom-error-class");
    });

    it("should apply custom iconClassName to icon", () => {
      render(
        <ErrorState
          title="Error"
          icon={<div>Icon</div>}
          iconClassName="custom-icon-color"
        />,
      );

      const icon = screen.getByTestId("error-state-icon");
      expect(icon).toHaveClass("custom-icon-color");
    });

    it("should apply custom contentClassName to content", () => {
      render(
        <ErrorState
          title="Error"
          description="Details"
          contentClassName="custom-content"
        />,
      );

      const content = screen.getByText("Error").closest("div");
      expect(content).toHaveClass("custom-content");
    });

    it("should have default styling classes", () => {
      render(<ErrorState title="Error" />);

      const errorState = screen.getByTestId("error-state");
      expect(errorState).toHaveClass(
        "flex",
        "flex-col",
        "items-center",
        "justify-center",
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      render(
        <ErrorState
          title="Failed to load data"
          description="Please try again"
        />,
      );

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Failed to load data");
    });

    it("should have accessible action buttons", () => {
      const mockRetry = vi.fn();

      render(
        <ErrorState
          title="Error"
          actions={[{ label: "Retry Request", onClick: mockRetry }]}
        />,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Retry Request");
      expect(button).not.toBeDisabled();
    });
  });

  describe("Complex scenarios", () => {
    it("should render with all props provided", () => {
      const mockRetry = vi.fn();
      const mockCancel = vi.fn();

      render(
        <ErrorState
          title="Network Error"
          description="Unable to connect to server"
          error="Error code: 503 Service Unavailable"
          icon={<span>❌</span>}
          actions={[
            { label: "Retry", onClick: mockRetry, variant: "primary" },
            { label: "Cancel", onClick: mockCancel, variant: "secondary" },
          ]}
          className="error-custom-class"
          iconClassName="icon-error-color"
          contentClassName="content-error-style"
        />,
      );

      expect(screen.getByText("Network Error")).toBeInTheDocument();
      expect(
        screen.getByText("Unable to connect to server"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Error code: 503 Service Unavailable"),
      ).toBeInTheDocument();
      expect(screen.getByText("❌")).toBeInTheDocument();
      expect(screen.getByTestId("error-state-action-0")).toBeInTheDocument();
      expect(screen.getByTestId("error-state-action-1")).toBeInTheDocument();
    });

    it("should handle long error messages", () => {
      const longError =
        "This is a very long error message that describes " +
        "the issue in detail. It explains what went wrong and why. " +
        "The user should read this to understand the problem better.";

      render(<ErrorState title="Error" error={longError} />);

      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("should handle many action buttons", () => {
      const callbacks = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];

      render(
        <ErrorState
          title="Error"
          actions={callbacks.map((fn, i) => ({
            label: `Action ${i + 1}`,
            onClick: fn,
          }))}
        />,
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);

      buttons.forEach((btn, i) => {
        fireEvent.click(btn);
        expect(callbacks[i]).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle special characters in messages", () => {
      render(
        <ErrorState
          title="Error: Invalid input '@#$%^&*()'"
          description="Check your input & try again"
          error="Expected: [a-z], Got: !@#$"
        />,
      );

      expect(screen.getByText(/Invalid input/)).toBeInTheDocument();
      expect(screen.getByText(/try again/)).toBeInTheDocument();
      expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState Component", () => {
  describe("Rendering", () => {
    it("should render the empty state container with title", () => {
      render(<EmptyState title="No items found" />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    it("should render title and description", () => {
      render(
        <EmptyState
          title="No campaigns"
          description="You haven't created any campaigns yet."
        />,
      );

      expect(screen.getByText("No campaigns")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't created any campaigns yet."),
      ).toBeInTheDocument();
    });

    it("should render icon when provided", () => {
      render(
        <EmptyState
          title="No results"
          icon={<svg data-testid="custom-icon">Icon</svg>}
        />,
      );

      expect(screen.getByTestId("empty-state-icon")).toBeInTheDocument();
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });

    it("should not render icon when not provided", () => {
      render(<EmptyState title="No results" />);

      expect(screen.queryByTestId("empty-state-icon")).not.toBeInTheDocument();
    });

    it("should not render description when not provided", () => {
      render(<EmptyState title="No results" />);

      expect(screen.queryByText(/haven't/)).not.toBeInTheDocument();
    });
  });

  describe("Action button", () => {
    it("should render action button when action is provided", () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: "Create One", onClick: mockAction }}
        />,
      );

      const button = screen.getByTestId("empty-state-action");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Create One");
    });

    it("should not render action button when action is not provided", () => {
      render(<EmptyState title="No items" />);

      expect(
        screen.queryByTestId("empty-state-action"),
      ).not.toBeInTheDocument();
    });

    it("should call action callback when button is clicked", () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: "Create", onClick: mockAction }}
        />,
      );

      const button = screen.getByTestId("empty-state-action");
      fireEvent.click(button);

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple button clicks", () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: "Try Again", onClick: mockAction }}
        />,
      );

      const button = screen.getByTestId("empty-state-action");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockAction).toHaveBeenCalledTimes(3);
    });
  });

  describe("Styling", () => {
    it("should apply custom className to container", () => {
      const { container } = render(
        <EmptyState title="No items" className="custom-class" />,
      );

      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toHaveClass("custom-class");
    });

    it("should apply custom iconClassName to icon", () => {
      render(
        <EmptyState
          title="No items"
          icon={<div>Icon</div>}
          iconClassName="custom-icon-class"
        />,
      );

      const icon = screen.getByTestId("empty-state-icon");
      expect(icon).toHaveClass("custom-icon-class");
    });

    it("should apply custom contentClassName to content", () => {
      render(
        <EmptyState
          title="No items"
          description="Try something else"
          contentClassName="custom-content-class"
        />,
      );

      const content = screen.getByText("No items").closest("div");
      expect(content).toHaveClass("custom-content-class");
    });

    it("should have default styling classes", () => {
      render(<EmptyState title="No items" />);

      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toHaveClass(
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
        <EmptyState
          title="No campaigns"
          description="Create your first campaign"
        />,
      );

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("No campaigns");
    });

    it("should have accessible action button", () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: "Create New", onClick: mockAction }}
        />,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("Create New");
      expect(button).not.toBeDisabled();
    });
  });

  describe("Complex scenarios", () => {
    it("should render with all props provided", () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No results"
          description="Try adjusting your filters"
          icon={<span>📭</span>}
          action={{ label: "Clear Filters", onClick: mockAction }}
          className="my-custom-class"
          iconClassName="icon-custom"
          contentClassName="content-custom"
        />,
      );

      expect(screen.getByText("No results")).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your filters"),
      ).toBeInTheDocument();
      expect(screen.getByText("📭")).toBeInTheDocument();
      expect(screen.getByTestId("empty-state-action")).toBeInTheDocument();
    });

    it("should handle long descriptions", () => {
      const longDescription =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

      render(<EmptyState title="No data" description={longDescription} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it("should handle special characters in title and description", () => {
      render(
        <EmptyState
          title="No items found (search: '@#$%')"
          description="Please try with different keywords & symbols"
        />,
      );

      expect(screen.getByText(/No items found/)).toBeInTheDocument();
      expect(screen.getByText(/different keywords/)).toBeInTheDocument();
    });
  });
});

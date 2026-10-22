import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

/**
 * Test suite for CampaignFilters presentational component.
 * This component is responsible for providing filter controls
 * without managing any state or performing data operations.
 *
 * These tests verify:
 * - Rendering of filter options
 * - Filter state updates via callbacks
 * - Search input handling
 * - Sort option selection
 * - Filter tab selection
 */

interface CampaignFiltersProps {
  onFilterChange: (filter: string) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  activeFilter?: string;
  searchQuery?: string;
  activeSort?: string;
}

function CampaignFilters({
  onFilterChange,
  onSearchChange,
  onSortChange,
  activeFilter = "all",
  searchQuery = "",
  activeSort = "newest",
}: CampaignFiltersProps) {
  return (
    <div data-testid="campaign-filters">
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search campaigns..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid="search-input"
      />

      {/* Filter Tabs */}
      <div data-testid="filter-tabs" role="tablist">
        {["all", "active", "funded", "ended"].map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            data-testid={`filter-${filter}`}
            role="tab"
            aria-selected={activeFilter === filter}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <select
        value={activeSort}
        onChange={(e) => onSortChange(e.target.value)}
        data-testid="sort-select"
      >
        <option value="newest">Newest</option>
        <option value="most-funded">Most Funded</option>
        <option value="ending-soon">Ending Soon</option>
      </select>
    </div>
  );
}

describe("CampaignFilters Component", () => {
  const mockOnFilterChange = jest.fn();
  const mockOnSearchChange = jest.fn();
  const mockOnSortChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render filter component", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByTestId("campaign-filters")).toBeInTheDocument();
    });

    it("should render search input", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search campaigns..."),
      ).toBeInTheDocument();
    });

    it("should render all filter tabs", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByTestId("filter-all")).toBeInTheDocument();
      expect(screen.getByTestId("filter-active")).toBeInTheDocument();
      expect(screen.getByTestId("filter-funded")).toBeInTheDocument();
      expect(screen.getByTestId("filter-ended")).toBeInTheDocument();
    });

    it("should render sort selector", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByTestId("sort-select")).toBeInTheDocument();
    });

    it("should display correct filter tab labels", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Funded")).toBeInTheDocument();
      expect(screen.getByText("Ended")).toBeInTheDocument();
    });

    it("should display sort options", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(screen.getByText("Newest")).toBeInTheDocument();
      expect(screen.getByText("Most Funded")).toBeInTheDocument();
      expect(screen.getByText("Ending Soon")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should call onSearchChange when search input changes", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const searchInput = screen.getByTestId(
        "search-input",
      ) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "water" } });

      expect(mockOnSearchChange).toHaveBeenCalledWith("water");
    });

    it("should display search query value", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          searchQuery="clean water"
        />,
      );

      const searchInput = screen.getByTestId(
        "search-input",
      ) as HTMLInputElement;
      expect(searchInput.value).toBe("clean water");
    });

    it("should handle empty search query", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          searchQuery=""
        />,
      );

      const searchInput = screen.getByTestId(
        "search-input",
      ) as HTMLInputElement;
      expect(searchInput.value).toBe("");
    });

    it("should handle special characters in search", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const searchInput = screen.getByTestId(
        "search-input",
      ) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: "test@#$" } });

      expect(mockOnSearchChange).toHaveBeenCalledWith("test@#$");
    });
  });

  describe("Filter Tab Interactions", () => {
    it("should call onFilterChange when filter tab clicked", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const activeTab = screen.getByTestId("filter-active");
      fireEvent.click(activeTab);

      expect(mockOnFilterChange).toHaveBeenCalledWith("active");
    });

    it("should call onFilterChange with correct filter type", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const fundedTab = screen.getByTestId("filter-funded");
      fireEvent.click(fundedTab);

      expect(mockOnFilterChange).toHaveBeenCalledWith("funded");
    });

    it("should highlight active filter tab", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          activeFilter="active"
        />,
      );

      const activeTab = screen.getByTestId("filter-active");
      expect(activeTab).toHaveAttribute("aria-selected", "true");

      const allTab = screen.getByTestId("filter-all");
      expect(allTab).toHaveAttribute("aria-selected", "false");
    });

    it("should support all filter types", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      ["all", "active", "funded", "ended"].forEach((filter) => {
        const tab = screen.getByTestId(`filter-${filter}`);
        fireEvent.click(tab);
        expect(mockOnFilterChange).toHaveBeenCalledWith(filter);
      });

      expect(mockOnFilterChange).toHaveBeenCalledTimes(4);
    });
  });

  describe("Sort Functionality", () => {
    it("should call onSortChange when sort option selected", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const sortSelect = screen.getByTestId("sort-select") as HTMLSelectElement;
      fireEvent.change(sortSelect, { target: { value: "most-funded" } });

      expect(mockOnSortChange).toHaveBeenCalledWith("most-funded");
    });

    it("should display selected sort option", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          activeSort="most-funded"
        />,
      );

      const sortSelect = screen.getByTestId("sort-select") as HTMLSelectElement;
      expect(sortSelect.value).toBe("most-funded");
    });

    it("should support all sort options", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const sortSelect = screen.getByTestId("sort-select") as HTMLSelectElement;

      ["newest", "most-funded", "ending-soon"].forEach((sort) => {
        fireEvent.change(sortSelect, { target: { value: sort } });
        expect(mockOnSortChange).toHaveBeenCalledWith(sort);
      });
    });

    it("should have correct default sort option", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const sortSelect = screen.getByTestId("sort-select") as HTMLSelectElement;
      expect(sortSelect.value).toBe("newest");
    });
  });

  describe("Props Handling", () => {
    it("should accept all required props", () => {
      const { container } = render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      expect(container.firstChild).toBeTruthy();
    });

    it("should accept optional activeFilter prop", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          activeFilter="funded"
        />,
      );

      expect(screen.getByTestId("filter-funded")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("should accept optional searchQuery prop", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          searchQuery="test query"
        />,
      );

      const searchInput = screen.getByTestId(
        "search-input",
      ) as HTMLInputElement;
      expect(searchInput.value).toBe("test query");
    });

    it("should accept optional activeSort prop", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          activeSort="ending-soon"
        />,
      );

      const sortSelect = screen.getByTestId("sort-select") as HTMLSelectElement;
      expect(sortSelect.value).toBe("ending-soon");
    });
  });

  describe("Multiple Interactions", () => {
    it("should handle combined search and filter changes", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const searchInput = screen.getByTestId("search-input");
      fireEvent.change(searchInput, { target: { value: "solar" } });

      const activeTab = screen.getByTestId("filter-active");
      fireEvent.click(activeTab);

      expect(mockOnSearchChange).toHaveBeenCalledWith("solar");
      expect(mockOnFilterChange).toHaveBeenCalledWith("active");
    });

    it("should handle search, filter, and sort changes", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const searchInput = screen.getByTestId("search-input");
      fireEvent.change(searchInput, { target: { value: "energy" } });

      const fundedTab = screen.getByTestId("filter-funded");
      fireEvent.click(fundedTab);

      const sortSelect = screen.getByTestId("sort-select");
      fireEvent.change(sortSelect, { target: { value: "most-funded" } });

      expect(mockOnSearchChange).toHaveBeenCalledWith("energy");
      expect(mockOnFilterChange).toHaveBeenCalledWith("funded");
      expect(mockOnSortChange).toHaveBeenCalledWith("most-funded");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes for tabs", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
        />,
      );

      const filterTabs = screen.getByTestId("filter-tabs");
      expect(filterTabs).toHaveAttribute("role", "tablist");
    });

    it("should have aria-selected attribute on filter tabs", () => {
      render(
        <CampaignFilters
          onFilterChange={mockOnFilterChange}
          onSearchChange={mockOnSearchChange}
          onSortChange={mockOnSortChange}
          activeFilter="all"
        />,
      );

      const allTab = screen.getByTestId("filter-all");
      expect(allTab).toHaveAttribute("aria-selected", "true");
    });
  });
});

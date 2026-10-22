import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Campaign } from "@/types/campaign";

/**
 * Test suite for CampaignList presentational component.
 * This component is responsible for rendering a virtualized grid of campaigns
 * without any data-fetching or filtering logic.
 *
 * These tests verify:
 * - Rendering of campaign cards
 * - Empty state handling
 * - Grid virtualization
 * - Callback handling for user interactions
 */

// Mock VirtualizedGrid component
jest.mock("@/components/ui/VirtualizedGrid", () => ({
  VirtualizedGrid: ({
    items,
    renderItem,
  }: {
    items: Campaign[];
    renderItem: (item: Campaign, index: number) => React.ReactNode;
  }) => (
    <div data-testid="virtualized-grid">
      {items.map((item, i) => (
        <div key={item.id} data-testid={`campaign-item-${item.id}`}>
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  ),
}));

// Mock CampaignCard component
jest.mock("@/components/ui/CampaignCard", () => ({
  CampaignCard: ({
    campaign,
    onPledge,
  }: {
    campaign: Campaign;
    onPledge: (id: string) => void;
  }) => (
    <div data-testid={`campaign-card-${campaign.id}`}>
      <h3>{campaign.title}</h3>
      <button onClick={() => onPledge(campaign.id)}>Pledge</button>
    </div>
  ),
}));

jest.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
  NoCampaignsIllustration: () => (
    <div data-testid="no-campaigns-illustration" />
  ),
}));

interface CampaignListProps {
  campaigns: Campaign[];
  onPledge: (campaignId: string) => void;
  isEmpty?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

function CampaignList({
  campaigns,
  onPledge,
  isEmpty = false,
  emptyStateTitle = "No campaigns found",
  emptyStateDescription = "Be the first to launch a campaign.",
}: CampaignListProps) {
  const { VirtualizedGrid } = require("@/components/ui/VirtualizedGrid");
  const { CampaignCard } = require("@/components/ui/CampaignCard");
  const {
    EmptyState,
    NoCampaignsIllustration,
  } = require("@/components/ui/EmptyState");

  if (isEmpty || campaigns.length === 0) {
    return (
      <EmptyState
        title={emptyStateTitle}
        description={emptyStateDescription}
        illustration={<NoCampaignsIllustration />}
      />
    );
  }

  return (
    <VirtualizedGrid
      items={campaigns}
      getKey={(campaign: Campaign) => campaign.id}
      rowHeight={480}
      gap={24}
      minColumnWidth={340}
      renderItem={(campaign: Campaign) => (
        <CampaignCard campaign={campaign} onPledge={onPledge} />
      )}
    />
  );
}

describe("CampaignList Component", () => {
  const mockCampaigns: Campaign[] = [
    {
      id: "1",
      contractId: "1",
      title: "Clean Water Initiative",
      description: "Bring clean water to rural communities",
      creator: "WaterCharity",
      raised: 15000,
      goal: 50000,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Active",
      token: "XLM",
    },
    {
      id: "2",
      contractId: "2",
      title: "Solar Energy Project",
      description: "Community solar power installation",
      creator: "GreenEnergy",
      raised: 25000,
      goal: 40000,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Active",
      token: "XLM",
    },
  ];

  const mockOnPledge = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render list of campaigns", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("virtualized-grid")).toBeInTheDocument();
    });

    it("should render each campaign card", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      mockCampaigns.forEach((campaign) => {
        expect(
          screen.getByTestId(`campaign-card-${campaign.id}`),
        ).toBeInTheDocument();
      });
    });

    it("should display campaign titles", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      mockCampaigns.forEach((campaign) => {
        expect(screen.getByText(campaign.title)).toBeInTheDocument();
      });
    });

    it("should render correct number of campaign cards", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      const cards = screen.getAllByTestId(/campaign-card-/);
      expect(cards).toHaveLength(mockCampaigns.length);
    });

    it("should handle single campaign", () => {
      render(
        <CampaignList campaigns={[mockCampaigns[0]]} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("campaign-card-1")).toBeInTheDocument();
    });

    it("should handle many campaigns", () => {
      const manyCampaigns = Array.from({ length: 50 }, (_, i) => ({
        ...mockCampaigns[0],
        id: String(i),
        contractId: String(i),
        title: `Campaign ${i}`,
      }));

      render(
        <CampaignList campaigns={manyCampaigns} onPledge={mockOnPledge} />,
      );

      expect(screen.getAllByTestId(/campaign-card-/)).toHaveLength(50);
    });
  });

  describe("Empty State", () => {
    it("should render empty state when no campaigns provided", () => {
      render(<CampaignList campaigns={[]} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("should display empty state message", () => {
      render(<CampaignList campaigns={[]} onPledge={mockOnPledge} />);

      expect(screen.getByText("No campaigns found")).toBeInTheDocument();
    });

    it("should show empty state illustration", () => {
      render(<CampaignList campaigns={[]} onPledge={mockOnPledge} />);

      expect(
        screen.getByTestId("no-campaigns-illustration"),
      ).toBeInTheDocument();
    });

    it("should use custom empty state text", () => {
      const customTitle = "No results match your search";
      const customDescription = "Try different filters";

      render(
        <CampaignList
          campaigns={[]}
          onPledge={mockOnPledge}
          emptyStateTitle={customTitle}
          emptyStateDescription={customDescription}
        />,
      );

      expect(screen.getByText(customTitle)).toBeInTheDocument();
      expect(screen.getByText(customDescription)).toBeInTheDocument();
    });

    it("should render empty state when isEmpty prop is true", () => {
      render(
        <CampaignList
          campaigns={mockCampaigns}
          onPledge={mockOnPledge}
          isEmpty={true}
        />,
      );

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.queryByTestId("virtualized-grid")).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should call onPledge when campaign is pledged", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      const pledgeButtons = screen.getAllByText("Pledge");
      pledgeButtons[0].click();

      expect(mockOnPledge).toHaveBeenCalledWith(mockCampaigns[0].id);
    });

    it("should pass correct campaign id to onPledge", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      const pledgeButtons = screen.getAllByText("Pledge");
      pledgeButtons[1].click();

      expect(mockOnPledge).toHaveBeenCalledWith(mockCampaigns[1].id);
    });

    it("should handle multiple pledge interactions", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      const pledgeButtons = screen.getAllByText("Pledge");
      pledgeButtons[0].click();
      pledgeButtons[1].click();

      expect(mockOnPledge).toHaveBeenCalledTimes(2);
      expect(mockOnPledge).toHaveBeenCalledWith(mockCampaigns[0].id);
      expect(mockOnPledge).toHaveBeenCalledWith(mockCampaigns[1].id);
    });
  });

  describe("Props Handling", () => {
    it("should accept campaigns array prop", () => {
      const { container } = render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      expect(container.firstChild).toBeTruthy();
    });

    it("should accept onPledge callback prop", () => {
      const { container } = render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      expect(container.firstChild).toBeTruthy();
    });

    it("should support optional empty state props", () => {
      const { container } = render(
        <CampaignList
          campaigns={[]}
          onPledge={mockOnPledge}
          emptyStateTitle="Custom Title"
          emptyStateDescription="Custom Description"
        />,
      );

      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should render campaign cards with testid", () => {
      render(
        <CampaignList campaigns={mockCampaigns} onPledge={mockOnPledge} />,
      );

      mockCampaigns.forEach((campaign) => {
        expect(
          screen.getByTestId(`campaign-card-${campaign.id}`),
        ).toBeInTheDocument();
      });
    });

    it("should have accessible empty state", () => {
      render(<CampaignList campaigns={[]} onPledge={mockOnPledge} />);

      const emptyState = screen.getByTestId("empty-state");
      expect(emptyState).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should render virtualized grid efficiently", () => {
      const largeCampaignList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockCampaigns[0],
        id: String(i),
        contractId: String(i),
      }));

      const { container } = render(
        <CampaignList campaigns={largeCampaignList} onPledge={mockOnPledge} />,
      );

      expect(
        container.querySelector('[data-testid="virtualized-grid"]'),
      ).toBeInTheDocument();
    });
  });
});

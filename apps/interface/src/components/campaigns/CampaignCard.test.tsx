import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Campaign } from "@/types/campaign";

/**
 * Test suite for CampaignCard presentational component.
 * This component displays individual campaign information
 * without managing any data-fetching logic.
 *
 * These tests verify:
 * - Campaign data rendering (title, description, progress)
 * - Progress bar calculations
 * - Call-to-action button handling
 * - Visual state representation
 * - Accessibility features
 */

interface CampaignCardProps {
  campaign: Campaign;
  onPledge: (campaignId: string) => void;
  index?: number;
}

function CampaignCard({ campaign, onPledge, index = 0 }: CampaignCardProps) {
  const progress = Math.min(100, (campaign.raised / campaign.goal) * 100);
  const daysLeft = campaign.deadline
    ? Math.ceil(
        (new Date(campaign.deadline).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const status = campaign.raised >= campaign.goal ? "funded" : "active";

  return (
    <div data-testid={`campaign-card-${index}`} className="campaign-card">
      <div className="campaign-header">
        <h3 data-testid="campaign-title">{campaign.title}</h3>
        <span data-testid="campaign-status" className={`status-${status}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <p data-testid="campaign-description">{campaign.description}</p>

      <div className="campaign-info">
        <span data-testid="campaign-creator">By {campaign.creator}</span>
        {daysLeft > 0 && (
          <span data-testid="days-left">{daysLeft} days left</span>
        )}
      </div>

      <div className="progress-section">
        <div data-testid="progress-bar" className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
            data-testid="progress-fill"
          />
        </div>

        <div className="progress-info">
          <span data-testid="raised-amount">
            ${campaign.raised.toLocaleString()}
          </span>
          <span data-testid="goal-amount">
            {" "}
            of ${campaign.goal.toLocaleString()}
          </span>
        </div>

        <div className="progress-percentage">
          <span data-testid="progress-percentage">{Math.round(progress)}%</span>
        </div>
      </div>

      <button
        onClick={() => onPledge(campaign.id)}
        data-testid="pledge-button"
        disabled={status === "funded"}
      >
        {status === "funded" ? "Funded" : "Pledge Now"}
      </button>
    </div>
  );
}

describe("CampaignCard Component", () => {
  const mockCampaign: Campaign = {
    id: "1",
    contractId: "1",
    title: "Clean Water Initiative",
    description: "Bringing clean water to rural communities",
    creator: "WaterCharity",
    raised: 15000,
    goal: 50000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "Active",
    token: "XLM",
  };

  const mockOnPledge = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render campaign card", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-card-0")).toBeInTheDocument();
    });

    it("should display campaign title", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-title")).toHaveTextContent(
        mockCampaign.title,
      );
    });

    it("should display campaign description", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-description")).toHaveTextContent(
        mockCampaign.description,
      );
    });

    it("should display campaign creator", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-creator")).toHaveTextContent(
        `By ${mockCampaign.creator}`,
      );
    });

    it("should render pledge button", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("pledge-button")).toBeInTheDocument();
    });
  });

  describe("Campaign Status", () => {
    it("should show active status when not funded", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-status")).toHaveTextContent("Active");
    });

    it("should show funded status when goal reached", () => {
      const fundedCampaign = {
        ...mockCampaign,
        raised: 50000,
      };

      render(
        <CampaignCard campaign={fundedCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("campaign-status")).toHaveTextContent("Funded");
    });

    it("should show funded status when goal exceeded", () => {
      const overFundedCampaign = {
        ...mockCampaign,
        raised: 75000,
      };

      render(
        <CampaignCard campaign={overFundedCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("campaign-status")).toHaveTextContent("Funded");
    });

    it("should have correct CSS class for status", () => {
      const fundedCampaign = {
        ...mockCampaign,
        raised: mockCampaign.goal,
      };

      render(
        <CampaignCard campaign={fundedCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("campaign-status")).toHaveClass(
        "status-funded",
      );
    });
  });

  describe("Progress Bar", () => {
    it("should render progress bar", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    });

    it("should calculate correct progress percentage", () => {
      const testCases = [
        { raised: 0, goal: 100, expected: 0 },
        { raised: 50, goal: 100, expected: 50 },
        { raised: 100, goal: 100, expected: 100 },
        { raised: 150, goal: 100, expected: 100 }, // Capped at 100%
        { raised: 15000, goal: 50000, expected: 30 },
      ];

      testCases.forEach(({ raised, goal, expected }) => {
        const campaign = {
          ...mockCampaign,
          raised,
          goal,
        };

        const { container } = render(
          <CampaignCard campaign={campaign} onPledge={mockOnPledge} />,
        );

        const progressFill = screen.getByTestId("progress-fill");
        const percentage = parseInt(progressFill.style.width);
        expect(percentage).toBe(expected);

        // Clean up
        container.remove();
      });
    });

    it("should display progress percentage", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("progress-percentage")).toHaveTextContent(
        "30%",
      );
    });

    it("should display raised and goal amounts", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("raised-amount")).toHaveTextContent("$15,000");
      expect(screen.getByTestId("goal-amount")).toHaveTextContent("$50,000");
    });
  });

  describe("Deadline Display", () => {
    it("should display days left when deadline is in future", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      const daysLeft = screen.getByTestId("days-left");
      expect(daysLeft).toBeInTheDocument();
      expect(daysLeft.textContent).toMatch(/\d+ days left/);
    });

    it("should not display days left when deadline is in past", () => {
      const pastCampaign = {
        ...mockCampaign,
        deadline: new Date(Date.now() - 1000).toISOString(),
      };

      render(<CampaignCard campaign={pastCampaign} onPledge={mockOnPledge} />);

      expect(screen.queryByTestId("days-left")).not.toBeInTheDocument();
    });

    it("should show correct number of days remaining", () => {
      // 7 days from now
      const futureCampaign = {
        ...mockCampaign,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      render(
        <CampaignCard campaign={futureCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("days-left")).toHaveTextContent("7 days left");
    });
  });

  describe("Button Interactions", () => {
    it("should call onPledge when pledge button clicked", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      const pledgeButton = screen.getByTestId("pledge-button");
      fireEvent.click(pledgeButton);

      expect(mockOnPledge).toHaveBeenCalledWith(mockCampaign.id);
    });

    it("should pass correct campaign id to onPledge", () => {
      const campaignWithId = {
        ...mockCampaign,
        id: "campaign-123",
      };

      render(
        <CampaignCard campaign={campaignWithId} onPledge={mockOnPledge} />,
      );

      fireEvent.click(screen.getByTestId("pledge-button"));

      expect(mockOnPledge).toHaveBeenCalledWith("campaign-123");
    });

    it("should disable pledge button when campaign is funded", () => {
      const fundedCampaign = {
        ...mockCampaign,
        raised: mockCampaign.goal,
      };

      render(
        <CampaignCard campaign={fundedCampaign} onPledge={mockOnPledge} />,
      );

      const pledgeButton = screen.getByTestId("pledge-button");
      expect(pledgeButton).toBeDisabled();
    });

    it("should show Funded text when campaign is funded", () => {
      const fundedCampaign = {
        ...mockCampaign,
        raised: mockCampaign.goal,
      };

      render(
        <CampaignCard campaign={fundedCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("pledge-button")).toHaveTextContent("Funded");
    });

    it("should show Pledge Now text when campaign is active", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("pledge-button")).toHaveTextContent(
        "Pledge Now",
      );
    });

    it("should not prevent onPledge call for active campaign", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      const pledgeButton = screen.getByTestId(
        "pledge-button",
      ) as HTMLButtonElement;
      expect(pledgeButton.disabled).toBe(false);
      fireEvent.click(pledgeButton);

      expect(mockOnPledge).toHaveBeenCalled();
    });
  });

  describe("Props Handling", () => {
    it("should accept campaign prop", () => {
      const { container } = render(
        <CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />,
      );

      expect(container.firstChild).toBeTruthy();
    });

    it("should accept onPledge callback prop", () => {
      const { container } = render(
        <CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />,
      );

      expect(container.firstChild).toBeTruthy();
    });

    it("should accept optional index prop", () => {
      render(
        <CampaignCard
          campaign={mockCampaign}
          onPledge={mockOnPledge}
          index={5}
        />,
      );

      expect(screen.getByTestId("campaign-card-5")).toBeInTheDocument();
    });
  });

  describe("Number Formatting", () => {
    it("should format currency with comma separators", () => {
      const largeCampaign = {
        ...mockCampaign,
        raised: 1000000,
        goal: 5000000,
      };

      render(<CampaignCard campaign={largeCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("raised-amount")).toHaveTextContent(
        "$1,000,000",
      );
      expect(screen.getByTestId("goal-amount")).toHaveTextContent("$5,000,000");
    });

    it("should handle small amounts", () => {
      const smallCampaign = {
        ...mockCampaign,
        raised: 100,
        goal: 500,
      };

      render(<CampaignCard campaign={smallCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("raised-amount")).toHaveTextContent("$100");
      expect(screen.getByTestId("goal-amount")).toHaveTextContent("$500");
    });
  });

  describe("Edge Cases", () => {
    it("should handle campaign with zero raised amount", () => {
      const noRaisedCampaign = {
        ...mockCampaign,
        raised: 0,
      };

      render(
        <CampaignCard campaign={noRaisedCampaign} onPledge={mockOnPledge} />,
      );

      expect(screen.getByTestId("raised-amount")).toHaveTextContent("$0");
      expect(screen.getByTestId("progress-percentage")).toHaveTextContent("0%");
    });

    it("should handle campaign with very large amounts", () => {
      const largeCampaign = {
        ...mockCampaign,
        raised: 999999999,
        goal: 1000000000,
      };

      render(<CampaignCard campaign={largeCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("raised-amount")).toHaveTextContent(
        "$999,999,999",
      );
    });
  });

  describe("Accessibility", () => {
    it("should have proper button element for pledge action", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      const button = screen.getByTestId("pledge-button");
      expect(button.tagName).toBe("BUTTON");
    });

    it("should have semantic heading for title", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      const title = screen.getByTestId("campaign-title");
      expect(title.tagName).toBe("H3");
    });

    it("should have descriptive text content", () => {
      render(<CampaignCard campaign={mockCampaign} onPledge={mockOnPledge} />);

      expect(screen.getByTestId("campaign-title").textContent).toBeTruthy();
      expect(
        screen.getByTestId("campaign-description").textContent,
      ).toBeTruthy();
    });
  });
});

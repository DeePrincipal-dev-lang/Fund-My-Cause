import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignCardProgress } from "./CampaignCardProgress";
import type { Campaign } from "@/types/campaign";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@fund-my-cause/components", () => ({
  CampaignProgress: ({
    raisedText,
    goalText,
    timeRemaining,
    renderBar,
    percent,
  }: {
    raisedText: string;
    goalText: string;
    timeRemaining: React.ReactNode;
    renderBar: (opts: { percent: number }) => React.ReactNode;
    percent: number;
  }) => (
    <div>
      <div data-testid="raised-text">{raisedText}</div>
      <div data-testid="goal-text">{goalText}</div>
      <div data-testid="time-remaining">{timeRemaining}</div>
      <div data-testid="progress-bar">{renderBar({ percent })}</div>
    </div>
  ),
}));

jest.mock("@fund-my-cause/shared-utils", () => ({
  formatXlmWithUsd: (amount: number, price: number | null) =>
    price ? `${amount} XLM ($${(amount * price).toFixed(2)})` : `${amount} XLM`,
}));

jest.mock("@/components/ui/ProgressBar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar-inner" style={{ width: `${progress}%` }} />
  ),
}));

jest.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ deadline }: { deadline: string }) => (
    <span data-testid="countdown">{deadline}</span>
  ),
}));

const mockCampaign: Campaign = {
  id: "test-1",
  contractId: "CTEST1",
  title: "Forest Restoration",
  description: "Plant 1 million trees",
  creator: "GCREATOR1",
  raised: 50,
  goal: 100,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

describe("CampaignCardProgress", () => {
  it("renders raised amount text", () => {
    render(
      <CampaignCardProgress
        campaign={mockCampaign}
        progress={50}
        xlmPrice={null}
      />,
    );
    expect(screen.getByTestId("raised-text")).toHaveTextContent("50 XLM");
    expect(screen.getByTestId("raised-text")).toHaveTextContent("raised");
  });

  it("renders goal amount text", () => {
    render(
      <CampaignCardProgress
        campaign={mockCampaign}
        progress={50}
        xlmPrice={null}
      />,
    );
    expect(screen.getByTestId("goal-text")).toHaveTextContent("100 XLM");
    expect(screen.getByTestId("goal-text")).toHaveTextContent("goal");
  });

  it("renders progress bar with correct percentage", () => {
    render(
      <CampaignCardProgress
        campaign={mockCampaign}
        progress={50}
        xlmPrice={null}
      />,
    );
    const bar = screen.getByTestId("progress-bar-inner");
    expect(bar).toHaveStyle({ width: "50%" });
  });

  it("renders countdown timer", () => {
    render(
      <CampaignCardProgress
        campaign={mockCampaign}
        progress={50}
        xlmPrice={null}
      />,
    );
    expect(screen.getByTestId("countdown")).toBeInTheDocument();
  });

  it("includes USD amount when xlmPrice is provided", () => {
    render(
      <CampaignCardProgress
        campaign={mockCampaign}
        progress={50}
        xlmPrice={0.1}
      />,
    );
    expect(screen.getByTestId("raised-text")).toHaveTextContent("$5.00");
  });
});

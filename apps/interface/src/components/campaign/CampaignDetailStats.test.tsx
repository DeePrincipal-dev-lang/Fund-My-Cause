import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignDetailStats } from "./CampaignDetailStats";

jest.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ deadline }: { deadline: string | Date }) => (
    <div data-testid="countdown-timer">{String(deadline)}</div>
  ),
}));

jest.mock("@/components/ui/XlmAmount", () => ({
  XlmAmount: ({ xlm, price }: { xlm: number; price?: number | null }) => (
    <span data-testid="xlm-amount">{xlm}</span>
  ),
}));

describe("CampaignDetailStats", () => {
  it("renders contributor count", () => {
    render(
      <CampaignDetailStats
        contributorCount={42}
        averageContribution={1500}
        deadline="2024-12-31T23:59:59Z"
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("renders average contribution with XlmAmount", () => {
    render(
      <CampaignDetailStats
        contributorCount={42}
        averageContribution={1500}
        deadline="2024-12-31T23:59:59Z"
        xlmPrice={150}
      />,
    );
    const xlmAmounts = screen.getAllByTestId("xlm-amount");
    expect(xlmAmounts[0]).toHaveTextContent("1500");
    expect(screen.getByText("Avg. contribution")).toBeInTheDocument();
  });

  it("renders countdown timer with deadline", () => {
    const deadline = "2024-12-31T23:59:59Z";
    render(
      <CampaignDetailStats
        contributorCount={42}
        averageContribution={1500}
        deadline={deadline}
      />,
    );
    expect(screen.getByTestId("countdown-timer")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });

  it("renders all three stat cards", () => {
    render(
      <CampaignDetailStats
        contributorCount={100}
        averageContribution={2000}
        deadline="2024-12-31T23:59:59Z"
      />,
    );
    expect(screen.getByText("Contributors")).toBeInTheDocument();
    expect(screen.getByText("Avg. contribution")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });

  it("accepts Date object for deadline", () => {
    const deadline = new Date("2024-12-31T23:59:59Z");
    render(
      <CampaignDetailStats
        contributorCount={42}
        averageContribution={1500}
        deadline={deadline}
      />,
    );
    expect(screen.getByTestId("countdown-timer")).toBeInTheDocument();
  });

  it("renders zero contributor count", () => {
    render(
      <CampaignDetailStats
        contributorCount={0}
        averageContribution={0}
        deadline="2024-12-31T23:59:59Z"
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles large contributor counts", () => {
    render(
      <CampaignDetailStats
        contributorCount={9999}
        averageContribution={5000}
        deadline="2024-12-31T23:59:59Z"
      />,
    );
    expect(screen.getByText("9999")).toBeInTheDocument();
  });

  it("renders without xlmPrice", () => {
    const { container } = render(
      <CampaignDetailStats
        contributorCount={42}
        averageContribution={1500}
        deadline="2024-12-31T23:59:59Z"
      />,
    );
    expect(container).toBeInTheDocument();
  });
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { CampaignDetailProgress } from "./CampaignDetailProgress";

jest.mock("@/components/ui/ProgressBar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" aria-valuenow={progress} />
  ),
}));

jest.mock("@/components/ui/XlmAmount", () => ({
  XlmAmount: ({ xlm, price }: { xlm: number; price?: number | null }) => (
    <span data-testid="xlm-amount">{xlm}</span>
  ),
}));

describe("CampaignDetailProgress", () => {
  it("renders progress bar with correct value", () => {
    render(
      <CampaignDetailProgress
        progress={50}
        raised={5000}
        goal={10000}
        xlmPrice={150}
      />,
    );
    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("displays raised and goal amounts", () => {
    render(
      <CampaignDetailProgress
        progress={50}
        raised={5000}
        goal={10000}
        xlmPrice={150}
      />,
    );
    const xlmAmounts = screen.getAllByTestId("xlm-amount");
    expect(xlmAmounts).toHaveLength(2);
    expect(xlmAmounts[0]).toHaveTextContent("5000");
    expect(xlmAmounts[1]).toHaveTextContent("10000");
  });

  it("renders 'raised' and 'goal' labels", () => {
    render(<CampaignDetailProgress progress={25} raised={2500} goal={10000} />);
    expect(screen.getByText(/raised/)).toBeInTheDocument();
    expect(screen.getByText(/goal/)).toBeInTheDocument();
  });

  it("handles zero progress", () => {
    render(<CampaignDetailProgress progress={0} raised={0} goal={10000} />);
    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
  });

  it("handles 100% progress", () => {
    render(
      <CampaignDetailProgress progress={100} raised={10000} goal={10000} />,
    );
    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders without xlmPrice", () => {
    const { container } = render(
      <CampaignDetailProgress progress={50} raised={5000} goal={10000} />,
    );
    expect(container).toBeInTheDocument();
  });
});

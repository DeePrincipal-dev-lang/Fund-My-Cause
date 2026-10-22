import React from "react";
import { render, screen } from "@testing-library/react";
import { FundingProgress } from "./FundingProgress";

jest.mock("@/components/ui/ProgressBar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div
      role="progressbar"
      aria-valuenow={progress}
      data-testid="progress-bar"
    />
  ),
}));

jest.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ deadline }: { deadline: string }) => (
    <span data-testid="countdown-timer">{deadline}</span>
  ),
}));

jest.mock("@/lib/format", () => ({
  formatXLM: (v: bigint) => `${v.toString()} XLM`,
}));

const defaultProps = {
  progress: 50,
  totalRaised: 5000n,
  goal: 10000n,
  contributorCount: 42n,
  averageContribution: 119n,
  deadline: "2026-12-31T00:00:00.000Z",
};

describe("FundingProgress", () => {
  it("renders the progress bar with the correct progress value", () => {
    render(<FundingProgress {...defaultProps} />);
    const bar = screen.getByTestId("progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("displays raised amount", () => {
    render(<FundingProgress {...defaultProps} />);
    expect(screen.getByText(/5000 XLM raised/)).toBeInTheDocument();
  });

  it("displays goal amount", () => {
    render(<FundingProgress {...defaultProps} />);
    expect(screen.getByText(/10000 XLM goal/)).toBeInTheDocument();
  });

  it("displays contributor count", () => {
    render(<FundingProgress {...defaultProps} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("displays average contribution", () => {
    render(<FundingProgress {...defaultProps} />);
    expect(screen.getByText(/119 XLM/)).toBeInTheDocument();
    expect(screen.getByText("Avg. contribution")).toBeInTheDocument();
  });

  it("renders the countdown timer with the deadline", () => {
    render(<FundingProgress {...defaultProps} />);
    expect(screen.getByTestId("countdown-timer")).toHaveTextContent(
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("renders 0% progress correctly", () => {
    render(<FundingProgress {...defaultProps} progress={0} />);
    const bar = screen.getByTestId("progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders 100% progress correctly", () => {
    render(<FundingProgress {...defaultProps} progress={100} />);
    const bar = screen.getByTestId("progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

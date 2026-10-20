import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CampaignProgress } from "../CampaignProgress";
import {
  activeCampaign,
  fundedCampaign,
} from "../../../../fixtures/campaign";

// Derive display strings from the canonical fixture data so the tests stay in
// sync with the fixtures rather than duplicating magic numbers inline.
const activePct = activeCampaign.percentageFunded; // 45
const fundedPct = fundedCampaign.percentageFunded; // 105 — over-funded

// Human-readable strings derived from the fixtures (simulate how the UI formats them)
const activeRaisedText = `${Number(activeCampaign.totalRaised).toLocaleString()} XLM raised`;
const activeGoalText = `${Number(activeCampaign.goal).toLocaleString()} XLM goal`;
const activeDaysText = `${activeCampaign.daysRemaining}d left`;

describe("CampaignProgress", () => {
  it("renders a zero-progress bar with no amounts when empty", () => {
    render(<CampaignProgress percent={0} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
  });

  it("renders the bar, amounts and remaining time for the active campaign fixture", () => {
    render(
      <CampaignProgress
        percent={activePct}
        raisedText={activeRaisedText}
        goalText={activeGoalText}
        timeRemaining={activeDaysText}
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      String(activePct),
    );
    expect(screen.getByText(activeRaisedText)).toBeDefined();
    expect(screen.getByText(activeGoalText)).toBeDefined();
    expect(screen.getByText(activeDaysText)).toBeDefined();
  });

  it("clamps an over-funded percentage for display (funded campaign fixture)", () => {
    // fundedCampaign.percentageFunded is 105 — should clamp to 100 in the bar
    render(<CampaignProgress percent={fundedPct} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("shows a loading placeholder instead of the bar", () => {
    render(
      <CampaignProgress
        percent={activePct}
        isLoading
        raisedText={activeRaisedText}
      />,
    );

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(activeRaisedText)).toBeNull();
  });

  it("shows the error message instead of the bar", () => {
    render(<CampaignProgress percent={activePct} error="Totals unavailable" />);

    expect(screen.getByRole("alert").textContent).toBe("Totals unavailable");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("delegates the bar to renderBar when supplied", () => {
    const renderBar = vi.fn(({ percent }) => <div data-percent={percent} />);
    render(<CampaignProgress percent={activePct} renderBar={renderBar} />);

    expect(renderBar).toHaveBeenCalledWith({
      percent: activePct,
      animated: false,
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

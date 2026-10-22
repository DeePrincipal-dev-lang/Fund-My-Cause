import React from "react";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders with correct percentage", () => {
    const { container } = render(<ProgressBar progress={50} />);
    const bar = container.querySelector("[role='progressbar']");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("displays percentage text", () => {
    render(<ProgressBar progress={75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("handles zero progress", () => {
    const { container } = render(<ProgressBar progress={0} />);
    const bar = container.querySelector("[role='progressbar']");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("handles 100% progress", () => {
    const { container } = render(<ProgressBar progress={100} />);
    const bar = container.querySelector("[role='progressbar']");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("clamps progress exceeding 100", () => {
    const { container } = render(<ProgressBar progress={150} />);
    const bar = container.querySelector("[role='progressbar']");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });
});

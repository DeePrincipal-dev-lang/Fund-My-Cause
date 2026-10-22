/**
 * Unit tests for campaigns error boundary — Issue #1285
 *
 * Tests error handling and recovery UI on campaigns page.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CampaignsError from "../error";

describe("CampaignsError", () => {
  const mockReset = jest.fn();
  const baseError = new Error("Failed to fetch campaigns");

  beforeEach(() => {
    mockReset.mockClear();
  });

  it("renders error page", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    expect(screen.getByText("Failed to load campaigns")).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    expect(screen.getByText("Failed to fetch campaigns")).toBeInTheDocument();
  });

  it("displays fallback message when error has no message", () => {
    const errorNoMsg = new Error();
    render(<CampaignsError error={errorNoMsg} reset={mockReset} />);

    expect(
      screen.getByText("Unable to load the campaigns list. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders try again button", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    const button = screen.getByText("Try again");
    expect(button).toBeInTheDocument();
  });

  it("calls reset when try again is clicked", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    const button = screen.getByText("Try again");
    fireEvent.click(button);

    expect(mockReset).toHaveBeenCalled();
  });

  it("renders home link", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    const homeLink = screen.getByText("Go home");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.getAttribute("href")).toBe("/");
  });

  it("displays proper heading hierarchy", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
  });

  it("has proper button styling", () => {
    render(<CampaignsError error={baseError} reset={mockReset} />);

    const button = screen.getByText("Try again");
    const style = button.getAttribute("style");

    expect(style).toContain("backgroundColor");
    expect(style).toContain("color");
    expect(style).toContain("padding");
  });

  it("renders in centered layout", () => {
    const { container } = render(
      <CampaignsError error={baseError} reset={mockReset} />,
    );

    const wrapper = container.firstChild;
    const style = wrapper?.getAttribute("style");

    expect(style).toContain("display");
    expect(style).toContain("flex");
    expect(style).toContain("alignItems");
    expect(style).toContain("center");
  });
});

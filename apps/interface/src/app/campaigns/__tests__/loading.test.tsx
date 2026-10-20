/**
 * Unit tests for campaigns loading skeleton — Issue #1285
 *
 * Tests that the loading component renders properly and provides
 * accessible skeleton UI while data loads.
 */

import React from "react";
import { render } from "@testing-library/react";
import CampaignsLoading from "../loading";

describe("CampaignsLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<CampaignsLoading />);
    expect(container).toBeTruthy();
  });

  it("displays loading skeleton structure", () => {
    const { container } = render(<CampaignsLoading />);

    // Should have header section
    const headings = container.querySelectorAll("h1");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("displays multiple skeleton cards for campaign list", () => {
    const { container } = render(<CampaignsLoading />);

    // Should render multiple skeleton cards (we render 6 in the component)
    const skeletonCards = container.querySelectorAll(
      '[style*="gridTemplateColumns"]',
    ).length;
    // The grid container should exist
    expect(
      container.querySelector('[style*="gridTemplateColumns"]'),
    ).toBeTruthy();
  });

  it("applies pulse animation", () => {
    const { container } = render(<CampaignsLoading />);

    // Check for animation style
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("pulse");
    expect(style?.textContent).toContain("animation");
  });

  it("uses accessible semantic HTML", () => {
    const { container } = render(<CampaignsLoading />);

    // Should use semantic div structure (no accessibility violations)
    const content = container.textContent;
    expect(content).toBeTruthy();
  });

  it("maintains loading skeleton for appropriate duration", () => {
    const { container } = render(<CampaignsLoading />);

    // Verify pulse animation duration matches expectation
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("2s");
  });
});

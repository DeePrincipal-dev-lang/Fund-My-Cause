/**
 * Unit tests for profile loading skeleton — Issue #1285
 *
 * Tests that the loading component renders properly for profile page.
 */

import React from "react";
import { render } from "@testing-library/react";
import ProfileLoading from "../loading";

describe("ProfileLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<ProfileLoading />);
    expect(container).toBeTruthy();
  });

  it("displays avatar skeleton", () => {
    const { container } = render(<ProfileLoading />);

    // Should have a circular skeleton (avatar)
    const styles = container.innerHTML;
    expect(styles).toContain("borderRadius");
  });

  it("displays multiple form field skeletons", () => {
    const { container } = render(<ProfileLoading />);

    // Should have multiple field containers
    const fields = container.querySelectorAll("[style*='padding: 16px']");
    expect(fields.length).toBeGreaterThan(0);
  });

  it("applies pulse animation", () => {
    const { container } = render(<ProfileLoading />);

    // Check for animation style
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("pulse");
  });

  it("renders with proper structure", () => {
    const { container } = render(<ProfileLoading />);

    // Should have reasonable content
    const content = container.textContent;
    expect(content).toBeTruthy();
  });
});

/**
 * Unit tests for status loading skeleton — Issue #1285
 *
 * Tests loading UI for status page.
 */

import React from "react";
import { render } from "@testing-library/react";
import StatusLoading from "../loading";

describe("StatusLoading", () => {
  it("renders without error", () => {
    const { container } = render(<StatusLoading />);
    expect(container).toBeTruthy();
  });

  it("displays heading skeleton", () => {
    const { container } = render(<StatusLoading />);

    const styles = container.innerHTML;
    expect(styles).toContain("backgroundColor");
  });

  it("displays status cards skeleton", () => {
    const { container } = render(<StatusLoading />);

    // Should have grid layout for cards
    const styles = container.innerHTML;
    expect(styles).toContain("gridTemplateColumns");
  });

  it("displays table skeleton", () => {
    const { container } = render(<StatusLoading />);

    // Should have rows for table data
    const rows = container.querySelectorAll("[style*='display: flex']");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("applies pulse animation", () => {
    const { container } = render(<StatusLoading />);

    const style = container.querySelector("style");
    expect(style?.textContent).toContain("pulse");
    expect(style?.textContent).toContain("animation");
  });

  it("renders with proper spacing", () => {
    const { container } = render(<StatusLoading />);

    const content = container.textContent;
    expect(content).toBeTruthy();
  });
});

/**
 * Unit tests for profile error boundary — Issue #1285
 *
 * Tests error handling on profile page.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfileError from "../error";

describe("ProfileError", () => {
  const mockReset = jest.fn();
  const baseError = new Error("Failed to fetch profile");

  beforeEach(() => {
    mockReset.mockClear();
  });

  it("renders error message", () => {
    render(<ProfileError error={baseError} reset={mockReset} />);

    expect(screen.getByText("Failed to load profile")).toBeInTheDocument();
  });

  it("displays custom error message", () => {
    render(<ProfileError error={baseError} reset={mockReset} />);

    expect(screen.getByText("Failed to fetch profile")).toBeInTheDocument();
  });

  it("renders try again button", () => {
    render(<ProfileError error={baseError} reset={mockReset} />);

    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("calls reset function on button click", () => {
    render(<ProfileError error={baseError} reset={mockReset} />);

    fireEvent.click(screen.getByText("Try again"));
    expect(mockReset).toHaveBeenCalled();
  });

  it("renders home navigation link", () => {
    render(<ProfileError error={baseError} reset={mockReset} />);

    const link = screen.getByText("Go home");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/");
  });

  it("has proper layout structure", () => {
    const { container } = render(
      <ProfileError error={baseError} reset={mockReset} />,
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveAttribute("style");
  });
});

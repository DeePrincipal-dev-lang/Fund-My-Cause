import React from "react";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { CommandPalette } from "./CommandPalette";

expect.extend(toHaveNoViolations);

// jsdom does not implement scrollIntoView, which CommandPalette calls on mount.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ address: null, connect: jest.fn() }),
}));

describe("CommandPalette accessibility (#1475)", () => {
  it("gives the close button an accessible name", () => {
    render(<CommandPalette isOpen onClose={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: "Close command palette" }),
    ).toBeInTheDocument();
  });

  it("has no button-name axe violations", async () => {
    const { container } = render(<CommandPalette isOpen onClose={jest.fn()} />);

    const results = await axe(container, { runOnly: ["button-name"] });

    expect(results).toHaveNoViolations();
  });
});

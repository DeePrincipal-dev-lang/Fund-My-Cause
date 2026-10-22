/**
 * ErrorSimulator runtime guard (#1573).
 *
 * The component must render nothing outside development, regardless of where
 * it's mounted. DevErrorSimulator already gates the *import*, but the
 * component itself carries a belt-and-braces guard so a stray direct import
 * (or a test that mounts it) can't render the button in production.
 */
import { render } from "@testing-library/react";
import { ErrorSimulator } from "./ErrorSimulator";

describe("ErrorSimulator (#1573)", () => {
  const prev = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  it("renders nothing in production", () => {
    process.env.NODE_ENV = "production";
    const { container } = render(<ErrorSimulator />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing in test (NODE_ENV=test)", () => {
    process.env.NODE_ENV = "test";
    const { container } = render(<ErrorSimulator />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the simulate button in development", () => {
    process.env.NODE_ENV = "development";
    const { getByText } = render(<ErrorSimulator />);
    expect(getByText("Simulate Error")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";

const { push, connect } = vi.hoisted(() => ({ push: vi.fn(), connect: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ connect }),
}));

const PLACEHOLDER = "Type a command or search...";

function getInput() {
  return screen.getByPlaceholderText(PLACEHOLDER);
}

function getActiveOption() {
  return screen.getByRole("option", { selected: true });
}

describe("CommandPalette keyboard navigation", () => {
  beforeEach(() => {
    push.mockClear();
    connect.mockClear();
  });

  it("renders nothing while closed", () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("focuses the search input when it opens", async () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(getInput()).toHaveFocus());
  });

  it("starts with the first command active", () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    expect(getActiveOption()).toHaveTextContent("Go to Home");
  });

  it("moves the active command down and up with the arrow keys", () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    fireEvent.keyDown(getInput(), { key: "ArrowDown" });
    expect(getActiveOption()).toHaveTextContent("Browse Campaigns");

    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(getActiveOption()).toHaveTextContent("Go to Home");
  });

  it("stops at the first and last command instead of wrapping", () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    fireEvent.keyDown(getInput(), { key: "ArrowUp" });
    expect(getActiveOption()).toHaveTextContent("Go to Home");

    const count = screen.getAllByRole("option").length;
    for (let i = 0; i < count + 5; i++) {
      fireEvent.keyDown(getInput(), { key: "ArrowDown" });
    }
    const options = screen.getAllByRole("option");
    expect(getActiveOption()).toBe(options[options.length - 1]);
  });

  it("runs the active command and closes on Enter", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("runs the command that arrow keys selected, not the first one", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.keyDown(getInput(), { key: "ArrowDown" });
    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/campaigns");
    expect(push).not.toHaveBeenCalledWith("/");
  });

  it("closes on Escape without running a command", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.keyDown(getInput(), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing on Enter when the search has no matches", async () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.change(getInput(), { target: { value: "zzzz-no-such-command" } });
    await waitFor(() => expect(screen.getByText("No results found")).toBeInTheDocument());
    fireEvent.keyDown(getInput(), { key: "Enter" });

    expect(onClose).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("returns focus to the element that had it before opening", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open palette";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<CommandPalette isOpen onClose={vi.fn()} />);
    await waitFor(() => expect(getInput()).toHaveFocus());

    rerender(<CommandPalette isOpen={false} onClose={vi.fn()} />);

    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

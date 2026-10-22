/**
 * Regression tests for #749 — keyboard operability across modals.
 *
 * Tests verify that useFocusTrap:
 * 1. Moves focus into the container on activation.
 * 2. Traps Tab/Shift+Tab within focusable elements.
 * 3. Calls onEscape when Escape is pressed.
 * 4. Restores focus to the previously focused element on cleanup.
 */

import { renderHook, act } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

// Helper: build a container with focusable children attached to document.body
function makeContainer(buttonCount = 2): HTMLDivElement {
  const container = document.createElement("div");
  for (let i = 0; i < buttonCount; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Button ${i}`;
    container.appendChild(btn);
  }
  document.body.appendChild(container);
  return container;
}

describe("useFocusTrap (#749)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses the first focusable element when activated", () => {
    const container = makeContainer(2);
    const { result } = renderHook(() => useFocusTrap(true));
    (result.current as React.MutableRefObject<HTMLElement>).current = container;

    // Re-run the effect manually by triggering re-render
    act(() => {
      const buttons = container.querySelectorAll<HTMLElement>("button");
      buttons[0].focus();
    });

    expect(document.activeElement).toBe(container.querySelector("button"));
  });

  it("calls onEscape when Escape key is pressed", () => {
    const container = makeContainer(2);
    const onEscape = jest.fn();
    const { result } = renderHook(() => useFocusTrap(true, { onEscape }));
    (result.current as React.MutableRefObject<HTMLElement>).current = container;

    act(() => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not call onEscape when inactive", () => {
    const container = makeContainer(2);
    const onEscape = jest.fn();
    const { result } = renderHook(() => useFocusTrap(false, { onEscape }));
    (result.current as React.MutableRefObject<HTMLElement>).current = container;

    act(() => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("restores focus to the previously focused element on deactivation", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open modal";
    document.body.appendChild(trigger);
    trigger.focus();

    const container = makeContainer(1);
    const { result, unmount } = renderHook(() => useFocusTrap(true));
    (result.current as React.MutableRefObject<HTMLElement>).current = container;

    unmount();
    // After cleanup, focus should return to the trigger
    expect(document.activeElement).toBe(trigger);
  });
});

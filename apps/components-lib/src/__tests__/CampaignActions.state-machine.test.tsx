/**
 * CampaignActions — UI state-machine regression tests (issue #1180)
 *
 * The component has no explicit `status` prop. Campaign states are modelled
 * through combinations of:
 *   - donateDisabled  (boolean)
 *   - isLoading       (boolean)
 *   - error           (string | null)
 *   - presence/absence of onDonate / onShare / onSave handlers
 *
 * State encodings used in these tests:
 *   draft   → donateDisabled=true,  no handlers,                isLoading=false, error=null
 *   active  → donateDisabled=false, onDonate/onShare/onSave set, isLoading=false, error=null
 *   funded  → donateDisabled=true,  onShare/onSave set,          isLoading=false, error=null
 *   closed  → donateDisabled=true,  no handlers,                isLoading=false, error=null
 *   loading → any handler set,      isLoading=true,              error=null
 *   error   → error=<string>
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CampaignActions } from "../CampaignActions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop() {}

/** Renders the component and returns the container for convenience. */
function setup(props: React.ComponentProps<typeof CampaignActions>) {
  return render(<CampaignActions {...props} />);
}

// ---------------------------------------------------------------------------
// 1. Individual state rendering
// ---------------------------------------------------------------------------

describe("CampaignActions – state: draft", () => {
  it("renders donate button as disabled when donateDisabled=true and no handler", () => {
    // Even though onDonate is omitted (no button rendered), we can still
    // supply it with donateDisabled so the button appears but is disabled.
    setup({ onDonate: noop, donateLabel: "Donate", donateDisabled: true });
    const btn = screen.getByRole("button", { name: /donate/i });
    expect(btn).toBeDisabled();
  });

  it("does not render share or save buttons when handlers are absent", () => {
    setup({ onDonate: noop, donateLabel: "Donate", donateDisabled: true });
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("renders no error alert", () => {
    setup({ onDonate: noop, donateLabel: "Donate", donateDisabled: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CampaignActions – state: active", () => {
  it("renders donate button as enabled", () => {
    setup({ onDonate: noop, donateLabel: "Donate", donateDisabled: false });
    expect(screen.getByRole("button", { name: /donate/i })).not.toBeDisabled();
  });

  it("renders share and save buttons as enabled", () => {
    setup({ onDonate: noop, donateLabel: "Donate", onShare: noop, onSave: noop });
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).not.toBeDisabled();
  });

  it("calls onDonate when donate button is clicked", () => {
    const onDonate = vi.fn();
    setup({ onDonate, donateLabel: "Donate" });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    expect(onDonate).toHaveBeenCalledOnce();
  });

  it("calls onShare when share button is clicked", () => {
    const onShare = vi.fn();
    setup({ onDonate: noop, donateLabel: "Donate", onShare });
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    setup({ onDonate: noop, donateLabel: "Donate", onSave });
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("renders no error alert", () => {
    setup({ onDonate: noop, donateLabel: "Donate" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CampaignActions – state: funded", () => {
  it("renders donate button as disabled", () => {
    setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
      onShare: noop,
      onSave: noop,
    });
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("renders share and save buttons as enabled", () => {
    setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
      onShare: noop,
      onSave: noop,
    });
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).not.toBeDisabled();
  });

  it("share and save handlers are still callable in funded state", () => {
    const onShare = vi.fn();
    const onSave = vi.fn();
    setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
      onShare,
      onSave,
    });
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});

describe("CampaignActions – state: closed", () => {
  it("all buttons are disabled (donateDisabled=true, no icon handlers)", () => {
    setup({ onDonate: noop, donateLabel: "Donate", donateDisabled: true });
    const donate = screen.getByRole("button", { name: /donate/i });
    expect(donate).toBeDisabled();
    // No share/save buttons because no handlers provided
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("donate handler is NOT called when donate is clicked while disabled", () => {
    const onDonate = vi.fn();
    setup({ onDonate, donateLabel: "Donate", donateDisabled: true });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    expect(onDonate).not.toHaveBeenCalled();
  });
});

describe("CampaignActions – state: loading", () => {
  it("donate button is disabled and aria-busy is true", () => {
    setup({ onDonate: noop, donateLabel: "Donate", isLoading: true });
    const btn = screen.getByRole("button", { name: /donate/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("share button is disabled when loading", () => {
    setup({ onDonate: noop, donateLabel: "Donate", onShare: noop, isLoading: true });
    expect(screen.getByRole("button", { name: /share campaign/i })).toBeDisabled();
  });

  it("save button is disabled when loading", () => {
    setup({ onDonate: noop, donateLabel: "Donate", onSave: noop, isLoading: true });
    expect(screen.getByRole("button", { name: /save campaign/i })).toBeDisabled();
  });

  it("no handlers are called when buttons are clicked while loading", () => {
    const onDonate = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();
    setup({
      onDonate,
      donateLabel: "Donate",
      onShare,
      onSave,
      isLoading: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));
    expect(onDonate).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders no error alert", () => {
    setup({ onDonate: noop, donateLabel: "Donate", isLoading: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CampaignActions – state: error", () => {
  it("renders an error alert with the error message", () => {
    setup({ error: "Transaction failed. Please try again." });
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Transaction failed. Please try again.");
  });

  it("renders no buttons when error is present", () => {
    setup({ onDonate: noop, donateLabel: "Donate", onShare: noop, onSave: noop, error: "Oops" });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Valid state transitions
// ---------------------------------------------------------------------------

describe("CampaignActions – valid transitions", () => {
  it("draft → active: donate button becomes enabled", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
    });
    // draft — disabled
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();

    // transition to active
    rerender(
      <CampaignActions onDonate={noop} donateLabel="Donate" donateDisabled={false} />
    );
    expect(screen.getByRole("button", { name: /donate/i })).not.toBeDisabled();
  });

  it("active → funded: donate becomes disabled, share/save stay enabled", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: false,
      onShare: noop,
      onSave: noop,
    });
    // active — all enabled
    expect(screen.getByRole("button", { name: /donate/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).not.toBeDisabled();

    // transition to funded
    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        donateDisabled={true}
        onShare={noop}
        onSave={noop}
      />
    );
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).not.toBeDisabled();
  });

  it("funded → closed: remaining buttons get disabled (handlers removed)", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
      onShare: noop,
      onSave: noop,
    });
    // funded — donate disabled, share/save enabled
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();

    // transition to closed — remove share/save handlers
    rerender(
      <CampaignActions onDonate={noop} donateLabel="Donate" donateDisabled={true} />
    );
    expect(screen.queryByRole("button", { name: /share campaign/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /save campaign/i })).toBeNull();
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("active → loading: all buttons disabled, donate gains aria-busy", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: false,
      onShare: noop,
      onSave: noop,
    });
    expect(screen.getByRole("button", { name: /donate/i })).not.toBeDisabled();

    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        donateDisabled={false}
        onShare={noop}
        onSave={noop}
        isLoading={true}
      />
    );
    const donate = screen.getByRole("button", { name: /donate/i });
    expect(donate).toBeDisabled();
    expect(donate).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /share campaign/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).toBeDisabled();
  });

  it("loading → active: buttons re-enabled, aria-busy gone", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      onSave: noop,
      isLoading: true,
    });
    // loading
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();

    // back to active
    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        donateDisabled={false}
        onShare={noop}
        onSave={noop}
        isLoading={false}
      />
    );
    const donate = screen.getByRole("button", { name: /donate/i });
    expect(donate).not.toBeDisabled();
    expect(donate).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).not.toBeDisabled();
  });

  it("active → error: error alert replaces all buttons", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      onSave: noop,
    });
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);

    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        onShare={noop}
        onSave={noop}
        error="Something went wrong"
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("error → active: error clears, buttons return", () => {
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      error: "Network error",
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        onShare={noop}
        donateDisabled={false}
        error={null}
      />
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /donate/i })).toBeInTheDocument();
  });

  it("any state → loading: all existing buttons become disabled", () => {
    // Start in funded (donate disabled, share/save enabled)
    const { rerender } = setup({
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
      onShare: noop,
      onSave: noop,
    });
    expect(screen.getByRole("button", { name: /share campaign/i })).not.toBeDisabled();

    rerender(
      <CampaignActions
        onDonate={noop}
        donateLabel="Donate"
        donateDisabled={true}
        onShare={noop}
        onSave={noop}
        isLoading={true}
      />
    );
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /share campaign/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save campaign/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 3. Invalid transitions — UI must refuse
// ---------------------------------------------------------------------------

describe("CampaignActions – invalid transitions (blocked handlers)", () => {
  it("donate click when donateDisabled=true → handler NOT called", () => {
    const onDonate = vi.fn();
    setup({ onDonate, donateLabel: "Donate", donateDisabled: true });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    expect(onDonate).not.toHaveBeenCalled();
  });

  it("any button click when isLoading=true → no handler called", () => {
    const onDonate = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();
    setup({ onDonate, donateLabel: "Donate", onShare, onSave, isLoading: true });

    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));

    expect(onDonate).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("any button click when error is shown → no buttons exist", () => {
    setup({
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      onSave: noop,
      error: "Fatal error",
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. layout prop — state behavior must be identical in both layouts
// ---------------------------------------------------------------------------

describe("CampaignActions – layout prop does not break state behavior", () => {
  it("inline layout: donate disabled in draft state", () => {
    setup({
      layout: "inline",
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
    });
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("stacked layout: donate disabled in draft state", () => {
    setup({
      layout: "stacked",
      onDonate: noop,
      donateLabel: "Donate",
      donateDisabled: true,
    });
    expect(screen.getByRole("button", { name: /donate/i })).toBeDisabled();
  });

  it("inline layout: all buttons disabled when loading", () => {
    setup({
      layout: "inline",
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      onSave: noop,
      isLoading: true,
    });
    screen.getAllByRole("button").forEach((btn) => expect(btn).toBeDisabled());
  });

  it("stacked layout: all buttons disabled when loading", () => {
    setup({
      layout: "stacked",
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      onSave: noop,
      isLoading: true,
    });
    screen.getAllByRole("button").forEach((btn) => expect(btn).toBeDisabled());
  });

  it("inline layout: error replaces buttons", () => {
    setup({
      layout: "inline",
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      error: "Inline error",
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Inline error");
  });

  it("stacked layout: error replaces buttons", () => {
    setup({
      layout: "stacked",
      onDonate: noop,
      donateLabel: "Donate",
      onShare: noop,
      error: "Stacked error",
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Stacked error");
  });

  it("inline layout: active state — all handlers callable", () => {
    const onDonate = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();
    setup({
      layout: "inline",
      onDonate,
      donateLabel: "Donate",
      onShare,
      onSave,
    });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));
    expect(onDonate).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("stacked layout: active state — all handlers callable", () => {
    const onDonate = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();
    setup({
      layout: "stacked",
      onDonate,
      donateLabel: "Donate",
      onShare,
      onSave,
    });
    fireEvent.click(screen.getByRole("button", { name: /donate/i }));
    fireEvent.click(screen.getByRole("button", { name: /share campaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /save campaign/i }));
    expect(onDonate).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 5. Save/bookmark toggle state
// ---------------------------------------------------------------------------

describe("CampaignActions – save button toggle state", () => {
  it("uses saveAriaLabel when not saved", () => {
    setup({ onSave: noop, saved: false, saveAriaLabel: "Save campaign" });
    expect(screen.getByRole("button", { name: "Save campaign" })).toBeInTheDocument();
  });

  it("uses unsaveAriaLabel when saved", () => {
    setup({
      onSave: noop,
      saved: true,
      unsaveAriaLabel: "Remove from saved",
    });
    expect(screen.getByRole("button", { name: "Remove from saved" })).toBeInTheDocument();
  });

  it("save button has aria-pressed=false when not saved", () => {
    setup({ onSave: noop, saved: false });
    expect(screen.getByRole("button", { name: /save campaign/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("save button has aria-pressed=true when saved", () => {
    setup({ onSave: noop, saved: true });
    expect(screen.getByRole("button", { name: /remove from saved/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

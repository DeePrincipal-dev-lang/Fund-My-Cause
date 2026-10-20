/**
 * #1202 — WCAG AA Color Contrast Tests
 *
 * Verifies that every text/background pair defined in the design-token
 * semantic aliases meets the 4.5:1 contrast ratio required by WCAG 2.1
 * SC 1.4.3 (Contrast Minimum, Level AA) for normal-size text.
 *
 * We use jest-axe to run the axe-core engine against small rendered
 * HTML fixtures that represent each theme variant so the same engine used
 * in automated accessibility audits is the source of truth here.
 *
 * Coverage:
 *   - Dark theme: all semantic text/background pairs
 *   - Light theme: all semantic text/background pairs
 *   - Status text colours (success, danger) in both themes
 */

import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Render a labelled paragraph in a fixed-size container so axe can evaluate
 * the colour-contrast rule reliably.  The font-size is set to 16px (normal text)
 * so the 4.5:1 threshold applies.
 */
function textSwatch(fg: string, bg: string, label: string): React.ReactElement {
  return (
    <div
      style={{
        backgroundColor: bg,
        padding: "8px",
        display: "inline-block",
      }}
    >
      <p
        style={{
          color: fg,
          fontSize: "16px",
          margin: 0,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Token values (kept in sync with design-tokens.ts + globals.css) ───────────

const dark = {
  background: "#030712",
  surface: "#111827",
  surfaceElevated: "#1f2937",
  textPrimary: "#f9fafb",
  textSecondary: "#9ca3af",
  textMuted: "#8691a0", // WCAG-fixed
  brand: "#6366f1",
  brandHover: "#818cf8",
  success: "#22c55e",
  danger: "#ef4444",
};

const light = {
  background: "#ffffff",
  surface: "#f9fafb",
  surfaceElevated: "#f3f4f6",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#565d6b", // WCAG-fixed
  brand: "#4f46e5",
  brandHover: "#4f46e5", // WCAG-fixed (was #6366f1, 4.47:1)
  successText: "#15803d", // WCAG-fixed (was #22c55e, 2.28:1)
  dangerText: "#b91c1c", // WCAG-fixed (was #ef4444, 3.76:1)
};

// ── Dark theme tests ───────────────────────────────────────────────────────────

describe("#1202 WCAG AA — dark theme", () => {
  it("text-primary on background", async () => {
    const { container } = render(
      textSwatch(dark.textPrimary, dark.background, "Primary text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-secondary on background", async () => {
    const { container } = render(
      textSwatch(dark.textSecondary, dark.background, "Secondary text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-secondary on surface", async () => {
    const { container } = render(
      textSwatch(dark.textSecondary, dark.surface, "Secondary text on surface"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on background (WCAG-fixed: was #6b7280)", async () => {
    const { container } = render(
      textSwatch(dark.textMuted, dark.background, "Muted text on bg"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on surface (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(dark.textMuted, dark.surface, "Muted text on surface"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on surface-elevated (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(
        dark.textMuted,
        dark.surfaceElevated,
        "Muted text on surface-elevated",
      ),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("brand on background", async () => {
    const { container } = render(
      textSwatch(dark.brand, dark.background, "Brand text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("brand-hover on background", async () => {
    const { container } = render(
      textSwatch(dark.brandHover, dark.background, "Brand hover text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("success on background", async () => {
    const { container } = render(
      textSwatch(dark.success, dark.background, "Success text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("danger on background", async () => {
    const { container } = render(
      textSwatch(dark.danger, dark.background, "Danger text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });
});

// ── Light theme tests ──────────────────────────────────────────────────────────

describe("#1202 WCAG AA — light theme", () => {
  it("text-primary on background", async () => {
    const { container } = render(
      textSwatch(light.textPrimary, light.background, "Primary text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-secondary on background", async () => {
    const { container } = render(
      textSwatch(light.textSecondary, light.background, "Secondary text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-secondary on surface", async () => {
    const { container } = render(
      textSwatch(
        light.textSecondary,
        light.surface,
        "Secondary text on surface",
      ),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on background (WCAG-fixed: was #9ca3af)", async () => {
    const { container } = render(
      textSwatch(light.textMuted, light.background, "Muted text on bg"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on surface (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(light.textMuted, light.surface, "Muted text on surface"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("text-muted on surface-elevated (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(
        light.textMuted,
        light.surfaceElevated,
        "Muted text on surface-elevated",
      ),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("brand on background", async () => {
    const { container } = render(
      textSwatch(light.brand, light.background, "Brand text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("brand-hover on background (WCAG-fixed: was #6366f1)", async () => {
    const { container } = render(
      textSwatch(light.brandHover, light.background, "Brand hover text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("success text on background (WCAG-fixed: was #22c55e)", async () => {
    const { container } = render(
      textSwatch(light.successText, light.background, "Success text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("success text on surface (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(light.successText, light.surface, "Success text on surface"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("danger text on background (WCAG-fixed: was #ef4444)", async () => {
    const { container } = render(
      textSwatch(light.dangerText, light.background, "Danger text"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });

  it("danger text on surface (WCAG-fixed)", async () => {
    const { container } = render(
      textSwatch(light.dangerText, light.surface, "Danger text on surface"),
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: true } },
    });
    expect(results).toHaveNoViolations();
  });
});

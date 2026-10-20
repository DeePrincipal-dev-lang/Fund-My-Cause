/**
 * Snapshot-free visual regression tests for components-lib primitives
 * Issue #1172
 *
 * ── Why pixel-based, not snapshot-based ──────────────────────────────────────
 * Snapshot tests (snapshots.test.tsx) compare serialised HTML markup.  They
 * catch *structural* changes but miss many *visual* regressions:
 *   - Tailwind class reorders that alter the CSS cascade
 *   - Colour-token changes in the design system
 *   - Animation/transition regressions
 *   - Rendering differences across browsers
 *
 * Playwright's `toHaveScreenshot()` captures actual pixel output and diffs it
 * against a committed baseline image, giving genuine visual coverage.
 *
 * ── Test structure ────────────────────────────────────────────────────────────
 * Each test navigates to a dedicated component demo page at:
 *   http://localhost:3000/components-preview/<component-name>
 *
 * Those pages are served by the Next.js app (apps/interface) under
 *   apps/interface/src/app/components-preview/
 *
 * The component preview pages render the components-lib primitives in isolation
 * with all relevant visual states so screenshots capture exactly what a
 * consumer of the library would see.
 *
 * ── Baseline management ───────────────────────────────────────────────────────
 * Baselines are stored in:
 *   e2e/snapshots/components-visual-regression.spec.ts-snapshots/
 *
 * To commit initial baselines (first run):
 *   npx playwright test components-visual-regression --update-snapshots
 *
 * To update after an intentional design change:
 *   npx playwright test components-visual-regression --update-snapshots
 *   # Review the diff in the .png files before committing
 *
 * To run just these tests:
 *   npx playwright test components-visual-regression
 *
 * ── Pixel diff threshold ──────────────────────────────────────────────────────
 * We use a 0.2 % (0.002) pixel-diff ratio, consistent with the existing page-
 * level visual regression suite.  Anti-aliasing and sub-pixel rendering can
 * introduce ~0.1 % noise even on identical output, so a zero threshold is not
 * practical for cross-platform CI.
 *
 * ── Component coverage ────────────────────────────────────────────────────────
 *   ✅ Button   — primary, secondary, outline, ghost, danger; loading; disabled
 *   ✅ Card     — default, compact, highlighted, hoverable; with header+footer
 *   ✅ Modal    — open state (sm, md, lg, xl); with footer; without title
 *   ✅ Select   — default, with placeholder, with error, disabled
 *   ✅ Input    — default, with label, with error, disabled, required
 *
 * Closes #1172
 */

import { test, expect, Page } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

const THRESHOLD = 0.002; // 0.2 % pixel-diff threshold

/**
 * Base path for the component preview pages served by apps/interface.
 * Each component has its own sub-route so states are isolated.
 */
const PREVIEW_BASE = "/components-preview";

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Navigate to a component preview page and wait until it is fully rendered.
 * The preview pages are simple static renders with no async data fetching,
 * so `domcontentloaded` is sufficient.
 */
async function goToPreview(page: Page, component: string): Promise<void> {
  await page.goto(`${PREVIEW_BASE}/${component}`);
  await page.waitForLoadState("domcontentloaded");
  // Web-first wait: resolves as soon as the preview has rendered its test ids
  await expect(page.locator("[data-testid]").first()).toBeVisible();
}

// ── Test suites ───────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

test.describe("Visual regression — Button (#1172)", () => {
  test("Button: all variants", async ({ page }) => {
    await goToPreview(page, "button");
    const section = page.locator("[data-testid='button-variants']");
    await expect(section).toHaveScreenshot("button-variants.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Button: loading state", async ({ page }) => {
    await goToPreview(page, "button");
    const loadingBtn = page.locator("[data-testid='button-loading']");
    await expect(loadingBtn).toHaveScreenshot("button-loading.png", {
      maxDiffPixelRatio: THRESHOLD,
      // Mask the spinner which is animated; we care about layout, not frames
      mask: [page.locator("[data-testid='button-loading'] .animate-spin")],
    });
  });

  test("Button: disabled state", async ({ page }) => {
    await goToPreview(page, "button");
    const disabledBtn = page.locator("[data-testid='button-disabled']");
    await expect(disabledBtn).toHaveScreenshot("button-disabled.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Button: size variants (sm, md, lg)", async ({ page }) => {
    await goToPreview(page, "button");
    const sizes = page.locator("[data-testid='button-sizes']");
    await expect(sizes).toHaveScreenshot("button-sizes.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Button: full-width", async ({ page }) => {
    await goToPreview(page, "button");
    const fullWidth = page.locator("[data-testid='button-fullwidth']");
    await expect(fullWidth).toHaveScreenshot("button-fullwidth.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

test.describe("Visual regression — Card (#1172)", () => {
  test("Card: default variant", async ({ page }) => {
    await goToPreview(page, "card");
    await expect(page.locator("[data-testid='card-default']")).toHaveScreenshot(
      "card-default.png",
      { maxDiffPixelRatio: THRESHOLD },
    );
  });

  test("Card: compact variant", async ({ page }) => {
    await goToPreview(page, "card");
    await expect(page.locator("[data-testid='card-compact']")).toHaveScreenshot(
      "card-compact.png",
      { maxDiffPixelRatio: THRESHOLD },
    );
  });

  test("Card: highlighted variant", async ({ page }) => {
    await goToPreview(page, "card");
    await expect(
      page.locator("[data-testid='card-highlighted']"),
    ).toHaveScreenshot("card-highlighted.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Card: hoverable state", async ({ page }) => {
    await goToPreview(page, "card");
    const card = page.locator("[data-testid='card-hoverable']");
    await card.hover();
    // toHaveScreenshot retries until two consecutive captures match, so the
    // hover transition settles without a fixed sleep.
    await expect(card).toHaveScreenshot("card-hoverable-hovered.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Card: with CardHeader, CardBody, CardFooter", async ({ page }) => {
    await goToPreview(page, "card");
    await expect(
      page.locator("[data-testid='card-with-sections']"),
    ).toHaveScreenshot("card-with-sections.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

test.describe("Visual regression — Modal (#1172)", () => {
  test("Modal: medium size (default)", async ({ page }) => {
    await goToPreview(page, "modal");
    // Trigger the modal open
    await page.locator("[data-testid='open-modal-md']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-md.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: small size", async ({ page }) => {
    await goToPreview(page, "modal");
    await page.locator("[data-testid='open-modal-sm']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-sm.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: large size", async ({ page }) => {
    await goToPreview(page, "modal");
    await page.locator("[data-testid='open-modal-lg']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-lg.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: xl size", async ({ page }) => {
    await goToPreview(page, "modal");
    await page.locator("[data-testid='open-modal-xl']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-xl.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: with footer actions", async ({ page }) => {
    await goToPreview(page, "modal");
    await page.locator("[data-testid='open-modal-with-footer']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-with-footer.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: without title", async ({ page }) => {
    await goToPreview(page, "modal");
    await page.locator("[data-testid='open-modal-no-title']").click();
    await page.waitForSelector("[role='dialog']");
    await expect(page).toHaveScreenshot("modal-no-title.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Modal: closed state renders nothing", async ({ page }) => {
    await goToPreview(page, "modal");
    // No modal trigger clicked — dialog should not be present
    await expect(page.locator("[role='dialog']")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

test.describe("Visual regression — Select (#1172)", () => {
  test("Select: default state with options", async ({ page }) => {
    await goToPreview(page, "select");
    await expect(
      page.locator("[data-testid='select-default']"),
    ).toHaveScreenshot("select-default.png", { maxDiffPixelRatio: THRESHOLD });
  });

  test("Select: with placeholder", async ({ page }) => {
    await goToPreview(page, "select");
    await expect(
      page.locator("[data-testid='select-placeholder']"),
    ).toHaveScreenshot("select-placeholder.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Select: error state", async ({ page }) => {
    await goToPreview(page, "select");
    await expect(page.locator("[data-testid='select-error']")).toHaveScreenshot(
      "select-error.png",
      { maxDiffPixelRatio: THRESHOLD },
    );
  });

  test("Select: disabled state", async ({ page }) => {
    await goToPreview(page, "select");
    await expect(
      page.locator("[data-testid='select-disabled']"),
    ).toHaveScreenshot("select-disabled.png", { maxDiffPixelRatio: THRESHOLD });
  });

  test("Select: full-width layout", async ({ page }) => {
    await goToPreview(page, "select");
    await expect(
      page.locator("[data-testid='select-fullwidth']"),
    ).toHaveScreenshot("select-fullwidth.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

test.describe("Visual regression — Input (#1172)", () => {
  test("Input: default state", async ({ page }) => {
    await goToPreview(page, "input");
    await expect(
      page.locator("[data-testid='input-default']"),
    ).toHaveScreenshot("input-default.png", { maxDiffPixelRatio: THRESHOLD });
  });

  test("Input: with label and helper text", async ({ page }) => {
    await goToPreview(page, "input");
    await expect(
      page.locator("[data-testid='input-with-label']"),
    ).toHaveScreenshot("input-with-label.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Input: error state", async ({ page }) => {
    await goToPreview(page, "input");
    await expect(page.locator("[data-testid='input-error']")).toHaveScreenshot(
      "input-error.png",
      { maxDiffPixelRatio: THRESHOLD },
    );
  });

  test("Input: disabled state", async ({ page }) => {
    await goToPreview(page, "input");
    await expect(
      page.locator("[data-testid='input-disabled']"),
    ).toHaveScreenshot("input-disabled.png", { maxDiffPixelRatio: THRESHOLD });
  });

  test("Input: required indicator", async ({ page }) => {
    await goToPreview(page, "input");
    await expect(
      page.locator("[data-testid='input-required']"),
    ).toHaveScreenshot("input-required.png", { maxDiffPixelRatio: THRESHOLD });
  });

  test("Input: focused state", async ({ page }) => {
    await goToPreview(page, "input");
    const input = page.locator("[data-testid='input-default'] input");
    await input.focus();
    await expect(
      page.locator("[data-testid='input-default']"),
    ).toHaveScreenshot("input-focused.png", { maxDiffPixelRatio: THRESHOLD });
  });
});

// ---------------------------------------------------------------------------
// Cross-component: mobile viewport
// ---------------------------------------------------------------------------

test.describe("Visual regression — mobile viewport (#1172)", () => {
  test("Button variants on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToPreview(page, "button");
    await expect(
      page.locator("[data-testid='button-variants']"),
    ).toHaveScreenshot("button-variants-mobile.png", {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test("Card default on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToPreview(page, "card");
    await expect(page.locator("[data-testid='card-default']")).toHaveScreenshot(
      "card-default-mobile.png",
      {
        maxDiffPixelRatio: THRESHOLD,
      },
    );
  });
});

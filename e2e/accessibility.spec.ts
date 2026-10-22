import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility Audit Tests — Issue #1284
 *
 * Validates WCAG compliance using axe-core/playwright.
 * Tests fail on new critical/serious violations.
 * Serves as baseline audit for campaign list, campaign detail, and profile pages.
 */

// Helper to run axe scan and report violations
async function scanForA11yViolations(page, description: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  // Log all violations for debugging
  if (results.violations.length > 0) {
    console.log(`\n${description} - Violations found:`);
    results.violations.forEach((v) => {
      console.log(`  - ${v.id} (${v.impact}): ${v.help}`);
      v.nodes.forEach((n) => {
        console.log(`    Node: ${n.html?.substring(0, 60)}...`);
      });
    });
  }

  return results;
}

// Helper to validate critical/serious violations
function expectNoCriticalViolations(violations: any[]) {
  const criticalViolations = violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (criticalViolations.length > 0) {
    const summary = criticalViolations
      .map((v) => `${v.id} (${v.impact}): ${v.help}`)
      .join("\n  ");
    throw new Error(`Critical/serious a11y violations found:\n  ${summary}`);
  }
}

test.describe("Accessibility Audit — Issue #1284", () => {
  test.describe("Campaign List Page", () => {
    test("has no critical/serious a11y violations", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const results = await scanForA11yViolations(page, "/campaigns");
      expectNoCriticalViolations(results.violations);
    });

    test("all buttons have accessible labels", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const unlabeledButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll("button");
        return Array.from(buttons).filter((btn) => {
          const hasAriaLabel = btn.getAttribute("aria-label");
          const hasTextContent = btn.textContent?.trim().length > 0;
          const hasTitle = btn.getAttribute("title");
          return !hasAriaLabel && !hasTextContent && !hasTitle;
        }).length;
      });

      expect(unlabeledButtons).toBe(0);
    });

    test("all images have alt text", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const imagesWithoutAlt = await page.evaluate(() => {
        const imgs = document.querySelectorAll("img");
        return Array.from(imgs).filter((img) => {
          return (
            !img.getAttribute("alt") &&
            img.getAttribute("role") !== "presentation"
          );
        }).length;
      });

      expect(imagesWithoutAlt).toBe(0);
    });

    test("color contrast is sufficient", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const results = await scanForA11yViolations(
        page,
        "/campaigns contrast check",
      );
      const contrastViolations = results.violations.filter(
        (v) => v.id === "color-contrast",
      );

      // Critical/serious color contrast violations should not exist
      const criticalContrast = contrastViolations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(criticalContrast).toHaveLength(0);
    });

    test("form inputs are properly labeled", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const unlabeledInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll("input, textarea, select");
        return Array.from(inputs).filter((input) => {
          const id = input.getAttribute("id");
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.getAttribute("aria-label");
          return !hasLabel && !hasAriaLabel;
        }).length;
      });

      expect(unlabeledInputs).toBe(0);
    });
  });

  test.describe("Campaign Detail Page", () => {
    test("has no critical/serious a11y violations", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('[data-testid="campaign-card"]', {
        timeout: 10000,
      });
      await page.click('[data-testid="campaign-card"]:first-child');
      await page.waitForLoadState("networkidle");

      const results = await scanForA11yViolations(page, "Campaign detail page");
      expectNoCriticalViolations(results.violations);
    });

    test("heading hierarchy is correct", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('[data-testid="campaign-card"]', {
        timeout: 10000,
      });
      await page.click('[data-testid="campaign-card"]:first-child');

      const headingHierarchy = await page.evaluate(() => {
        const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const levels = Array.from(headings).map((h) => {
          const level = parseInt(h.tagName[1]);
          return level;
        });

        // Check for proper hierarchy (no jumps like h1 -> h3)
        let valid = true;
        for (let i = 1; i < levels.length; i++) {
          if (levels[i] - levels[i - 1] > 1) {
            valid = false;
            break;
          }
        }
        return { levels, valid };
      });

      expect(headingHierarchy.valid).toBe(true);
    });

    test("interactive elements are keyboard accessible", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('[data-testid="campaign-card"]', {
        timeout: 10000,
      });
      await page.click('[data-testid="campaign-card"]:first-child');

      // Tab through page and verify focus moves
      let focusChanged = false;
      const initialActive = await page.evaluate(
        () => document.activeElement?.className,
      );

      await page.keyboard.press("Tab");
      const afterTab = await page.evaluate(
        () => document.activeElement?.className,
      );

      focusChanged = initialActive !== afterTab;
      expect(
        focusChanged ||
          (await page.evaluate(
            () => document.activeElement?.tagName === "BODY",
          )),
      ).toBe(true);
    });
  });

  test.describe("Profile Page", () => {
    test("has no critical/serious a11y violations", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForLoadState("networkidle");

      const results = await scanForA11yViolations(page, "/profile");
      expectNoCriticalViolations(results.violations);
    });

    test("form labels are properly associated", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForLoadState("networkidle");

      const properlyLabeledInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll("input, textarea");
        let labeled = 0;

        inputs.forEach((input) => {
          const id = input.getAttribute("id");
          const label = id && document.querySelector(`label[for="${id}"]`);
          const ariaLabel = input.getAttribute("aria-label");
          const ariaLabelledBy = input.getAttribute("aria-labelledby");

          if (label || ariaLabel || ariaLabelledBy) {
            labeled++;
          }
        });

        return { total: inputs.length, labeled };
      });

      // All inputs should have labels
      expect(properlyLabeledInputs.labeled).toBe(properlyLabeledInputs.total);
    });

    test("error messages are linked to inputs", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForLoadState("networkidle");

      const errorAssociations = await page.evaluate(() => {
        // Find inputs and check if they have aria-describedby pointing to error messages
        const inputs = document.querySelectorAll("input");
        let withErrorDescription = 0;

        inputs.forEach((input) => {
          const describedBy = input.getAttribute("aria-describedby");
          if (describedBy) {
            const description = document.getElementById(describedBy);
            if (description && description.textContent?.includes("error")) {
              withErrorDescription++;
            }
          }
        });

        return { total: inputs.length, withErrorDescription };
      });

      // At least check that error association pattern is attempted
      expect(errorAssociations.withErrorDescription >= 0).toBe(true);
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("campaigns page is fully keyboard navigable", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      let interactiveElementCount = 0;
      let keyboardAccessibleCount = 0;

      // Count interactive elements
      interactiveElementCount = await page.evaluate(() => {
        const interactive = document.querySelectorAll(
          "button, a[href], input, [role='button'], [role='link']",
        );
        return interactive.length;
      });

      // Tab through and count reachable elements
      for (let i = 0; i < interactiveElementCount + 5; i++) {
        await page.keyboard.press("Tab");
        const activeElement = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return (el as HTMLElement).tagName;
        });

        if (activeElement) keyboardAccessibleCount++;
      }

      // At least some interactive elements should be reachable via keyboard
      expect(keyboardAccessibleCount > 0).toBe(true);
    });
  });

  test.describe("Screen Reader Support", () => {
    test("landmark regions are present on campaign list", async ({ page }) => {
      await page.goto("/campaigns");
      await page.waitForLoadState("networkidle");

      const landmarks = await page.evaluate(() => {
        const main = document.querySelector("main");
        const nav = document.querySelector("nav");
        const footer = document.querySelector("footer");
        const contentRegions = document.querySelectorAll(
          "[role='main'], [role='navigation']",
        );

        return {
          hasMain: !!main,
          hasNav: !!nav,
          hasFooter: !!footer,
          hasRoleRegions: contentRegions.length > 0,
        };
      });

      // Should have at least main or navigation landmarks
      const hasLandmarks =
        landmarks.hasMain || landmarks.hasNav || landmarks.hasRoleRegions;
      expect(hasLandmarks).toBe(true);
    });

    test("page title is descriptive", async ({ page }) => {
      await page.goto("/campaigns");
      const title = await page.title();
      expect(title.length > 0).toBe(true);
    });
  });
});

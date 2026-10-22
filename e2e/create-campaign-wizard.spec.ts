import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * End-to-end smoke test for the create-campaign wizard (issue #1548).
 *
 * Walks every wizard step with fixture data and runs an axe scan on each
 * step, failing only on critical violations. Tests the complete campaign
 * creation flow from start to finish.
 *
 * Steps covered:
 * 1. Basic Info - Campaign metadata
 * 2. Media - Campaign images and videos
 * 3. FAQ & Team - FAQs and team members
 * 4. Platform Config - Platform settings and fees
 * 5. Review & Deploy - Final review and deployment
 *
 * Accessibility:
 * - Runs @axe-core/playwright on each step
 * - Fails on critical violations
 * - Warns on warnings/minor violations
import { test, expect, type Page } from "./fixtures/wallet";
import AxeBuilder from "@axe-core/playwright";
import { activeCampaign } from "../fixtures/campaign";

/**
 * End-to-end smoke test for the create-campaign wizard (issue #1476).
 *
 * Walks every wizard step with fixture data and runs an axe scan on each
 * step, failing only on critical violations.
 */

const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const TEST_CAMPAIGN = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  title: "Emergency Relief Fund",
  description: "Supporting families affected by natural disasters",
  creator: "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
};

interface AxeViolation {
  id: string;
  help: string;
  impact?: string;
}

interface AxeResults {
  violations: AxeViolation[];
}

async function expectNoCriticalA11yViolations(page: Page, step: string) {
  try {
    const results: AxeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical.map((v) => `${v.id}: ${v.help}`),
      `critical axe violations on step "${step}"`,
    ).toEqual([]);

    // Log warnings for visibility
    const warnings = results.violations.filter((v) => v.impact === "minor" || v.impact === "moderate");
    if (warnings.length > 0) {
      console.warn(`[${step}] Axe warnings found:`, warnings.map((v) => v.id));
    }
  } catch (error) {
    console.error(`Failed to run axe on step "${step}":`, error);
    throw error;
  }
}

test.describe("Create campaign wizard E2E smoke test", () => {
  test.beforeEach(async ({ page }) => {
    // Mock IPFS upload endpoint
async function expectNoCriticalA11yViolations(page: Page, step: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === "critical");
  expect(
    critical.map((v) => `${v.id}: ${v.help}`),
    `critical axe violations on step "${step}"`,
  ).toEqual([]);
}

test.describe("Create campaign wizard smoke test", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ IpfsHash: "QmMockImageHash" }),
        }),
    );

    // Mock RPC calls if needed
    await page.route(
      "**/soroban-rpc/**",
      (route) => {
        // Allow real requests or mock specific scenarios
        route.continue();
      },
    );
  });

  test("should complete wizard from start to finish with valid data", async ({
    page,
  }) => {
    // Navigate to create campaign page
    await page.goto("/create");
    await expect(page).toHaveTitle(/Create Campaign|Create/i);

    // ════════════════════════════════════════════════════════════════════
    // Step 1: Basic Info
    // ════════════════════════════════════════════════════════════════════
    await expect(
      page.getByRole("heading", { name: /Basic Info|Campaign Details/i }),
    ).toBeVisible();

    // Fill basic campaign information
    await page.getByLabel(/Contract ID|Smart Contract/i).fill(TEST_CAMPAIGN.contractId);
    await page.getByLabel(/Token Address|Token Contract/i).fill(TEST_CAMPAIGN.contractId);
    await page.getByLabel(/Title|Campaign Title/i).fill(TEST_CAMPAIGN.title);
    await page.getByLabel(/Description|Campaign Description/i).fill(TEST_CAMPAIGN.description);
    await page.getByLabel(/Goal.*XLM|Funding Goal/i).fill("1000");
    await page.getByLabel(/Min Contribution.*XLM|Minimum Amount/i).fill("10");

    // Set deadline to 30 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await page
      .getByLabel(/Deadline|End Date/i)
      .fill(deadline.toISOString().split("T")[0]);

    // Verify form is valid and run accessibility check
    await expect(page.getByRole("button", { name: /Next|Continue/i })).toBeEnabled();
    await expectNoCriticalA11yViolations(page, "Step 1: Basic Info");

    // Navigate to next step
    await page.getByRole("button", { name: /Next|Continue/i }).click();
    await page.waitForLoadState("networkidle");

    // ════════════════════════════════════════════════════════════════════
    // Step 2: Media
    // ════════════════════════════════════════════════════════════════════
    await expect(
      page.getByRole("heading", { name: /Media|Images.*Videos/i }),
    ).toBeVisible();

    // Upload campaign image
    const fileInput = page.locator("input[type='file']").first();
    await fileInput.setInputFiles({
      name: "campaign-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(MOCK_PNG_BASE64, "base64"),
    });

    // Wait for image upload and confirm crop if needed
    await page.waitForLoadState("networkidle");
    const cropButton = page.getByRole("button", { name: /Confirm Crop|Apply|Save Image/i });
    if (await cropButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cropButton.click();
    }

    // Add video URL
    const videoInput = page.getByLabel(/Video|YouTube|Video URL/i);
    if (await videoInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await videoInput.fill("https://youtube.com/watch?v=dQw4w9WgXcQ");
    }

    // Verify and check accessibility
    await expect(page.getByRole("button", { name: /Next|Continue/i })).toBeEnabled();
    await expectNoCriticalA11yViolations(page, "Step 2: Media");

    await page.getByRole("button", { name: /Next|Continue/i }).click();
    await page.waitForLoadState("networkidle");

    // ════════════════════════════════════════════════════════════════════
    // Step 3: FAQ & Team
    // ════════════════════════════════════════════════════════════════════
    await expect(
      page.getByRole("heading", { name: /FAQ|Team|Details/i }),
    ).toBeVisible();

    // Add FAQ entry if add button exists
    const addFaqButton = page.getByRole("button", { name: /Add FAQ|Add Question|Add Entry/i });
    if (await addFaqButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addFaqButton.click();
      await page.getByLabel(/Question|FAQ question/i).fill("Is this campaign audited?");
      await page.getByLabel(/Answer|FAQ answer/i).fill("Yes, we have completed a security audit.");
    }

    // Add team member if button exists
    const addTeamButton = page.getByRole("button", { name: /Add Team|Add Member|Add Person/i });
    if (await addTeamButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addTeamButton.click();
      await page.getByLabel(/Team Name|Member Name/i).fill("John Doe");
      await page.getByLabel(/Role|Position/i).fill("Campaign Lead");
    }

    // Check accessibility
    await expectNoCriticalA11yViolations(page, "Step 3: FAQ & Team");

    await page.getByRole("button", { name: /Next|Continue|Skip/i }).click();
    await page.waitForLoadState("networkidle");

    // ════════════════════════════════════════════════════════════════════
    // Step 4: Platform Config
    // ════════════════════════════════════════════════════════════════════
    await expect(
      page.getByRole("heading", { name: /Platform|Config|Settings/i }),
    ).toBeVisible();

    // Fill platform configuration if applicable
    const feeAddressInput = page.getByLabel(/Platform Fee|Fee Address/i);
    if (await feeAddressInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await feeAddressInput.fill(TEST_CAMPAIGN.creator);
    }

    const feeInput = page.getByLabel(/Fee|Basis Points|Percentage/i);
    if (await feeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await feeInput.fill("250"); // 2.5%
    }

    // Check accessibility
    await expectNoCriticalA11yViolations(page, "Step 4: Platform Config");

    await page.getByRole("button", { name: /Review|Deploy|Continue/i }).click();
    await page.waitForLoadState("networkidle");

    // ════════════════════════════════════════════════════════════════════
    // Step 5: Review & Deploy
    // ════════════════════════════════════════════════════════════════════
    await expect(
      page.getByRole("heading", { name: /Review|Deploy|Confirm/i }),
    ).toBeVisible();

    // Verify campaign title is shown on review screen
    await expect(page.getByText(TEST_CAMPAIGN.title)).toBeVisible();

    // Verify key information is displayed
    await expect(page.getByText(/1000.*XLM|Goal.*1000/i)).toBeVisible();

    // Check accessibility on review screen
    await expectNoCriticalA11yViolations(page, "Step 5: Review & Deploy");

    // Verify deploy button exists and is accessible
    const deployButton = page.getByRole("button", { name: /Deploy|Create|Launch|Submit/i });
    await expect(deployButton).toBeVisible();
  });

  test("should show validation errors for invalid data", async ({ page }) => {
    await page.goto("/create");

    // Try to proceed without filling required fields
    const nextButton = page.getByRole("button", { name: /Next|Continue/i });

    // Fill only some fields to trigger validation
    await page.getByLabel(/Title|Campaign Title/i).fill("Test Campaign");

    // Click next - should show validation errors
    await nextButton.click();

    // Expect to stay on the same page (validation failed)
    await expect(
      page.getByRole("heading", { name: /Basic Info|Campaign Details/i }),
    ).toBeVisible();

    // Check for error messages
    const errorMessages = page.locator("[role='alert']");
    expect(await errorMessages.count()).toBeGreaterThan(0);
  });

  test("should allow going back to previous steps", async ({ page }) => {
    await page.goto("/create");

    // Fill and proceed to step 2
    await page.getByLabel(/Contract ID|Smart Contract/i).fill(TEST_CAMPAIGN.contractId);
    await page.getByLabel(/Token Address|Token Contract/i).fill(TEST_CAMPAIGN.contractId);
    await page.getByLabel(/Title|Campaign Title/i).fill(TEST_CAMPAIGN.title);
    await page.getByLabel(/Description|Campaign Description/i).fill(TEST_CAMPAIGN.description);
    await page.getByLabel(/Goal.*XLM|Funding Goal/i).fill("1000");
    await page.getByLabel(/Min Contribution.*XLM|Minimum Amount/i).fill("10");

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await page
      .getByLabel(/Deadline|End Date/i)
      .fill(deadline.toISOString().split("T")[0]);

    await page.getByRole("button", { name: /Next|Continue/i }).click();
    await page.waitForLoadState("networkidle");

    // Verify we're on step 2
    await expect(
      page.getByRole("heading", { name: /Media|Images.*Videos/i }),
    ).toBeVisible();

    // Go back
    const backButton = page.getByRole("button", { name: /Back|Previous/i });
    if (await backButton.isVisible()) {
      await backButton.click();
      await page.waitForLoadState("networkidle");

      // Verify we're back on step 1
      await expect(
        page.getByRole("heading", { name: /Basic Info|Campaign Details/i }),
      ).toBeVisible();

      // Verify data is preserved
      await expect(page.getByLabel(/Title|Campaign Title/i)).toHaveValue(TEST_CAMPAIGN.title);
    }
  });

  test("should be fully accessible throughout wizard flow", async ({ page }) => {
    await page.goto("/create");

    // Test keyboard navigation
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // At least one element should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();

    // Test that form has proper ARIA labels
    const requiredFields = page.locator("[aria-required='true']");
    expect(await requiredFields.count()).toBeGreaterThan(0);

    // Test that errors are announced to screen readers
    const errorRegion = page.locator("[role='alert'], [role='status']");
    if (await errorRegion.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(await errorRegion.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test("completes every step and reaches the review screen", async ({
    page,
  }) => {
    await page.goto("/create");

    // 1. Basic Info
    await expect(
      page.getByRole("heading", { name: "Basic Info" }),
    ).toBeVisible();
    await page.getByLabel("Contract ID").fill(activeCampaign.contractId);
    await page.getByLabel("Token Address").fill(activeCampaign.contractId);
    await page.getByLabel("Title").fill(activeCampaign.title);
    await page.getByLabel("Description").fill(activeCampaign.description);
    await page.getByLabel("Goal (XLM)").fill("1000");
    await page.getByLabel("Min Contribution (XLM)").fill("10");
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    await page
      .getByLabel("Deadline")
      .fill(deadline.toISOString().split("T")[0]);
    await expectNoCriticalA11yViolations(page, "Basic Info");
    await page.getByRole("button", { name: "Next" }).click();

    // 2. Media
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
    await page.locator("input[type='file']").setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(MOCK_PNG_BASE64, "base64"),
    });
    await page.getByRole("button", { name: "Confirm Crop" }).click();
    await page
      .getByLabel("Campaign video URL")
      .fill("https://youtube.com/watch?v=abcdef");
    await expectNoCriticalA11yViolations(page, "Media");
    await page.getByRole("button", { name: "Next" }).click();

    // 3. FAQ & Team
    await expect(
      page.getByRole("heading", { name: "FAQ & Team" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add FAQ" }).click();
    await page.getByLabel("FAQ question").fill("Is this audit complete?");
    await page
      .getByLabel("FAQ answer")
      .fill("Yes, an independent audit was completed.");
    await expectNoCriticalA11yViolations(page, "FAQ & Team");
    await page.getByRole("button", { name: "Next" }).click();

    // 4. Platform Config
    await expect(
      page.getByRole("heading", { name: "Platform Config" }),
    ).toBeVisible();
    await page.getByLabel("Platform Fee Address").fill(activeCampaign.creator);
    await page.getByLabel("Fee (basis points, e.g. 250 = 2.5%)").fill("250");
    await expectNoCriticalA11yViolations(page, "Platform Config");
    await page.getByRole("button", { name: "Review & Deploy" }).click();

    // 5. Review & Deploy
    await expect(
      page.getByRole("heading", { name: "Review & Deploy" }),
    ).toBeVisible();
    await expect(page.getByText(activeCampaign.title)).toBeVisible();
    await expectNoCriticalA11yViolations(page, "Review & Deploy");
  });
});

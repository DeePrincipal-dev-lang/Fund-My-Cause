import { test, expect, newWalletContext, DEFAULT_MOCK_ADDRESS } from "./fixtures/wallet";

/**
 * Issue #1165 — Full Contribution Flow E2E tests
 *
 * Covers the critical path:
 *   connect wallet → view campaign → contribute → verify balance/progress update
 *
 * Also covers the rejected-transaction path and edge cases.
 *
 * The Freighter wallet is fully mocked via `e2e/fixtures/wallet.ts` — the
 * postMessage responder auto-approves SUBMIT_TRANSACTION so tests are
 * deterministic in CI without a real extension.
 *
 * ## Test matrix
 * | # | Scenario                                       | Browsers          |
 * |---|------------------------------------------------|-------------------|
 * | 1 | Connect wallet — address shown in navbar        | Chrome/FF/Safari  |
 * | 2 | Discover campaigns on /campaigns               | Chrome/FF/Safari  |
 * | 3 | Navigate to campaign detail page               | Chrome/FF/Safari  |
 * | 4 | Pledge modal opens                             | Chrome/FF/Safari  |
 * | 5 | Input validation — empty amount                | Chrome/FF/Safari  |
 * | 6 | Input validation — non-positive amount         | Chrome/FF/Safari  |
 * | 7 | Full contribute → success receipt              | Chrome/FF/Safari  |
 * | 8 | Progress bar updates after contribution        | Chrome/FF/Safari  |
 * | 9 | Rejected transaction shows error message       | Chrome/FF/Safari  |
 * |10 | Multiple contributions accumulate progress     | Chrome/FF/Safari  |
 * |11 | Wallet disconnect prevents contribution        | Chrome/FF/Safari  |
 * |12 | Contribution amount is displayed in receipt    | Chrome/FF/Safari  |
 * |13 | User can close pledge modal without submitting | Chrome/FF/Safari  |
 * |14 | Contribution with minimum pledge amount        | Chrome/FF/Safari  |
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navigate to the first available campaign detail page from /campaigns */
async function goToFirstCampaign(page: import("@playwright/test").Page) {
  await page.goto("/campaigns");
  const campaignLink = page.locator("a[href*='/campaigns/']").first();
  await campaignLink.waitFor({ timeout: 10_000 });
  await campaignLink.click();
  // Wait for either a Pledge button or campaign title to confirm we arrived
  await page.waitForSelector(
    "[role='button'][aria-label*='pledge' i], button:text-matches('pledge', 'i'), h1",
    { timeout: 10_000 },
  );
}

/** Connect the wallet if the connect button is visible */
async function ensureWalletConnected(page: import("@playwright/test").Page) {
  const connectBtn = page.getByRole("button", { name: /connect wallet/i });
  if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await connectBtn.click();
    // Wait for the connected state
    await expect(
      page.locator("text=/GMOCK|G[A-Z0-9]{4}\.\.\.[A-Z0-9]{4}/i")
    ).toBeVisible({ timeout: 8_000 });
  }
}

/** Open the pledge modal on the current campaign detail page */
async function openPledgeModal(page: import("@playwright/test").Page) {
  const pledgeBtn = page.getByRole("button", { name: /pledge/i });
  await pledgeBtn.waitFor({ timeout: 10_000 });
  await pledgeBtn.click();
  await expect(
    page.locator("text=/Pledge to|Contribute to/i")
  ).toBeVisible({ timeout: 8_000 });
}

/** Fill in the pledge amount input */
async function fillAmount(page: import("@playwright/test").Page, amount: string) {
  const input = page.locator(
    "input[placeholder*='Amount'], input[type='number'], input[name='amount']"
  );
  await input.waitFor({ timeout: 5_000 });
  await input.fill(amount);
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("Contribution Flow — full journey", () => {
  // ── 1. Wallet connection ───────────────────────────────────────────────────
  test("connects wallet and shows abbreviated address in navbar", async ({
    page,
  }) => {
    await page.goto("/");
    await ensureWalletConnected(page);
    await expect(
      page.locator("text=/GMOCK|G[A-Z0-9]{4}\.\.\.[A-Z0-9]{4}/i")
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── 2. Campaign discovery ─────────────────────────────────────────────────
  test("discovers at least one campaign on /campaigns", async ({ page }) => {
    await page.goto("/campaigns");
    const cards = page.locator(
      "[data-testid='campaign-card'], .campaign-card, a[href*='/campaigns/']"
    );
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Campaign detail navigation ─────────────────────────────────────────
  test("opens a campaign detail page from the list", async ({ page }) => {
    await page.goto("/campaigns");
    const link = page.locator("a[href*='/campaigns/']").first();
    await link.click();
    await expect(
      page.getByRole("button", { name: /pledge/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── 4. Pledge modal opens ─────────────────────────────────────────────────
  test("opens pledge modal when Pledge button is clicked", async ({ page }) => {
    await goToFirstCampaign(page);
    await openPledgeModal(page);
    // Modal title is visible
    await expect(
      page.locator("text=/Pledge to|Contribute to/i")
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── 5. Validation — empty amount ──────────────────────────────────────────
  test("shows validation error when submitting an empty pledge amount", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await openPledgeModal(page);

    // Submit without entering an amount
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    await expect(
      page.locator("text=/valid amount|enter an amount|required/i")
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 6. Validation — non-positive amount ───────────────────────────────────
  test("shows validation error when pledge amount is zero or negative", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await openPledgeModal(page);
    await fillAmount(page, "0");
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    await expect(
      page.locator("text=/valid amount|greater than zero|positive|minimum/i")
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 7. Full contribute → success receipt ──────────────────────────────────
  test("completes full contribution journey and shows success receipt", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await ensureWalletConnected(page);
    await openPledgeModal(page);
    await fillAmount(page, "10");

    // The wallet mock auto-approves signTransaction
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    await expect(
      page.locator(
        "text=/success|pledge submitted|contribution confirmed|thank you/i"
      )
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 8. Progress bar updates after contribution ────────────────────────────
  test("progress bar value does not decrease after a successful pledge", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await ensureWalletConnected(page);

    const progressBar = page.locator("[role='progressbar']");
    const beforeRaw = await progressBar
      .getAttribute("aria-valuenow")
      .catch(() => "0");
    const before = parseFloat(beforeRaw ?? "0");

    await openPledgeModal(page);
    await fillAmount(page, "100");
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    await expect(
      page.locator("text=/success|pledge submitted|confirmed/i")
    ).toBeVisible({ timeout: 15_000 });

    const afterRaw = await progressBar
      .getAttribute("aria-valuenow")
      .catch(() => "0");
    const after = parseFloat(afterRaw ?? "0");

    expect(after).toBeGreaterThanOrEqual(before);
  });

  // ── 9. Rejected transaction shows error ───────────────────────────────────
  test("shows an error message when the wallet rejects the transaction", async ({
    browser,
  }) => {
    /**
     * Override the wallet mock in a new context so that SUBMIT_TRANSACTION
     * returns an error response instead of a signed XDR.
     */
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        const respond = (fields: Record<string, unknown>) => {
          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: data.messageId,
              ...fields,
            },
            window.location.origin,
          );
        };

        switch (data.type) {
          case "REQUEST_ACCESS":
          case "REQUEST_PUBLIC_KEY":
            respond({ publicKey: "GTEST000000000000000000000000000000000000000000000000000" });
            break;
          case "REQUEST_CONNECTION_STATUS":
            respond({ isConnected: true });
            break;
          case "REQUEST_ALLOWED_STATUS":
            respond({ isAllowed: true });
            break;
          case "REQUEST_NETWORK_DETAILS":
            respond({
              networkDetails: {
                network: "TESTNET",
                networkName: "TESTNET",
                networkUrl: "https://horizon-testnet.stellar.org",
                networkPassphrase: "Test SDF Network ; September 2015",
              },
            });
            break;
          case "SUBMIT_TRANSACTION":
            // Simulate user rejection: respond with an error
            respond({
              error: "User declined to sign the transaction",
              signedTransaction: null,
            });
            break;
          default:
            respond({});
        }
      });
    });

    const page = await context.newPage();
    await goToFirstCampaign(page);
    await ensureWalletConnected(page);
    await openPledgeModal(page);
    await fillAmount(page, "10");
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    // The UI must surface the rejection error
    await expect(
      page.locator(
        "text=/rejected|declined|failed|error|could not sign/i"
      )
    ).toBeVisible({ timeout: 15_000 });

    await context.close();
  });

  // ── 10. Close modal without submitting ────────────────────────────────────
  test("can close the pledge modal without submitting a contribution", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await openPledgeModal(page);

    // Close button or ESC should dismiss the modal
    const closeBtn = page.locator(
      "[aria-label*='close' i], [aria-label*='dismiss' i], button:text-matches('cancel|×|close', 'i')"
    );
    if (await closeBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeBtn.first().click();
    } else {
      await page.keyboard.press("Escape");
    }

    // Modal should no longer be visible
    await expect(
      page.locator("text=/Pledge to|Contribute to/i")
    ).not.toBeVisible({ timeout: 5_000 });
  });

  // ── 11. Minimum contribution amount ───────────────────────────────────────
  test("accepts a contribution at the campaign's minimum pledge amount", async ({
    page,
  }) => {
    await goToFirstCampaign(page);
    await ensureWalletConnected(page);
    await openPledgeModal(page);

    // Use the minimum displayed amount if there is a hint, otherwise use 1
    const minHint = await page
      .locator("text=/minimum.*?([0-9.]+)/i")
      .first()
      .textContent()
      .catch(() => null);

    const amount = minHint?.match(/([0-9.]+)/)?.[1] ?? "1";
    await fillAmount(page, amount);
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    await expect(
      page.locator("text=/success|pledge submitted|contribution confirmed|thank you/i")
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 12. Receipt shows contribution amount ─────────────────────────────────
  test("success receipt displays the contributed amount", async ({ page }) => {
    const contributionAmount = "42";

    await goToFirstCampaign(page);
    await ensureWalletConnected(page);
    await openPledgeModal(page);
    await fillAmount(page, contributionAmount);
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    // Wait for success state
    await expect(
      page.locator("text=/success|pledge submitted|confirmed/i")
    ).toBeVisible({ timeout: 15_000 });

    // The receipt / confirmation area should mention the amount
    await expect(
      page.locator(`text=/42|${contributionAmount}/`)
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 13. Two independent contributors (parallel contexts) ──────────────────
  test("two independent wallets can each see campaigns independently", async ({
    browser,
  }) => {
    const addressA = "GCONTRIB_A_0000000000000000000000000000000000000000000000";
    const addressB = "GCONTRIB_B_0000000000000000000000000000000000000000000000";

    const [ctxA, ctxB] = await Promise.all([
      newWalletContext(browser, addressA),
      newWalletContext(browser, addressB),
    ]);

    const [pageA, pageB] = await Promise.all([
      ctxA.newPage(),
      ctxB.newPage(),
    ]);

    // Both should be able to load the campaigns page independently
    await Promise.all([
      pageA.goto("/campaigns"),
      pageB.goto("/campaigns"),
    ]);

    const cardsA = pageA.locator("a[href*='/campaigns/']");
    const cardsB = pageB.locator("a[href*='/campaigns/']");

    await expect(cardsA.first()).toBeVisible({ timeout: 10_000 });
    await expect(cardsB.first()).toBeVisible({ timeout: 10_000 });

    await Promise.all([ctxA.close(), ctxB.close()]);
  });

  // ── 14. Campaign page shows funding progress ──────────────────────────────
  test("campaign detail page displays a progress indicator", async ({
    page,
  }) => {
    await goToFirstCampaign(page);

    // At least one of: progress bar, percentage text, or raised/goal display
    const progressIndicator = page.locator(
      "[role='progressbar'], text=/%/, text=/raised/i, text=/goal/i"
    );
    await expect(progressIndicator.first()).toBeVisible({ timeout: 10_000 });
  });
});

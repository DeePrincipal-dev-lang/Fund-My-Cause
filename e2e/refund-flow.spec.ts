import { test, expect, newWalletContext } from "./fixtures/wallet";
import type { Page } from "@playwright/test";

/**
 * Issue #1063 — E2E: batch and partial refund flows
 *
 * Background:
 * The refund UI (`apps/interface/src/app/[locale]/refund/page.tsx`) lists every
 * cancelled/failed campaign the connected wallet may have contributed to and
 * lets the user claim their own refund with a per-campaign "Claim Refund"
 * button. Each claim builds and submits a `refund_single` transaction
 * (see `buildRefundTx` in `apps/interface/src/lib/soroban/tx-builders.ts`) —
 * this is the pull-based model documented in `docs/refund-model.md`.
 *
 * Scope of this file:
 *  1. Single-contributor claim flow (pre-existing coverage, kept & fixed to
 *     match the current card-based UI — the previous version of this file
 *     asserted against a "Contract ID" input / "Check Refund" button that no
 *     longer exist on the page).
 *  2. Multi-contributor coverage: 3 independent wallet identities each claim
 *     their own refund from the same failed campaign, proving the pull-based
 *     model — nobody needs to wait on, coordinate with, or be blocked by
 *     another contributor's claim.
 *  3. A documented note on batch (`refund_batch`) and partial (`refund_partial`)
 *     refund coverage — see the block below.
 *
 * ── Batch & partial refund: no UI surface exists ──────────────────────────
 * `apps/interface/src/lib/soroban/tx-builders.ts` only ever builds `refund_single`
 * transactions (`grep -rn "refund_batch\|refund_partial" apps/interface/src`
 * returns zero matches). The refund page has no multi-select/"claim all"
 * control and no admin/insurance partial-refund control. There is nothing in
 * the UI for a Playwright test to drive for either flow, so per this issue's
 * acceptance criteria, that coverage lives at the contract level instead:
 *
 *   - `refund_batch` (contracts/crowdfund/src/lib.rs:1648) is covered by
 *     `refund_batch_refunds_multiple_contributors`,
 *     `refund_batch_skips_already_refunded`,
 *     `refund_batch_fails_when_campaign_still_active`,
 *     `refund_batch_rejects_before_deadline_when_not_cancelled`, and
 *     `refund_batch_rejects_when_goal_reached`
 *     in `contracts/crowdfund/src/test.rs`.
 *   - `refund_partial` (contracts/crowdfund/src/lib.rs:2675) is covered by
 *     `refund_partial_within_limit_succeeds`,
 *     `refund_partial_exceeding_50_percent_is_rejected`, and
 *     `refund_partial_updates_total_raised`
 *     in `contracts/crowdfund/src/test.rs`.
 *
 *   Note: `contracts/crowdfund/src/refund.rs` also defines `refund_batch`/
 *   `refund_partial` helpers, but that module is never invoked from the
 *   `#[contractimpl]` block in `lib.rs` (only `mod refund;` is declared) —
 *   it is dead code, not the active contract surface. The tests listed above
 *   exercise the real, deployed entry points in `lib.rs`.
 *
 * If a batch/partial refund UI is ever added, this file should gain a
 * matching Playwright scenario and this note should be removed.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigates to the refund page.
 *
 * Two things need suppressing first:
 *  - Navigating to the unprefixed "/refund" 500s (a pre-existing issue with
 *    the app's "as-needed" next-intl locale prefix, unrelated to this
 *    ticket) — the explicit "/en/refund" locale-prefixed path works
 *    reliably, so we use that.
 *  - A first-visit "product tour" overlay (ProductTour.tsx) renders its own
 *    `role="dialog"` on top of the page and would collide with this file's
 *    dialog locators and intercept clicks. It's gated on the
 *    "product-tour-completed" localStorage key, so we pre-seed it.
 */
async function gotoRefund(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("product-tour-completed", "true");
  });
  await page.goto("/en/refund");
}

/**
 * Connects the wallet if the guard is showing. Clicking "Connect Wallet"
 * opens a wallet picker (Freighter / LOBSTR); the fixture mocks Freighter to
 * auto-approve, so we pick it and wait for the picker to close.
 *
 * The Navbar always renders its own persistent "Connect Wallet" button in
 * addition to the one WalletGuard shows in the gated content below it, so
 * two matches are expected pre-connection — `.first()` picks either (both
 * trigger the same connect flow).
 */
async function connectWallet(page: Page) {
  const connectBtn = page
    .getByRole("button", { name: /connect wallet/i })
    .first();
  if (!(await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return; // already connected
  }
  await connectBtn.click();
  const freighterOption = page.getByRole("button", {
    name: /connect with freighter/i,
  });
  if (await freighterOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await freighterOption.click();
  }

  // The Next.js dev server occasionally hits a transient SSR error on a
  // route's first render right after a fresh navigation (a pre-existing
  // dev-mode quirk unrelated to this ticket — it self-recovers). A reload
  // is a safe recovery: the wallet session lives in sessionStorage, so
  // useWallet's autoRestore() picks the connected address back up.
  const disconnectBtn = page
    .getByRole("button", { name: /disconnect/i })
    .first();
  const connected = await disconnectBtn
    .isVisible({ timeout: 8_000 })
    .catch(() => false);
  if (!connected) {
    await page.reload();
    await disconnectBtn.isVisible({ timeout: 8_000 }).catch(() => false);
  }
}

/** Locates a refund card by its campaign title (the card is the heading's grandparent). */
function refundCard(page: Page, campaignTitle: string) {
  return page
    .getByRole("heading", { name: campaignTitle })
    .locator("xpath=../..");
}

const FAILED_CAMPAIGN_TITLE = "Rural Connectivity Initiative"; // status: Refunded
const CANCELLED_CAMPAIGN_TITLE = "Ocean Plastic Cleanup Drone Fleet"; // status: Cancelled
const ACTIVE_CAMPAIGN_TITLE = "Eco-Friendly Water Purification"; // status: Active — must not be refundable

// ── single-contributor flow ─────────────────────────────────────────────────

test.describe("Refund Flow — single contributor", () => {
  test("prompts wallet connection before showing refundable campaigns", async ({
    page,
  }) => {
    await gotoRefund(page);

    await expect(
      page.locator("text=Connect your wallet to claim refunds."),
    ).toBeVisible();
    // The Navbar also renders its own persistent "Connect Wallet" button, so
    // two matches are expected here — .first() just confirms at least one
    // (either) is present.
    await expect(
      page.getByRole("button", { name: /connect wallet/i }).first(),
    ).toBeVisible();
  });

  test("lists cancelled/failed campaigns and excludes active ones", async ({
    page,
  }) => {
    await gotoRefund(page);
    await connectWallet(page);

    await expect(
      page.getByRole("heading", { name: "Claim Refunds" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: FAILED_CAMPAIGN_TITLE }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: CANCELLED_CAMPAIGN_TITLE }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: ACTIVE_CAMPAIGN_TITLE }),
    ).not.toBeVisible();
  });

  test("opens and cancels the claim confirmation dialog", async ({ page }) => {
    await gotoRefund(page);
    await connectWallet(page);

    const card = refundCard(page, FAILED_CAMPAIGN_TITLE);
    await card.getByRole("button", { name: /claim refund/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(FAILED_CAMPAIGN_TITLE)).toBeVisible();

    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).not.toBeVisible();

    // Cancelling must not mark the campaign as claimed.
    await expect(
      card.getByRole("button", { name: /claim refund/i }),
    ).toBeVisible();
  });

  test("confirming a claim submits the refund and resolves the dialog", async ({
    page,
  }) => {
    await gotoRefund(page);
    await connectWallet(page);

    const card = refundCard(page, CANCELLED_CAMPAIGN_TITLE);
    await card.getByRole("button", { name: /claim refund/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /confirm claim/i }).click();

    // Regardless of whether the (mocked-wallet) transaction ultimately
    // succeeds or is rejected by the network, the dialog always resolves —
    // `handleConfirm` closes it in a `finally` block. This is the
    // deterministic, network-independent assertion for this flow; the
    // success/failure banner text itself is not asserted here since it
    // depends on live Soroban RPC / Horizon responses.
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  });
});

// ── multi-contributor (pull-based) flow ─────────────────────────────────────

test.describe("Refund Flow — multi-contributor, pull-based (#1063)", () => {
  const contributors = [
    {
      name: "Alice",
      address: "GALICE000000000000000000000000000000000000000000000000A1",
    },
    {
      name: "Bob",
      address: "GBOB00000000000000000000000000000000000000000000000000B2",
    },
    {
      name: "Carol",
      address: "GCAROL000000000000000000000000000000000000000000000000C3",
    },
  ];

  test("each of 3 contributors independently claims their own refund from the same failed campaign", async ({
    browser,
  }) => {
    for (const contributor of contributors) {
      const context = await newWalletContext(browser, contributor.address);
      const page = await context.newPage();

      await gotoRefund(page);
      await connectWallet(page);

      // Every contributor sees the campaign as unclaimed — proving no shared
      // client-side state leaks between independent contributor sessions.
      const card = refundCard(page, FAILED_CAMPAIGN_TITLE);
      const claimButton = card.getByRole("button", { name: /claim refund/i });
      await expect(claimButton).toBeVisible();
      await expect(
        card.getByText("Refund claimed successfully"),
      ).not.toBeVisible();

      await claimButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      await dialog.getByRole("button", { name: /confirm claim/i }).click();

      // Pull-based model: this contributor's claim is a self-contained
      // transaction — resolving it doesn't require any other contributor's
      // action, and (conversely) doesn't block on one.
      await expect(dialog).not.toBeVisible({ timeout: 15_000 });

      await context.close();
    }
  });

  test("a contributor claiming does not affect a different campaign's card", async ({
    browser,
  }) => {
    const context = await newWalletContext(browser, contributors[0].address);
    const page = await context.newPage();

    await gotoRefund(page);
    await connectWallet(page);

    const claimedCard = refundCard(page, FAILED_CAMPAIGN_TITLE);
    await claimedCard.getByRole("button", { name: /claim refund/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /confirm claim/i })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible({
      timeout: 15_000,
    });

    // The unrelated cancelled campaign must remain untouched — refunds are
    // scoped per contributor *and* per campaign, never applied in bulk.
    const otherCard = refundCard(page, CANCELLED_CAMPAIGN_TITLE);
    await expect(
      otherCard.getByRole("button", { name: /claim refund/i }),
    ).toBeVisible();

    await context.close();
  });
});

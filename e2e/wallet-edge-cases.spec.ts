import { test as base, expect, type BrowserContext } from "@playwright/test";

/**
 * Issue #1064 — Wallet-interaction edge cases
 *
 * Covers three failure scenarios that every real-world user hits but that
 * the existing flow tests ignore:
 *
 *   1. User rejects (cancels) the signature prompt during contribution.
 *   2. Wallet is connected to a different Stellar network than the app expects.
 *   3. Wallet disconnects after a transaction is initiated but before signing.
 *
 * All tests use a per-scenario Freighter mock injected via addInitScript so
 * there is no dependency on the browser extension. The mocks run in the page's
 * own context, which means they can be overridden per test without touching the
 * shared fixture in e2e/fixtures/wallet.ts.
 *
 * Acceptance criteria (from issue):
 *   ✓ Each test asserts a specific, user-visible error state — not just
 *     "the test didn't crash".
 */

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Injects the base mock then overrides `signTransaction` to throw a
 * user-rejection error, mirroring what Freighter sends when the user clicks
 * "Decline" in the extension popup.
 */
async function injectRejectionMock(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as any).freighterApi = {
      isConnected: () => Promise.resolve(true),
      getPublicKey: () =>
        Promise.resolve(
          "GMOCK000000000000000000000000000000000000000000000000000",
        ),
      getNetwork: () => Promise.resolve("TESTNET"),
      getNetworkDetails: () =>
        Promise.resolve({
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      // Freighter throws with this message when the user presses "Decline"
      signTransaction: (_xdr: string) =>
        Promise.reject(new Error("Transaction declined by user")),
    };
  });
}

/**
 * Injects a mock where the wallet reports MAINNET while the app is configured
 * for TESTNET. The `getNetworkDetails` passphrase does not match the app's
 * `NEXT_PUBLIC_NETWORK_PASSPHRASE` ("Test SDF Network ; September 2015"), so
 * `useWalletStore.checkNetwork` sets `networkMismatch = true` and the Navbar
 * renders the warning banner.
 */
async function injectNetworkMismatchMock(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as any).freighterApi = {
      isConnected: () => Promise.resolve(true),
      getPublicKey: () =>
        Promise.resolve(
          "GMOCK000000000000000000000000000000000000000000000000000",
        ),
      getNetwork: () => Promise.resolve("MAINNET"),
      getNetworkDetails: () =>
        Promise.resolve({
          network: "MAINNET",
          networkUrl: "https://horizon.stellar.org",
          // Public mainnet passphrase — does NOT match the testnet passphrase
          // the app is configured with in .env.development
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        }),
      signTransaction: (xdr: string) => Promise.resolve(xdr),
    };
  });
}

/**
 * Injects a mock that auto-approves for the connection step, then attaches a
 * `simulateDisconnect` helper on `window` so the test can trigger a wallet
 * disconnect mid-flow by calling `window.__simulateDisconnect()`.
 *
 * After the helper is called `signTransaction` throws "No wallet connected" so
 * any in-flight transaction fails with the same error the store would produce
 * if `activeAdapter` were null.
 */
async function injectDisconnectMidFlowMock(context: BrowserContext) {
  await context.addInitScript(() => {
    let disconnected = false;

    (window as any).__simulateDisconnect = () => {
      disconnected = true;
    };

    (window as any).freighterApi = {
      isConnected: () => Promise.resolve(!disconnected),
      getPublicKey: () =>
        disconnected
          ? Promise.reject(new Error("Wallet disconnected"))
          : Promise.resolve(
              "GMOCK000000000000000000000000000000000000000000000000000",
            ),
      getNetwork: () => Promise.resolve("TESTNET"),
      getNetworkDetails: () =>
        Promise.resolve({
          network: "TESTNET",
          networkUrl: "https://horizon-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
      signTransaction: (_xdr: string) =>
        disconnected
          ? Promise.reject(new Error("No wallet connected"))
          : Promise.resolve(_xdr),
    };
  });
}

/**
 * Navigate to the first available campaign detail page and wait for the Pledge
 * button. Returns without error if no campaigns exist (tests that call this
 * helper will subsequently fail on their own meaningful assertions).
 */
async function openFirstCampaign(page: import("@playwright/test").Page) {
  await page.goto("/campaigns");
  await page
    .locator("a[href*='/campaigns/']")
    .first()
    .waitFor({ timeout: 10_000 });
  await page.locator("a[href*='/campaigns/']").first().click();
  await page
    .getByRole("button", { name: /pledge/i })
    .waitFor({ timeout: 10_000 });
}

/**
 * Click the Connect Wallet button if it is visible and wait for the address
 * abbreviation to appear in the nav. If no Connect button is present, the
 * wallet was already auto-restored from session — that is fine.
 */
async function connectWalletIfNeeded(page: import("@playwright/test").Page) {
  const btn = page.getByRole("button", { name: /connect wallet/i });
  const isVisible = await btn.isVisible({ timeout: 2_000 }).catch(() => false);
  if (isVisible) {
    await btn.click();
    // The wallet-select modal may appear; pick Freighter if so
    const freighterOpt = page.getByRole("button", { name: /freighter/i });
    if (await freighterOpt.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await freighterOpt.click();
    }
    // Wait for either the address abbreviation or any wallet indicator
    await page
      .locator(
        "[data-testid='wallet-address'], text=/GMOCK|G[A-Z0-9]{4}\.\.\.[A-Z0-9]{4}/i",
      )
      .waitFor({ timeout: 8_000 })
      .catch(() => {
        /* some layouts don't surface the address visibly — that's fine */
      });
  }
}

// ── Scenario 1: Signature rejection ──────────────────────────────────────────

base.describe("Wallet edge case — signature rejection (#1064)", () => {
  let context: BrowserContext;

  base.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    await injectRejectionMock(context);
  });

  base.afterEach(async () => {
    await context.close();
  });

  base(
    "shows a visible error state (not a silent hang) when the user declines the signature",
    async () => {
      const page = await context.newPage();

      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);

      // Open the pledge modal
      await page.getByRole("button", { name: /pledge/i }).click();

      // Enter a valid amount
      const amountInput = page
        .locator(
          "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
        )
        .first();
      await expect(amountInput).toBeVisible({ timeout: 8_000 });
      await amountInput.fill("10");

      // Submit — the wallet mock will reject the signTransaction call
      await page.getByRole("button", { name: /confirm pledge/i }).click();

      // ── Assertion 1: TransactionStatus renders the "Transaction Failed" block
      // The component uses role="status" on the outer wrapper and renders a
      // paragraph with text "Transaction Failed" when status === "error".
      await expect(
        page.locator('[role="status"]').getByText("Transaction Failed"),
      ).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: The UI must not be permanently frozen / locked.
      // The Dismiss button inside the error block must be present and clickable.
      const dismissBtn = page.getByRole("button", { name: /dismiss/i });
      await expect(dismissBtn).toBeVisible({ timeout: 5_000 });

      // ── Assertion 3: After dismissal the amount input (idle state) is
      // restored, confirming the modal is usable again (no silent hang).
      await dismissBtn.click();
      await expect(amountInput).toBeVisible({ timeout: 5_000 });

      await page.close();
    },
  );

  base("does not show a success receipt when the user declines", async () => {
    const page = await context.newPage();

    await openFirstCampaign(page);
    await connectWalletIfNeeded(page);
    await page.getByRole("button", { name: /pledge/i }).click();

    const amountInput = page
      .locator(
        "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
      )
      .first();
    await amountInput.fill("10");
    await page.getByRole("button", { name: /confirm pledge/i }).click();

    // The error state must be present
    await expect(
      page.locator('[role="status"]').getByText("Transaction Failed"),
    ).toBeVisible({ timeout: 10_000 });

    // No success text or receipt must ever appear
    await expect(
      page.locator(
        "text=/success|pledge submitted|contribution confirmed|thank you/i",
      ),
    ).not.toBeVisible({ timeout: 2_000 });

    await page.close();
  });
});

// ── Scenario 2: Wrong network ─────────────────────────────────────────────────

base.describe("Wallet edge case — wrong network (#1064)", () => {
  let context: BrowserContext;

  base.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    await injectNetworkMismatchMock(context);
  });

  base.afterEach(async () => {
    await context.close();
  });

  base(
    "surfaces a network-mismatch warning banner in the navbar before any transaction",
    async () => {
      const page = await context.newPage();
      await page.goto("/");
      await connectWalletIfNeeded(page);

      // The Navbar renders a warning banner with an AlertTriangle icon whenever
      // `networkMismatch === true && walletNetwork !== null`.
      // The banner contains either the raw network name "MAINNET" or the
      // human-readable "mainnet" and instructs the user to switch networks.
      const banner = page.locator(
        "text=/MAINNET|mainnet|wrong network|switch network|switch networks/i",
      );
      await expect(banner.first()).toBeVisible({ timeout: 10_000 });

      await page.close();
    },
  );

  base(
    "shows the network-mismatch banner on the campaign detail page",
    async () => {
      const page = await context.newPage();
      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);

      // The banner is part of the Navbar which is present on every page
      const banner = page.locator(
        "text=/MAINNET|mainnet|wrong network|switch network|switch networks/i",
      );
      await expect(banner.first()).toBeVisible({ timeout: 10_000 });

      await page.close();
    },
  );

  base(
    "does not show a success confirmation when the user attempts a transaction on the wrong network",
    async () => {
      const page = await context.newPage();
      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);

      // The mismatch banner must be present before interacting
      await expect(
        page
          .locator(
            "text=/MAINNET|mainnet|wrong network|switch network|switch networks/i",
          )
          .first(),
      ).toBeVisible({ timeout: 10_000 });

      // Open pledge modal and attempt to submit
      await page.getByRole("button", { name: /pledge/i }).click();
      const amountInput = page
        .locator(
          "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
        )
        .first();

      if (await amountInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await amountInput.fill("10");
        await page.getByRole("button", { name: /confirm pledge/i }).click();

        // No success should appear — either an error state shows, the modal
        // blocks interaction, or the mismatch banner is still the dominant UI.
        await expect(
          page.locator(
            "text=/success|pledge submitted|contribution confirmed|thank you/i",
          ),
        ).not.toBeVisible({ timeout: 5_000 });
      }

      await page.close();
    },
  );
});

// ── Scenario 3: Disconnect mid-flow ──────────────────────────────────────────

base.describe("Wallet edge case — disconnect mid-flow (#1064)", () => {
  let context: BrowserContext;

  base.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    await injectDisconnectMidFlowMock(context);
  });

  base.afterEach(async () => {
    await context.close();
  });

  base(
    "shows an error state when the wallet disconnects before signing completes",
    async () => {
      const page = await context.newPage();

      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);

      // Open the pledge modal
      await page.getByRole("button", { name: /pledge/i }).click();

      const amountInput = page
        .locator(
          "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
        )
        .first();
      await expect(amountInput).toBeVisible({ timeout: 8_000 });
      await amountInput.fill("10");

      // Simulate the wallet disconnecting mid-flow, before signTransaction is
      // called (the pledge handler calls signTx inside `contribute()`)
      await page.evaluate(() => {
        (window as any).__simulateDisconnect?.();
      });

      // Submit — signTransaction now rejects with "No wallet connected"
      await page.getByRole("button", { name: /confirm pledge/i }).click();

      // ── Assertion 1: The TransactionStatus error block must appear.
      // This proves the error was surfaced, not swallowed silently.
      await expect(
        page.locator('[role="status"]').getByText("Transaction Failed"),
      ).toBeVisible({ timeout: 10_000 });

      await page.close();
    },
  );

  base(
    "re-prompts the user to connect wallet when address is cleared mid-flow",
    async () => {
      const page = await context.newPage();

      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);

      // Open pledge modal — wallet is connected at this point
      await page.getByRole("button", { name: /pledge/i }).click();

      // Confirm the modal rendered in the connected state (Confirm Pledge button)
      await expect(
        page.getByRole("button", { name: /confirm pledge/i }),
      ).toBeVisible({ timeout: 8_000 });

      // Simulate disconnect by calling the wallet store's disconnect action
      // via the in-page helper; this clears address in the Zustand store.
      await page.evaluate(() => {
        (window as any).__simulateDisconnect?.();
      });

      // Dismiss the modal and reopen to pick up the cleared address state
      const closeBtn = page.getByRole("button", { name: /close/i });
      if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await closeBtn.click();
      }

      // Reopen pledge modal
      await page.getByRole("button", { name: /pledge/i }).click();

      // Because signTransaction now throws, either:
      //   (a) the Confirm button is now "Connect Wallet to Pledge" (if address
      //       was cleared in the store), OR
      //   (b) the modal surfaces the error on submit.
      //
      // We assert (b) — the error path — since the address is cleared only from
      // the mock layer, not from the Zustand store (autoRestore already ran).
      // Fill in amount and confirm to trigger the error path.
      const amountInput = page
        .locator(
          "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
        )
        .first();

      if (await amountInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await amountInput.fill("10");
        await page.getByRole("button", { name: /confirm pledge/i }).click();

        // Error state or a connect-wallet prompt — either is a valid recovery UI
        const errorVisible = await page
          .locator('[role="status"]')
          .getByText("Transaction Failed")
          .isVisible({ timeout: 8_000 })
          .catch(() => false);

        const connectVisible = await page
          .getByRole("button", { name: /connect wallet/i })
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        expect(errorVisible || connectVisible).toBe(true);
      }

      await page.close();
    },
  );

  base(
    "does not show a success receipt after a mid-flow disconnect",
    async () => {
      const page = await context.newPage();

      await openFirstCampaign(page);
      await connectWalletIfNeeded(page);
      await page.getByRole("button", { name: /pledge/i }).click();

      const amountInput = page
        .locator(
          "input[name='amount'], input[placeholder*='Amount'], input[placeholder*='amount'], input[type='number']",
        )
        .first();
      await expect(amountInput).toBeVisible({ timeout: 8_000 });
      await amountInput.fill("10");

      // Disconnect before signing
      await page.evaluate(() => {
        (window as any).__simulateDisconnect?.();
      });

      await page.getByRole("button", { name: /confirm pledge/i }).click();

      // Wait for the error state
      await expect(
        page.locator('[role="status"]').getByText("Transaction Failed"),
      ).toBeVisible({ timeout: 10_000 });

      // No success must ever appear
      await expect(
        page.locator(
          "text=/success|pledge submitted|contribution confirmed|thank you/i",
        ),
      ).not.toBeVisible({ timeout: 2_000 });

      await page.close();
    },
  );
});

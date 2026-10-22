import { test as base, BrowserContext } from "@playwright/test";

/** Default mock wallet address used across the suite unless a test needs a distinct identity. */
export const DEFAULT_MOCK_ADDRESS =
  "GMOCK000000000000000000000000000000000000000000000000000";

/**
 * Simulates the Freighter browser extension without needing it installed.
 *
 * `@stellar/freighter-api` (the package `apps/interface` actually talks to —
 * see `freighterAdapter` in `sdks/js/src/wallet/adapters/freighter.ts`) does
 * NOT read a `window.freighterApi` object. Since v6 it bridges to the
 * extension's content script purely via `window.postMessage`: it posts
 * `{ source: "FREIGHTER_EXTERNAL_MSG_REQUEST", messageId, type, ... }` and
 * awaits a `message` event carrying
 * `{ source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId, ... }` (the
 * "messagedId" spelling — not a typo here, it matches the SDK's own field
 * name) with a matching id. Most request types (REQUEST_ACCESS,
 * SUBMIT_TRANSACTION, REQUEST_NETWORK_DETAILS) have no built-in timeout, so
 * with no listener answering them `connect()`/`signTransaction()` hang
 * forever rather than reject — which is why wallet-gated E2E flows need this
 * responder, not a `window.freighterApi` stub.
 */
async function injectFreighterMock(context: BrowserContext, address: string) {
  await context.addInitScript((mockAddress: string) => {
    const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

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
          respond({ publicKey: mockAddress });
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
              networkPassphrase: NETWORK_PASSPHRASE,
            },
          });
          break;
        case "SUBMIT_TRANSACTION":
          // Auto-approve: echo the unsigned XDR straight back as "signed".
          respond({
            signedTransaction: data.transactionXdr,
            signerAddress: mockAddress,
          });
          break;
        default:
          respond({});
      }
    });
  }, address);
}

/**
 * For tests that need more than one simulated wallet identity at once (e.g.
 * several contributors independently claiming refunds) — mocks Freighter in
 * a fresh context under a specific address.
 */
export async function newWalletContext(
  browser: import("@playwright/test").Browser,
  address: string = DEFAULT_MOCK_ADDRESS,
) {
  const context = await browser.newContext();
  await injectFreighterMock(context, address);
  return context;
}

export const test = base.extend<{ walletContext: BrowserContext }>({
  walletContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await injectFreighterMock(context, DEFAULT_MOCK_ADDRESS);
    await use(context);
    await context.close();
  },
  // Override the default context to always include the mock
  context: async ({ browser }, use) => {
    const context = await browser.newContext();
    await injectFreighterMock(context, DEFAULT_MOCK_ADDRESS);
    await use(context);
    await context.close();
  },
});

export { expect } from "@playwright/test";

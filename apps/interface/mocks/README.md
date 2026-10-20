# apps/interface/mocks

Reusable test mocks for wallet-dependent unit tests.

## Why this directory exists

Tests that exercise wallet-signing paths previously either skipped the wallet
call (poor coverage) or called the real `@stellar/freighter-api` which bridges
to a browser extension via `window.postMessage` — causing tests to **hang or
fail non-deterministically** in Node/jsdom.

This directory provides drop-in fakes so every wallet-touching test runs
**deterministically, instantly, and with zero network I/O**.

---

## `stellarWallet.ts`

Two factory functions that implement the project's wallet interfaces:

| Factory                     | Interface implemented               | Use when…                                        |
| --------------------------- | ----------------------------------- | ------------------------------------------------ |
| `createMockWalletAdapter`   | `WalletAdapter` (SDK wallet module) | Testing components / hooks that call the adapter |
| `createMockWalletProvider`  | `WalletProvider` (higher-level)     | Testing context consumers, contribution flow     |

### Quick start

```ts
import {
  createMockWalletAdapter,
  createMockWalletProvider,
  MOCK_PUBLIC_KEY,
  TESTNET_PASSPHRASE,
} from "@/mocks/stellarWallet";   // or adjust path as needed
```

> **Alias tip** — if your tsconfig has `"@/*": ["src/*"]`, place this file
> under `src/mocks/` instead and import as `@/mocks/stellarWallet`.

### Auto-approve everything (happy path)

```ts
const wallet = createMockWalletAdapter();

const address = await wallet.connect();
// → "GMOCKWALLET000000000000000000000000000000000000000000000"

const signed = await wallet.signTransaction("base64-xdr", TESTNET_PASSPHRASE);
// → "signed::base64-xdr"
```

### Simulate connection failure

```ts
const wallet = createMockWalletAdapter({
  connectError: "User denied wallet access",
});

await expect(wallet.connect()).rejects.toThrow("User denied wallet access");
```

### Simulate transaction rejection

```ts
const wallet = createMockWalletAdapter({
  signError: "User rejected the transaction",
});

await expect(
  wallet.signTransaction("xdr", TESTNET_PASSPHRASE)
).rejects.toThrow("User rejected the transaction");
```

### Custom address / network

```ts
const wallet = createMockWalletAdapter({
  publicKey: "GCREATOR0000000000000000000000000000000000000000000000000",
  network: { network: "MAINNET", networkPassphrase: "Public Global Stellar Network ; September 2015" },
});
```

### WalletProvider (with state tracking)

```ts
const provider = createMockWalletProvider();

expect(provider.state).toBe("idle");

await provider.connect();
expect(provider.state).toBe("connected");
expect(provider.publicKey).toBe(MOCK_PUBLIC_KEY);

await provider.disconnect();
expect(provider.state).toBe("idle");
```

### Testing state-change callbacks

```ts
const provider = createMockWalletProvider();
const onState = jest.fn();
const unsub = provider.onStateChange(onState);

await provider.connect();
expect(onState).toHaveBeenCalledWith("connected", MOCK_PUBLIC_KEY);

unsub(); // stop listening
```

### Asserting no network calls

All mock methods are `jest.fn()` implementations. They never call `fetch`,
`window.postMessage`, or any Stellar SDK. You can confirm this with:

```ts
import * as freighterApi from "@stellar/freighter-api";
jest.mock("@stellar/freighter-api");

const wallet = createMockWalletAdapter();
await wallet.connect();

// The real freighter-api is never imported or called:
expect(freighterApi.getPublicKey).not.toHaveBeenCalled();
```

### Delay simulation (loading states)

```ts
const wallet = createMockWalletAdapter({ delay: 200 });

// connect() resolves after 200 ms — useful for asserting spinner visibility
```

---

## Migrating existing wallet tests

1. Find tests that import or mock `@stellar/freighter-api` directly.
2. Replace with `createMockWalletAdapter()` or `createMockWalletProvider()`.
3. Remove any `jest.mock("@stellar/freighter-api")` boilerplate.

### Before

```ts
jest.mock("@stellar/freighter-api", () => ({
  getPublicKey: jest.fn().mockResolvedValue("GTEST..."),
  signTransaction: jest.fn().mockResolvedValue("signed-xdr"),
  isConnected: jest.fn().mockResolvedValue(true),
}));
```

### After

```ts
import { createMockWalletAdapter } from "../../mocks/stellarWallet";

const wallet = createMockWalletAdapter();
// wallet.connect, wallet.signTransaction, etc. are ready to go
```

---

## Adding new mocks

1. Add a new export to `stellarWallet.ts` (or create a sibling file).
2. Write tests in `stellarWallet.test.ts` (or a sibling `*.test.ts`).
3. Update this README.

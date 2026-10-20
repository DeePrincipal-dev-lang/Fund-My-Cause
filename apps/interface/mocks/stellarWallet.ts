/**
 * Mock Stellar Wallet SDK
 * =======================
 * Provides fully in-process mocks for the wallet interfaces used throughout
 * `apps/interface`:
 *
 * - {@link WalletAdapter}  — from `@fund-my-cause/sdk/wallet` (low-level)
 * - {@link WalletProvider} — higher-level provider with state tracking
 *
 * ## Why this exists
 * Tests that exercise wallet-signing paths previously either:
 *   - skipped the wallet call entirely (poor coverage), or
 *   - called into the real `@stellar/freighter-api` which bridges to a browser
 *     extension via `window.postMessage` — causing tests to hang or fail
 *     non-deterministically in Node/jsdom.
 *
 * This mock eliminates both problems: all operations are resolved Promises,
 * fully configurable per-test, and **never** touch the network or the DOM
 * messaging APIs.
 *
 * ## Usage
 *
 * ```ts
 * import { createMockWalletAdapter, createMockWalletProvider } from
 *   '../../../mocks/stellarWallet';
 *
 * // Basic — auto-approves everything
 * const wallet = createMockWalletAdapter();
 * const address = await wallet.connect(); // MOCK_PUBLIC_KEY
 * const signed  = await wallet.signTransaction("unsigned-xdr", TESTNET_PASSPHRASE);
 *
 * // Simulate user rejection
 * const wallet = createMockWalletAdapter({ connectError: "User rejected" });
 * await expect(wallet.connect()).rejects.toThrow("User rejected");
 *
 * // Track calls in Jest
 * expect(wallet.connect).toHaveBeenCalledTimes(1);
 * ```
 *
 * @module stellarWallet
 */

import type {
  WalletAdapter,
  WalletNetwork,
  AccountChange,
  Unsubscribe,
} from "@fund-my-cause/sdk/wallet";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default mock public key — a valid-length G-prefixed Stellar address. */
export const MOCK_PUBLIC_KEY =
  "GMOCKWALLET000000000000000000000000000000000000000000000";

/** Stellar testnet network passphrase. */
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** Stellar mainnet network passphrase. */
export const MAINNET_PASSPHRASE =
  "Public Global Stellar Network ; September 2015";

// ── WalletProvider types (replicated from sdks/js/src/walletProvider.ts) ──────
// Defined here to avoid a cross-package relative import that breaks
// jest moduleResolution in the apps/interface test environment.

export type WalletProviderState = "idle" | "pending" | "connected" | "error";

/** Subset of WalletProvider needed by the mock. */
export interface WalletProvider {
  state: WalletProviderState;
  publicKey: string | null;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  signTransaction(xdr: string): Promise<string>;
  getNetworkDetails(): Promise<string>;
  onStateChange(
    callback: (state: WalletProviderState, publicKey: string | null) => void,
  ): () => void;
}

// ── Configuration types ───────────────────────────────────────────────────────

/**
 * Configuration options for {@link createMockWalletAdapter}.
 */
export interface MockWalletAdapterConfig {
  /**
   * Public key returned by `connect()`.
   * @default MOCK_PUBLIC_KEY
   */
  publicKey?: string;

  /** If set, `connect()` rejects with this message. */
  connectError?: string;

  /** If set, `signTransaction()` rejects with this message. */
  signError?: string;

  /** If set, `disconnect()` rejects with this message. */
  disconnectError?: string;

  /**
   * Network details returned by `getNetwork()`.
   * Defaults to testnet.
   */
  network?: WalletNetwork;

  /**
   * Human-readable wallet name.
   * @default "MockWallet"
   */
  name?: string;

  /**
   * Optional artificial delay (ms) per async operation.
   * Useful for testing loading-state transitions.
   * @default 0
   */
  delay?: number;
}

/**
 * Configuration options for {@link createMockWalletProvider}.
 */
export interface MockWalletProviderConfig {
  /** @default "idle" */
  initialState?: WalletProviderState;

  /** Public key when connected. @default MOCK_PUBLIC_KEY */
  publicKey?: string;

  /** If set, `connect()` rejects with this message. */
  connectError?: string;

  /** If set, `signTransaction()` rejects with this message. */
  signError?: string;

  /** Network name returned by `getNetworkDetails()`. @default "TESTNET" */
  networkName?: string;

  /**
   * Artificial delay (ms) per async operation.
   * @default 0
   */
  delay?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Builds a deterministic fake-signed XDR so callers can assert the value. */
const fakeSign = (xdr: string): string => `signed::${xdr}`;

// ── WalletAdapter mock ────────────────────────────────────────────────────────

/**
 * Creates a Jest-spy-equipped mock implementing {@link WalletAdapter}.
 *
 * All methods are `jest.fn()` implementations — callers can inspect call
 * counts, override return values, or throw per-test.
 *
 * @example
 * ```ts
 * const wallet = createMockWalletAdapter({ signError: "User rejected" });
 * await expect(wallet.signTransaction("xdr", TESTNET_PASSPHRASE))
 *   .rejects.toThrow("User rejected");
 * ```
 */
export function createMockWalletAdapter(
  config: MockWalletAdapterConfig = {},
): jest.Mocked<WalletAdapter> {
  const {
    publicKey = MOCK_PUBLIC_KEY,
    connectError,
    signError,
    disconnectError,
    network = { network: "TESTNET", networkPassphrase: TESTNET_PASSPHRASE },
    name = "MockWallet",
    delay = 0,
  } = config;

  const maybeDelay = (): Promise<void> =>
    delay > 0 ? sleep(delay) : Promise.resolve();

  const connect = jest.fn(async (): Promise<string> => {
    await maybeDelay();
    if (connectError) throw new Error(connectError);
    return publicKey;
  });

  const signTransaction = jest.fn(
    async (xdr: string, _networkPassphrase: string): Promise<string> => {
      await maybeDelay();
      if (signError) throw new Error(signError);
      return fakeSign(xdr);
    },
  );

  const disconnect = jest.fn(async (): Promise<void> => {
    await maybeDelay();
    if (disconnectError) throw new Error(disconnectError);
  });

  const getNetwork = jest.fn(async (): Promise<WalletNetwork | null> => {
    await maybeDelay();
    return network;
  });

  const onAccountChange = jest.fn(
    (_callback: (change: AccountChange) => void): Unsubscribe => {
      return jest.fn(); // no-op unsubscribe
    },
  );

  return {
    name,
    connect,
    signTransaction,
    disconnect,
    getNetwork,
    onAccountChange,
  } as unknown as jest.Mocked<WalletAdapter>;
}

// ── WalletProvider mock ───────────────────────────────────────────────────────

/**
 * Creates a mock implementing the higher-level {@link WalletProvider}.
 *
 * Tracks `state` and `publicKey` internally, mirroring the real provider's
 * behaviour so components that depend on `WalletProvider` can be tested
 * without a browser extension.
 *
 * @example
 * ```ts
 * const provider = createMockWalletProvider();
 * expect(provider.state).toBe("idle");
 * await provider.connect();
 * expect(provider.state).toBe("connected");
 * ```
 */
export function createMockWalletProvider(
  config: MockWalletProviderConfig = {},
): WalletProvider & {
  connect: jest.Mock;
  disconnect: jest.Mock;
  signTransaction: jest.Mock;
  getNetworkDetails: jest.Mock;
  onStateChange: jest.Mock;
} {
  const {
    initialState = "idle",
    publicKey: configPublicKey = MOCK_PUBLIC_KEY,
    connectError,
    signError,
    networkName = "TESTNET",
    delay = 0,
  } = config;

  let _state: WalletProviderState = initialState;
  let _publicKey: string | null =
    initialState === "connected" ? configPublicKey : null;

  type StateListener = (
    state: WalletProviderState,
    publicKey: string | null,
  ) => void;
  const _listeners = new Set<StateListener>();

  const notify = (): void => {
    _listeners.forEach((fn) => fn(_state, _publicKey));
  };

  const maybeDelay = (): Promise<void> =>
    delay > 0 ? sleep(delay) : Promise.resolve();

  const connect = jest.fn(async (): Promise<string> => {
    await maybeDelay();
    if (connectError) {
      _state = "error";
      notify();
      throw new Error(connectError);
    }
    _state = "connected";
    _publicKey = configPublicKey;
    notify();
    return configPublicKey;
  });

  const disconnect = jest.fn(async (): Promise<void> => {
    await maybeDelay();
    _state = "idle";
    _publicKey = null;
    notify();
  });

  const signTransaction = jest.fn(async (xdr: string): Promise<string> => {
    await maybeDelay();
    if (signError) throw new Error(signError);
    return fakeSign(xdr);
  });

  const getNetworkDetails = jest.fn(async (): Promise<string> => {
    await maybeDelay();
    return networkName;
  });

  const onStateChange = jest.fn(
    (callback: StateListener): (() => void) => {
      _listeners.add(callback);
      return () => _listeners.delete(callback);
    },
  );

  return {
    get state() {
      return _state;
    },
    get publicKey() {
      return _publicKey;
    },
    connect,
    disconnect,
    signTransaction,
    getNetworkDetails,
    onStateChange,
  };
}

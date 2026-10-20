/**
 * @jest-environment jsdom
 *
 * Unit tests for apps/interface/mocks/stellarWallet.ts
 *
 * Verifies the mock itself behaves correctly so tests that depend on it
 * can trust the mock's semantics, and demonstrates the mock's API as
 * living documentation.
 *
 * Issue: #1167 — Add mock Stellar SDK service for wallet-dependent unit tests
 */

// Mock @stellar/freighter-api so the SDK source can be imported without
// the real browser extension or npm package installed.
jest.mock("@stellar/freighter-api", () => ({
  getPublicKey: jest.fn(),
  signTransaction: jest.fn(),
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  setAllowed: jest.fn(),
  getNetworkDetails: jest.fn(),
  requestAccess: jest.fn(),
}));

// Mock WalletConnect peer dep that may be absent in CI
jest.mock("@walletconnect/sign-client", () => ({ default: jest.fn() }), {
  virtual: true,
});

import {
  createMockWalletAdapter,
  createMockWalletProvider,
  MOCK_PUBLIC_KEY,
  TESTNET_PASSPHRASE,
  MAINNET_PASSPHRASE,
} from "./stellarWallet";

// ── createMockWalletAdapter ───────────────────────────────────────────────────

describe("createMockWalletAdapter", () => {
  describe("default behaviour (no config)", () => {
    it("returns an object with the WalletAdapter shape", () => {
      const wallet = createMockWalletAdapter();
      expect(wallet).toHaveProperty("name");
      expect(wallet).toHaveProperty("connect");
      expect(wallet).toHaveProperty("signTransaction");
      expect(wallet).toHaveProperty("disconnect");
      expect(wallet).toHaveProperty("getNetwork");
      expect(wallet).toHaveProperty("onAccountChange");
    });

    it("connect resolves to the default mock public key", async () => {
      const wallet = createMockWalletAdapter();
      const address = await wallet.connect();
      expect(address).toBe(MOCK_PUBLIC_KEY);
    });

    it("signTransaction resolves to a deterministic signed XDR", async () => {
      const wallet = createMockWalletAdapter();
      const signed = await wallet.signTransaction("my-xdr", TESTNET_PASSPHRASE);
      expect(signed).toBe("signed::my-xdr");
    });

    it("disconnect resolves without error", async () => {
      const wallet = createMockWalletAdapter();
      await expect(wallet.disconnect!()).resolves.toBeUndefined();
    });

    it("getNetwork resolves to testnet by default", async () => {
      const wallet = createMockWalletAdapter();
      const net = await wallet.getNetwork!();
      expect(net?.network).toBe("TESTNET");
      expect(net?.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    });

    it("onAccountChange returns an unsubscribe function", () => {
      const wallet = createMockWalletAdapter();
      const unsub = wallet.onAccountChange!(() => {});
      expect(typeof unsub).toBe("function");
    });

    it("default name is 'MockWallet'", () => {
      const wallet = createMockWalletAdapter();
      expect(wallet.name).toBe("MockWallet");
    });
  });

  describe("custom config", () => {
    it("uses the provided publicKey", async () => {
      const customKey = "GCUSTOM0000000000000000000000000000000000000000000000000";
      const wallet = createMockWalletAdapter({ publicKey: customKey });
      expect(await wallet.connect()).toBe(customKey);
    });

    it("uses the provided wallet name", () => {
      const wallet = createMockWalletAdapter({ name: "Freighter" });
      expect(wallet.name).toBe("Freighter");
    });

    it("returns the provided network from getNetwork", async () => {
      const wallet = createMockWalletAdapter({
        network: { network: "MAINNET", networkPassphrase: MAINNET_PASSPHRASE },
      });
      const net = await wallet.getNetwork!();
      expect(net?.network).toBe("MAINNET");
      expect(net?.networkPassphrase).toBe(MAINNET_PASSPHRASE);
    });
  });

  describe("error simulation", () => {
    it("connect rejects when connectError is configured", async () => {
      const wallet = createMockWalletAdapter({
        connectError: "User denied wallet access",
      });
      await expect(wallet.connect()).rejects.toThrow("User denied wallet access");
    });

    it("signTransaction rejects when signError is configured", async () => {
      const wallet = createMockWalletAdapter({
        signError: "User rejected the transaction",
      });
      await expect(
        wallet.signTransaction("xdr", TESTNET_PASSPHRASE),
      ).rejects.toThrow("User rejected the transaction");
    });

    it("disconnect rejects when disconnectError is configured", async () => {
      const wallet = createMockWalletAdapter({
        disconnectError: "Wallet extension unresponsive",
      });
      await expect(wallet.disconnect!()).rejects.toThrow(
        "Wallet extension unresponsive",
      );
    });

    it("connect still succeeds after a sign error (errors are independent)", async () => {
      const wallet = createMockWalletAdapter({ signError: "Signing failed" });
      await expect(wallet.connect()).resolves.toBe(MOCK_PUBLIC_KEY);
      await expect(
        wallet.signTransaction("xdr", TESTNET_PASSPHRASE),
      ).rejects.toThrow("Signing failed");
    });
  });

  describe("jest spy behaviour — no network calls made", () => {
    it("records connect call arguments", async () => {
      const wallet = createMockWalletAdapter();
      await wallet.connect();
      expect(wallet.connect).toHaveBeenCalledTimes(1);
    });

    it("records signTransaction call arguments", async () => {
      const wallet = createMockWalletAdapter();
      await wallet.signTransaction("my-xdr", TESTNET_PASSPHRASE);
      expect(wallet.signTransaction).toHaveBeenCalledWith(
        "my-xdr",
        TESTNET_PASSPHRASE,
      );
    });

    it("records multiple calls independently", async () => {
      const wallet = createMockWalletAdapter();
      await wallet.connect();
      await wallet.signTransaction("xdr1", TESTNET_PASSPHRASE);
      await wallet.signTransaction("xdr2", TESTNET_PASSPHRASE);
      expect(wallet.connect).toHaveBeenCalledTimes(1);
      expect(wallet.signTransaction).toHaveBeenCalledTimes(2);
    });

    it("supports mockResolvedValueOnce for one-off overrides", async () => {
      const wallet = createMockWalletAdapter();
      const overrideKey = "GOVERRIDDEN000000000000000000000000000000000000000000000";
      wallet.connect.mockResolvedValueOnce(overrideKey);
      expect(await wallet.connect()).toBe(overrideKey);
      // Second call falls back to default
      expect(await wallet.connect()).toBe(MOCK_PUBLIC_KEY);
    });

    it("can be reset via jest.clearAllMocks()", async () => {
      const wallet = createMockWalletAdapter();
      await wallet.connect();
      expect(wallet.connect).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();
      expect(wallet.connect).toHaveBeenCalledTimes(0);
    });
  });

  describe("connect → sign → disconnect lifecycle", () => {
    it("completes the full wallet lifecycle with zero network I/O", async () => {
      const wallet = createMockWalletAdapter();

      const address = await wallet.connect();
      expect(address).toBe(MOCK_PUBLIC_KEY);

      const signed = await wallet.signTransaction("tx-xdr", TESTNET_PASSPHRASE);
      expect(signed).toBe("signed::tx-xdr");

      await expect(wallet.disconnect!()).resolves.toBeUndefined();

      expect(wallet.connect).toHaveBeenCalledTimes(1);
      expect(wallet.signTransaction).toHaveBeenCalledTimes(1);
      expect(wallet.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});

// ── createMockWalletProvider ──────────────────────────────────────────────────

describe("createMockWalletProvider", () => {
  describe("initial state", () => {
    it("starts in 'idle' state by default", () => {
      const provider = createMockWalletProvider();
      expect(provider.state).toBe("idle");
    });

    it("starts with null publicKey when idle", () => {
      const provider = createMockWalletProvider();
      expect(provider.publicKey).toBeNull();
    });

    it("can start in 'connected' state", () => {
      const provider = createMockWalletProvider({ initialState: "connected" });
      expect(provider.state).toBe("connected");
      expect(provider.publicKey).toBe(MOCK_PUBLIC_KEY);
    });

    it("uses provided publicKey when starting connected", () => {
      const key = "GCUSTOM0000000000000000000000000000000000000000000000000";
      const provider = createMockWalletProvider({
        initialState: "connected",
        publicKey: key,
      });
      expect(provider.publicKey).toBe(key);
    });
  });

  describe("connect()", () => {
    it("transitions state to 'connected' and resolves publicKey", async () => {
      const provider = createMockWalletProvider();
      const address = await provider.connect();
      expect(address).toBe(MOCK_PUBLIC_KEY);
      expect(provider.state).toBe("connected");
      expect(provider.publicKey).toBe(MOCK_PUBLIC_KEY);
    });

    it("transitions state to 'error' when connectError is set", async () => {
      const provider = createMockWalletProvider({
        connectError: "Extension not found",
      });
      await expect(provider.connect()).rejects.toThrow("Extension not found");
      expect(provider.state).toBe("error");
    });

    it("is a jest spy", async () => {
      const provider = createMockWalletProvider();
      await provider.connect();
      expect(provider.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect()", () => {
    it("transitions state back to 'idle' and clears publicKey", async () => {
      const provider = createMockWalletProvider();
      await provider.connect();
      expect(provider.state).toBe("connected");

      await provider.disconnect();
      expect(provider.state).toBe("idle");
      expect(provider.publicKey).toBeNull();
    });

    it("is a jest spy", async () => {
      const provider = createMockWalletProvider();
      await provider.disconnect();
      expect(provider.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("signTransaction()", () => {
    it("returns a signed XDR when not configured to error", async () => {
      const provider = createMockWalletProvider();
      const signed = await provider.signTransaction("my-xdr");
      expect(signed).toBe("signed::my-xdr");
    });

    it("rejects when signError is configured", async () => {
      const provider = createMockWalletProvider({ signError: "Rejected" });
      await expect(provider.signTransaction("xdr")).rejects.toThrow("Rejected");
    });

    it("is a jest spy", async () => {
      const provider = createMockWalletProvider();
      await provider.signTransaction("xdr");
      expect(provider.signTransaction).toHaveBeenCalledWith("xdr");
    });
  });

  describe("getNetworkDetails()", () => {
    it("returns 'TESTNET' by default", async () => {
      const provider = createMockWalletProvider();
      expect(await provider.getNetworkDetails()).toBe("TESTNET");
    });

    it("uses the configured networkName", async () => {
      const provider = createMockWalletProvider({ networkName: "MAINNET" });
      expect(await provider.getNetworkDetails()).toBe("MAINNET");
    });

    it("is a jest spy", async () => {
      const provider = createMockWalletProvider();
      await provider.getNetworkDetails();
      expect(provider.getNetworkDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe("onStateChange()", () => {
    it("calls subscriber on connect", async () => {
      const provider = createMockWalletProvider();
      const listener = jest.fn();
      provider.onStateChange(listener);
      await provider.connect();
      expect(listener).toHaveBeenCalledWith("connected", MOCK_PUBLIC_KEY);
    });

    it("calls subscriber on disconnect", async () => {
      const provider = createMockWalletProvider({ initialState: "connected" });
      const listener = jest.fn();
      provider.onStateChange(listener);
      await provider.disconnect();
      expect(listener).toHaveBeenCalledWith("idle", null);
    });

    it("allows unsubscribing before state change", async () => {
      const provider = createMockWalletProvider();
      const listener = jest.fn();
      const unsub = provider.onStateChange(listener);
      unsub();
      await provider.connect();
      expect(listener).not.toHaveBeenCalled();
    });

    it("is a jest spy", () => {
      const provider = createMockWalletProvider();
      provider.onStateChange(jest.fn());
      expect(provider.onStateChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("connect → sign → disconnect lifecycle (no network calls)", () => {
    it("completes the full WalletProvider lifecycle deterministically", async () => {
      const provider = createMockWalletProvider();
      expect(provider.state).toBe("idle");

      const address = await provider.connect();
      expect(address).toBe(MOCK_PUBLIC_KEY);
      expect(provider.state).toBe("connected");

      const signed = await provider.signTransaction("contribution-xdr");
      expect(signed).toBe("signed::contribution-xdr");

      await provider.disconnect();
      expect(provider.state).toBe("idle");
      expect(provider.publicKey).toBeNull();
    });
  });
});

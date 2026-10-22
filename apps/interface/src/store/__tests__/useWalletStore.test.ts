/**
 * Unit tests for useWalletStore selectors.
 *
 * The underlying reducer logic lives in useWalletStore and is tested via
 * useWallet.test.tsx.  These tests verify:
 *   • every named selector returns the expected field from a given state shape
 *   • derived selectors (selectIsConnected) compute correctly
 */

import {
  useWalletStore,
  selectWalletAddress,
  selectIsConnecting,
  selectIsAutoConnecting,
  selectIsSigning,
  selectWalletError,
  selectNetworkMismatch,
  selectWalletNetwork,
  selectShowWalletSelect,
  selectIsConnected,
} from "../useWalletStore";

// Freeze the initial state snapshot so each test begins from a known baseline.
const INITIAL = useWalletStore.getState();

beforeEach(() => {
  useWalletStore.setState(INITIAL, true);
});

// ── State shape helpers ───────────────────────────────────────────────────────

function stateWith(patch: Partial<ReturnType<typeof useWalletStore.getState>>) {
  return { ...INITIAL, ...patch };
}

// ── selectWalletAddress ───────────────────────────────────────────────────────

describe("selectWalletAddress", () => {
  it("returns null when no wallet is connected", () => {
    expect(selectWalletAddress(stateWith({ address: null }))).toBeNull();
  });

  it("returns the address when connected", () => {
    const addr = "GABC123";
    expect(selectWalletAddress(stateWith({ address: addr }))).toBe(addr);
  });
});

// ── selectIsConnected (derived) ───────────────────────────────────────────────

describe("selectIsConnected", () => {
  it("returns false when address is null", () => {
    expect(selectIsConnected(stateWith({ address: null }))).toBe(false);
  });

  it("returns true when address is set", () => {
    expect(selectIsConnected(stateWith({ address: "GABC123" }))).toBe(true);
  });
});

// ── selectIsConnecting ────────────────────────────────────────────────────────

describe("selectIsConnecting", () => {
  it("returns the isConnecting flag", () => {
    expect(selectIsConnecting(stateWith({ isConnecting: true }))).toBe(true);
    expect(selectIsConnecting(stateWith({ isConnecting: false }))).toBe(false);
  });
});

// ── selectIsAutoConnecting ────────────────────────────────────────────────────

describe("selectIsAutoConnecting", () => {
  it("returns the isAutoConnecting flag", () => {
    expect(selectIsAutoConnecting(stateWith({ isAutoConnecting: true }))).toBe(
      true,
    );
    expect(selectIsAutoConnecting(stateWith({ isAutoConnecting: false }))).toBe(
      false,
    );
  });
});

// ── selectIsSigning ───────────────────────────────────────────────────────────

describe("selectIsSigning", () => {
  it("returns the isSigning flag", () => {
    expect(selectIsSigning(stateWith({ isSigning: true }))).toBe(true);
    expect(selectIsSigning(stateWith({ isSigning: false }))).toBe(false);
  });
});

// ── selectWalletError ─────────────────────────────────────────────────────────

describe("selectWalletError", () => {
  it("returns null when there is no error", () => {
    expect(selectWalletError(stateWith({ error: null }))).toBeNull();
  });

  it("returns the error message", () => {
    expect(selectWalletError(stateWith({ error: "Connection refused" }))).toBe(
      "Connection refused",
    );
  });
});

// ── selectNetworkMismatch ─────────────────────────────────────────────────────

describe("selectNetworkMismatch", () => {
  it("returns the networkMismatch flag", () => {
    expect(selectNetworkMismatch(stateWith({ networkMismatch: true }))).toBe(
      true,
    );
    expect(selectNetworkMismatch(stateWith({ networkMismatch: false }))).toBe(
      false,
    );
  });
});

// ── selectWalletNetwork ───────────────────────────────────────────────────────

describe("selectWalletNetwork", () => {
  it("returns null when not yet detected", () => {
    expect(selectWalletNetwork(stateWith({ walletNetwork: null }))).toBeNull();
  });

  it("returns the network name", () => {
    expect(selectWalletNetwork(stateWith({ walletNetwork: "TESTNET" }))).toBe(
      "TESTNET",
    );
  });
});

// ── selectShowWalletSelect ────────────────────────────────────────────────────

describe("selectShowWalletSelect", () => {
  it("returns false by default", () => {
    expect(selectShowWalletSelect(stateWith({ showWalletSelect: false }))).toBe(
      false,
    );
  });

  it("returns true when the modal should be shown", () => {
    expect(selectShowWalletSelect(stateWith({ showWalletSelect: true }))).toBe(
      true,
    );
  });
});

// ── Store action integration ──────────────────────────────────────────────────

describe("setShowWalletSelect action", () => {
  it("toggles showWalletSelect in the live store", () => {
    useWalletStore.getState().setShowWalletSelect(true);
    expect(useWalletStore.getState().showWalletSelect).toBe(true);
    useWalletStore.getState().setShowWalletSelect(false);
    expect(useWalletStore.getState().showWalletSelect).toBe(false);
  });
});

/**
 * useWalletStore — canonical wallet connection and session state.
 *
 * All wallet state lives here:
 *   • connected address
 *   • adapter reference (freighter / lobstr)
 *   • loading flags (isConnecting, isAutoConnecting, isSigning)
 *   • error message
 *   • network mismatch flag
 *   • wallet-select modal visibility
 *
 * Components should prefer the scoped selector hooks in
 * `@/hooks/useWalletSlice` over importing this store directly.
 */

import { create } from "zustand";
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { freighterAdapter } from "@/lib/freighterAdapter";
import { lobstrAdapter } from "@/lib/lobstrAdapter";
import type { WalletAdapter, Unsubscribe } from "@/lib/walletAdapters";
import type { ToastType } from "@/components/ui/Toast";
import {
  saveSession,
  loadSession,
  clearSession,
  isNetworkMatch,
  classifySignError,
  type WalletType,
} from "@/services/wallet.service";

const ADAPTERS: Record<WalletType, WalletAdapter> = {
  freighter: freighterAdapter,
  lobstr: lobstrAdapter,
};

type Toaster = (message: string, type: ToastType) => void;

export interface WalletStoreState {
  address: string | null;
  activeAdapter: WalletAdapter | null;
  isConnecting: boolean;
  isAutoConnecting: boolean;
  isSigning: boolean;
  error: string | null;
  networkMismatch: boolean;
  walletNetwork: string | null;
  showWalletSelect: boolean;

  setShowWalletSelect: (show: boolean) => void;
  autoRestore: () => Promise<void>;
  connectWith: (walletType: WalletType, onToast: Toaster) => Promise<void>;
  disconnect: (onToast: Toaster) => Promise<void>;
  signTx: (xdr: string, onToast: Toaster) => Promise<string>;
}

/**
 * Unsubscribe for the active adapter's account-change listener. Kept outside
 * the store because it is a subscription handle, not rendered state.
 */
let stopAccountWatch: Unsubscribe | null = null;

/**
 * Reads the connected wallet's network via the adapter, so the check works
 * for any wallet rather than only Freighter. Wallets that can't report a
 * network (e.g. LOBSTR over WalletConnect) leave the current values alone.
 */
async function checkNetwork(
  adapter: WalletAdapter,
  set: (partial: Partial<WalletStoreState>) => void,
) {
  const network = await adapter.getNetwork?.();
  if (!network) return;
  set({
    walletNetwork: network.network,
    networkMismatch: !isNetworkMatch(network.networkPassphrase),
  });
}

export const useWalletStore = create<WalletStoreState>((set, get) => {
  /**
   * Follows account/network switches the user makes inside their wallet, so
   * the app doesn't keep signing as an account the user has moved away from.
   */
  function watchAccount(adapter: WalletAdapter, walletType: WalletType) {
    stopAccountWatch?.();
    stopAccountWatch =
      adapter.onAccountChange?.(({ address, network, networkPassphrase }) => {
        saveSession(address, walletType);
        set({
          address,
          walletNetwork: network,
          networkMismatch: !isNetworkMatch(networkPassphrase),
        });
      }) ?? null;
  }

  return {
    address: null,
    activeAdapter: null,
    isConnecting: false,
    isAutoConnecting: true,
    isSigning: false,
    error: null,
    networkMismatch: false,
    walletNetwork: null,
    showWalletSelect: false,

    setShowWalletSelect: (show) => set({ showWalletSelect: show }),

    autoRestore: async () => {
      const saved = loadSession();
      if (saved) {
        const adapter = ADAPTERS[saved.walletType];
        set({ address: saved.address, activeAdapter: adapter });
        await checkNetwork(adapter, set);
        watchAccount(adapter, saved.walletType);
      }
      set({ isAutoConnecting: false });
    },

    connectWith: async (walletType, onToast) => {
      set({ showWalletSelect: false, isConnecting: true, error: null });
      const adapter = ADAPTERS[walletType];
      try {
        const addr = await adapter.connect();
        saveSession(addr, walletType);
        set({ address: addr, activeAdapter: adapter });
        await checkNetwork(adapter, set);
        watchAccount(adapter, walletType);
        onToast("Wallet connected successfully!", "success");
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to connect wallet.";
        set({ error: msg });
        onToast(msg, "error");
      } finally {
        set({ isConnecting: false });
      }
    },

    disconnect: async (onToast) => {
      stopAccountWatch?.();
      stopAccountWatch = null;
      await get().activeAdapter?.disconnect?.();
      clearSession();
      set({
        address: null,
        activeAdapter: null,
        networkMismatch: false,
        walletNetwork: null,
      });
      onToast("Wallet disconnected", "info");
    },

    signTx: async (xdr, onToast) => {
      const adapter = get().activeAdapter;
      if (!adapter) throw new Error("No wallet connected");
      set({ isSigning: true });
      try {
        return await adapter.signTransaction(xdr, NETWORK_PASSPHRASE);
      } catch (e) {
        const kind = classifySignError(e);
        if (kind === "cancelled") onToast("Transaction cancelled", "info");
        else if (kind === "network")
          onToast("Network error, please try again", "error");
        throw e;
      } finally {
        set({ isSigning: false });
      }
    },
  };
});

/** @deprecated Use {@link WalletStoreState} — kept as an alias for existing imports. */
export type WalletSliceState = WalletStoreState;

// ── Selectors ─────────────────────────────────────────────────────────────────

/** Returns the connected wallet address, or null when disconnected. */
export const selectWalletAddress = (s: WalletStoreState) => s.address;

/** Returns true while the wallet is being connected for the first time. */
export const selectIsConnecting = (s: WalletStoreState) => s.isConnecting;

/** Returns true during the silent auto-restore on app load. */
export const selectIsAutoConnecting = (s: WalletStoreState) =>
  s.isAutoConnecting;

/** Returns true while a transaction is waiting for wallet signature. */
export const selectIsSigning = (s: WalletStoreState) => s.isSigning;

/** Returns the last wallet error message, or null. */
export const selectWalletError = (s: WalletStoreState) => s.error;

/** Returns true when the in-wallet network does not match the configured network. */
export const selectNetworkMismatch = (s: WalletStoreState) => s.networkMismatch;

/** Returns the Stellar network reported by the wallet extension. */
export const selectWalletNetwork = (s: WalletStoreState) => s.walletNetwork;

/** Returns true when the wallet picker modal should be shown. */
export const selectShowWalletSelect = (s: WalletStoreState) =>
  s.showWalletSelect;

/** Returns true when a wallet is currently connected. */
export const selectIsConnected = (s: WalletStoreState) => s.address !== null;

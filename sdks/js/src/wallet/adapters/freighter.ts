import {
  requestAccess,
  signTransaction,
  getNetworkDetails,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import type { WalletAdapter } from "../types";

/** How often WatchWalletChanges polls the extension, in ms. */
const WALLET_WATCH_INTERVAL_MS = 3000;

/**
 * {@link WalletAdapter} backed by the Freighter browser extension.
 * Requires the extension to be installed; `connect()`/`signTransaction()`
 * reject if it is not.
 */
export const freighterAdapter: WalletAdapter = {
  name: "Freighter",
  async connect() {
    const result = await requestAccess();
    if (result.error) {
      throw new Error(result.error.message ?? "Freighter connection failed");
    }
    return result.address;
  },
  async signTransaction(xdr, networkPassphrase) {
    const result = await signTransaction(xdr, { networkPassphrase });
    if (result.error) {
      throw new Error(result.error.message ?? "Signing failed");
    }
    return result.signedTxXdr;
  },
  async getNetwork() {
    try {
      const result = await getNetworkDetails();
      // A network read failing is not actionable for the caller — it just means
      // we cannot check for a mismatch, so report "unknown" rather than throw.
      if (result?.error) return null;
      return {
        network: result.network,
        networkPassphrase: result.networkPassphrase,
      };
    } catch {
      return null;
    }
  },
  onAccountChange(callback) {
    const watcher = new WatchWalletChanges(WALLET_WATCH_INTERVAL_MS);
    watcher.watch(({ address, network, networkPassphrase, error }) => {
      if (error) return;
      callback({ address, network, networkPassphrase });
    });
    return () => watcher.stop();
  },
};

/**
 * Wallet connection / session persistence (#1575).
 *
 * App-specific wiring around the shared wallet-connect primitives in
 * `@fund-my-cause/sdk/wallet`. Responsible for storing and clearing the
 * connected address and wallet type. No React, no UI imports.
 */
import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
} from "@fund-my-cause/sdk/wallet";

export const SESSION_KEY = "fmc:wallet_address";
export const SESSION_WALLET_KEY = "fmc:wallet_type";

export const saveSession = saveWalletSession;
export const loadSession = loadWalletSession;
export const clearSession = clearWalletSession;

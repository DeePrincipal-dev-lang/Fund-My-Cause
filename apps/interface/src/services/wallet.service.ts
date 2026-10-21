/**
 * Wallet service — app-specific wiring around the shared wallet-connect
 * primitives in @fund-my-cause/sdk/wallet (session persistence, network
 * matching, error classification). No React, no UI imports. Safe to use in
 * tests and server contexts.
 *
 * Responsibilities, by section below (the file is short, so they stay in one module):
 * - Session: persisting the connected address and wallet type.
 * - Network: checking a wallet's network against the app's passphrase.
 * - Signing: `classifySignError` re-exported for sign-failure handling. Signing itself
 *   happens in the wallet hook, not here, and there is no balance logic in this file.
 */
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
  isNetworkMatch as sdkIsNetworkMatch,
  classifySignError,
  type WalletType,
  type SignErrorKind,
} from "@fund-my-cause/sdk/wallet";

export type { WalletType, SignErrorKind };
export { classifySignError };

export const SESSION_KEY = "fmc:wallet_address";
export const SESSION_WALLET_KEY = "fmc:wallet_type";

// ── Session ───────────────────────────────────────────────────────────────────

export const saveSession = saveWalletSession;
export const loadSession = loadWalletSession;
export const clearSession = clearWalletSession;

// ── Network ───────────────────────────────────────────────────────────────────

export function isNetworkMatch(networkPassphrase: string): boolean {
  return sdkIsNetworkMatch(networkPassphrase, NETWORK_PASSPHRASE);
}

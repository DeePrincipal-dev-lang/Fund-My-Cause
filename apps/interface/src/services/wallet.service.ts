/**
 * Wallet service — app-specific wiring around the shared wallet-connect
 * primitives in @fund-my-cause/sdk/wallet (session persistence, network
 * matching, error classification). No React, no UI imports. Safe to use in
 * tests and server contexts.
 *
 * Split by responsibility in #1575:
 * - connection (session persistence) → ./wallet/wallet.connection.ts
 * - signing (error classification)    → ./wallet/wallet.signing.ts
 * - balance reads                     → ./wallet/wallet.balance.ts (no public API yet)
 *
 * This file is a thin facade re-exporting the same public API as before, so
 * importers do not need to change.
 */
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { isNetworkMatch as sdkIsNetworkMatch } from "@fund-my-cause/sdk/wallet";

// Session (connection)
export {
  SESSION_KEY,
  SESSION_WALLET_KEY,
  saveSession,
  loadSession,
  clearSession,
} from "./wallet/wallet.connection";

// Signing
export { classifySignError } from "./wallet/wallet.signing";
export type { SignErrorKind } from "./wallet/wallet.signing";
export type { WalletType } from "@fund-my-cause/sdk/wallet";

// Network
export function isNetworkMatch(networkPassphrase: string): boolean {
  return sdkIsNetworkMatch(networkPassphrase, NETWORK_PASSPHRASE);
}

/**
 * Shared Soroban/Horizon client configuration and connection singletons.
 *
 * `getHorizonServer` and `getRpcServer` memoize their respective clients so
 * transaction building, simulation, and submission reuse one connection each
 * instead of constructing a fresh `Horizon.Server`/`SorobanRpc.Server` on
 * every call.
 */

import { Horizon, Networks, rpc as SorobanRpc } from "@stellar/stellar-sdk";

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
export const RPC_URL = SOROBAN_RPC_URL;
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

const CONTRACT_IDS: string[] = (
  process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

/**
 * Returns all known campaign contract IDs from environment variables.
 * Used for static site generation fallback.
 */
export function getStaticCampaignIds(): string[] {
  return [...CONTRACT_IDS];
}

let horizonServer: Horizon.Server | null = null;

/** Returns the shared Horizon server instance, constructed once per client lifetime. */
export function getHorizonServer(): Horizon.Server {
  horizonServer ??= new Horizon.Server(HORIZON_URL);
  return horizonServer;
}

let rpcServer: SorobanRpc.Server | null = null;

/** Returns the shared Soroban RPC server instance, constructed once per client lifetime. */
export function getRpcServer(): SorobanRpc.Server {
  rpcServer ??= new SorobanRpc.Server(RPC_URL);
  return rpcServer;
}

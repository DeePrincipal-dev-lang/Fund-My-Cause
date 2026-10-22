/**
 * Donation matching example.
 *
 * Shows how a sponsor sets up a 1:1 matching pool, a contributor pledges,
 * and the matched amount is reflected in the campaign stats.
 *
 * Both CREATOR_SECRET and SPONSOR_SECRET must be set in .env.
 * In a real app the sponsor would sign via their own wallet.
 */

import "dotenv/config";
import { FmcClient } from "@fund-my-cause/sdk";
import {
  SOROBAN_RPC_URL,
  NETWORK_PASSPHRASE,
  HORIZON_URL,
  makeSignTx,
  keypairFromSecret,
} from "@fund-my-cause/example-shared";

const CONTRACT_ID  = process.env.CONTRACT_ID!;
const CREATOR_KEY  = process.env.CREATOR_SECRET!;
const SPONSOR_KEY  = process.env.SPONSOR_SECRET!;
const CONTRIB_KEY  = process.env.STELLAR_SECRET!;
const XLM_TOKEN_ID = process.env.XLM_TOKEN_ID!;

const client = new FmcClient({
  contractId:        CONTRACT_ID,
  rpcUrl:            SOROBAN_RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl:        HORIZON_URL,
});

const sponsorAddr = keypairFromSecret(SPONSOR_KEY).publicKey;
const contribAddr = keypairFromSecret(CONTRIB_KEY).publicKey;

// ── 1. Set up 1:1 matching (100 XLM cap) ─────────────────────────────────────
// Note: in production, the creator and sponsor must both sign the transaction.
// Here we sign only with the sponsor key; adjust for your multi-sig flow.

console.log("\n── Setting up 1:1 matching (cap: 100 XLM) ───────────");
const setupHash = await client.setupMatching({
  sponsorAddress: sponsorAddr,
  matchRatioBps:  10_000,
  maxMatchXlm:    100,
  signTx:         makeSignTx(SPONSOR_KEY),
});
console.log("Matching setup tx:", setupHash);

// ── 2. Show matching config ───────────────────────────────────────────────────

const config = await client.getMatchingConfig();
console.log("\nMatching config:", config);

// ── 3. Contribute 10 XLM ─────────────────────────────────────────────────────

console.log("\n── Contributing 10 XLM ──────────────────────────────");
const statsBeforeMatch = await client.getStats();
console.log("Before — raised:", statsBeforeMatch.raisedXlm, "XLM");

await client.contribute({
  contributor: contribAddr,
  amountXlm:  10,
  tokenId:    XLM_TOKEN_ID,
  signTx:     makeSignTx(CONTRIB_KEY),
});

// ── 4. Verify matched amount appears in stats ─────────────────────────────────

const statsAfter = await client.getStats();
console.log("\nAfter contribution + matching:");
console.log("  Raised:        ", statsAfter.raisedXlm, "XLM  (10 contrib + 10 match)");
console.log("  Total matched: ", await client.getTotalMatched(), "XLM");
console.log("  Pool remaining:", await client.getMatchingPool(), "XLM");

console.log("\nDone.");

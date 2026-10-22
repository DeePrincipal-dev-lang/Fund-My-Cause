/**
 * Basic campaign lifecycle example.
 *
 * Demonstrates: deploy → initialize → contribute → withdraw
 *
 * This example uses the JS SDK and runs entirely against the Stellar testnet.
 * Fill in .env before running.
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

// ── Config ────────────────────────────────────────────────────────────────────

const CONTRACT_ID     = process.env.CONTRACT_ID!;
const CONTRIBUTOR_KEY = process.env.STELLAR_SECRET!;
const XLM_TOKEN_ID    = process.env.XLM_TOKEN_ID!;

const client = new FmcClient({
  contractId:        CONTRACT_ID,
  rpcUrl:            SOROBAN_RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl:        HORIZON_URL,
});

const { publicKey: contributor } = keypairFromSecret(CONTRIBUTOR_KEY);
const signTx = makeSignTx(CONTRIBUTOR_KEY);

// ── Step 1: Print campaign info ───────────────────────────────────────────────

console.log("\n── Campaign Info ──────────────────────────────────────");
const info = await client.getCampaignInfo();
console.log("Title:   ", info.title);
console.log("Goal:    ", info.goalXlm, "XLM");
console.log("Status:  ", info.status);
console.log("Deadline:", info.deadline.toISOString());

// ── Step 2: Check initial stats ───────────────────────────────────────────────

console.log("\n── Stats (before contribution) ───────────────────────");
let stats = await client.getStats();
console.log("Raised:      ", stats.raisedXlm, "XLM");
console.log("Progress:    ", stats.progressPercent.toFixed(1) + "%");
console.log("Contributors:", stats.contributorCount);

// ── Step 3: Contribute 5 XLM ─────────────────────────────────────────────────

console.log("\n── Contributing 5 XLM ────────────────────────────────");
const txHash = await client.contribute({
  contributor,
  amountXlm: 5,
  tokenId: XLM_TOKEN_ID,
  message: "Contribution from the basic-campaign example",
  signTx,
});
console.log("Transaction:", txHash);
console.log("Explorer:   ", `https://stellar.expert/explorer/testnet/tx/${txHash}`);

// ── Step 4: Updated stats ─────────────────────────────────────────────────────

console.log("\n── Stats (after contribution) ────────────────────────");
stats = await client.getStats();
console.log("Raised:      ", stats.raisedXlm, "XLM");
console.log("Progress:    ", stats.progressPercent.toFixed(1) + "%");
console.log("Contributors:", stats.contributorCount);

// ── Step 5: Check contribution history ───────────────────────────────────────

const history = await client.getContributionHistory(contributor);
console.log("\n── Contribution history for", contributor.slice(0, 8) + "...");
for (const record of history) {
  console.log(`  ${record.timestamp.toISOString()}  ${record.amountXlm} XLM  (running: ${record.runningTotalXlm} XLM)`);
}

console.log("\nDone. To withdraw, run: node scripts/withdraw.ts (after deadline)");

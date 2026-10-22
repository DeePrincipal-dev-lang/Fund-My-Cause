/**
 * Campaign list example.
 *
 * Fetches all campaigns from the registry contract, then queries each one
 * for its title, goal, and current raised amount — in parallel.
 */

import "dotenv/config";
import { FmcClient, FmcRegistryClient } from "@fund-my-cause/sdk";
import { SOROBAN_RPC_URL, NETWORK_PASSPHRASE, HORIZON_URL } from "@fund-my-cause/example-shared";

const REGISTRY_ID = process.env.REGISTRY_ID!;

const registry = new FmcRegistryClient({
  contractId: REGISTRY_ID,
  rpcUrl:            SOROBAN_RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl:        HORIZON_URL,
});

// ── Fetch all campaign addresses ──────────────────────────────────────────────

console.log("Fetching campaign list from registry…");
const addresses = await registry.listAll();
console.log(`Found ${addresses.length} campaigns.\n`);

if (addresses.length === 0) {
  console.log("No campaigns registered yet. Deploy one first.");
  process.exit(0);
}

// ── Query each campaign in parallel ──────────────────────────────────────────

const results = await Promise.allSettled(
  addresses.map(async (contractId) => {
    const c = new FmcClient({ contractId, rpcUrl: SOROBAN_RPC_URL, networkPassphrase: NETWORK_PASSPHRASE, horizonUrl: HORIZON_URL });
    const [info, stats] = await Promise.all([c.getCampaignInfo(), c.getStats()]);
    return { contractId, info, stats };
  }),
);

// ── Display ───────────────────────────────────────────────────────────────────

console.log("ID".padEnd(10) + "Title".padEnd(30) + "Raised / Goal".padEnd(22) + "Status");
console.log("─".repeat(75));

for (let i = 0; i < results.length; i++) {
  const result = results[i];
  if (result.status === "rejected") {
    console.log(`  ${addresses[i]?.slice(0, 8)}…  (failed to load: ${result.reason})`);
    continue;
  }
  const { contractId, info, stats } = result.value;
  const progress = `${stats.raisedXlm.toFixed(0)}/${stats.goalXlm.toFixed(0)} XLM`;
  console.log(
    `${contractId.slice(0, 8)}…  `.padEnd(12) +
    info.title.slice(0, 28).padEnd(30) +
    progress.padEnd(22) +
    info.status,
  );
}

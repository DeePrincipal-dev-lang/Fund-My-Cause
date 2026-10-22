/**
 * On-chain event listener example.
 *
 * Polls the Soroban RPC for "contributed" and "matching_sponsor_refunded"
 * events on a campaign contract and prints them to stdout.
 *
 * Usage:
 *   npm start                  # poll every 10 s from latest ledger
 *   npm start -- --from 1234   # start from a specific ledger sequence
 */

import "dotenv/config";
import { rpc, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { SOROBAN_RPC_URL } from "@fund-my-cause/example-shared";

const CONTRACT_ID = process.env.CONTRACT_ID!;
const POLL_MS     = 10_000;

if (!CONTRACT_ID) {
  console.error("CONTRACT_ID is required in .env");
  process.exit(1);
}

const server = new rpc.Server(SOROBAN_RPC_URL);

// Parse --from CLI arg
const fromArg = process.argv.indexOf("--from");
let fromLedger: number | undefined =
  fromArg >= 0 ? Number(process.argv[fromArg + 1]) : undefined;

// Topic filters: listen for all "campaign" events
const campaignTopic = nativeToScVal("campaign", { type: "symbol" }).toXDR("base64");

async function poll() {
  if (fromLedger === undefined) {
    const latest = await server.getLatestLedger();
    fromLedger = latest.sequence;
    console.log(`Starting from ledger ${fromLedger}`);
  }

  const result = await server.getEvents({
    startLedger: fromLedger,
    filters: [
      {
        type: "contract",
        contractIds: [CONTRACT_ID],
        topics: [[campaignTopic, "*"]],
      },
    ],
    pagination: { limit: 100 },
  });

  for (const ev of result.events) {
    const eventType = scValToNative(
      ev.topic[1] ?? ev.topic[0],
    ) as string;

    const data = scValToNative(ev.value);

    switch (eventType) {
      case "contributed": {
        const { contributor, amount, new_total, matched_amount } = data as Record<string, unknown>;
        const xlm = (n: unknown) => (Number(BigInt(n as bigint)) / 1e7).toFixed(2);
        console.log(
          `[ledger ${ev.ledger}] contribution  ` +
          `${(contributor as string).slice(0, 8)}…  ` +
          `+${xlm(amount)} XLM  ` +
          `(total: ${xlm(new_total)} XLM` +
          (Number(BigInt(matched_amount as bigint)) > 0
            ? `  matched: +${xlm(matched_amount)} XLM`
            : "") +
          ")",
        );
        break;
      }

      case "matching_sponsor_refunded": {
        const [sponsor, pool] = data as [string, bigint];
        console.log(
          `[ledger ${ev.ledger}] sponsor refund  ` +
          `${sponsor.slice(0, 8)}…  ` +
          `${(Number(pool) / 1e7).toFixed(2)} XLM returned`,
        );
        break;
      }

      case "withdrawn": {
        const { creator, payout } = data as Record<string, unknown>;
        console.log(
          `[ledger ${ev.ledger}] withdrawn  ` +
          `creator ${(creator as string).slice(0, 8)}…  ` +
          `${(Number(BigInt(payout as bigint)) / 1e7).toFixed(2)} XLM`,
        );
        break;
      }

      default:
        console.log(`[ledger ${ev.ledger}] ${eventType}  ${JSON.stringify(data)}`);
    }
  }

  if (result.events.length > 0) {
    fromLedger = result.events[result.events.length - 1]!.ledger + 1;
  }
}

console.log(`Listening for events on ${CONTRACT_ID}…\n`);

await poll();
setInterval(poll, POLL_MS);

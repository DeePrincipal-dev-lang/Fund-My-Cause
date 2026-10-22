# Troubleshooting Decision Tree

Use the navigation links below to jump directly to the issue category, then follow the branching steps to reach a solution in a few clicks.

---

## Quick Navigation

- [🔌 Wallet Issues](#wallet-issues)
- [🌐 Network & RPC Issues](#network--rpc-issues)
- [⛓️ Transaction Failures](#transaction-failures)
- [🔨 Build & Deploy Errors](#build--deploy-errors)
- [🐳 Docker Issues](#docker-issues)
- [📋 Contract Invocation Errors](#contract-invocation-errors)

---

## Wallet Issues

**Does the wallet connect button do anything?**

```
No — nothing happens at all
└── Is the Freighter extension installed?
    ├── No  → Install Freighter from https://www.freighter.app, then reload
    └── Yes → Is the extension enabled in your browser?
              ├── No  → Enable it in your browser's extension manager, then reload
              └── Yes → Is the page served over https:// (not http://)?
                        ├── No  → Freighter requires HTTPS in production; use localhost or enable HTTPS
                        └── Yes → Hard-reload the tab (Ctrl+Shift+R / Cmd+Shift+R) — required after first install

Yes — modal opens but fails / shows error
└── Are you using Freighter or LOBSTR/WalletConnect?
    ├── Freighter → Go to "Freighter is on the wrong network" below
    └── LOBSTR   → Go to "LOBSTR connection fails" below
```

### Freighter is on the wrong network (buttons disabled after connecting)

**Symptom:** Contribute / Withdraw buttons are greyed out after connecting.

**Decision:**
```
Is NEXT_PUBLIC_NETWORK_PASSPHRASE set correctly in .env.local?
├── Check: grep NEXT_PUBLIC_NETWORK_PASSPHRASE apps/interface/.env.local
│   Expected: Test SDF Network ; September 2015
├── Wrong value → Fix .env.local and restart the dev server
└── Correct → Open Freighter extension → click the network name at top
              → Switch to Testnet (or the network matching your passphrase)
```

### LOBSTR / WalletConnect connection fails

**Symptom:** "No Stellar account returned by LOBSTR" or "Could not parse address from LOBSTR session".

```
Is NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID set in .env.local?
├── No / empty → Get a free project ID at https://cloud.walletconnect.com
│               Add: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
└── Yes → Did you approve the pairing in the LOBSTR app within 60 seconds?
          ├── No / timed out → Disconnect and retry; approve within 60 seconds
          └── Yes → Session may have expired → disconnect, reload, and reconnect
```

### Wallet disconnects on page refresh

This is expected behaviour. The wallet address is stored in `sessionStorage`, which persists across same-tab refreshes but is cleared when the tab is closed. On refresh the session restores automatically; after closing the tab you must reconnect.

---

## Network & RPC Issues

**What symptom are you seeing?**

```
A) Blank page on load / HostError in console
B) "Network error, please try again" toast
C) "Account not found" / getAccount fails
D) 429 Too Many Requests / rate limiting
```

### A) Blank page / HostError

```
Is NEXT_PUBLIC_RPC_URL pointing to a Soroban RPC endpoint?
├── Verify: curl $NEXT_PUBLIC_RPC_URL -X POST \
│     -H "Content-Type: application/json" \
│     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[]}'
│   Expected response: {"result":{"status":"healthy",...}}
├── No response / error → RPC is unreachable; check https://status.stellar.org
│   Use the correct testnet RPC: https://soroban-testnet.stellar.org
└── Horizon URL used by mistake → Replace with Soroban RPC URL:
    NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
```

Reference: [environment-config.md](./environment-config.md)

### B) "Network error, please try again"

```
Is the Stellar network experiencing an outage?
├── Check https://status.stellar.org
├── Outage → Wait and retry when resolved
└── No outage → Are NEXT_PUBLIC_RPC_URL and NEXT_PUBLIC_HORIZON_URL correct?
               ├── No → Fix .env.local; restart the dev server
               └── Yes → Transient error — retry after a few seconds
                         If persistent, try a different RPC endpoint
```

### C) "Account not found" / getAccount fails

```
Has the wallet address been funded on testnet?
├── No → Fund via Friendbot:
│        curl "https://friendbot.stellar.org?addr=<YOUR_ADDRESS>"
│        Or visit: https://laboratory.stellar.org/#account-creator?network=test
└── Yes → Is the address on the correct network (testnet vs mainnet)?
          └── Confirm NEXT_PUBLIC_NETWORK_PASSPHRASE matches your wallet's network
```

### D) Rate limiting / 429 errors

```
Are you using the public Soroban testnet RPC directly?
├── Yes → The public endpoint has rate limits
│         Options:
│         1. Use a dedicated RPC provider
│         2. Run a local RPC node
│         3. Add delay/retry logic in your code
└── Using a private RPC → Check your provider's rate limit documentation
```

---

## Transaction Failures

**What error or behaviour are you seeing?**

```
A) "Transaction cancelled" toast
B) "Submit failed" / sendTransaction returns ERROR
C) "Transaction not confirmed after polling"
D) "This transaction requires a ledger entry restore"
```

### A) "Transaction cancelled" toast

The user clicked "Reject" in the Freighter or LOBSTR signing prompt. No funds were moved. Retry the action and approve in the wallet.

### B) "Submit failed" / sendTransaction returns ERROR

```
Did the RPC reject the transaction envelope?
├── Bad sequence number → Reload the page to refresh the account sequence
├── Insufficient fee   → Ensure the account has ≥ 0.00001 XLM base fee
└── Non-Soroban RPC   → Confirm NEXT_PUBLIC_RPC_URL is a Soroban endpoint
                         (not a plain Horizon URL)
```

### C) "Transaction not confirmed after polling"

The transaction was accepted (`PENDING`) but did not reach `SUCCESS` or `FAILED` within 30 seconds (20 polls × 1.5 s).

```
Steps:
1. Copy the transaction hash from the error details
2. Check on Stellar Expert:
   https://stellar.expert/explorer/testnet/tx/<HASH>
3. Is the transaction confirmed on-chain?
   ├── Yes, SUCCESS  → Reload the campaign page; the state should be updated
   ├── Yes, FAILED   → Read the error details on Stellar Expert; see contract error table below
   └── Still pending → Wait ~30 seconds longer; network may be slow
```

### D) "This transaction requires a ledger entry restore"

```
The contract storage entry has expired (TTL reached zero).
Steps:
1. Wait a few seconds and retry — the app will re-attempt after restore
2. If the issue persists, the deployer must extend the contract TTL:
   stellar contract extend \
     --id <CONTRACT_ID> \
     --network testnet \
     --source <DEPLOYER_ADDRESS> \
     --ledgers-to-extend 500000
```

Reference: [contract-api.md](./contract-api.md)

---

## Build & Deploy Errors

**Which command failed?**

```
A) cargo build
B) deploy.sh
C) App startup ("Missing required environment variable")
D) npm / frontend build
```

### A) cargo build fails

```
Error: "can't find crate for `std`"
└── wasm32-unknown-unknown target is missing
    Fix: rustup target add wasm32-unknown-unknown

Error: "error[E0554]: #![feature] may not be used on the stable release channel"
└── Wrong Rust toolchain
    Fix: Check rust-toolchain.toml and run: rustup show

Error: linker errors on macOS
└── Install Xcode Command Line Tools: xcode-select --install
```

### B) deploy.sh fails

```
Error: "stellar: command not found"
└── Stellar CLI not installed or not in PATH
    macOS:   brew install stellar-cli
    Cargo:   cargo install --locked stellar-cli --features opt
    Guide:   https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli

Error: wrong number of arguments / unexpected behaviour
└── Check argument order (must match exactly):
    ./scripts/deploy.sh \
      <CREATOR_ADDRESS> \
      <TOKEN_ADDRESS> \
      <GOAL_IN_STROOPS> \
      <DEADLINE_UNIX_TIMESTAMP> \
      <MIN_CONTRIBUTION_IN_STROOPS> \
      "<TITLE>" \
      "<DESCRIPTION>" \
      <SOCIAL_LINKS_OR_null> \
      [REGISTRY_CONTRACT_ID]

Error: "account not found" during deploy
└── The creator address has not been funded
    Fund on testnet: curl "https://friendbot.stellar.org?addr=<CREATOR>"
```

### C) App startup fails — "Missing required environment variable"

```
Steps:
1. cp apps/interface/.env.example apps/interface/.env.local
2. Edit .env.local and fill in all required variables:

   Variable                           | Example
   ---------------------------------- | ------------------------------------------
   NEXT_PUBLIC_CONTRACT_ID            | CABC... (56-char contract address)
   NEXT_PUBLIC_RPC_URL                | https://soroban-testnet.stellar.org
   NEXT_PUBLIC_NETWORK_PASSPHRASE     | Test SDF Network ; September 2015
   NEXT_PUBLIC_HORIZON_URL            | https://horizon-testnet.stellar.org

3. Restart the dev server: npm run dev
```

Reference: [environment-config.md](./environment-config.md)

### D) Frontend build / npm errors

```
Error: "Cannot find module" or TypeScript type errors
└── Are node_modules installed?
    Fix: run `npm install` at the repository root (see [SETUP.md](./SETUP.md#npm-workspaces))

Error: type errors in CI
└── Run locally to see the same errors:
    cd apps/interface && npm run typecheck

Error: lint failures
└── Run locally: cd apps/interface && npm run lint
    Auto-fix many issues: npm run lint -- --fix
```

---

## Docker Issues

**What is the symptom?**

```
A) App starts but shows blank page
B) "Missing required environment variable" in container logs
C) Build fails with "Cannot find module"
D) Container exits immediately with code 1
```

### A & B) Blank page or missing env var in container

`NEXT_PUBLIC_*` variables are inlined at **build time** by Next.js. Passing them only at `docker run` time has no effect.

```
Fix — pass all NEXT_PUBLIC_* vars as build arguments:

docker build \
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CABC... \
  --build-arg NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org \
  --build-arg NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
  --build-arg NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org \
  -f apps/interface/Dockerfile \
  -t fund-my-cause .

Or with Docker Compose:
  1. Fill in apps/interface/.env.local
  2. docker compose up --build
```

Reference: [docker.md](./docker.md)

### C) Docker Compose build fails — "Cannot find module"

Stale or wrong-architecture `node_modules` from a previous build.

```bash
docker compose down --volumes
docker compose build --no-cache
docker compose up
```

### D) Container exits with code 1

```bash
# Check logs for the actual error
docker compose logs interface
# or
docker logs <container_id>

# Most common cause: missing environment variable (see A & B above)
```

---

## Contract Invocation Errors

The contract returns typed errors as `ContractError(N)` in simulation diagnostics.

| Code | Name | Triggered by | Fix |
|------|------|--------------|-----|
| 1 | `AlreadyInitialized` | Calling `initialize` on an already-initialized contract | Deploy a new contract instance |
| 2 | `CampaignEnded` | Contributing after the deadline | The campaign is closed |
| 3 | `CampaignStillActive` | Calling `withdraw` or `refund_single` before the deadline | Wait until the deadline passes |
| 4 | `GoalNotReached` | Calling `withdraw` when `total_raised < goal` | Goal was not met; contributors should call `refund_single` |
| 5 | `GoalReached` | Calling `refund_single` when the goal was met | Goal was met; creator should call `withdraw` |
| 6 | `Overflow` | Contribution would overflow `i128` | Extremely unlikely in practice |
| 7 | `NotActive` | State-changing function called when status ≠ `Active` | Check campaign status first |
| 8 | `InvalidFee` | Platform `fee_bps` > 10,000 | Use a value between 0 and 10,000 |
| 9 | `BelowMinimum` | Contribution < `min_contribution` | Increase the contribution amount |
| 10 | `InvalidDeadline` | `deadline` ≤ current ledger timestamp | Use a future Unix timestamp |
| 11 | `CampaignPaused` | Contributing while paused | Wait for the creator to unpause |
| 12 | `InvalidGoal` | `goal` ≤ 0 | Use a positive goal value |
| 13 | `TokenNotAccepted` | Contributing with a non-whitelisted token | Use the campaign's accepted token |

**Parsing contract errors in frontend code:**

```ts
const match = raw.match(/ContractError\((\d+)\)/);
if (match) {
  const code = Number(match[1]); // map to the table above
}
```

Full error reference: [docs/api/errors.md](./api/errors.md)

---

## Still Stuck?

1. Search existing issues: [github.com/Fund-My-Cause/Fund-My-Cause/issues](https://github.com/Fund-My-Cause/Fund-My-Cause/issues)
2. Check the [architecture overview](./architecture.md) to understand how components interact
3. Open a new issue with the exact error message, steps to reproduce, and your environment details

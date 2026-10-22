# Contract Playground

> **Maintenance status:** Active — scripts are kept in sync with the deployed
> Soroban contract ABI and tested on every CI run via
> `playground/scripts/__tests__/playground.test.ts`.  They use the
> `@stellar/stellar-sdk` Soroban RPC directly (not the JS SDK) so they remain
> useful for raw contract introspection independent of the higher-level
> `@fund-my-cause/sdk` client.

An interactive environment for exploring Fund-My-Cause contract functions against the Stellar **testnet** — no local Rust toolchain needed.

## Options

### 1. Stellar Laboratory (zero setup)

The [Stellar Laboratory](https://laboratory.stellar.org/#contract-explorer?network=testnet) lets you invoke any Soroban contract function directly in the browser.

1. Open the lab and paste your `CONTRACT_ID`.
2. Select a function from the dropdown (e.g. `get_stats`, `contribute`).
3. Fill in the parameters and click **Run**.

### 2. Local playground (Node.js)

```bash
cd playground
npm install
cp .env.example .env
# Fill in CONTRACT_ID and STELLAR_SECRET in .env
node scripts/run.js
```

### 3. VS Code REST Client

If you use [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client), open `playground/requests.http` and click **Send Request** on any block.

---

## What's in this directory

| File | Purpose |
|------|---------|
| `scripts/run.js` | Interactive CLI menu for calling contract functions |
| `scripts/query.js` | Read-only queries — no wallet required |
| `scripts/contribute.js` | Send a testnet contribution |
| `requests.http` | REST Client snippets for Soroban RPC calls |
| `.env.example` | Environment variable template |

---

## Quick commands

```bash
# Query stats (no wallet needed)
node scripts/query.js stats

# Query a contributor's balance
node scripts/query.js contribution G...

# Send a 5 XLM contribution (needs STELLAR_SECRET in .env)
node scripts/contribute.js 5
```

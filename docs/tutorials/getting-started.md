# Getting Started with Fund-My-Cause

This guide walks you from zero to a running local environment in about 15 minutes.

## 1. Clone the repository

```bash
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause
```

## 2. Install dependencies

Follow **[docs/SETUP.md](../SETUP.md)** once from the repository root. The root
npm workspace install covers the frontend, services, SDKs, and shared packages:

```bash
npm install
```

## 3. Get a testnet account

Create a funded testnet keypair at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=testnet) and note the **secret key** (starts with `S`).

## 4. Deploy contracts to testnet

```bash
export CREATOR=<YOUR_TESTNET_PUBLIC_KEY>
export TOKEN=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC  # testnet XLM

DEADLINE=$(date -v+30d +%s 2>/dev/null || date -d "+30 days" +%s)

./scripts/deploy.sh "$CREATOR" "$TOKEN" 1000000000 "$DEADLINE" \
  10000000 "My First Campaign" "Testing Fund-My-Cause" null
```

The script prints:
```
Contract ID: C...
Registry ID: C...
```

Save both values.

## 5. Configure the frontend

```bash
cp apps/interface/.env.example apps/interface/.env.local
```

Edit `.env.local`:
```bash
NEXT_PUBLIC_CONTRACT_ID=<CONTRACT_ID from step 4>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<REGISTRY_ID from step 4>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

## 6. Run the frontend

```bash
cd apps/interface
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Connect Freighter (make sure it's set to **Testnet**), find your campaign, and try a contribution.

## 7. Verify the deployment

```bash
# Query your campaign stats
stellar contract invoke \
  --id <CONTRACT_ID> --network testnet \
  -- get_stats
```

Expected output:
```json
{"total_raised":0,"goal":1000000000,"progress_bps":0,"contributor_count":0,...}
```

## Next steps

- [Create your first campaign →](./create-campaign.md)
- [Accept contributions in your app →](./accept-contributions.md)
- [Full contract API reference →](../api/crowdfund.md)

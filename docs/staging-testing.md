# Staging Environment Testing Guide

## Overview

The staging environment is automatically deployed to Stellar Testnet when changes are pushed to the `develop` branch or when PRs are opened against `develop`.

## Automatic Deployment

- **Trigger**: Push to `develop` or PR to `develop`
- **Network**: Stellar Testnet
- **Contracts**: Automatically deployed and initialized
- **Frontend**: Built with staging configuration

## Testing Procedures

### 1. Setup Freighter Wallet

1. Install [Freighter wallet](https://www.freighter.app/)
2. Switch to **Testnet** network in Freighter settings
3. Fund your testnet account at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)

### 2. Configure Local Environment

After deployment, the CI will comment on your PR with contract addresses. Update your local `.env.local`:

```bash
cp apps/interface/.env.staging apps/interface/.env.local
# Edit .env.local and add the contract IDs from the PR comment
```

### 3. Run Frontend Locally

From the repository root, after following [SETUP.md](./SETUP.md):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Test Campaign Functionality

#### Create Campaign
- Connect wallet via Freighter
- Navigate to "Create Campaign"
- Fill in campaign details
- Submit transaction and approve in Freighter

#### Contribute to Campaign
- Navigate to an active campaign
- Click "Pledge"
- Enter contribution amount (minimum 1 XLM on testnet)
- Approve transaction in Freighter

#### Withdraw Funds (Creator)
- Wait for campaign deadline or goal to be met
- Navigate to your campaign
- Click "Withdraw"
- Approve transaction

#### Claim Refund (Contributor)
- For failed campaigns (goal not met)
- Navigate to the campaign
- Click "Claim Refund"
- Approve transaction

### 5. Verify Contract State

Use Stellar CLI to inspect contract state:

```bash
# Get campaign stats
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_stats

# Check total raised
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- total_raised

# Check your contribution
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- contribution \
  --contributor <YOUR_ADDRESS>
```

## Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Network | Testnet | Mainnet |
| Tokens | Test XLM (free) | Real XLM |
| RPC URL | soroban-testnet.stellar.org | soroban-mainnet.stellar.org |
| Horizon | horizon-testnet.stellar.org | horizon.stellar.org |
| Data Persistence | May be reset | Permanent |

## Troubleshooting

### Transaction Fails
- Ensure you have sufficient testnet XLM
- Check Freighter is on Testnet network
- Verify contract IDs are correct

### Contract Not Found
- Wait for deployment to complete (check Actions tab)
- Verify you're using the latest contract ID from PR comment

### Wallet Connection Issues
- Refresh the page
- Disconnect and reconnect Freighter
- Clear browser cache

## Reporting Issues

If you encounter bugs in staging:

1. Note the contract ID and transaction hash
2. Capture screenshots/error messages
3. Open an issue with the `staging` label
4. Include steps to reproduce

## CI/CD Pipeline

The staging workflow performs:

1. ✅ Build and optimize WASM contracts
2. ✅ Deploy contracts to Testnet
3. ✅ Initialize with test parameters
4. ✅ Build frontend with staging config
5. ✅ Post deployment info to PR comments
6. ✅ Generate deployment summary

View workflow runs in the [Actions tab](../../actions/workflows/deploy-staging.yml).

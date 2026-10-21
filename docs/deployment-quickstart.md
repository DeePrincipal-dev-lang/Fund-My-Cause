# Deployment Quick Start Guide

Fast-track guide for deploying Fund-My-Cause to testnet or mainnet.

## Table of Contents

- [Testnet Deployment (5 minutes)](#testnet-deployment-5-minutes)
- [Mainnet Deployment](#mainnet-deployment)
- [Configuration Guide](#configuration-guide)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

---

## Testnet Deployment (5 minutes)

### Prerequisites

```bash
# Install Stellar CLI
curl https://stellar.org/install-cli | bash

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Clone repository
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause
```

### Step 1: Build Contracts

```bash
# Build WASM binaries
cargo build --release --target wasm32-unknown-unknown

# Verify build
ls -lh target/wasm32-unknown-unknown/release/fund_my_cause.wasm
```

### Step 2: Deploy Using Script

```bash
# Set variables
export CREATOR_ADDRESS="GXXXXXX..."  # Your testnet account
export TOKEN_ADDRESS="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"  # Native XLM
export DEADLINE=$(date -d "+30 days" +%s)

# Run deployment script
./scripts/deploy.sh $CREATOR_ADDRESS $TOKEN_ADDRESS 1000 $DEADLINE 10 \
  "My Campaign" "A great cause" null

# Script will output:
# Contract ID: CXXXXXX...
# Registry ID: CXXXXXX...
```

### Step 3: Configure Frontend

```bash
# Copy environment template
cp apps/interface/.env.example apps/interface/.env.local

# Edit with your contract IDs
cat > apps/interface/.env.local << 'EOF'
NEXT_PUBLIC_CONTRACT_ID="CXXXXXX..."  # From step 2
NEXT_PUBLIC_REGISTRY_CONTRACT_ID="CXXXXXX..."
NEXT_PUBLIC_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon-testnet.stellar.org"
NEXT_PUBLIC_NETWORK_NAME="testnet"
EOF
```

### Step 4: Run Frontend

From the repository root, after following [SETUP.md](./SETUP.md#npm-workspaces):

```bash
npm run dev

# Open http://localhost:3000
```

### Step 5: Test Contribution

1. Install [Freighter Wallet](https://www.freighter.app/)
2. Switch to testnet in Freighter
3. Get testnet XLM from [Stellar Friendbot](https://developers.stellar.org/docs/tools/developer-tools/testnet-details)
4. Connect wallet in app
5. Make a test contribution

---

## Mainnet Deployment

### Prerequisites

- Mainnet account with 50+ XLM
- Stellar CLI installed
- Rust toolchain with wasm32 target
- GitHub account (for verification)

### Step 1: Prepare Account

```bash
# Generate keypair (if needed)
stellar keys generate --network public

# Check balance
stellar account info <YOUR_PUBLIC_KEY> --network public

# Must have at least 10 XLM
```

### Step 2: Set Environment

```bash
# Create .env.mainnet
cat > .env.mainnet << 'EOF'
DEPLOYER_PUBLIC_KEY="GXXXXXX..."
DEPLOYER_SECRET_KEY="SXXXXXX..."
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
RPC_URL="https://soroban-mainnet.stellar.org"
HORIZON_URL="https://horizon.stellar.org"

CREATOR_ADDRESS="GXXXXXX..."
TOKEN_ADDRESS="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
GOAL_STROOPS="10000000000"  # 1000 XLM
DEADLINE_TIMESTAMP="<unix-timestamp>"
MIN_CONTRIBUTION_STROOPS="1000000"  # 0.1 XLM

CAMPAIGN_TITLE="My Campaign"
CAMPAIGN_DESCRIPTION="Help fund this project"
EOF

source .env.mainnet
```

### Step 3: Build and Deploy

```bash
# Build optimized WASM
cargo build --release --target wasm32-unknown-unknown

# Deploy crowdfund contract
CROWDFUND_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fund_my_cause.wasm \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL)

echo "Crowdfund Contract: $CROWDFUND_ID"

# Deploy registry contract
cd contracts/registry
cargo build --release --target wasm32-unknown-unknown
cd ../..

REGISTRY_ID=$(stellar contract deploy \
  --wasm contracts/registry/target/wasm32-unknown-unknown/release/fund_my_cause_registry.wasm \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL)

echo "Registry Contract: $REGISTRY_ID"
```

### Step 4: Initialize Campaign

```bash
# Initialize crowdfund contract
stellar contract invoke \
  --id $CROWDFUND_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL \
  -- initialize \
  --creator $CREATOR_ADDRESS \
  --token $TOKEN_ADDRESS \
  --goal $GOAL_STROOPS \
  --deadline $DEADLINE_TIMESTAMP \
  --min_contribution $MIN_CONTRIBUTION_STROOPS \
  --max_contribution 0 \
  --title "$CAMPAIGN_TITLE" \
  --description "$CAMPAIGN_DESCRIPTION" \
  --social_links null \
  --platform_config null \
  --accepted_tokens null \
  --category Charity \
  --vesting null \
  --penalty_bps null

# Register in registry
stellar contract invoke \
  --id $REGISTRY_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL \
  -- register \
  --campaign_id $CROWDFUND_ID
```

### Step 5: Verify on Stellar Expert

1. Go to https://stellar.expert/explorer/public
2. Search for your contract ID
3. Verify:
   - Contract code is deployed
   - Storage shows correct parameters
   - Events show "initialized"

### Step 6: Deploy Frontend

```bash
# Create production environment
cat > apps/interface/.env.production << 'EOF'
NEXT_PUBLIC_CONTRACT_ID="$CROWDFUND_ID"
NEXT_PUBLIC_REGISTRY_CONTRACT_ID="$REGISTRY_ID"
NEXT_PUBLIC_RPC_URL="https://soroban-mainnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon.stellar.org"
NEXT_PUBLIC_NETWORK_NAME="mainnet"
EOF

# Build from the repository root
npm run build

# Deploy to Vercel (recommended)
npm install -g vercel
vercel --prod
```

---

## Configuration Guide

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_CONTRACT_ID` | Crowdfund contract address | `CXXXXXX...` |
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network | `Test SDF Network ; September 2015` |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Registry contract address | - |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon REST API | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_PINATA_API_KEY` | IPFS image uploads | - |
| `NEXT_PUBLIC_NETWORK_NAME` | Network display name | `testnet` |

### Campaign Parameters

#### Goal and Deadline

```bash
# Goal in stroops (1 XLM = 10,000,000 stroops)
GOAL_STROOPS="10000000000"  # 1000 XLM

# Deadline as Unix timestamp
DEADLINE=$(date -d "+30 days" +%s)
# Or specific date:
DEADLINE=$(date -d "2026-12-31 23:59:59" +%s)
```

#### Minimum Contribution

```bash
# Minimum in stroops
MIN_CONTRIBUTION_STROOPS="1000000"  # 0.1 XLM
```

#### Platform Fee (Optional)

```bash
# Fee in basis points (100 bps = 1%)
PLATFORM_FEE_BPS="250"  # 2.5%

# Fee recipient address
PLATFORM_FEE_ADDRESS="GXXXXXX..."
```

### Network Selection

#### Testnet

```bash
NEXT_PUBLIC_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon-testnet.stellar.org"
```

#### Mainnet

```bash
NEXT_PUBLIC_RPC_URL="https://soroban-mainnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon.stellar.org"
```

---

## Troubleshooting

### "Insufficient balance for transaction"

```bash
# Check account balance
stellar account info <YOUR_PUBLIC_KEY> --network testnet

# Get testnet XLM
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"

# For mainnet, buy XLM from exchange
```

### "Contract not found"

```bash
# Verify contract ID is correct
stellar contract info <CONTRACT_ID> --network testnet

# Check contract was deployed to correct network
# Testnet contracts start with C and are on testnet
# Mainnet contracts start with C and are on mainnet
```

### "Invalid parameter"

```bash
# Verify deadline is in future
date +%s  # Current timestamp
echo $DEADLINE  # Your deadline

# Verify goal is positive
echo $GOAL_STROOPS  # Should be > 0

# Verify addresses are valid
stellar account info $CREATOR_ADDRESS --network testnet
```

### "WASM validation failed"

```bash
# Rebuild WASM
cargo clean
cargo build --release --target wasm32-unknown-unknown

# Check Rust version
rustc --version  # Should match rust-toolchain.toml (1.91.0)

# Check for compilation errors
cargo build --release --target wasm32-unknown-unknown 2>&1 | head -20
```

### "Transaction timeout"

```bash
# Increase timeout
stellar contract invoke ... --timeout 300

# Check RPC endpoint is responsive
curl https://soroban-testnet.stellar.org/health

# Try different RPC endpoint
# See "Alternative RPC Providers" in deployment.md
```

### Frontend won't connect to contract

```bash
# Verify environment variables
cat apps/interface/.env.local

# Check contract ID is correct
stellar contract info $NEXT_PUBLIC_CONTRACT_ID --network testnet

# Check RPC URL is accessible
curl $NEXT_PUBLIC_RPC_URL/health

# Check browser console for errors
# Open DevTools (F12) and check Console tab
```

---

## Examples

### Example 1: Testnet Campaign (Charity)

```bash
export CREATOR_ADDRESS="GXXXXXX..."
export TOKEN_ADDRESS="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
export GOAL_STROOPS="100000000"  # 10 XLM
export DEADLINE=$(date -d "+14 days" +%s)
export MIN_CONTRIBUTION_STROOPS="100000"  # 0.01 XLM

./scripts/deploy.sh $CREATOR_ADDRESS $TOKEN_ADDRESS 10 $DEADLINE 0.01 \
  "Help Local Food Bank" "Support our community food bank" null
```

### Example 2: Mainnet Campaign (Technology)

```bash
export CREATOR_ADDRESS="GXXXXXX..."
export TOKEN_ADDRESS="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"
export GOAL_STROOPS="50000000000"  # 5000 XLM
export DEADLINE=$(date -d "+90 days" +%s)
export MIN_CONTRIBUTION_STROOPS="10000000"  # 1 XLM

./scripts/deploy.sh $CREATOR_ADDRESS $TOKEN_ADDRESS 5000 $DEADLINE 1 \
  "Build Open Source Stellar Tools" "Help us create better Stellar developer tools" null
```

### Example 3: Campaign with Platform Fee

```bash
# Create platform config JSON
PLATFORM_CONFIG=$(cat <<EOF
{
  "address": "GPLATFORM...",
  "fee_bps": 250
}
EOF
)

# Deploy with fee
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network testnet \
  --rpc-url $RPC_URL \
  -- initialize \
  --creator $CREATOR_ADDRESS \
  --token $TOKEN_ADDRESS \
  --goal 1000000000 \
  --deadline $DEADLINE \
  --min_contribution 10000000 \
  --max_contribution 0 \
  --title "My Campaign" \
  --description "With platform fee" \
  --social_links null \
  --platform_config "$PLATFORM_CONFIG" \
  --accepted_tokens null \
  --category Charity \
  --vesting null \
  --penalty_bps null
```

### Example 4: Campaign with Vesting

```bash
# Create vesting schedule JSON
VESTING=$(cat <<EOF
{
  "cliff": $(date -d "+30 days" +%s),
  "duration": 2592000
}
EOF
)

# Deploy with vesting (30 day cliff, 30 day linear vesting)
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network testnet \
  --rpc-url $RPC_URL \
  -- initialize \
  --creator $CREATOR_ADDRESS \
  --token $TOKEN_ADDRESS \
  --goal 1000000000 \
  --deadline $DEADLINE \
  --min_contribution 10000000 \
  --max_contribution 0 \
  --title "My Campaign" \
  --description "With vesting" \
  --social_links null \
  --platform_config null \
  --accepted_tokens null \
  --category Charity \
  --vesting "$VESTING" \
  --penalty_bps null
```

---

## Next Steps

1. **Monitor Campaign** — Check stats regularly
   ```bash
   stellar contract invoke --id $CONTRACT_ID --network testnet -- get_stats
   ```

2. **Share Campaign** — Promote to potential contributors

3. **Handle Contributions** — Process withdrawals or refunds

4. **Post-Campaign** — Archive and analyze results

---

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org)
- [Soroban Documentation](https://soroban.stellar.org)
- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Stellar Expert](https://stellar.expert)
- [Full Deployment Guide](./deployment.md)

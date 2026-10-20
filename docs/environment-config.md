# Multi-Environment Configuration Management

## Overview

Fund-My-Cause supports three environments with distinct configurations:

- **Development**: Local development with testnet
- **Staging**: Pre-production testing on testnet (CI/CD)
- **Production**: Live deployment on mainnet

## Environment Files

| File | Purpose | Network |
|------|---------|---------|
| `.env.development` | Local development | Testnet |
| `.env.staging` | Staging/CI environment | Testnet |
| `.env.production` | Production deployment | Mainnet |
| `.env.local` | Active configuration (gitignored) | Varies |
| `.env.example` | Template with all variables | N/A |

## Configuration Variables

### Required Variables (single source of truth)

The canonical list of required variables lives in [`scripts/check-env-parity.js`](../scripts/check-env-parity.js) → `REQUIRED_VARS`. Every `.env.*` file must define all of these keys or the env-parity CI check will fail.

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_CROWDFUND_CONTRACT_ID` | Crowdfund contract address | `CABC...XYZ` |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Registry contract address | `CDEF...ABC` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network passphrase | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon REST API endpoint | `https://horizon-testnet.stellar.org` |

> **Adding a new required variable?** Add it to `REQUIRED_VARS` in `scripts/check-env-parity.js` **and** to all `.env.*` files in `apps/interface/`. The CI workflow `.github/workflows/env-parity.yml` will fail on any PR that adds a key in one file without updating the others.

### Optional Variables

```bash
NEXT_PUBLIC_CONTRACT_ID           # Crowdfund contract the UI reads (defaults to a testnet ID)
NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS # Comma-separated extra campaign contracts
NEXT_PUBLIC_NETWORK               # mainnet | testnet
NEXT_PUBLIC_GRAPHQL_URL           # Base URL of services/graphql-api (client appends /graphql)
NEXT_PUBLIC_RPC_URL               # Soroban RPC endpoint alias
NEXT_PUBLIC_PINATA_API_KEY        # IPFS upload key
NEXT_PUBLIC_PINATA_SECRET_API_KEY # IPFS upload secret (read by src/lib/pinata.ts)
NEXT_PUBLIC_ANALYTICS_ENABLED     # Enable/disable analytics (true/false)
NEXT_PUBLIC_ANALYTICS_ID          # Analytics tracking ID
NEXT_PUBLIC_IMAGE_CDN_URL         # CDN origin for responsive images
NEXT_PUBLIC_FEATURED_CAMPAIGNS    # Comma-separated featured campaign IDs
```

### Env Parity Check

Run locally before opening a PR:

```bash
node scripts/check-env-parity.js
```

The check validates that every key in `REQUIRED_VARS` appears in all `.env.*` files and reports any undocumented `NEXT_PUBLIC_*` extras as warnings.

## Quick Start

### Switch to an environment

```bash
# Switch to development
./scripts/switch-env.sh development

# Switch to staging
./scripts/switch-env.sh staging

# Switch to production
./scripts/switch-env.sh production
```

This will:
1. Backup your current `.env.local`
2. Copy the environment file to `.env.local`
3. Validate the configuration
4. Show next steps

### Validate configuration

```bash
# Validate current environment
./scripts/validate-env.sh development

# Validate staging
./scripts/validate-env.sh staging

# Validate production
./scripts/validate-env.sh production
```

## Environment Details

### Development

**Purpose**: Local development and testing

**Configuration**:
```bash
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NODE_ENV=development
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

**Usage**:
```bash
./scripts/switch-env.sh development
cd apps/interface
npm run dev
```

### Staging

**Purpose**: Pre-production testing, CI/CD deployments

**Configuration**:
```bash
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NODE_ENV=production
```

**Deployment**: Automatic via GitHub Actions on `develop` branch

**Testing**: See [docs/staging-testing.md](./staging-testing.md)

### Production

**Purpose**: Live mainnet deployment

**Configuration**:
```bash
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NODE_ENV=production
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

**Deployment**: Manual or via GitHub Actions on `main` branch

**⚠️ Important**: Always validate production config before deployment!

## Secrets Management

### Local Development

Store secrets in `.env.local` (gitignored):

```bash
cp apps/interface/.env.development apps/interface/.env.local
# Edit .env.local with your secrets
```

### CI/CD (GitHub Actions)

Store secrets in GitHub repository settings:

1. Go to Settings → Secrets and variables → Actions
2. Add secrets:
   - `TESTNET_SECRET_KEY` - Deployer key for testnet
   - `MAINNET_SECRET_KEY` - Deployer key for mainnet
   - `PINATA_API_KEY` - IPFS upload key
   - `PINATA_SECRET_KEY` - IPFS upload secret

### Production Deployment

Use environment variables or secrets management service:

```bash
# Docker
docker run -e NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=... fund-my-cause

# Vercel
vercel env add NEXT_PUBLIC_CROWDFUND_CONTRACT_ID production

# AWS/Cloud
# Use AWS Secrets Manager, Parameter Store, etc.
```

## Validation Rules

### All Environments
- ✅ RPC URL must be set
- ✅ Network passphrase must be set
- ✅ Horizon URL must be set

### Production Only
- ✅ Contract IDs must be set
- ✅ Must use mainnet passphrase
- ✅ RPC URL should contain "mainnet"

### Development/Staging
- ✅ Must use testnet passphrase
- ✅ RPC URL should contain "testnet"

## Best Practices

### 1. Never commit secrets
```bash
# .gitignore already includes:
.env.local
.env*.local
```

### 2. Validate before deployment
```bash
./scripts/validate-env.sh production
```

### 3. Use environment-specific values
```typescript
// In code
const isProduction = process.env.NODE_ENV === 'production';
const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
```

### 4. Document new variables
When adding new environment variables:
1. Add to all `.env.*` files
2. Add to `.env.example`
3. Update this documentation
4. Update validation script if required

### 5. Test configuration changes
```bash
# Test development
./scripts/switch-env.sh development
npm run build

# Test staging
./scripts/switch-env.sh staging
npm run build

# Test production
./scripts/switch-env.sh production
npm run build
```

## Troubleshooting

### "Environment file not found"
```bash
# List available environments
ls -1 apps/interface/.env.*

# Create missing environment file
cp apps/interface/.env.example apps/interface/.env.development
```

### "Missing required variables"
```bash
# Check which variables are missing
./scripts/validate-env.sh development

# Edit the environment file
nano apps/interface/.env.development
```

### "Wrong network passphrase"
```bash
# Development/Staging should use:
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Production should use:
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

### Contract not found
```bash
# Ensure contract IDs are set
grep CONTRACT_ID apps/interface/.env.local

# Deploy contracts if missing
./scripts/deploy.sh ...
```

## CI/CD Integration

### GitHub Actions

Workflows automatically use the correct environment:

```yaml
# Staging deployment
- name: Build frontend
  env:
    NEXT_PUBLIC_CROWDFUND_CONTRACT_ID: ${{ needs.deploy-contracts.outputs.contract_id }}
    NEXT_PUBLIC_SOROBAN_RPC_URL: https://soroban-testnet.stellar.org
  run: npm run build
```

### Environment-specific workflows

- `deploy-staging.yml` - Uses staging config
- `deploy-testnet.yml` - Uses testnet config
- `deploy-mainnet.yml` - Uses production config

## Migration Guide

### From single .env to multi-environment

```bash
# 1. Backup current config
cp apps/interface/.env.local apps/interface/.env.local.backup

# 2. Create environment files
cp apps/interface/.env.example apps/interface/.env.development
cp apps/interface/.env.example apps/interface/.env.staging
cp apps/interface/.env.example apps/interface/.env.production

# 3. Fill in values for each environment

# 4. Switch to desired environment
./scripts/switch-env.sh development
```

## Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Stellar Networks](https://developers.stellar.org/docs/networks)
- [Soroban RPC](https://developers.stellar.org/docs/data/rpc)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

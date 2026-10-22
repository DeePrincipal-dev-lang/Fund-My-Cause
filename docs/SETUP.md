# Fund-My-Cause Local Development Setup Guide

> **Single source of truth for onboarding and local development across all monorepo workspaces.**

Fund-My-Cause is a monorepo consisting of Soroban smart contracts, a Next.js frontend, Node.js microservices, Python scoring engines, and shared TypeScript libraries. This guide covers environment configuration, installation, contract compilation, and service startup for all components.

---

## Table of Contents

1. [Monorepo Architecture Overview](#monorepo-architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quickstart (5-Minute Setup)](#quickstart-5-minute-setup)
4. [Workspace Setup & Execution](#workspace-setup--execution)
   - [Contracts (`contracts/`)](#1-smart-contracts-contracts)
   - [Frontend (`apps/interface`)](#2-frontend-application-appsinterface)
   - [GraphQL API Service (`services/graphql-api`)](#3-graphql-api-service-servicesgraphql-api)
   - [Indexer Service (`services/indexer`)](#4-blockchain-indexer-servicesindexer)
   - [Monitoring Service (`services/monitoring-service`)](#5-monitoring-service-servicesmonitoring-service)
   - [Python Engines (`backend/`)](#6-backend-python-services-backend)
   - [SDKs & Packages (`sdks/`, `packages/`)](#7-sdks--shared-packages)
5. [Root Scripts Reference](#root-scripts-reference)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Docker & Containerized Stack](#docker--containerized-stack)
8. [Testing & Quality Checks](#testing--quality-checks)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Monorepo Architecture Overview

```
Fund-My-Cause/
├── apps/
│   ├── interface/              # Next.js 16 App Router UI (Tailwind CSS, Freighter)
│   └── components-lib/         # Shared UI React component library
├── backend/
│   ├── fraud_detection/        # Python pipeline for Sybil & donation fraud detection
│   └── recommendations/        # Python campaign ranking & scoring engine
├── contracts/
│   ├── crowdfund/              # Core crowdfunding Soroban smart contract (Rust)
│   ├── registry/               # Campaign registry & discovery contract (Rust)
│   ├── achievements/           # Gamification / NFT badges contract (Rust)
│   ├── qf/                     # Quadratic-funding calculation contract (Rust)
│   ├── common/                 # Shared error / access-control / events crate
│   └── benchmarks/             # Criterion benches (excluded from the workspace)
├── packages/
│   ├── shared-utils/           # Cross-package utility functions & logging helpers
│   └── types/                  # Shared TypeScript data models & schemas
├── sdks/
│   └── js/                     # JavaScript/TypeScript SDK for contract interaction
├── services/
│   ├── graphql-api/            # Apollo Server 4 GraphQL API with Redis caching & WS
│   ├── indexer/                # Soroban RPC event listener & ingestion daemon
│   └── monitoring-service/     # APM, metrics exporter, and health monitoring
└── docker-compose.yml          # Local Stellar quickstart + frontend/indexer containers
```

---

## Prerequisites

Ensure the following tools are installed on your machine. The repository's `rust-toolchain.toml` pins Rust 1.91.0 and declares the `wasm32-unknown-unknown` target, so rustup installs both when you run any `cargo` command in the repo.

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | 20.x or higher | Frontend, services, SDKs | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **npm** | 9.x or higher | Monorepo package management | Included with Node.js |
| **Rust & Cargo** | 1.91.0 | Smart contract compilation | [rustup.rs](https://rustup.rs) — `rust-toolchain.toml` pins the exact version |
| **wasm32 target** | Latest | WebAssembly contract target | Installed automatically from `rust-toolchain.toml` |
| **Stellar CLI** | 21.0+ | Contract deployment & RPC | `cargo install --locked stellar-cli --features opt` |
| **Python** | 3.10+ | Backend fraud & recommendation | [python.org](https://python.org) |
| **Docker & Compose** | Latest | PostgreSQL & Redis services | [docker.com](https://www.docker.com/) |
| **Freighter Wallet** | Latest | Browser extension for Stellar auth | [freighter.app](https://www.freighter.app/) |

---

## Quickstart (5-Minute Setup)

For contributors wanting to get up and running immediately with mock data:

```bash
# 1. Clone the repository
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause

# 2. Install monorepo dependencies
npm install

# 3. Build smart contracts into WASM (crowdfund crate — see Root Scripts Reference)
npm run contracts:build

# 4. Generate local test fixtures
npm run fixtures:generate

# 5. Start the frontend
npm run dev
```

Visit `http://localhost:3000` to interact with the UI using local mock data.

### npm workspaces

This repository uses **npm workspaces**. Run `npm install` once at the repository
root: it installs dependencies for `apps/*`, `packages/*`, `sdks/*`, and
`services/*`. Do not run a separate install inside an individual workspace; doing
so creates a nested dependency tree and can hide version mismatches. Use the
root `package-lock.json` as the source of truth for resolved versions.

Every root script is described in [Root Scripts Reference](#root-scripts-reference);
per-workspace startup (GraphQL API, indexer, monitoring, Python engines) is in
[Workspace Setup & Execution](#workspace-setup--execution).

---

## Workspace Setup & Execution

### 1. Smart Contracts (`contracts/`)

Contracts are written in Rust for the Stellar Soroban runtime.

#### Build

> **Note:** `npm run contracts:build` pins `--manifest-path contracts/crowdfund/Cargo.toml`,
> so it compiles **only the `crowdfund` crate** (this is also what
> `.github/workflows/contract.yml` does — it builds each deployable contract
> with its own `--manifest-path`). Use the `--workspace` form below when you
> need every crate.

```bash
# Build the crowdfund contract (what `npm run contracts:build` does)
npm run contracts:build

# Build every workspace member (crowdfund, registry, achievements, qf, common)
cargo build --release --target wasm32-unknown-unknown --workspace

# Or build a single contract directly
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/registry/Cargo.toml
```

WASM artifacts are generated in `target/wasm32-unknown-unknown/release/`.

#### Run Contract Tests
```bash
# Run unit & integration tests across all Rust crates
npm run contracts:test
```

#### WASM Size Budget
The release `crowdfund` WASM is kept under a documented size budget so it cannot
grow unnoticed. The budget lives in `scripts/check_wasm_size.py` (see
[contracts/crowdfund/README.md](../contracts/crowdfund/README.md) for the current
limit and rationale).

```bash
# Build the release WASM, then check it against the budget
npm run contracts:build
make contracts-size
```

`make contracts-size` runs `scripts/check_wasm_size.py` against
`target/wasm32-unknown-unknown/release/crowdfund.wasm` and **exits non-zero when
the artifact exceeds the budget**. Run it before opening a PR that touches the
contract; if your change legitimately needs more space, raise the budget in the
same PR and explain why.

#### Deploying & Seeding Testnet
```bash
# Generate a testnet account and fund it via Friendbot
stellar keys generate --network testnet --name dev-deployer
stellar keys address dev-deployer

# Set credentials
export CREATOR=$(stellar keys address dev-deployer)
export TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Seed testnet with sample campaigns and generate apps/interface/.env.local
npm run seed:testnet -- --creator "$CREATOR" --token "$TOKEN"

# Equivalent (the npm script wraps this file)
./scripts/seed-testnet.sh --creator "$CREATOR" --token "$TOKEN"
```

---

### 2. Frontend Application (`apps/interface`)

Next.js 16 application with Tailwind CSS and Stellar Freighter wallet integration.

#### Configuration
```bash
cp apps/interface/.env.example apps/interface/.env.local
```

Key `.env.local` variables (the names the app actually reads — see
`apps/interface/src/lib/constants.ts`, `src/lib/soroban/client.ts`, and
`src/lib/graphql/client.ts`):
```env
NEXT_PUBLIC_NETWORK=testnet                       # mainnet | testnet
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ID=C...                      # crowdfund contract, generated by seed script
NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS=C...,C...       # comma-separated extra campaign contracts
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000
```

#### Running Dev Server
```bash
# From monorepo root
npm run dev

# Or directly in workspace
npm run dev --workspace=apps/interface
```
Access at `http://localhost:3000`.

---

### 3. GraphQL API Service (`services/graphql-api`)

Apollo Server 4 / Express service providing query aggregation, Redis caching, and WebSocket subscriptions.

#### Infrastructure Dependency
Start Redis (the service exits if Redis is unreachable; the in-memory fallback
is only reachable from unit tests):
```bash
docker compose -f docker-compose.full.yml up -d redis
```

#### Configuration
```bash
cp services/graphql-api/.env.example services/graphql-api/.env
```

Ensure `JWT_SECRET` is at least 32 characters long and not a default value.
The service reads **`GRAPHQL_PORT`** (not `PORT`); the default is `4000`.
Key variables read by the service:
```env
GRAPHQL_PORT=4000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_NETWORK=testnet
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long_12345
CURSOR_SECRET=dev-cursor-secret-changeme
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
LOG_LEVEL=info
REGISTRY_CONTRACT_ID=
FRAUD_DETECTION_URL=http://localhost:8000
```

#### Running GraphQL Service

This service does **not** load `.env` automatically. Export the file into your
shell, then start it with `tsx` (the packaged `dev` script is currently broken):
```bash
set -a
source services/graphql-api/.env
set +a

cd services/graphql-api
npx tsx src/index.ts
```
GraphQL Playground / Endpoint: `http://localhost:4000/graphql`  
Health check: `http://localhost:4000/health`

#### Generate Schema Documentation
```bash
npm run docs:generate --workspace=services/graphql-api
```

---

### 4. Blockchain Indexer (`services/indexer`)

Event listener and ingestion daemon that scans Soroban contract events into an
**in-memory** event store. There is no database: `src/repository.ts` is backed by
`EventStore`, and there is intentionally no `DATABASE_URL` to configure (see
[services/indexer/README.md](../services/indexer/README.md)).

#### Configuration
```bash
cp services/indexer/.env.example services/indexer/.env
```
All keys below come from `services/indexer/.env.example`:
```env
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
CROWDFUND_CONTRACT_ID=C...
REGISTRY_CONTRACT_ID=C...       # optional — only if ingesting registry events
PORT=3001
LOG_LEVEL=info
```

#### Running Indexer
```bash
npm run dev --workspace=services/indexer
```
Health check: `http://localhost:3001/health` (also `/healthz`, `/readyz`)

---

### 5. Monitoring Service (`services/monitoring-service`)

Metrics aggregator, health monitor, and Prometheus-compatible exporter with
optional PagerDuty incident creation.

#### Configuration & Startup

This service does **not** load `.env` automatically, so export it before starting:
```bash
cp services/monitoring-service/.env.example services/monitoring-service/.env
set -a
source services/monitoring-service/.env
set +a
npm run dev --workspace=services/monitoring-service
```
The port comes from `PORT` (default **9091**; the example file sets `9091`):
```env
PORT=9091
PAGERDUTY_API_KEY=your-pagerduty-api-key
PAGERDUTY_SERVICE_ID=your-pagerduty-service-id
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
```
Endpoints: `http://localhost:9091/metrics`, `/health`, `/healthz`, `/readyz`

---

### 6. Backend Python Services (`backend/`)

Python modules for fraud detection and quadratic funding / campaign recommendation scoring.

#### Setup Virtual Environment
```bash
# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate # Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r backend/fraud_detection/requirements.txt
pip install -r backend/recommendations/requirements.txt
```

#### Running Recommendations Engine
```bash
python backend/recommendations/service.py
```

#### Running Python Tests
```bash
pytest backend/fraud_detection/
pytest backend/recommendations/
```

---

### 7. SDKs & Shared Packages

When modifying `@fund-my-cause/sdk`, `@fund-my-cause/types`, or `@fund-my-cause/shared-utils`:

```bash
# Build shared types
cd packages/types && npm run build

# Build shared utilities
cd packages/shared-utils && npm run build

# Build JavaScript SDK
cd sdks/js && npm run build
```

---

## Root Scripts Reference

Every script defined in the root `package.json`, run from the repository root:

| Script | Command | What it does |
|--------|---------|--------------|
| `npm run dev` | `npm run dev --workspace=apps/interface` | Starts the Next.js dev server on `:3000` (the root script only launches the frontend — start each service with `npm run dev --workspace=<name>`) |
| `npm run build` | `npm run build --workspace=apps/interface` | Production build of the frontend |
| `npm run lint` | `npm run lint --workspace=apps/interface` | ESLint over the frontend workspace |
| `npm run contracts:build` | `cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml` | Builds the **`crowdfund`** contract only (see [Build](#build)) |
| `npm run contracts:test` | `cargo test --workspace` | All Rust tests across every contract crate |
| `npm run test:e2e` | `playwright test` | Playwright end-to-end suite (run `npx playwright install` once) |
| `npm run fixtures:generate` | `npx ts-node scripts/generate-fixtures.ts` | Generates mock data for UI work without a chain |
| `npm run seed:testnet` | `bash scripts/seed-testnet.sh` | Deploys/seeds testnet campaigns and writes `apps/interface/.env.local`; pass args after `--` |
| `npm run format` | `cd apps/interface && npx prettier --write` | Prettier across the frontend workspace |
| `npm run prepare` | `which husky … && husky \|\| true` | Installs git hooks (`lint-staged`) after `npm install` |

Workspace-scoped scripts are run with `npm run <script> --workspace=<dir>`,
e.g. `npm run dev --workspace=services/indexer`. Each service also exposes
its own scripts — see that service's `package.json`.

---

## Environment Variables Reference

Each workspace ships a `.env.example`; copy it to the file named below and fill
in real values.

| Workspace | Copy to | Key variables | Description |
|-----------|---------|---------------|-------------|
| **Root** | `.env` | `DATABASE_URL`, `REDIS_URL`, `COMPOSE_PROJECT_NAME`, `JWT_SECRET` | Docker Compose + shared infrastructure config |
| **`apps/interface`** | `.env.local` | `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_HORIZON_URL`, `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS`, `NEXT_PUBLIC_GRAPHQL_URL` | Frontend contract IDs, network, GraphQL endpoint |
| **`services/graphql-api`** | `.env` | `GRAPHQL_PORT`, `REDIS_URL`, `RPC_URL`, `CONTRACT_NETWORK`, `JWT_SECRET` (>=32 chars), `CURSOR_SECRET`, `CORS_ORIGIN` | Apollo server, auth signing, pagination cursors |
| **`services/indexer`** | `.env` | `SOROBAN_RPC_URL`, `CROWDFUND_CONTRACT_ID`, `REGISTRY_CONTRACT_ID` (optional), `PORT`, `LOG_LEVEL` | Event ingestion (in-memory store — no database URL) |
| **`services/monitoring-service`** | `.env` | `PORT` (default 9091), `PAGERDUTY_API_KEY`, `PAGERDUTY_SERVICE_ID`, `PAGERDUTY_INTEGRATION_KEY` | Metrics, health endpoints, PagerDuty incidents |
| **`backend/`** | — | `LOG_LEVEL`, `LOG_FORMAT` (optional) | Python services read env directly; there is no `.env.example` yet |
| **`playground/`, `examples/*`, `performance/`** | `.env` | See each directory's `.env.example` | Standalone demos and benchmarks |

`services/indexer` loads `.env` automatically. `services/graphql-api` and
`services/monitoring-service` do not — export those files into your shell with
`set -a; source <file>; set +a` before starting them.

---

## Docker & Containerized Stack

The root `docker-compose.yml` starts the frontend and a local Stellar quickstart
node; the indexer is an optional profile. PostgreSQL and Redis live in
`docker-compose.full.yml`.

```bash
# Start backing services used by the GraphQL API (and optional Postgres)
docker compose -f docker-compose.full.yml up -d redis

# Start the frontend plus local Stellar node
docker compose up --build

# Include the indexer container as well
docker compose --profile indexer up --build
```

For backend services, see the per-service sections above; run them with
`npm run dev --workspace=<service>` after completing the setup in this guide.

---

## Testing & Quality Checks

Run the following checks before committing code:

```bash
# 1. Smart Contract Tests
npm run contracts:test

# 2. Frontend Linting & Typecheck
npm run lint --workspace=apps/interface

# 3. End-to-End Tests (Playwright)
npm run test:e2e

# 4. Secret Scan & Git Hooks
npx lint-staged
```

---

## Troubleshooting Guide

### 1. `stellar: command not found` or `soroban: command not found`
- **Cause**: The Stellar CLI binary is not in your system `$PATH`.
- **Solution**: Install via Cargo:
  ```bash
  cargo install --locked stellar-cli --features opt
  ```
  Ensure `~/.cargo/bin` is in your `PATH` (`export PATH="$HOME/.cargo/bin:$PATH"`).

### 2. `error[E0463]: can't find crate for 'core' target 'wasm32-unknown-unknown'`
- **Cause**: WebAssembly compilation target is missing in your Rust toolchain.
- **Solution**:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```

### 3. `JWT_SECRET must be at least 32 characters for secure operation`
- **Cause**: `services/graphql-api` validates `JWT_SECRET` on startup and rejects empty, short (<32 chars), or example default keys.
- **Solution**: Generate a strong 32+ character key, put it in
  `services/graphql-api/.env`, and export the file before starting the service:
  ```bash
  openssl rand -hex 32
  set -a; source services/graphql-api/.env; set +a
  ```

### 4. `Redis Connection Error / ECONNREFUSED 127.0.0.1:6379`
- **Cause**: Redis server is not running.
- **Solution**: Start Redis using the compose file that defines it:
  ```bash
  docker compose -f docker-compose.full.yml up -d redis
  ```
  `services/graphql-api` requires Redis at startup; the in-memory fallback is
  only used by unit tests.

### 5. Frontend shows "No campaigns found" or "Contract not found"
- **Cause**: `.env.local` contains placeholder contract IDs or testnet contracts were not deployed.
- **Solution**:
  - For mock UI development: Run `npm run fixtures:generate`
  - For real testnet interaction: Run `./scripts/seed-testnet.sh` to populate fresh testnet contract IDs into `apps/interface/.env.local`.

### 6. Friendbot funding failure
- **Cause**: Stellar Friendbot rate limiting or network congestion.
- **Solution**: Visit `https://friendbot.stellar.org/?addr=<YOUR_STELLAR_ADDRESS>` in your browser or retry after a few seconds.

### 7. `Error: listen EADDRINUSE :::3000` (or `4000`, `3001`, `9091`)
- **Cause**: A previous dev server is still running, so the port is taken.
- **Solution**: find and stop it, then restart:
  ```bash
  lsof -nP -iTCP:3000 -sTCP:LISTEN     # swap the port as needed
  kill <PID>
  ```
  Ports in use locally: `3000` frontend, `4000` GraphQL API, `3001` indexer,
  `9091` monitoring service.

### 8. Playwright: `Executable doesn't exist .../chromium-.../chrome-linux/chrome`
- **Cause**: `npm run test:e2e` needs browser binaries that `npm install` does not download.
- **Solution**:
  ```bash
  npx playwright install
  ```

### 9. `npm install` fails with peer/lockfile errors
- **Cause**: A stale `node_modules` or a nested `node_modules` from installing inside a workspace.
- **Solution**: remove the stale tree and install once from the repository root:
  ```bash
  rm -rf node_modules
  npm install
  ```
  Do not run `npm install` inside `apps/*`, `packages/*`, `sdks/*`, or `services/*`;
  the root workspace install covers all of them.

### 10. A service starts and immediately exits (or complains about missing config)
- **Cause**: The workspace's `.env.example` was never copied to the expected filename.
- **Solution**: copy it — the filenames differ per service:
  ```bash
  cp apps/interface/.env.example apps/interface/.env.local
  cp services/graphql-api/.env.example services/graphql-api/.env
  cp services/indexer/.env.example services/indexer/.env
  cp services/monitoring-service/.env.example services/monitoring-service/.env
  ```
  See [Environment Variables Reference](#environment-variables-reference).

---

## Additional Resources

- [Contributing Guidelines](../CONTRIBUTING.md)
- [Backend Service Notes](./services-local-development.md)
- [System Architecture](./architecture.md)
- [API Reference](./api/README.md)
- [GraphQL API Reference](./api/graphql.md)
- [Security Model](./security-model.md)

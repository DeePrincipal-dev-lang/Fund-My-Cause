# Fund-My-Cause

A decentralized crowdfunding platform built on the [Stellar](https://stellar.org) network using [Soroban](https://soroban.stellar.org) smart contracts. Fund-My-Cause lets anyone create a campaign on-chain, accept contributions in XLM or any Stellar token, and automatically release or refund funds based on whether the goal is met.

[![CI Status](https://github.com/Fund-My-Cause/Fund-My-Cause/workflows/Rust%20CI/badge.svg)](https://github.com/Fund-My-Cause/Fund-My-Cause/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Contract Version](https://img.shields.io/badge/contract-v0.1.0-brightgreen)](./contracts/crowdfund/Cargo.toml)
[![Contract Coverage](https://img.shields.io/badge/contract%20coverage-80%25-green)](https://github.com/Fund-My-Cause/Fund-My-Cause/actions/workflows/contract-coverage.yml)

---

## Roadmap

Check out our public roadmap to see what's coming next!

> [View the Roadmap](./docs/roadmap.md) — see our planned milestones and features.

## Architecture

![System Architecture](./docs/assets/architecture.svg)

### Verified data flow

The diagram below documents how `apps/interface`, `services/*` and `contracts/`
actually talk to each other today — not the idealized design. It explicitly
labels four structural seams: the dual frontend→chain paths, the two
independently-versioned Soroban RPC clients, the type-sharing gap between
services, and the two disconnected alerting stacks.

![Verified data flow across apps/interface, services and contracts](./docs/assets/architecture-data-flow.svg)

> Diagram source (edit this, then re-render): [docs/assets/architecture-data-flow.mmd](./docs/assets/architecture-data-flow.mmd)

> Full component details and data-flow walkthroughs: [docs/architecture.md](./docs/architecture.md)  
> Backend & indexer architecture: [docs/backend-architecture.md](./docs/backend-architecture.md)

---

## How It Works

1. A creator deploys and initializes a campaign with a funding goal, deadline, and minimum contribution.
2. Contributors pledge tokens before the deadline.
3. If the goal is met by the deadline, the creator withdraws the funds (minus an optional platform fee).
4. If the goal is not met, each contributor individually claims their refund via a pull-based model.

---

## Monorepo Structure

```
Fund-My-Cause/
├── apps/
│   └── interface/          # Next.js 16 frontend (TypeScript + Tailwind)
│       ├── src/
│       │   ├── app/        # Next.js App Router pages & layouts
│       │   ├── components/ # UI components (Navbar, ProgressBar, PledgeModal, etc.)
│       │   ├── context/    # WalletContext (Freighter wallet integration)
│       │   ├── lib/        # Soroban contract client helpers
│       │   └── types/      # Shared TypeScript types
│       └── package.json
├── contracts/
│   └── crowdfund/          # Soroban smart contract (Rust)
│       ├── src/
│       │   └── lib.rs      # Core contract logic
│       └── Cargo.toml
│   └── registry/           # Soroban registry contract for campaign discovery
│       ├── src/
│       │   └── lib.rs      # register/list campaign contract IDs
│       └── Cargo.toml
├── scripts/
│   └── deploy.sh           # Automated deploy + initialize script
├── .github/
│   └── workflows/
│       └── rust_ci.yml     # CI: build WASM + run tests
├── Cargo.toml              # Rust workspace config
├── package.json            # Node workspace config
└── README.md
```

---

## Smart Contract

The Soroban contract lives in `contracts/crowdfund/src/lib.rs` and exposes the following interface:

| Function                                                                                                          | Description                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `initialize(creator, token, goal, deadline, min_contribution, title, description, social_links, platform_config)` | Create a new campaign                                                         |
| `contribute(contributor, amount)`                                                                                 | Pledge tokens before the deadline                                             |
| `update_metadata(title, description, social_links)`                                                               | Update campaign metadata if status is Active                                  |
| `withdraw()`                                                                                                      | Creator claims funds after a successful campaign                              |
| `refund_single(contributor)`                                                                                      | Contributor claims their own refund if goal not met                           |
| `get_stats()`                                                                                                     | Returns `CampaignStats` (total raised, progress bps, contributor count, etc.) |
| `total_raised()`                                                                                                  | Current total raised                                                          |
| `goal()`                                                                                                          | Campaign funding goal                                                         |
| `deadline()`                                                                                                      | Campaign deadline (ledger timestamp)                                          |
| `contribution(contributor)`                                                                                       | Contribution amount for a specific address                                    |
| `min_contribution()`                                                                                              | Minimum allowed contribution                                                  |
| `title()` / `description()`                                                                                       | Campaign metadata                                                             |
| `social_links()`                                                                                                  | Campaign social URLs                                                          |
| `version()`                                                                                                       | Contract version number                                                       |

### Pull-based Refund Model

Rather than a single transaction refunding all contributors (which would fail at scale), each contributor calls `refund_single` to claim their own refund. This is gas-efficient, scalable, and avoids a single point of failure.

### Platform Fee

An optional `PlatformConfig` can be set at initialization with a fee in basis points (e.g. `250` = 2.5%). The fee is deducted from the creator's payout on withdrawal and sent to the platform address.

### Contract Upgrades & State Migration

Contracts support in-place bytecode upgrades via Soroban's `update_current_contract_wasm` host function, preserving contract IDs, escrow balances, and active campaign state across releases. For architectural rationale, trade-offs, and migration procedures, see **[ADR-007: Stellar Contract Upgrade Strategy](./docs/adr/ADR-007-stellar-contract-upgrade-strategy.md)** and the **[Contract Upgrade Guide](./docs/contract-upgrades.md)**.

---

## Frontend

The interface is a Next.js 16 app using the App Router, Tailwind CSS v4, and Freighter wallet integration.

Key components:

- `Navbar` — wallet connect/disconnect via Freighter
- `ProgressBar` — visual funding progress
- `CountdownTimer` — live countdown to campaign deadline
- `PledgeModal` — contribution flow with wallet auth

### Wallet Integration

The app uses `@stellar/freighter-api` for wallet connectivity. The `WalletContext` provider wraps the app and exposes `connect`, `disconnect`, `address`, and `signTx`.

---

## Getting Started

Follow **[docs/SETUP.md](./docs/SETUP.md)** for the complete local setup: npm workspaces, the pinned Rust toolchain, Docker Compose, environment files, tests, and per-service startup. This README intentionally does not duplicate those steps.

For container deployment details, see [Docker](#docker) and [docs/docker.md](./docs/docker.md). For testnet deployment, see [docs/deployment.md](./docs/deployment.md).

---

## Docker

> For the full deployment guide — environment variables, multi-stage build details, health checks, production hardening, and troubleshooting — see **[docs/docker.md](./docs/docker.md)**.

### Run with Docker Compose (recommended)

```bash
# 1. Copy and fill in your env vars
cp apps/interface/.env.example apps/interface/.env.local
# Edit apps/interface/.env.local with your contract ID and RPC URL

# 2. Build and start
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Build the image manually

```bash
# Build context must be the repo root (monorepo workspace)
docker build -f apps/interface/Dockerfile -t fund-my-cause .
docker run -p 3000:3000 --env-file apps/interface/.env.local fund-my-cause
```

### Multi-stage build

The Dockerfile uses a two-stage build to keep the production image small (~150–250 MB):

1. `builder` — installs all dependencies and compiles Next.js with `output: 'standalone'`
2. `runner` — copies only the standalone bundle; no source files or dev dependencies are shipped

### Key environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CONTRACT_ID` | Yes | Crowdfund contract address |
| `NEXT_PUBLIC_RPC_URL` | Yes | Soroban RPC endpoint |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Yes | Stellar network passphrase |
| `NEXT_PUBLIC_HORIZON_URL` | No | Horizon REST API endpoint |
| `NEXT_PUBLIC_PINATA_API_KEY` | No | Pinata IPFS key (image uploads) |

See [docs/docker.md](./docs/docker.md) for the full variable reference, health check setup, and production deployment considerations.

---

## CI/CD

GitHub Actions workflows:

- `rust_ci.yml` — builds WASM + runs Rust tests on push/PR to `main`
- `frontend_ci.yml` — lints and typechecks the frontend on push/PR to `main`
- `playwright.yml` — runs Playwright E2E tests on PRs targeting `main`
- `deploy-testnet.yml` — deploys contracts to Stellar testnet on push to `develop`

Dependabot is configured to keep npm, Cargo, and GitHub Actions dependencies up to date weekly.

---

## Code Coverage

The frontend enforces a minimum **80% coverage threshold** across all metrics (statements, branches, functions, lines) via Jest. The build fails if any metric drops below this floor.

Run coverage locally:

```bash
cd apps/interface
npm run test:coverage
```

Thresholds are configured in `apps/interface/jest.config.js` under `coverageThreshold.global`.

---

## Security

Fund-My-Cause takes security seriously. For comprehensive security information, see:

- **[Security Guidelines](./docs/security-guidelines.md)** — Overview of security practices and policies
- **[Security Model & Threat Analysis](./docs/security-model.md)** — Detailed threat model and mitigation strategies
- **[Security Checklist](./docs/security-checklist.md)** — Pre-deployment, deployment, and operational checklists
- **[Incident Response Procedures](./docs/incident-response.md)** — Procedures for detecting and responding to security incidents
- **[Security Best Practices](./docs/security-best-practices.md)** — User security guidance and wallet security
- **[SECURITY.md](./SECURITY.md)** — Vulnerability reporting policy and supported versions

### Reporting Security Vulnerabilities

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/Fund-My-Cause/Fund-My-Cause/security/advisories/new) or email [security@fund-my-cause.org](mailto:security@fund-my-cause.org).

Include:
- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Affected component (smart contract, frontend, CI/CD)
- Potential impact assessment

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) and will credit researchers in release notes unless anonymity is requested.

---

## Developer Resources

| Resource | Description |
|----------|-------------|
| [docs/INDEX.md](./docs/INDEX.md) | Complete documentation index and architecture catalog |
| [docs/SETUP.md](./docs/SETUP.md) | Comprehensive monorepo local development setup and troubleshooting guide |
| [docs/adr/](./docs/adr/README.md) | Architecture Decision Records (including [ADR-007](./docs/adr/ADR-007-stellar-contract-upgrade-strategy.md)) |
| [docs/api/](./docs/api/README.md) | Full contract API reference — every function, type, event, and error code |
| [docs/tutorials/](./docs/tutorials/README.md) | Step-by-step guides: getting started, contributing, dashboards, matching, saved searches |
| [sdks/js/](./sdks/js/README.md) | TypeScript SDK — typed client for all contract operations |
| [playground/](./playground/README.md) | Interactive testnet playground — query and invoke contracts from the CLI or REST Client |
| [examples/](./examples/README.md) | Runnable integration examples (Node.js + React) |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `git commit -m "feat: add X"`
4. Open a pull request

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Reproducible Builds & Cargo.lock

`Cargo.lock` is **committed to this repository** intentionally.

For application binaries and smart contracts, locking every transitive dependency to an exact version is a security requirement — not optional. Without it:

- A `cargo build` on a different machine or at a later date may silently pull in a newer (potentially compromised or breaking) version of any dependency.
- Audits and vulnerability scans target specific versions; a floating lock file makes those results meaningless.
- Soroban WASM bytecode must be byte-for-byte reproducible so that on-chain contract hashes can be independently verified.

This follows the [Cargo book's recommendation](https://doc.rust-lang.org/cargo/faq.html#why-do-binaries-have-cargolock-in-version-control-but-not-libraries) for binaries and aligns with Rust smart contract best practices.

---

## Built on Stellar

Fund-My-Cause is powered by the Stellar network and Soroban smart contracts. Stellar provides fast, low-cost transactions with 5-second finality, making it ideal for crowdfunding at scale.

- [Stellar Docs](https://developers.stellar.org)
- [Soroban Docs](https://soroban.stellar.org)
- [Freighter Wallet](https://www.freighter.app)

## Handsoff notes

<!-- handsoff-issue-1350 -->
- #1350: [Frontend] Split app/campaigns page into focused container/presentational components

<!-- handsoff-issue-1351 -->
- #1351: [Frontend] Consolidate duplicate data-fetching logic in src/services and src/lib/graphql

<!-- handsoff-issue-1358 -->
- #1358: [Frontend] Modularize webhook handling logic in src/lib/webhooks

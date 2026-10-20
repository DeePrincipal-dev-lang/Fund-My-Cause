# Contributing to Fund-My-Cause

Thank you for your interest in contributing to Fund-My-Cause! We welcome contributions from the community.

## 🚀 Getting Started

**New to the project?** Follow our comprehensive step-by-step setup guide:

👉 **[Contributor Onboarding Walkthrough](./docs/contributor-onboarding.md)** 👈

This guide covers:
- Setting up your development environment
- Building and testing smart contracts
- Running the frontend locally
- Working with the backend/indexer stack
- Common troubleshooting tips

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Report Bugs

Found a bug? Please open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Your environment (OS, browser, Node.js version, etc.)
- Screenshots or error logs if applicable

## How to Propose Features

Have an idea? Open an issue using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Include:

- Problem statement: what problem does this solve?
- Proposed solution: how should it work?
- Alternative approaches you've considered
- Any additional context

## Branch Naming Convention

Use the following format for branch names:

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `chore/<description>` — maintenance, dependencies, tooling
- `docs/<description>` — documentation updates
- `refactor/<description>` — code refactoring without behavior changes

Example: `feat/campaign-metadata-update`, `fix/freighter-connection-timeout`

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation
- `style` — formatting, missing semicolons, etc.
- `refactor` — code refactoring
- `perf` — performance improvements
- `test` — adding or updating tests
- `chore` — build, dependencies, tooling

**Example:**
```
feat(contracts): add campaign metadata update function

Allow creators to update campaign title and description
while the campaign is active.

Closes #42
```

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Branch is based on latest `main`
- [ ] Commit messages follow Conventional Commits format
- [ ] Code follows project style (Rust: `cargo fmt`, TypeScript: `prettier`)
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (README, code comments, etc.)
- [ ] No console errors or warnings
- [ ] Snapshots updated if UI changed (`npm run test -- -u`)

## Running the Full Test Suite Locally

### Contracts (Rust)

```bash
# Build WASM
cargo build --release --target wasm32-unknown-unknown

# Run all tests
cargo test --workspace

# Run tests with output
cargo test --workspace -- --nocapture

# Run specific test
cargo test --package crowdfund test_contribute -- --nocapture
```

### Frontend (TypeScript)

```bash
cd apps/interface

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Updating Snapshots

If you intentionally change a component's UI or contract behavior, update snapshots:

```bash
cd apps/interface

# Update Jest snapshots
npm test -- -u

# Or with Vitest
vitest -u
```

Commit updated snapshot files alongside your component changes so reviewers can see the visual diff.

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to enforce code quality before commits.

### Automatic Checks

Pre-commit hooks automatically run the following checks on staged files:

- **JavaScript/TypeScript files** (`.js`, `.ts`, `.tsx`, `.jsx`): Prettier formatting. ESLint is also run on `apps/interface` files.
- **Rust files** (`.rs`): `cargo fmt --check` for formatting.
- **Secrets scanning**: Staged files are scanned for common secret patterns (private keys, API tokens, etc.).

### Setup

Pre-commit hooks are automatically installed when you run `npm install` (via the `prepare` script).

If you need to manually install or update hooks:

```bash
npm run prepare
```

### Skipping Hooks (Emergency `--no-verify` Policy)

In rare emergency situations — for example, an urgent hotfix that cannot wait for formatting or lint fixes — you can bypass all pre-commit checks with:

```bash
git commit --no-verify
```

**Policy:**

1. `--no-verify` **bypasses all checks** (formatting, linting, and secrets scanning). Use it only when the commit must go through immediately and you have no time to address failures.
2. **Always verify locally before pushing.** After committing with `--no-verify`, run the relevant checks manually:
   ```bash
   # JS/TS
   npx prettier --check .
   # Rust
   cargo fmt --check
   cargo clippy --workspace --all-targets --all-features
   ```
3. **Do not use `--no-verify` to bypass secrets scanning.** If a secret is accidentally staged, remove it immediately and rotate the exposed credential.
4. **CI will catch issues.** Even if a commit bypasses pre-commit hooks, CI enforces the same checks. A `--no-verify` commit that fails CI must be fixed before merging.
5. **Document the bypass.** If you use `--no-verify` for a non-obvious reason, add a brief note in the commit message or PR description explaining why.

## Development Setup

### Quick Start

1. Clone the repo:
   ```bash
   git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
   cd Fund-My-Cause
   ```

2. Follow the single setup guide, [docs/SETUP.md](./docs/SETUP.md), to install dependencies, build the contracts, and run the test suites. Do not use other copies of these steps.

### Local Development

**Frontend:**
```bash
cd apps/interface
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

**Contracts:**
```bash
cargo build --release --target wasm32-unknown-unknown
cargo test --workspace -- --nocapture
```

### Seeding Test Data (Local Development)

For local development with realistic data, use the seed scripts to deploy sample campaigns to testnet:

#### Prerequisites
1. Stellar CLI installed and configured
2. Testnet account with XLM balance
3. Token contract ID (or use native XLM)

#### Quick Start

**Unix/Linux/Mac:**
```bash
# Set your testnet credentials
export CREATOR="YOUR_TESTNET_ADDRESS"
export TOKEN="TOKEN_CONTRACT_ID"

# Seed testnet with sample campaigns
./scripts/seed-testnet.sh

# Or specify number of campaigns
./scripts/seed-testnet.sh --num-campaigns 10 --verbose
```

**Windows:**
```powershell
# Set your testnet credentials
$env:CREATOR = "YOUR_TESTNET_ADDRESS"
$env:TOKEN = "TOKEN_CONTRACT_ID"

# Seed testnet with sample campaigns
.\scripts\seed-testnet.ps1

# Or specify number of campaigns
.\scripts\seed-testnet.ps1 -NumCampaigns 10 -Verbose
```

This will:
- Deploy a registry contract (if needed)
- Create 5-10 campaigns with varied states (active, funded, failed, refunding)
- Update `apps/interface/.env.local` with contract IDs
- Generate `fixtures/seed-data.json` for reference

#### Generate Test Fixtures (JSON)

For testing without deploying contracts, generate local fixtures:

```bash
# Generate test fixtures
npx ts-node scripts/generate-fixtures.ts

# Custom output path
npx ts-node scripts/generate-fixtures.ts --output fixtures/custom-fixtures.json
```

Fixtures include:
- 10 campaigns covering all lifecycle states
- Sample contributors and contributions
- Realistic data for E2E and component tests

See [fixtures/README.md](fixtures/README.md) for detailed documentation on using fixtures and seed data.

## Project Structure

```
Fund-My-Cause/
├── apps/interface/          # Next.js frontend
├── contracts/
│   ├── crowdfund/          # Main crowdfunding contract
│   └── registry/           # Campaign registry contract
├── scripts/                # Deployment and utility scripts
├── e2e/                    # End-to-end tests
└── .github/                # GitHub workflows and templates
```

## Changelog Maintenance

Every user-facing change must be recorded in [CHANGELOG.md](./CHANGELOG.md) before the PR is merged. This keeps the release history readable and makes it easy to generate release notes.

### Format

The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions. Each entry lives under the `## [Unreleased]` heading until a release is cut, at which point it is moved to a new versioned section.

```markdown
## [Unreleased]

### Added
- ...

### Changed
- ...

## [1.2.0] - 2026-05-01

### Fixed
- ...
```

### Semantic Versioning for Contracts

This project follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) for both the npm packages and the Soroban smart contracts. The contract version is stored in `CONTRACT_VERSION` in `contracts/crowdfund/src/lib.rs`.

| Bump | When to use | Contract examples |
|------|-------------|-------------------|
| **MAJOR** (`x.0.0`) | Breaking change — existing callers must update | Removing or renaming a public function, changing a function's parameter types or order, changing storage key layout in a way that breaks existing data |
| **MINOR** (`0.x.0`) | Backwards-compatible new functionality | Adding a new contract function, adding an optional parameter, new error codes, new events |
| **PATCH** (`0.0.x`) | Backwards-compatible bug fixes | Fixing incorrect fee calculation, correcting an off-by-one in deadline validation, gas optimisations with no interface change |

> **Smart contract note:** Because deployed Soroban contracts are immutable, a MAJOR bump typically means deploying a new contract instance and migrating state or directing users to the new address. Treat any storage layout change as a breaking change.

### Changelog Categories

Use only the standard Keep a Changelog categories. Pick the one that best describes the change:

| Category | Use for |
|----------|---------|
| `Added` | New features, new contract functions, new API endpoints, new UI components |
| `Changed` | Changes to existing behaviour that are backwards-compatible (e.g. updated defaults, revised copy) |
| `Deprecated` | Features that still work but will be removed in a future release |
| `Removed` | Features or functions that have been deleted |
| `Fixed` | Bug fixes |
| `Security` | Vulnerability patches or security-hardening changes |

### Writing Good Entries

Each entry should be a single sentence that answers **what changed and why it matters to users or integrators**. Avoid implementation details unless they affect how the feature is used.

**Good entries:**

```markdown
### Added
- `accepted_tokens` whitelist parameter to `initialize()`, allowing campaigns
  to accept multiple Stellar tokens (e.g. XLM and USDC) simultaneously.
- `contributor_list(offset, limit)` function for paginated contributor queries
  (page size capped at 50 to prevent excessive memory usage).
- `pause` / `unpause` admin functions to temporarily halt contributions without
  cancelling the campaign.

### Changed
- `contribute()` now requires an explicit `token` argument; callers must pass
  the token address they are transferring.

### Fixed
- Platform fee calculation no longer rounds down to zero for contributions
  below 10,000 stroops.

### Security
- Added `checked_add` overflow protection to all contribution amount
  accumulations.
```

**Avoid vague entries like:**

```markdown
### Changed
- Updated some contract logic.
- Minor fixes.
```

### When to Update the Changelog

Update `CHANGELOG.md` in the **same commit or PR** as the code change. The PR checklist already includes a documentation step — treat the changelog as part of that.

- **Feature PR:** add an entry under `Added` (or `Changed` / `Deprecated` as appropriate).
- **Bug-fix PR:** add an entry under `Fixed`.
- **Security PR:** add an entry under `Security` and consider a coordinated disclosure before merging publicly.
- **Docs-only PR:** no changelog entry required unless the docs change affects how users integrate with the project.
- **Chore / tooling PR:** no changelog entry required.

### Cutting a Release

When the team decides to release:

1. Create a release branch: `git checkout -b release/v1.2.0`
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [1.2.0] - YYYY-MM-DD` and add a fresh empty `## [Unreleased]` block above it.
3. Update the comparison links at the bottom of the file:
   ```markdown
   [Unreleased]: https://github.com/Fund-My-Cause/Fund-My-Cause/compare/v1.2.0...HEAD
   [1.2.0]: https://github.com/Fund-My-Cause/Fund-My-Cause/compare/v1.1.0...v1.2.0
   ```
4. Bump `CONTRACT_VERSION` in `contracts/crowdfund/src/lib.rs` if the contract changed.
5. Open a PR, get it reviewed, merge, then tag: `git tag v1.2.0 && git push --tags`.

### Automation

The following tools can reduce manual changelog work:

- **[git-cliff](https://git-cliff.org/)** — generates a changelog from Conventional Commit messages. Add a `cliff.toml` at the repo root to customise groupings and output format.
  ```bash
  # Preview what the next release changelog would look like
  git cliff --unreleased
  ```
- **[release-please](https://github.com/googleapis/release-please)** — GitHub Action that opens a release PR automatically, bumping versions and updating the changelog based on commit history. Add `.github/workflows/release-please.yml` to enable it.
- **GitHub Releases** — paste the relevant changelog section into the GitHub Release description when tagging so users see it directly on the releases page.

---

## Questions?

- Check existing [issues](https://github.com/Fund-My-Cause/Fund-My-Cause/issues)
- Review [README.md](./README.md) for setup and architecture
- Open a [discussion](https://github.com/Fund-My-Cause/Fund-My-Cause/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

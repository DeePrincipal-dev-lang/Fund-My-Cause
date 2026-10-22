# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **#1518/#1519 Shared resilience primitives** — moved the generic three-state circuit
  breaker into `@fund-my-cause/shared-utils` and added a shared exponential-backoff retry
  helper. Indexer HTTP/RPC clients and the Horizon wrapper now delegate to the shared
  implementations; existing `@fund-my-cause/rpc-client` and indexer imports remain valid.
- **Crowdfund event topics renamed from `("campaign", <event>)` to `("crowdfund", <event>)`** (see
  ADR-010). Event names and payloads are unchanged. Indexers must subscribe to the `crowdfund`
  scope for campaign events; events emitted before this release keep the old scope on the ledger.
- **#1350 Campaigns page split into container/presentational components** — `CampaignList`,
  `CampaignFilters`, and `CampaignCard` extracted to `src/components/campaigns/`; the page
  now wires state through a `CampaignsContainer` and delegates rendering to those presentational
  components.

### Added
- **#1531 90 % line-coverage floor on crowdfund contract** — `make contracts:coverage` runs
  `cargo llvm-cov` for the `crowdfund` package and fails with a non-zero exit code when line
  coverage drops below 90 %. New branch tests in
  `contracts/crowdfund/tests/refund_withdraw_coverage.rs` exercise previously-uncovered guards
  in `src/refund.rs` and `src/withdraw.rs` (AlreadyWithdrawn, GoalNotReached, soft_cap path,
  partial-release proportional refund, record_release accumulation).

### Removed
- **Deprecated `/health` endpoint** — removed the legacy `GET /health` route from
  `backend/recommendations/service.py` and `backend/fraud_detection/pipeline.py`. It was a
  duplicate of `GET /healthz` (which additionally reports a timestamp) and `GET /readyz`;
  no client called `/health` specifically, only its own test suite. Associated
  `test_health` tests were removed, and `tests_error_schema.py` now asserts against
  `/healthz` instead.

### Added
- **#893 REST endpoint audit** — `services/graphql-api/docs/rest-endpoints.md` documents
  every REST route in `services/graphql-api` (`GET /health`, `GET /status`, `GET /metrics`,
  `POST /graphql`) with a caller cross-reference against `apps/interface` and `sdks/js`.
  All routes are confirmed active with zero deprecated callers.  The frontend migrated fully
  to GraphQL for *data* operations; the three non-GraphQL routes are operational/infra
  endpoints with no GraphQL equivalents and no candidates for removal.
- **#894 Indexer database index migration** — `services/indexer/src/migrations/` adds a
  structured migration system for the in-memory EventStore:
  - `001_add_event_indexes.ts` — adds secondary `contractIndex` and `typeIndex` Maps that
    eliminate full-table scans on `queryByContract` and `queryByType` (O(n) → O(k log k),
    where k = matching events).  Includes `up()`, `down()` (rollback), and `verify()`.
  - `run-migrations.ts` — migration runner that applies or rolls back all migrations in
    order.  Idempotent; safe to run on restart.
  - `EventStore` extended with `enableIndexes()`, `disableIndexes()`, `verifyIndexes()`,
    and the `IndexedEventStore` interface; secondary indexes maintained on every `addEvents`
    call (O(1) amortised overhead per event).
  - Migrations applied automatically at indexer startup via `runMigrations(store, 'up')`.
- **#895 Centralised structured logging** — all backend services now emit structured logs
  consistent with `docs/logging-conventions.md`:
  - `services/monitoring-service/src/logger.ts` — pino logger with `service: monitoring-service`
    binding and `requestLogger(traceId)` helper (mirrors `graphql-api` and `indexer` loggers).
  - All `console.log` / `console.error` calls removed from `incident-response.ts`,
    `pagerduty-integration.ts`, `alert-transport.ts`, and `index.ts`; replaced with
    structured `logger.info` / `logger.error` / `logger.warn` / `logger.debug` calls.
  - `backend/recommendations/service.py` — structlog added with `merge_contextvars` processor
    chain, `TraceIDMiddleware` registered on the FastAPI app, and `log.info` / `log.debug`
    calls on recommendation request/cache-hit/cache-miss paths.  Mirrors the canonical
    implementation in `backend/fraud_detection/pipeline.py`.
  - `structlog==24.1.0` added to `backend/recommendations/requirements.txt`.
- **#896 Indexer event handler split** — `services/indexer/src/handlers/` introduces a
  domain-driven dispatch layer:
  - `types.ts` — `EventHandler` shared interface (`eventType: string`, `handle(events, repo)`).
  - `campaign.handler.ts` — handles `campaign` events with domain-specific log fields
    (creator, title, goal, deadline).
  - `donation.handler.ts` — handles `donation` events and the legacy `Contribute` alias
    (backward compat with original Soroban contract event names); logs per-batch total amount.
  - `achievement.handler.ts` — handles `achievement` events (badge, points, achievement_type).
  - `dispatcher.ts` — `EventDispatcher` groups a mixed batch by type, routes each group to
    the matching handler, and falls back to the repository for unknown types (zero event loss).
    Alias routing registered at construction time via `static aliases` on handler classes.
  - `index.ts` barrel re-exports all handlers and the dispatcher.
  - `services/indexer/src/index.ts` updated: ingestion loop now calls `dispatcher.dispatch(events)`
    instead of `eventRepository.addEvents(events)`.
  - Unit tests: `campaign.handler.test.ts`, `donation.handler.test.ts`,
    `achievement.handler.test.ts`, `dispatcher.test.ts` (mixed batch, alias routing,
    fallback, empty batch, end-state equivalence with pre-refactor behavior).

### Removed
- **#893** No REST endpoints removed — all existing routes have active callers.
  (See `services/graphql-api/docs/rest-endpoints.md` for the full audit record.)

### Added
- Seed/fixture generators for local testing and development (#731)
  - `scripts/seed-testnet.sh` — Unix/Linux/Mac script to deploy sample campaigns to testnet covering all lifecycle states (active, funded, failed, refunding)
  - `scripts/seed-testnet.ps1` — Windows PowerShell version of seed script with identical functionality
  - `scripts/generate-fixtures.ts` — TypeScript fixture generator creating realistic JSON test data for E2E and component tests
  - `fixtures/README.md` — comprehensive documentation for using fixtures and seed scripts, including campaign states, usage examples, and troubleshooting
  - `docs/LOCAL_DEVELOPMENT_QUICKSTART.md` — quick start guide for local development with step-by-step setup instructions
  - `npm run fixtures:generate` — command to generate test fixtures JSON
  - `npm run seed:testnet` — command to seed testnet with sample campaigns (Unix/Linux/Mac)
  - Automatic `.env.local` generation with deployed contract IDs
  - `fixtures/seed-data.json` generation with deployment metadata and contract addresses
  - Campaign templates covering 10 different states: new, mid-progress, near goal, fully funded, failed, refunding, paused, near deadline, early stage, and low progress
  - Support for 5-50 campaigns with `--num-campaigns` option for load testing
  - Verbose mode for detailed deployment logging
  - Backup creation for `.env.local` before overwriting
- `docs/api/` — structured API reference for both contracts: `crowdfund.md`,
  `registry.md`, `types.md`, `errors.md`, `events.md`, each cross-linked.
- `docs/tutorials/` — six step-by-step guides: getting started, campaign
  creation, accepting contributions, building a dashboard, donation matching,
  and saved-search alerts.
- `sdks/js/` — typed JavaScript/TypeScript SDK (`@fund-my-cause/sdk`) exposing
  `FmcClient` (all read + write methods), `FmcRegistryClient`, `FmcContractError`,
  and unit-conversion helpers (`xlmToStroops`, `stroopsToXlm`, etc.).
- `sdks/js/src/utils.test.ts` — unit tests for all SDK utility functions.
- `playground/` — interactive testnet playground: `query.js` (read-only CLI),
  `contribute.js` (send a contribution), `run.js` (interactive menu), and
  `requests.http` (VS Code REST Client snippets for raw Soroban RPC calls).
- `examples/` — five runnable integration examples: `basic-campaign`,
  `campaign-list`, `donation-matching`, `contribution-widget` (React), and
  `event-listener` (on-chain event polling).
- Initial project setup with Soroban smart contracts
- Decentralized crowdfunding platform on Stellar network
- Pull-based refund model for scalable fund distribution
- Platform fee configuration support
- Next.js frontend with Freighter wallet integration
- Campaign registry contract for discovery
- Comprehensive test suite with snapshots
- CI/CD pipeline with GitHub Actions
- `DataKey::ContributorIndex(u32)` storage key for O(1) per-contributor writes,
  replacing the O(n) `KEY_CONTRIBS` Vec append that grew proportionally with
  campaign size.
- `estimateContributionGas(contractId, contributor, amount, tokenId)` in
  `apps/interface/src/lib/contract.ts` — simulates a contribution and returns
  the estimated network fee in stroops and XLM before the user signs.
- `getContributorsPaginated(contractId, offset, limit)` in
  `apps/interface/src/lib/contract.ts` — fetches a page of contributor addresses
  using the new indexed storage, proportional only to page size.
- `validate_refund_eligibility(now, deadline, total, goal)` in `validation.rs`
  combines the duplicate deadline + goal checks shared by `refund_single` and
  `refund_batch` into a single short-circuit function.
- Extended benchmark suite in `contract_benchmarks.rs`: `contribute_repeat_contributor`,
  `contribute_50th_contributor`, `get_stats_empty`, `get_stats_10_contributors`,
  `contributor_list_page1_of_10`, and `contributor_list_page2_of_50`.

### Changed
- `contribute()` now validates the minimum-amount constraint **before** reading
  the blacklist/whitelist from persistent storage, saving 1–2 storage reads on
  every rejected under-minimum contribution.
- `contributor_list(offset, limit)` now reads only the requested page of
  contributors via indexed persistent keys instead of deserialising the full
  contributor list on every call.
- `get_stats()` now caches the instance storage handle to reduce repeated borrow
  overhead across the four instance reads it performs.
- `get_performance_metrics()` now correctly reads contributors from persistent
  storage via indexed keys; previously it read `KEY_CONTRIBS` from instance
  storage (which was always empty), so trending was always 0.
- `refund_single()` and `refund_batch()` now delegate their eligibility checks
  to `validate_refund_eligibility()`, removing duplicated inline logic.
- `contribute_on_behalf()` now also writes `DataKey::ContributorIndex` for
  first-time delegated contributors, making them visible via `contributor_list`.

### Deprecated

### Removed

### Fixed
- `get_performance_metrics()` trending metric was always 0 because contributors
  were read from the wrong storage tier (instance instead of persistent).

### Security

## [0.1.0] - 2026-03-28

### Added
- Initial release of Fund-My-Cause
- Soroban smart contracts (crowdfund and registry)
- Next.js 16 frontend with TypeScript and Tailwind CSS
- Freighter wallet integration
- Campaign creation, contribution, and refund functionality
- Platform fee mechanism
- Automated deployment scripts
- E2E tests with Playwright
- Unit tests with Jest and Vitest

[Unreleased]: https://github.com/Fund-My-Cause/Fund-My-Cause/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Fund-My-Cause/Fund-My-Cause/releases/tag/v0.1.0

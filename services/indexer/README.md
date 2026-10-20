# Indexer Service

Off-chain indexer service for Fund-My-Cause. Ingests Soroban contract events and provides fast queries via REST API.

## Reconciliation Strategy

Reorg handling and duplicate-event idempotency are documented in
[RECONCILIATION.md](./RECONCILIATION.md). Per-event-type processor
architecture is documented in [PROCESSOR_REGISTRY.md](./PROCESSOR_REGISTRY.md).

## Quick Start

### Environment Variables

```bash
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
CROWDFUND_CONTRACT_ID=<your-contract-id>
REGISTRY_CONTRACT_ID=<your-registry-contract-id>  # optional; see "Event Handlers" below
QF_CONTRACT_ID=<your-qf-contract-id>  # optional
ACHIEVEMENTS_CONTRACT_ID=<your-achievements-contract-id>  # optional
PORT=3001
LOG_LEVEL=info
```

### Install & Build

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run dev
```

## API Endpoints

### Health Check

```bash
GET /health
```

Returns service health status with ledger position and event count.

```json
{
  "status": "healthy",
  "uptime": 12345,
  "lastEventTime": 1704067200000,
  "lastLedger": 12345678,
  "eventsProcessed": 450
}
```

### Readiness Check

```bash
GET /ready
```

Returns `200` if indexer is running and ingesting events, `503` otherwise.

### Query Events

```bash
GET /events?contractId=<id>&limit=100
GET /events?type=<event-type>&limit=100
GET /events?limit=100
```

Query contract events by contract ID, event type, or get all recent events.

```json
{
  "count": 3,
  "events": [
    {
      "id": "12345-0",
      "timestamp": 1704067200000,
      "type": "Contribute",
      "contractId": "CXXX",
      "data": { "contributor": "GXXX", "amount": "1000000000" }
    }
  ]
}
```

### Service Stats

```bash
GET /stats
```

Get overall service statistics.

```json
{
  "eventCount": 450,
  "health": "healthy",
  "uptime": 12345,
  "lastLedger": 12345678,
  "eventsProcessed": 450
}
```

## Architecture

- **RPC Client**: Connects to Soroban RPC and streams contract events for every contract ID in `contractIds` (crowdfund + optionally registry)
- **Event Dispatcher**: Groups a mixed batch of events by type and routes each group to its domain handler; unknown types fall back to the repository directly so no event is lost
- **Event Handlers**: One class per (contract type, event type) pair, modularized under `src/handlers/<contractType>/` — see below
- **Event Store**: In-memory event storage, the single live data-access layer for this service
- **Health Checker**: Tracks service health and metrics
- **Express Server**: REST API (`/events`, `/stats`, `/health`, `/ready`) for querying indexed data

## Event Handlers (#1125)

Handlers are grouped by the Soroban contract that emits their event type, so
adding a new contract never requires touching an existing contract's handler
code:

```
src/handlers/
  types.ts                    # EventHandler interface + ContractType
  dispatcher.ts                # contract-agnostic router (eventType -> handler)
  crowdfund/                   # contracts/crowdfund events
    campaign.handler.ts         # eventType: "campaign"
    donation.handler.ts         # eventType: "donation" (alias: "Contribute")
    achievement.handler.ts      # eventType: "achievement"
  qf/                          # contracts/qf events
    calculated.handler.ts       # eventType: "qf_calc"
  achievements/                # contracts/achievements events
    unlocked.handler.ts         # eventType: "ach_unl"
    points-awarded.handler.ts   # eventType: "ach_pts"
  registry/                    # contracts/registry events
    registered.handler.ts       # eventType: "reg_proj" (alias: "registered")
```

Every handler implements the shared `EventHandler` interface (`eventType`,
`contractType`, `handle()`) documented in `src/handlers/types.ts`. To add a
new contract type: create `src/handlers/<contractType>/`, implement
`EventHandler` for each of its event types, export the classes from
`src/handlers/index.ts`, register instances in the `EventDispatcher` in
`src/index.ts`, and add the contract's ID to the `contractIds` passed to
`SorobanRPCClient`.

## Connection Pool Configuration

The indexer uses in-memory storage (via `EventStore`) rather than a SQL or NoSQL database, so there is no traditional connection pool to configure. Instead, `src/store-config.ts` exposes the analogous resource-capacity levers that bound memory and outbound RPC concurrency.

### Settings

| Environment variable | Default | Description |
|---|---|---|
| `STORE_MAX_EVENT_CAPACITY` | `100000` | Maximum events held in memory. Acts as the pool-size equivalent — bounds total RAM usage. Oldest events are evicted when the limit is reached. |
| `STORE_EVENT_BATCH_SIZE` | `500` | Maximum events processed per ingestion batch. Analogous to a pool acquire timeout: limits per-cycle work. |
| `STORE_STALE_LEDGER_THRESHOLD_MS` | `60000` | Milliseconds since the last ingested event before health is reported as degraded. |
| `RPC_REQUEST_TIMEOUT_MS` | `30000` | Timeout in ms for each Soroban RPC request. Matches the recommended Soroban RPC timeout. |
| `RPC_MAX_CONCURRENT_REQUESTS` | `5` | Maximum concurrent outbound RPC requests. Stellar testnet recommends ≤ 10 concurrent connections; 5 leaves headroom for other clients. |
| `RPC_RETRY_ATTEMPTS` | `3` | Retry attempts on transient RPC failure before the request is considered failed. |

### Design rationale

These defaults are derived from observed testnet behaviour:

- **Peak ingestion rate**: ~500 events/min on testnet → `STORE_MAX_EVENT_CAPACITY=100,000` keeps ~200 min of history in memory before eviction begins.
- **`RPC_MAX_CONCURRENT_REQUESTS=5`**: prevents saturating the Stellar testnet RPC endpoint (recommended ceiling: 10 concurrent connections).
- **`RPC_REQUEST_TIMEOUT_MS=30,000`**: aligns with the Soroban JSON-RPC documented timeout.

All values are configurable via environment variables (see `.env.example`). The defaults are intentionally conservative; raise `STORE_MAX_EVENT_CAPACITY` if you need longer in-memory history and have sufficient RAM.

### Future migration

When a durable store (e.g. PostgreSQL, SQLite) is introduced, replace `src/store-config.ts` with the shared pool config from `@fund-my-cause/shared-utils` (`packages/shared-utils/src/db-config.ts`, #1128) — the single source of truth for pool tuning across every backend service:

```typescript
import { loadDbPoolConfig } from "@fund-my-cause/shared-utils";

const dbPool = loadDbPoolConfig();
// { max, min, idleTimeoutMillis, connectionTimeoutMillis, retryAttempts, retryBackoffMs }
```

The `StoreConfig` interface is designed to make this migration visible: a grep for `StoreConfig` will find every place the capacity and concurrency settings are consumed. See `docs/db-pool-conventions.md` for the full parameter reference and the equivalent Python loader used by `fraud_detection` and `recommendations`.

### Data-access decision (#837)

This service previously carried two disconnected data-access implementations: this
in-memory `EventStore` (wired into `src/index.ts` and actually running in production),
and a fully separate Postgres/GraphQL/REST stack (`src/db/**`, `graphql-resolvers.ts`,
`graphql-server.ts`, `rest-api.ts`, `ingestor.ts`) that was never imported by
`src/index.ts` and never ran.

That Postgres stack has been removed rather than wired up, because it was not a
functioning alternative to recover:
- It depended on `pg`, `graphql`, `dataloader`, and `express-graphql`, none of which
  were ever declared in `package.json` — it never actually installed or type-checked.
- `ingestor.ts` and `db/queryStats.test.ts` imported sibling modules via incorrect
  relative paths, so even in isolation the code did not resolve.
- The ingestion shape it expected (`initialize`/`contribute`/`withdraw`/`refund`
  domain events) does not match what `rpc-client.ts` actually produces
  (generic `IndexerEvent`s) — there was no working bridge between the two.

The in-memory `EventStore` remains the single, intentional data-access
implementation for now. Its known limitation is that indexed events do not survive a
restart; replacing it with a durable store is tracked as future work and should be
designed against the real event shape produced by `rpc-client.ts`, not resurrected
from the deleted code above.

## Next Steps

- [ ] Add event type parsing and validation
- [ ] Implement event indexing for campaign state (raised, contributors, etc.)
- [ ] Design a durable (e.g. persistent) event store that survives restarts
- [ ] Implement event replay and backfill
- [ ] Add alerting and monitoring

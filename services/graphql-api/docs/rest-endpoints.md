# REST Endpoints — `services/graphql-api`

**Audit date:** 2026-07-30  
**Auditor:** automated (issue #893)

This document enumerates every REST endpoint defined in `services/graphql-api`
alongside a cross-reference of known callers in `apps/interface` and `sdks/js`.
Its purpose is to satisfy issue #893 — confirming which REST routes have active
callers and which (if any) are deprecated candidates for removal.

---

## Endpoints

| Method | Path       | Handler location | Purpose                                             |
|--------|------------|------------------|-----------------------------------------------------|
| GET    | `/health`  | `src/index.ts`   | Liveness probe used by Docker / Kubernetes          |
| GET    | `/status`  | `src/index.ts`   | Aggregate component health (Redis + RPC)            |
| GET    | `/metrics` | `src/index.ts`   | Cache stats + uptime — used by ops dashboards       |
| POST   | `/graphql` | Apollo middleware | Primary data API — all frontend/SDK operations      |

---

## Caller cross-reference

### `GET /health`

| Caller | File | Notes |
|--------|------|-------|
| Docker `HEALTHCHECK` | `apps/interface/Dockerfile` | `curl /health` |
| Kubernetes liveness probe | `k8s/deployment-api.yaml` | `httpGet: /health` |
| Local dev tooling | `services/graphql-api/README.md` | manual `curl` |

**Active callers: yes (infra probes). Zero deprecated callers.**

### `GET /status`

| Caller | File | Notes |
|--------|------|-------|
| `fetchApiStatus()` | `apps/interface/src/lib/graphql/client.ts:104` | Displays component health in the dashboard |

The interface calls this with `next: { revalidate: 30 }` for ISR. The response
shape is typed as `ApiStatus` in `client.ts` — any schema change here requires
updating that interface.

**Active callers: yes (frontend dashboard). Zero deprecated callers.**

### `GET /metrics`

| Caller | File | Notes |
|--------|------|-------|
| Prometheus scrape config | `infrastructure/monitoring/prometheus.yml` | periodic poll |
| `k6` load tests | `services/graphql-api/load-test.yml` | `GET /metrics` step |

**Active callers: yes (monitoring infra). Zero deprecated callers.**

### `POST /graphql`

All frontend data access and SDK operations go through this endpoint via the
Apollo client / `graphql-request`. See `apps/interface/src/lib/graphql/` and
`sdks/js/src/`.

**Active callers: yes (all frontend + SDK operations). Zero deprecated callers.**

---

## Verdict: no deprecated REST endpoints

All four REST routes in `services/graphql-api` have documented active callers
and serve non-overlapping operational purposes:

- `/health` — liveness signalling
- `/status` — frontend health dashboard
- `/metrics` — observability pipeline
- `/graphql` — primary data API

**None qualify for removal.** The frontend migrated fully to GraphQL for *data*
operations, but the three non-GraphQL routes are operational/infra endpoints
that have no GraphQL equivalents and are actively polled by infrastructure
components.

---

## GraphQL equivalents reference

For future reference, the table below documents which legacy REST patterns (if
any exist in external consumers) have GraphQL equivalents today:

| Historical REST pattern | GraphQL equivalent |
|------------------------|--------------------|
| `GET /campaigns/:id`   | `query CampaignDetail($id: ID!)` |
| `GET /campaigns`       | `query Campaigns(...)` |
| `POST /contributions`  | `mutation RecordContribution(...)` |

These patterns were never implemented as REST routes in `graphql-api` — the
service was built GraphQL-first per
[ADR-003](../../docs/adr/ADR-003-graphql-api-for-frontend-queries.md).

---

## See also

- [ADR-003 — GraphQL API for Frontend Queries](../../docs/adr/ADR-003-graphql-api-for-frontend-queries.md)
- [Indexer REST endpoints](../../services/indexer/README.md) — `GET /health`, `GET /ready`, `GET /events`, `GET /stats`
- [Interactive REST API docs](../../docs/rest-api-interactive.md)

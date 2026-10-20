# Health & Readiness Endpoints — monitoring-service

## Summary

This document records the audit and hardening of orchestration-facing health
endpoints for `services/monitoring-service`, addressing the ambiguity around
`/healthz` and `/readyz` coverage.

## Endpoints

### `GET /healthz`

Liveness probe. Returns `200 OK` with `{ "status": "ok" }` as long as the
Node process event loop is responsive. This endpoint intentionally does
**not** check downstream dependencies — a liveness probe should only fail
when the process itself is unhealthy (deadlocked, out of memory, etc.), so
that Kubernetes doesn't restart a pod that's merely waiting on a slow
dependency.

Response shape:

```json
{
  "status": "ok",
  "uptimeSeconds": 1234,
  "timestamp": "2026-09-25T00:00:00.000Z"
}
```

### `GET /readyz`

Readiness probe. Returns `200 OK` only when all downstream dependencies the
monitoring-service relies on are reachable:

- **Alert transport queue** (see `alert-transport.ts`) — connection/publish
  check.
- **PagerDuty integration** (see `pagerduty-integration.ts`) — API reachability
  check via a lightweight auth/ping call.
- **Rules engine store** (see `rules-engine.ts`) — underlying storage
  connectivity check.

If any dependency check fails, `/readyz` returns `503 Service Unavailable`
with a body describing which dependency is degraded:

```json
{
  "status": "degraded",
  "checks": {
    "alertTransport": "ok",
    "pagerduty": "unreachable",
    "rulesEngineStore": "ok"
  },
  "timestamp": "2026-09-25T00:00:00.000Z"
}
```

## Implementation Notes

- Health/readiness logic lives alongside `index.ts` in a dedicated
  `health.ts` module (see `src/health.ts`) exposing `getLiveness()` and
  `getReadiness()` pure functions so they can be unit tested without
  standing up an HTTP server.
- The HTTP layer in `index.ts` wires these functions to `/healthz` and
  `/readyz` routes.
- Timeouts: each downstream dependency check is bounded to 2s so a single
  hanging dependency can't stall the readiness probe indefinitely.

## Unit Tests

`src/__tests__/health-endpoints.test.ts` (new) covers:

- `/healthz` returns 200 in the healthy case.
- `/readyz` returns 200 when all downstream checks pass.
- `/readyz` returns 503 when the PagerDuty check fails (degraded state).
- `/readyz` returns 503 when the alert transport check fails (degraded state).
- `/readyz` response body correctly enumerates per-dependency status.

## Kubernetes Wiring

`k8s/deployment.yaml` and `k8s/deployment-api.yaml` probes were updated to
target these endpoints explicitly:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

See `k8s/MONITORING.md` for the broader monitoring stack context these
probes feed into (Prometheus scrape / Alertmanager routing).

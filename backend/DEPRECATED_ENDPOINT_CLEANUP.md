# Deprecated Endpoint Cleanup

## What was implemented

Searched `backend/` Python services for HTTP endpoints with zero external
callers. Found that both `backend/recommendations/service.py` and
`backend/fraud_detection/pipeline.py` exposed two overlapping health-check
routes each:

- `GET /health` → `{"status": "ok"}`
- `GET /healthz` → `{"status": "ok", "timestamp": ...}`

`/health` was a leftover from an earlier iteration before `/healthz` (and
`/readyz`) were introduced as the standard k8s-style probe endpoints. A
code search confirmed `/health` was referenced only by each service's own
`test_health` test — no other service, SDK, or frontend code called it.

## Changes

- Removed the `/health` route and its handler from:
  - `backend/recommendations/service.py`
  - `backend/fraud_detection/pipeline.py`
- Removed the now-orphaned `test_health` tests from:
  - `backend/recommendations/tests_service.py`
  - `backend/fraud_detection/tests_pipeline.py`
- Updated `backend/recommendations/tests_error_schema.py::test_health_endpoint_not_affected_by_error_schema`
  to assert against `/healthz` instead of the removed `/health` route.
- Added a `### Removed` entry to `CHANGELOG.md` under `[Unreleased]`.

## Result

`/healthz` and `/readyz` remain as the single source of truth for
liveness/readiness checks in both services; no test suite references the
removed `/health` route.

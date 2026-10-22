# Logging Conventions

This document is the authoritative reference for structured logging and distributed
trace-ID propagation across all Fund-My-Cause services.  New services **must** follow
these conventions so that a single donation request can be correlated end-to-end
across `graphql-api`, `fraud_detection`, `recommendations`, `indexer`,
`monitoring-service`, and any future service (#1126).

---

## 1. Trace-ID convention

### 1.1 Header name

```
X-Trace-ID
```

HTTP/2 transports the header in lowercase (`x-trace-id`); the canonical
casing is `X-Trace-ID`.  All code must match on the **lowercase** form when
reading headers.

### 1.2 Format

```
fmc-<timestamp_hex>-<random_hex>
```

| Segment          | Length | Description                                    |
|------------------|--------|------------------------------------------------|
| `fmc-`           | 4      | Fixed prefix — identifies the project          |
| `<timestamp_hex>`| 8      | Unix epoch seconds as 8 lowercase hex digits   |
| `-`              | 1      | Separator                                      |
| `<random_hex>`   | 16     | 8 cryptographically random bytes as hex        |

**Total length: 28 characters.**

Example: `fmc-67946a1b-3f8c2a0d9e4b71c2`

### 1.3 Regex for validation

```
^fmc-[0-9a-f]{8}-[0-9a-f]{16}$
```

### 1.4 Generation point

The trace ID is generated **once**, at the outermost entry point of a request:

- **graphql-api** generates a fresh ID for every incoming GraphQL HTTP request
  that does not supply a valid `X-Trace-ID` header.
- If the caller already supplies a well-formed `X-Trace-ID`, that value is
  accepted and reused — this allows external clients and integration tests to
  inject a known ID.

**No other service generates a new trace ID.**  All downstream services extract
and forward the value they receive.

---

## 2. Canonical utilities (TypeScript)

All TypeScript services must use the helpers from
`@fund-my-cause/shared-utils` (`packages/shared-utils/src/trace.ts`):

```ts
import {
  TRACE_ID_HEADER,   // "x-trace-id"
  generateTraceId,   // () => string  — fmc-<tsHex>-<randomHex>
  isValidTraceId,    // (v: unknown) => v is string
  resolveTraceId,    // (headers) => string  — accept or generate
} from "@fund-my-cause/shared-utils";
```

### Resolving a trace ID from an inbound request

```ts
// In the Apollo context factory (graphql-api/src/index.ts):
const traceId = resolveTraceId(req.headers);
res.set(TRACE_ID_HEADER, traceId);       // echo back to caller
```

### Propagating on outbound HTTP calls

```ts
// Pass traceId to createHttpClient once; every outbound call carries the header.
const client = createHttpClient({}, traceId);
await client.fetch(downstreamUrl, { method: "POST", body: "…" });
```

---

## 3. Canonical utilities (Python)

Python services use `structlog` with `contextvars` integration.  The
`TraceIDMiddleware` in `backend/fraud_detection/pipeline.py` is the reference
implementation:

```python
import structlog
from starlette.middleware.base import BaseHTTPMiddleware

TRACE_ID_HEADER = "x-trace-id"

class TraceIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        raw = request.headers.get(TRACE_ID_HEADER, "")
        trace_id = raw if _is_valid_trace_id(raw) else f"unknown-{int(time.time())}"

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)

        response = await call_next(request)
        response.headers[TRACE_ID_HEADER] = trace_id
        return response
```

`structlog.configure` must include `structlog.contextvars.merge_contextvars`
as the **first** processor so the `trace_id` binding is present on every log
line emitted inside the request.

---

## 4. Structured log field reference

Every log line emitted within a request context **must** include these fields:

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `trace_id`  | string | The `X-Trace-ID` value for this request      |
| `level`     | string | `debug` / `info` / `warn` / `error` / `fatal`|
| `timestamp` | string | ISO-8601 UTC                                 |
| `msg`       | string | Human-readable event description             |

Additional context fields (always lowercase, snake_case):

| Field          | Used in            | Description                          |
|----------------|--------------------|--------------------------------------|
| `campaign_id`  | all services       | Campaign being operated on           |
| `contributor`  | graphql-api        | Wallet address of the contributor    |
| `tx_hash`      | graphql-api, fraud | Soroban transaction hash             |
| `ledger`       | indexer            | Soroban ledger sequence number       |
| `status_code`  | fraud, indexer     | HTTP response status from downstream |
| `err`          | all services       | Serialised error object              |

### TypeScript (pino) example

```ts
// Service logger created with trace_id bound:
const log = requestLogger(traceId);   // from graphql-api/src/logger.ts

log.info(
  { campaignId, contributor, amount: amount.toString() },
  "recordContribution: started",
);
// Output:
// {"level":"info","trace_id":"fmc-67946a1b-3f8c2a0d9e4b71c2",
//  "campaignId":"C001","contributor":"GABC…","amount":"100","msg":"recordContribution: started"}
```

### Python (structlog) example

```python
# trace_id is already bound by the middleware — no per-call boilerplate needed:
log.info("contribution_received", campaign_id=campaign_id, contributor=wallet)
# Output:
# {"trace_id": "fmc-67946a1b-3f8c2a0d9e4b71c2", "event": "contribution_received",
#  "campaign_id": "C001", "contributor": "GABC…", "timestamp": "2026-07-26T10:00:00Z"}
```

---

## 5. End-to-end flow for a donation request

```
Client
  │  POST /graphql  (no X-Trace-ID or supplies one)
  ▼
graphql-api
  ├── resolveTraceId(req.headers)  →  fmc-67946a1b-3f8c2a0d9e4b71c2
  ├── log.info({ campaignId, contributor }, "recordContribution: started")
  │
  ├── POST /contributions  →  fraud_detection
  │     Header: X-Trace-ID: fmc-67946a1b-3f8c2a0d9e4b71c2
  │     fraud_detection: TraceIDMiddleware binds trace_id to structlog context
  │     fraud_detection: log.info("contribution_received", campaign_id=…)
  │
  └── (indexer polls Soroban independently; when it makes outbound HTTP
       calls it passes traceId to createHttpClient so outbound headers carry
       the same value — applicable to any future endpoint the indexer calls)
```

The same `fmc-67946a1b-3f8c2a0d9e4b71c2` appears in:
- `graphql-api` logs (pino, `trace_id` field)
- `fraud_detection` logs (structlog, `trace_id` field)
- any future service that follows this convention

---

## 6. Adding trace propagation to a new service

### TypeScript service

1. Add `@fund-my-cause/shared-utils` as a `file:` dependency.
2. Create a local `src/trace.ts` that re-exports from the shared package.
3. At your HTTP entry point call `resolveTraceId(req.headers)`.
4. Create a child logger: `logger.child({ trace_id: traceId })`.
5. Pass `traceId` to `createHttpClient` for all outbound HTTP calls.
6. Add `trace_id` to your service's `Context` type (or equivalent).

### Python / FastAPI service

1. Add `structlog` to your `requirements.txt`.
2. Copy the `structlog.configure(...)` block from `pipeline.py` (ensure
   `merge_contextvars` is the first processor).
3. Register `TraceIDMiddleware` with `app.add_middleware(TraceIDMiddleware)`.
4. Use `log = structlog.get_logger(...)` — `trace_id` is injected automatically.

---

## 7. Environment variables

| Variable     | Service       | Default  | Description              |
|--------------|---------------|----------|--------------------------|
| `LOG_LEVEL`  | all           | `info`   | Minimum log level        |
| `LOG_FORMAT` | fraud_detection, recommendations | console | Set to `json` in production |
| `NODE_ENV`   | graphql-api, indexer, monitoring-service | development | Set to `production` to switch pino from pretty-printed to JSON output |

---

## 8. See also

- [Log Aggregation Guide](./log-aggregation.md) — shipping, dashboards, alerts
- [DB Pool Conventions](./db-pool-conventions.md) — the equivalent cross-service
  convention doc for database connection-pool configuration (#1128)
- `packages/shared-utils/src/trace.ts` — canonical TypeScript implementation
- `backend/fraud_detection/pipeline.py` — canonical Python implementation
- `backend/recommendations/service.py` — Python implementation (mirrors `pipeline.py`)
- `services/graphql-api/src/logger.ts` — pino setup with `requestLogger()`
- `services/indexer/src/logger.ts` — pino setup for the indexer
- `services/monitoring-service/src/logger.ts` — pino setup with `requestLogger()`

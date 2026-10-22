# Trace-ID Specification

> **Status:** Canonical — all services MUST comply.
> **Issue:** [#1516](../../issues/1516)
> **Last updated:** 2026-10-22

---

## 1. Purpose

Trace IDs allow log entries from every Fund-My-Cause service — TypeScript
micro-services, the Python fraud-detection backend, and the Stellar indexer —
to be correlated into a single request trace.  One canonical format shared
across all runtimes eliminates silent correlation failures caused by divergent
implementations.

---

## 2. Header Name

| Property      | Value          |
|---------------|----------------|
| Header key    | `x-trace-id`   |
| Canonical case | lowercase      |

HTTP/2 normalises header names to lowercase automatically.  All services MUST
read and write the header in lowercase.  The TypeScript constant
`TRACE_ID_HEADER` and the Python constant `TRACE_ID_HEADER` are both set to
`"x-trace-id"`.

---

## 3. ID Format

```
fmc-<timestamp_hex>-<random_hex>
```

| Part            | Width      | Description                                        |
|-----------------|------------|----------------------------------------------------|
| `fmc-`          | 4 chars    | Constant prefix — Fund My Cause                    |
| `timestamp_hex` | 8 hex chars | Unix epoch seconds as a 32-bit big-endian integer  |
| `-`             | 1 char     | Separator                                          |
| `random_hex`    | 16 hex chars | 8 cryptographically-random bytes                  |

**Total length:** 28 characters (excluding any HTTP framing).

**Regex:**

```
^fmc-[0-9a-f]{8}-[0-9a-f]{16}$
```

**Example:**

```
fmc-67946a1b-3f8c2a0d9e4b71c2
```

All hex digits MUST be lowercase.

---

## 4. Generation

The **graphql-api** is the sole generation point.  For every incoming request:

1. If the caller supplies a well-formed `x-trace-id` header, it is forwarded
   unchanged to all downstream services.
2. If the header is absent or fails validation, a fresh trace ID is generated
   and injected before forwarding.

Downstream services (indexer, fraud-detection, recommendations) MUST NOT
generate trace IDs — they MUST propagate the value they receive.

---

## 5. Validation

A trace ID is valid if and only if it matches the regex above.

* An ID that does **not** match MUST be treated as absent.
* Services that receive an invalid ID SHOULD log a warning and substitute a
  fallback value (`unknown-<unix_timestamp>`) so log lines are never missing
  the `trace_id` field.

---

## 6. Language-Specific Modules

### TypeScript (canonical)

```
packages/shared-utils/src/trace.ts
```

Exports:

| Symbol           | Type       | Description                                              |
|------------------|------------|----------------------------------------------------------|
| `TRACE_ID_HEADER`| `string`   | `"x-trace-id"`                                           |
| `generateTraceId`| `() => string` | Generates a new trace ID using Web Crypto (or fallback) |
| `isValidTraceId` | `(v: unknown) => v is string` | Validates against the regex            |
| `resolveTraceId` | `(headers) => string` | Extracts or generates for a headers object      |

All TypeScript services import from `@fund-my-cause/shared-utils`.  No service
may duplicate the implementation.

### Python (canonical)

```
backend/fraud_detection/stages/trace_id.py
```

Exports:

| Symbol              | Type       | Description                                            |
|---------------------|------------|--------------------------------------------------------|
| `TRACE_ID_HEADER`   | `str`      | `"x-trace-id"`                                         |
| `TRACE_ID_RE`       | `re.Pattern` | Compiled regex for validation                        |
| `is_valid_trace_id` | `(str) -> bool` | Validates a candidate trace ID string            |
| `generate_trace_id` | `() -> str` | Generates a new compliant trace ID                   |
| `TraceIDMiddleware` | class      | Starlette middleware; extracts or falls back           |

`pipeline.py` (and any other Python service) MUST import from
`stages.trace_id` rather than re-implementing.

---

## 7. Cross-Language Fixture

A shared fixture file provides sample valid and invalid trace IDs that are
consumed by both the TypeScript and Python test suites:

```
fixtures/trace-id-fixtures.json
```

This guarantees that both runtimes agree on the same set of acceptance /
rejection cases, catching any future drift.

---

## 8. Propagation Contract

| Service                | Role         | Action                                                |
|------------------------|--------------|-------------------------------------------------------|
| graphql-api            | Origin       | Generate if absent; forward otherwise                 |
| services/indexer       | Relay        | Forward `x-trace-id` unchanged                        |
| backend/fraud_detection | Relay       | Extract via `TraceIDMiddleware`; echo back in response |
| backend/recommendations | Relay       | Forward `x-trace-id` unchanged                        |

---

## 9. Logging Convention

Every log line emitted during a request MUST include `trace_id` as a
structured field so that log aggregation tools (e.g. Kibana, CloudWatch
Insights) can filter by trace.

* TypeScript services use `pino` — pass `{ trace_id }` in the log call or bind
  it to a child logger at request entry.
* Python services use `structlog` — `TraceIDMiddleware` calls
  `structlog.contextvars.bind_contextvars(trace_id=...)` so every subsequent
  `log.*` call in the same request automatically carries the field.

See [docs/logging-conventions.md](./logging-conventions.md) for full guidance.

---

## 10. Acceptance Criteria (Issue #1516)

- [x] One documented format (this document)
- [x] TypeScript canonical implementation in `packages/shared-utils/src/trace.ts`
- [x] Python canonical implementation in `backend/fraud_detection/stages/trace_id.py`
- [x] `services/indexer` imports from `@fund-my-cause/shared-utils` (no local copy)
- [x] Shared fixture file `fixtures/trace-id-fixtures.json`
- [x] TypeScript unit tests for trace utilities (`packages/shared-utils/src/__tests__/trace.test.ts`)
- [x] Python unit tests for trace utilities (`backend/fraud_detection/stages/tests_trace_id.py`)
- [x] Both test suites consume the shared fixture file

# @fund-my-cause/shared-utils

Shared utilities for the Fund-My-Cause platform, consumed by every backend service and the frontend.

## Coverage Requirement

This package enforces an **85% minimum coverage threshold** on all four metrics:

| Metric     | Threshold |
|------------|-----------|
| Statements | 85%       |
| Branches   | 85%       |
| Functions  | 85%       |
| Lines      | 85%       |

The thresholds are configured in `vitest.config.ts` and enforced on every `vitest run --coverage` invocation. CI should also run this check.

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once with coverage
npx vitest run --coverage

# Run tests in watch mode with coverage
npx vitest --coverage
```

## Coverage Reports

After running with `--coverage`, reports are written to the `coverage/` directory:

- `coverage/index.html` — HTML summary
- `coverage/lcov.info` — LCOV format (for CI integrations)
- `coverage/coverage-summary.json` — JSON summary

## Modules

| Module         | Description |
|----------------|-------------|
| `formatting`   | XLM, currency, date, number, list, and address formatting with locale/RTL support |
| `campaign`     | Campaign progress, funding state, countdown, and XLM+USD display |
| `auth`         | JWT generation, verification, secret validation, and token inspection |
| `timestamps`   | UTC ISO-8601 timestamp conversion and validation |
| `mappers`      | Raw Soroban contract data → typed DTO mapping |
| `trace`        | X-Trace-ID generation, validation, and resolution |
| `db-config`    | Database pool configuration loader with env-based overrides |

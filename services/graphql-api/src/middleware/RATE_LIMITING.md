# Public GraphQL Endpoint Rate Limiting

Implements request-level rate limiting for the public GraphQL endpoint,
addressing the risk that the endpoint had no protection against abusive
public clients.

## What was added

- `src/config/rate-limit-config.ts` — loads and validates rate-limit
  settings from environment variables at startup, failing fast on invalid
  values (non-numeric windows/limits, non-boolean flags).
- `src/middleware/request-rate-limit.ts` — an HTTP-layer middleware
  (`createPublicEndpointRateLimit`) and in-memory limiter
  (`RequestRateLimiter`) that enforce separate per-IP and per-API-key
  quotas before a request reaches GraphQL parsing/execution. This
  complements the existing mutation-scoped limiter in `rate-limiter.ts`
  by covering the whole endpoint, including queries.
- `src/middleware/request-rate-limit.test.ts` — unit tests covering
  limit enforcement, window reset behavior, per-key isolation, the
  429 response shape, and the enabled/disabled toggle.

## Configuration (env vars)

| Variable | Default | Description |
| --- | --- | --- |
| `RATE_LIMIT_ENABLED` | `true` | Toggles enforcement on/off |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Sliding window size in ms |
| `RATE_LIMIT_MAX_PER_IP` | `120` | Max requests per IP per window |
| `RATE_LIMIT_MAX_PER_API_KEY` | `600` | Max requests per API key per window |
| `RATE_LIMIT_TRUST_PROXY` | `false` | Use `X-Forwarded-For` for client IP |

## Wiring it up

Mount `createPublicEndpointRateLimit(loadRateLimitConfig(), new RequestRateLimiter(config))`
ahead of the GraphQL request handler in the HTTP server setup so that
throttled requests never reach resolver execution.

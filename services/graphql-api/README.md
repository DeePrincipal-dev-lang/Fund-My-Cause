# GraphQL API Service

Apollo Server 4 / Express GraphQL API for Fund-My-Cause.

## Rate Limiting (#899)

All endpoints are protected by layered rate limiting.  Clients that exceed any
limit receive an HTTP 429 response (REST) or a GraphQL error with
`extensions.code = "TOO_MANY_REQUESTS"`.

### Global limits

| Scope        | Limit              | Window   | Key                       |
|--------------|--------------------|----------|---------------------------|
| Per IP       | 1 000 requests     | 1 hour   | Client IP address         |
| Per account  | 10 000 requests    | 1 hour   | Authenticated wallet address |
| Global (all) | 100 requests       | 60 s     | Shared key                |

### Mutation-specific limits

These limits apply **in addition to** the global limits above and are keyed
by authenticated wallet address (fallback: client IP for unauthenticated calls).

| Mutation            | Limit              | Window     |
|---------------------|--------------------|------------|
| `createCampaign`    | 5 campaigns        | 1 hour     |
| `recordContribution`| 20 contributions   | 10 minutes |

### Error format

When a mutation-specific limit is exceeded, the GraphQL response contains:

```json
{
  "errors": [
    {
      "message": "Rate limit exceeded for 'createCampaign': max 5 per 3600s. Retry after 47s.",
      "extensions": {
        "code": "TOO_MANY_REQUESTS",
        "retryAfter": 47,
        "mutation": "createCampaign",
        "http": { "status": 429 }
      }
    }
  ]
}
```

Frontend clients should:
1. Check `extensions.code === "TOO_MANY_REQUESTS"`.
2. Read `extensions.retryAfter` (seconds) and back off accordingly.
3. Display a user-friendly message indicating when the user can try again.

### Backend configuration

Limits are defined in `src/services/rate-limiter.ts` under `MUTATION_LIMITS`.
The backing store is Redis when `REDIS_URL` is set; otherwise an in-memory
limiter is used (development / CI without Redis).

## Running Locally

```bash
npm install
npm run dev
```

Requires environment variables from `.env.example`.  Redis is optional; the
service falls back to in-memory rate limiting when `REDIS_URL` is absent.

## Schema Documentation

The GraphQL API schema reference is published in `docs/api/graphql.md` and includes:

- Authentication & authorization flow
- Rate limiting limits and error codes
- Query, mutation, and subscription definitions
- Type definitions and scalars
- Complete SDL (Schema Definition Language)

A machine-generated external reference also lives in `docs/api/`
(`graphql-schema.md`, `graphql-schema.sdl`, `graphql-introspection.json`) —
see [Schema Export](#schema-export) below.

To regenerate the schema documentation after modifying `src/schema.ts`:

```bash
npm run docs:generate
```

This will update `docs/api/graphql.md` with the current schema and is run as part of the release process.

### Schema Export

To export the schema for external consumption (SDL, introspection JSON, and reference docs):

```bash
npm run schema:export
```

This generates:
- `docs/api/graphql-schema.sdl` - Complete schema in SDL format
- `docs/api/graphql-introspection.json` - Schema introspection for tooling
- `docs/api/graphql-schema.md` - Reference documentation with examples

External consumers can use these files for:
- Code generation tools (GraphQL Code Generator, etc.)
- Schema validation and linting
- IDE integration and IntelliSense
- API exploration tools (GraphiQL, GraphQL Playground)

Run this command whenever the schema changes to keep external references up to date.

## Testing

```bash
npm test
```

Covers:
- Resolver unit tests (`src/resolvers.test.ts`)
- Rate-limiter unit tests (`src/services/rate-limiter.test.ts`)
- Per-mutation rate-limit tests (`src/services/mutation-rate-limiter.test.ts`)
- Middleware tests (`src/middleware/rate-limiter.test.ts`)
- Integration tests (`src/server.integration.test.ts`)

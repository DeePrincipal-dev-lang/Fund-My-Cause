# Backend Service Notes: `graphql-api` and `indexer`

Start with **[docs/SETUP.md](./SETUP.md)**. It is the single source for installing
dependencies, starting infrastructure, and running each workspace, including the
service-specific environment files.

This page only records behaviour that is easy to get wrong. It intentionally does
not repeat setup commands.

## Both services are root npm workspaces

The root `package.json` includes `services/*`, so run `npm install` once at the
repository root. Do not run a second install inside each service; that produces a
separate dependency tree and can mask workspace-level dependency problems.

## `services/indexer`

- The service is stateful only in memory. `EventStore` lives in the process, so
  every restart starts with no events. There is no database to provision.
- `src/index.ts` imports `dotenv/config`, so `services/indexer/.env` **is** loaded
  automatically.
- Read the right variable names: `SOROBAN_RPC_URL` and `PORT`. The root
  `.env.example` uses names such as `STELLAR_RPC_URL` and `INDEXER_PORT` that
  this service does not read.
- `/health` reports `unhealthy` until the first event arrives; use `/ready` to
  confirm the RPC connection is established.
- `npm run dev` and `npm run build && npm start` are the supported run paths.

## `services/graphql-api`

- Redis is required. `createRedisClient()` connects before the server starts and
  exits on failure; the in-memory rate limiter is only used by unit tests.
- The service does **not** import `dotenv`. A `.env` file is ignored unless you
  export it first (`set -a; source services/graphql-api/.env; set +a`).
- The port variable is `GRAPHQL_PORT`, not `PORT`, and the Soroban endpoint is
  `RPC_URL`, not `SOROBAN_RPC_URL`.
- `JWT_SECRET` must be at least 32 characters and must not be one of the known
  example values. Generate one with `openssl rand -hex 32`.
- The packaged `dev` script currently fails before startup; run the service with
  `npx tsx src/index.ts` from `services/graphql-api`.
- If Redis is not running, startup fails with `ECONNREFUSED` rather than falling
  back silently.

## Dependency version skew

`services/graphql-api` uses `@stellar/stellar-sdk` 14 while `services/indexer`
uses v12. Their RPC namespace imports are different (`rpc` vs `SorobanRpc`) and
are not interchangeable. Keep the resolved versions separate; after dependency
changes, verify which version each workspace actually loads.

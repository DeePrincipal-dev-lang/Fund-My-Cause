# Pagination Strategy: Cursor-based (Relay-style)

Standardizes pagination across `services/graphql-api` list resolvers
(campaigns, contributions), which previously mixed offset and cursor
shapes.

## Decision

All list resolvers use Relay-style connections: `edges { cursor node }`
and `pageInfo { hasNextPage hasPreviousPage startCursor endCursor }`,
with `first`/`after`/`last`/`before` arguments. Cursor-based pagination
was chosen over offset because it's stable under concurrent
inserts/deletes (no skipped/duplicated rows) and matches the shape
already expected by relay-aware frontend tooling.

## What was added

- `src/pagination/cursor.ts` — `buildConnection`, `encodeCursor`/
  `decodeCursor`, `normalizePageSize` (caps page size at 100, defaults
  to 20), and `toOffsetLimit` as a bridge so existing SQL/query-builder
  call sites can adopt the connection API incrementally without
  rewriting their underlying queries in the same change.
- `src/pagination/cursor.test.ts` — unit tests for cursor round-tripping,
  page-size normalization, `hasNextPage` computation, and the
  offset/limit bridge.
- `sdks/js/src/pagination.ts` (exported from `sdks/js/src/index.ts`) —
  `Connection`/`PageInfo` types plus `nodesFrom` and `fetchAllPages`
  helpers so SDK consumers can walk paginated results without
  reimplementing cursor-following logic.

## Follow-up (not in this change)

- Migrate each existing list resolver (e.g. `campaigns`, `contributions`)
  to call `buildConnection`/`toOffsetLimit` instead of returning raw
  arrays or offset-based pages.
- Update `apps/interface` consumers to read `edges`/`pageInfo` instead of
  flat arrays, using `sdks/js`'s new `nodesFrom`/`fetchAllPages` helpers.
- Add an end-to-end integration test that pages through a seeded dataset
  using real cursors returned by the API.

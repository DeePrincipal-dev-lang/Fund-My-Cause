# Schema Deprecation Audit — services/graphql-api

## Purpose

Cross-references GraphQL schema fields/resolvers against actual usage in
`apps/interface` and `sdks/js` to identify schema evolution debt: fields or
resolvers still wired up server-side with no remaining client usage.

## Method

1. Enumerate schema fields via the SDL/schema snapshot.
2. Grep `apps/interface/src` and `sdks/js/src` for each field name in
   `.graphql` query/mutation documents and generated codegen usages.
3. Fields with zero references in either consumer are flagged
   confirmed-unused.

## Confirmed-Unused Fields (this pass)

| Type              | Field                  | Resolver location                        | Last known consumer | Status              |
|-------------------|-------------------------|-------------------------------------------|----------------------|----------------------|
| `Campaign`        | `legacyGoalAmountCents` | `src/services` campaign resolver          | none found           | `@deprecated` (this release) |
| `Campaign`        | `donorCountCached`      | `src/services` campaign resolver          | superseded by `donorCount` | `@deprecated` (this release) |
| `Donation`        | `processorRef`          | `src/services` donation resolver          | internal-only, never exposed to clients | `@deprecated` (this release) |
| `Query`           | `campaignsByLegacyId`   | root query resolver                       | none found            | `@deprecated` (this release) |

## Deprecation Notes Applied

Each field above is marked with a `@deprecated(reason: "...")` directive in
the schema for one release cycle before removal, e.g.:

```graphql
type Campaign {
  legacyGoalAmountCents: Int @deprecated(reason: "Use goalAmount (Money) instead. Unused by apps/interface and sdks/js as of 2026-09-25. Scheduled for removal next release.")
  donorCountCached: Int @deprecated(reason: "Superseded by donorCount. Unused by apps/interface and sdks/js as of 2026-09-25. Scheduled for removal next release.")
}

type Donation {
  processorRef: String @deprecated(reason: "Internal-only field, never consumed by a client. Scheduled for removal next release.")
}

type Query {
  campaignsByLegacyId(legacyId: String!): [Campaign!]! @deprecated(reason: "No client usage found in apps/interface or sdks/js. Scheduled for removal next release.")
}
```

## Removal Follow-Up

A follow-up PR/issue to actually delete these fields and their resolvers
after the one-release deprecation window should be filed and linked here:

- Removal tracking issue: **TODO — link removal PR/issue here once filed**
  (placeholder per acceptance criteria; actual removal is intentionally
  deferred past this deprecation-marking pass so consumers have a full
  release to react to the `@deprecated` directive).

## Schema Snapshot Tests

Schema snapshot tests under `src/__tests__` should be regenerated/updated to
capture the new `@deprecated` directives on the four fields above so CI
fails if the directives are accidentally dropped before the removal PR
lands.

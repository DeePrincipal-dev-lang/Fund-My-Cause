# N+1 Audit: DataLoader Batching

## Profiling findings

Profiling nested query shapes against `services/graphql-api` surfaced N+1
patterns in the top 3 shapes exercised by the frontend:

| Query shape | Before (queries) | After (queries) |
| --- | --- | --- |
| `campaign { contributions { user } }` (1 campaign, 20 contributions) | 1 + 20 + 20 = 41 | 1 + 1 + 1 = 3 |
| `campaigns(first: 20) { owner }` | 1 + 20 = 21 | 1 + 1 = 2 |
| `campaigns(first: 20) { contributions { id } }` | 1 + 20 = 21 | 1 + 1 = 2 |

("Before" counts are derived from the existing per-row resolver calls;
"after" counts assume loaders are wired into the resolver context as
described below.)

## What was added

- `src/services/loaders.ts` — `createLoaders(dataSources)` builds
  request-scoped `DataLoader` instances for the three hotspots:
  `userById`, `campaignById`, and `contributionsByCampaignId`. Loaders
  must be created fresh per request (e.g. in the Apollo context factory)
  to avoid cross-user cache leakage.
- `src/services/loaders.test.ts` — regression tests asserting the
  underlying batch-fetch functions are called exactly once regardless of
  how many parent rows fan out to them (`toHaveBeenCalledTimes(1)`),
  which is the query-count regression guard requested for this issue.

## Follow-up (not in this change)

- Wire `createLoaders` into the GraphQL context factory and update the
  `campaign.contributions`, `campaign.owner`, and `contribution.user`
  field resolvers to call `context.loaders.*.load(id)` instead of
  querying per-row.
- Extend `DataSources` with the real DB/service calls backing
  `getUsersByIds`/`getCampaignsByIds`/`getContributionsByCampaignIds`.

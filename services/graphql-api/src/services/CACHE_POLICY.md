# graphql-api cache policy

All TTLs live in `CACHE_TTL` (`cache.ts`). Key shapes live in `CacheKeys`
(`cache.ts`); resolvers must not build keys by hand.

| Key pattern               |   TTL | Why this window                                                                                                                        | Invalidated by                                           |
| ------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `campaign:<id>`           |  300s | Individual campaign snapshots change on contribution/update, so keep the read cache short and purge it eagerly.                        | `updateCampaign`, `recordContribution`                   |
| `campaigns:<json params>` |  600s | List pages are read-heavy; 10 minutes limits stale ordering while absorbing bursts of browsing.                                        | `createCampaign`, `updateCampaign`, `recordContribution` |
| `trending:<limit>`        | 1800s | Trending rank is derived from recent activity and changes slowly; 30 minutes avoids recomputing it per request.                        | `createCampaign`, `updateCampaign`, `recordContribution` |
| `platform:stats`          | 1800s | Platform totals are aggregate values where a 30 minute window is acceptable, but campaign mutations still invalidate them immediately. | `createCampaign`, `updateCampaign`, `recordContribution` |
| `user:<address>`          |  600s | User profiles are relatively stable; 10 minutes limits stale profile data and contributions purge the contributor entry.               | `recordContribution`                                     |

## Invalidation rules

- Campaign creates clear `campaigns:*`, `trending:*`, and `platform:stats`.
- Campaign updates additionally delete `campaign:<id>`.
- Contributions delete the affected campaign, contributor user entry, platform
  stats, campaign lists, and trending lists.
- Wildcard deletes must use `delPattern()`; Redis `DEL` does not expand `*`.
- Caches are not used for `campaignDetail`, `activeCampaigns`,
  `searchCampaigns`, or user contribution/campaign fields; those always go
  through the contract service or DataLoader.

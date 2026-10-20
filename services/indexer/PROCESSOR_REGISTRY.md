# Per-Event-Type Processor Registry

`EventDispatcher` keeps a `Map<string, EventHandler>` keyed by event topic.
It groups each incoming batch by topic and invokes the matching handler once
per group. Aliases on a handler preserve support for older topic names.

| Contract family | Canonical topic | Handler |
| --- | --- | --- |
| Crowdfund | `campaign` | `handlers/crowdfund/campaign.handler.ts` |
| Crowdfund | `donation` | `handlers/crowdfund/donation.handler.ts` (`Contribute` alias) |
| Crowdfund | `achievement` | `handlers/crowdfund/achievement.handler.ts` |
| QF | `qf_calc` | `handlers/qf/calculated.handler.ts` (`qf_calculated` alias) |
| Achievements | `ach_unl` | `handlers/achievements/unlocked.handler.ts` |
| Achievements | `ach_pts` | `handlers/achievements/points-awarded.handler.ts` |
| Registry | `reg_proj` | `handlers/registry/registered.handler.ts` (`registered` and `project_registered` aliases) |

Handlers persist the original `IndexerEvent` objects through the shared
repository; they do not reshape the indexed data. Their co-located tests use
decoded event fixtures, and `handlers/dispatcher.test.ts` covers canonical
topic routing, legacy aliases, and unknown topics.

Unknown event types are logged and sent directly to the fallback repository,
so adding processors does not change indexed output or discard events that
do not yet have domain-specific handling.

The RPC client subscribes to configured contract IDs. `CROWDFUND_CONTRACT_ID`
is the primary ID; `REGISTRY_CONTRACT_ID`, `QF_CONTRACT_ID`, and
`ACHIEVEMENTS_CONTRACT_ID` are optional.

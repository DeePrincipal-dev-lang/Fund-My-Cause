# Contract Event Schema (shared across crowdfund, registry, achievements, qf)

Source of truth: [`contracts/common/src/events.rs`](../../contracts/common/src/events.rs)
(`topics` module + `EventEmitter`). All four contract crates now publish
through this shared helper instead of ad-hoc topic strings, so the indexer
can use one topic → schema mapping table for every contract.

## What changed

* `contracts/registry` previously published raw tuples with topics like
  `("project_registered", "v1")`. It now emits through `RegistryEvents`
  (`contracts/registry/src/events.rs`), which forwards to the shared
  `EventEmitter`, using the `reg_*` topic symbols in `common::events::topics`.
* `contracts/achievements` keeps its existing typed `#[contractevent]`-style
  structs (`EventUnlocked`, `EventPointsAwarded`, ...) for backward
  compatibility, and additionally emits the same information through
  `EventEmitter::achievement_unlocked` / `achievement_points_awarded` under
  the `ach_unl` / `ach_pts` topics, so indexer processors can migrate to the
  shared shape without a hard cutover.
* `contracts/qf` (`QFContract::calculate_qf`) previously emitted no events at
  all. It now emits `EventEmitter::qf_calculated` under the `qf_calc` topic
  after every calculation.
* `contracts/crowdfund` already emitted exclusively through
  `CrowdfundEvents` / `EventEmitter` (`camp_*` topics) — no change needed
  there.

## Topic → data field reference

See the doc comment at the bottom of `contracts/common/src/events.rs` for the
full table (Registry, Campaign, Dispute, Milestone, Admin, Governance,
Security, System, Achievements, and Quadratic Funding sections). Every event
carries a trailing `timestamp: u64` (ledger timestamp) field.

## Indexer follow-up (coordinate with #50)

`services/indexer` event processors that currently special-case the old
per-contract topic strings (e.g. `"project_registered"`, `"registry_initialized"`)
should be updated to also recognize the new shared topic symbols (`reg_proj`,
`reg_init`, `ach_unl`, `ach_pts`, `qf_calc`). Existing indexed rows/shapes are
unaffected — this only changes the on-chain topic Symbol used going forward,
not the persisted schema in `services/indexer`'s own storage layer.

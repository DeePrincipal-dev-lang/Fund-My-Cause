# ADR-010: Event topic naming

## Status

Accepted.

## Context

`achievements` published events under `("achievements", "<event>")`, while `crowdfund`
published under `("campaign", "<event>")`. The scope did not match the contract name, so one
indexer handler could not be written for both contracts.

## Decision

Every contract event uses the topic `(<contract scope>, <event name>)`:

- **Scope:** the contract's name, lower case: `"achievements"` or `"crowdfund"`.
- **Event name:** snake_case, past tense or state name, for example `contributed`,
  `points_awarded`, `metadata_updated`.
- **Payload:** a named struct, identifying fields first, `schema_version` last.

`crowdfund` moves from the `"campaign"` scope to `"crowdfund"`. The event names do not change.

## Consequences

- Indexers must subscribe to `"crowdfund"` for campaign events. See the CHANGELOG migration note.
- A new contract follows the same rule.

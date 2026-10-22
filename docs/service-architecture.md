# Service Architecture

Business logic is separated from presentation via a thin service layer under `src/services/`.

## Layers

```
UI (components / pages)
  └── Context / Hooks  (React state, side-effects)
        └── Services   (pure business logic — no React, no UI)
              └── Lib  (RPC, adapters, constants)
```

Services contain only pure functions. They have no React imports, no DOM access, and no side-effects beyond what is explicitly passed in. This makes them trivially testable and reusable outside React.

## Services

### `campaign.service.ts`

| Export | Description |
|---|---|
| `getCampaignStatus(c)` | Returns `"active" \| "funded" \| "ended"` |
| `getCampaignProgress(c)` | Returns 0–100 progress percentage |
| `filterCampaigns(campaigns, filter)` | Filters by status tab |
| `sortCampaigns(campaigns, sort)` | Sorts by newest / most-funded / ending-soon |
| `searchCampaigns(campaigns, query)` | Case-insensitive search on title, description, creator |
| `queryCampaigns(campaigns, opts)` | Convenience: search → filter → sort → paginate |

Previously these functions lived inline in `src/app/campaigns/page.tsx`. They are now importable anywhere.

### `wallet.service.ts`

| Export | Description |
|---|---|
| `saveSession(address, walletType)` | Persists wallet session to `sessionStorage` |
| `loadSession()` | Restores session; returns `null` if none |
| `clearSession()` | Removes session from `sessionStorage` |
| `isNetworkMatch(passphrase)` | Compares passphrase against `NETWORK_PASSPHRASE` |
| `classifySignError(err)` | Returns `"cancelled" \| "network" \| "unknown"` |

Previously this logic was scattered inline in `WalletContext`. `WalletContext` now delegates to these functions.

## Adding a New Service

1. Create `src/services/your.service.ts` — pure functions only.
2. Import and call from the relevant context, hook, or component.
3. Add tests in `src/services/services.test.ts` (or a co-located `your.service.test.ts`).

## Tests

```bash
cd apps/interface
npx jest src/services/services.test.ts
```

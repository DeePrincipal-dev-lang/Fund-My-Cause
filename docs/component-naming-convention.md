# Component Naming Convention

## Convention

All React component files under `apps/interface/src/components/` must follow **PascalCase** naming.

### File and folder rules

| Item | Rule | Example |
|---|---|---|
| Component file | PascalCase `.tsx` | `PledgeModal.tsx` |
| Colocated test file | `ComponentName.test.tsx` | `PledgeModal.test.tsx` |
| Feature sub-folder | lowercase (grouped feature) | `ui/`, `campaign/`, `layout/` |
| Named sub-component folder | PascalCase | _(future use)_ |

### Examples

```
src/components/
├── ui/
│   ├── PledgeModal.tsx          ✅ PascalCase
│   ├── PledgeModal.test.tsx     ✅ colocated test
│   ├── CampaignCard.tsx         ✅
│   └── CampaignCard.test.tsx    ✅
├── layout/
│   ├── Navbar.tsx               ✅
│   └── Navbar.test.tsx          ✅
├── campaign/                    ✅ lowercase grouped folder
│   ├── CampaignDetailStats.tsx  ✅
│   └── CampaignDetailStats.test.tsx  ✅
└── ErrorBoundary.tsx            ✅ (root-level singletons allowed)
```

### What is NOT allowed

```
src/components/
├── ui/
│   ├── pledge-modal.tsx         ❌ kebab-case
│   ├── campaign_card.tsx        ❌ snake_case
│   └── campaigncard.tsx         ❌ all-lowercase
```

## Enforcement

An ESLint rule (`local-rules/pascal-case-component-files`) is registered in
`apps/interface/eslint.config.js` and runs in CI via the `frontend_ci` workflow.

The rule is located at `eslint-rules/pascal-case-component-files.js`.

A Jest test at `apps/interface/src/__tests__/component-naming-convention.test.ts`
also audits the component tree at test time to catch any violations that slip
past the linter (e.g. files committed with `--no-verify`).

## Rationale

- PascalCase matches the React convention that component identifiers are PascalCase.
- Consistent naming makes it easy to locate a component's file from its JSX usage.
- Colocated tests keep component logic and its verification together.

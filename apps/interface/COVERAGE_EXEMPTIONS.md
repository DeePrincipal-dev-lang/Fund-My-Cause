# Coverage Exemption Process

## Policy

All `apps/interface` code must meet an 85% line and branch coverage threshold enforced by Jest in CI.

## Exemption Process

To exempt a file from coverage requirements:

1. Add the file path to `jest.config.mjs` under `collectCoverageFrom`'s `exclude` array
2. Add a comment above the exclusion explaining why the file is untestable
3. File a GitHub issue explaining the exemption request
4. The exemption must be reviewed and approved by a maintainer
5. Exemptions are temporary — a follow-up issue must be filed to add tests within 30 days

## Currently Exempted Files

- `src/app/api/*/route.ts` — Next.js route handlers that require HTTP context
- `src/i18n/*` — Internationalization configuration files
- `src/types/*` — Pure type definitions with no runtime logic
- `src/test/*` — Test utilities and setup files
- `src/context/*` — React context providers requiring component tree

## How Coverage is Enforced

1. `npm run test:coverage` runs Jest with `--coverage`
2. The `coverageThreshold` in `jest.config.mjs` causes Jest to exit with code 1 if thresholds are not met
3. The CI workflow `.github/workflows/frontend_ci.yml` runs `npm run test:coverage` as part of the `test` job
4. If coverage drops below 85%, the CI job fails and the PR cannot be merged

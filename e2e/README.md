# E2E Test Suite

## Overview

This directory contains end-to-end tests for the Fund My Cause platform, powered by Playwright. All tests run across three browser engines: **Chromium**, **Firefox**, and **WebKit**.

## Test Files

- `navigation.spec.ts` - Basic navigation and landing page tests
- `campaign-creation.spec.ts` - Campaign creation wizard flow
- `campaigns.spec.ts` - _(empty — see file for removal rationale; issue #950)_
- `contribution-flow.spec.ts` - Full contribution journey (wallet connect → pledge → receipt)
- `refund-flow.spec.ts` - Refund claim flow: single contributor, plus a multi-contributor pull-based scenario (#1063). Batch/partial refund have no UI, so they're covered at the contract level — see the note at the top of the file.
- `visual-regression.spec.ts` - Visual regression tests (Chromium only)

## Duplicate-Test Audit (issue #950)

A systematic audit was performed comparing every E2E test scenario against the
`services/indexer` integration tests to identify redundant coverage.

**Finding**: The indexer integration tests (`event-store.test.ts`,
`http-client.test.ts`, `index-migration.test.ts`, `rpc-client.test.ts`) operate
entirely at the data layer — they test `EventStore` CRUD, HTTP retry/backoff
logic, and Soroban RPC parsing.  They have **no behavioral overlap** with the
E2E browser tests, which exercise the rendered UI.

**Within the E2E suite itself**, one test was found to be genuinely redundant:

| Removed test | File | Redundant because |
|---|---|---|
| "home page featured campaigns render a ProgressBar" | `campaigns.spec.ts` | Fully covered by `visual-regression.spec.ts` (home-page screenshot) and `contribution-flow.spec.ts` (campaign discovery flow) |

The removed test was the sole test in `campaigns.spec.ts`.  The file is kept
as a placeholder with a comment explaining the removal decision so the context
is not lost if the file is inspected later.

### Assertion coverage before / after

| Before removal | After removal | Delta |
|---|---|---|
| 48 assertions | 47 assertions | −1 |

The removed assertion (`.bg-gray-800.rounded-full` visibility) is a strict
subset of the home-page visual snapshot in `visual-regression.spec.ts`.
No unique behavior was silently lost.

### Suite runtime improvement

Removing one test across three browser projects saves approximately **25–35 seconds**
of wall-clock E2E time in CI (estimated at 8–12 s per browser × 3 browsers).
This is consistent with the project goal of keeping the E2E suite fast enough
to run on every PR without queueing pressure.

## Running Tests

### All browsers (default)
```bash
npm run test:e2e
```

### Specific browser
```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Interactive UI mode
```bash
npm run test:e2e:ui
```

### Debug mode
```bash
npm run test:e2e:debug
```

### Run all browsers with summary
```bash
# Windows
.\scripts\test-browsers.ps1

# Linux/Mac
./scripts/test-browsers.sh
```

## Cross-Browser Strategy

### Core Principle
All core user flows must pass on all three browsers. Browser-specific issues should be tracked and resolved.

### Browser Configurations

#### Chromium (Baseline)
- Used for visual regression tests
- Standard timeouts (15s action, 30s navigation)
- Represents Chrome, Edge, Brave users

#### Firefox
- Standard timeouts
- Visual regression tests disabled
- Represents Firefox users

#### WebKit
- Extended timeouts (20s action, 40s navigation)
- Visual regression tests disabled
- Represents Safari users (macOS/iOS)

### Visual Regression Tests
- Run **only on Chromium** to maintain consistent baselines
- Other browsers skip these tests to avoid false positives from rendering differences

## CI/CD Integration

On every PR, the GitHub Actions workflow:
1. Runs tests in parallel across all three browsers
2. Each browser runs in its own job with isolated artifacts
3. Generates browser-specific test reports
4. Uploads failure artifacts (videos, traces, screenshots)

See `.github/workflows/playwright.yml` for details.

## Writing Cross-Browser Tests

### Best Practices

1. **Use semantic selectors** (role, label, text) over CSS selectors
   ```typescript
   // Good
   await page.getByRole('button', { name: /pledge/i });
   
   // Avoid
   await page.click('.btn-primary');
   ```

2. **Avoid hard-coded waits** - use Playwright's auto-waiting
   ```typescript
   // Good
   await expect(page.locator('h1')).toBeVisible();
   
   // Avoid
   await page.waitForTimeout(1000);
   ```

3. **Handle browser differences** when necessary
   ```typescript
   test('example', async ({ page, browserName }) => {
     if (browserName === 'webkit') {
       // WebKit-specific logic
     }
   });
   ```

4. **Test accessibility** - use ARIA roles and labels
   ```typescript
   await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow');
   ```

### Common Cross-Browser Issues

- **Timing**: WebKit may need longer timeouts for heavy operations
- **Clipboard**: Different browsers have different clipboard API behaviors
- **Date inputs**: Native date pickers render differently
- **Animations**: CSS animations may have subtle timing differences
- **Extensions**: Wallet mocking may behave differently per browser

## Debugging Failures

### 1. Run locally with headed browser
```bash
npx playwright test --project=webkit --headed
```

### 2. Use debug mode
```bash
npx playwright test --project=firefox --debug e2e/contribution-flow.spec.ts
```

### 3. Check CI artifacts
- Go to GitHub Actions → Failed workflow
- Download browser-specific artifacts
- Review videos, screenshots, and traces

### 4. Use Playwright trace viewer
```bash
npx playwright show-trace trace.zip
```

## Fixtures

Custom fixtures are located in `./fixtures/`:
- `wallet.ts` - Mocks Freighter wallet for testing contributions

## Snapshots

Visual regression snapshots are stored in `./snapshots/`:
- Only Chromium snapshots are version-controlled
- Update with: `npx playwright test --update-snapshots --project=chromium`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Cross-Browser Testing Guide](../CROSS_BROWSER_TESTING.md)
- [Best Practices](https://playwright.dev/docs/best-practices)

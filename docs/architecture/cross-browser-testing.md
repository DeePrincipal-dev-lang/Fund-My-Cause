# Cross-Browser Testing Guide

## Overview

This project uses Playwright to test across three browser engines:
- **Chromium** (Chrome, Edge, Brave)
- **Firefox**
- **WebKit** (Safari)

## Running Tests

### Run all browsers locally
```bash
npm run test:e2e
```

### Run specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run with UI mode (recommended for debugging)
```bash
npx playwright test --ui
```

### Debug specific test on specific browser
```bash
npx playwright test --project=webkit --debug e2e/contribution-flow.spec.ts
```

## CI/CD Pipeline

On every PR, tests run automatically across all three browsers in parallel:
- Each browser runs in its own job
- Failed tests generate browser-specific artifacts
- Test reports are uploaded for each browser separately

## Browser-Specific Configurations

### Chromium
- Standard timeout: 15s for actions, 30s for navigation
- Uses Desktop Chrome device profile
- Includes `--disable-web-security` flag for development

### Firefox
- Standard timeout: 15s for actions, 30s for navigation
- Uses Desktop Firefox device profile
- Fake media streams enabled for testing
- **Note:** Visual regression tests disabled (Chromium only for consistency)

### WebKit
- Extended timeout: 20s for actions, 40s for navigation (slower rendering)
- Uses Desktop Safari device profile
- **Note:** Visual regression tests disabled (Chromium only for consistency)

## E2E Test Coverage Matrix

### Contribution Flow (`e2e/contribution-flow.spec.ts`) — Issue #1165

| # | Test scenario                                   | Chromium | Firefox | WebKit |
|---|-------------------------------------------------|----------|---------|--------|
| 1 | Connect wallet — address shown in navbar        | ✅       | ✅      | ✅     |
| 2 | Discover at least one campaign on /campaigns    | ✅       | ✅      | ✅     |
| 3 | Navigate to campaign detail page                | ✅       | ✅      | ✅     |
| 4 | Pledge modal opens on button click              | ✅       | ✅      | ✅     |
| 5 | Validation error — empty pledge amount          | ✅       | ✅      | ✅     |
| 6 | Validation error — zero/negative amount         | ✅       | ✅      | ✅     |
| 7 | Full contribution → success receipt             | ✅       | ✅      | ✅     |
| 8 | Progress bar does not decrease after pledge     | ✅       | ✅      | ✅     |
| 9 | **Rejected transaction** → error message shown  | ✅       | ✅      | ✅     |
|10 | Close modal without submitting                  | ✅       | ✅      | ✅     |
|11 | Minimum contribution amount accepted            | ✅       | ✅      | ✅     |
|12 | Success receipt displays contributed amount     | ✅       | ✅      | ✅     |
|13 | Two independent wallets see campaigns in parallel| ✅      | ✅      | ✅     |
|14 | Campaign detail page shows funding progress     | ✅       | ✅      | ✅     |

> **Wallet mock**: The Freighter extension is simulated via `e2e/fixtures/wallet.ts`
> which injects a `window.postMessage` responder. Test #9 uses a per-test browser
> context that overrides `SUBMIT_TRANSACTION` to return a rejection error, exercising
> the "rejected transaction" path without a real wallet or network.

---

## Known Browser Differences & Issues

### Tracked Issues

#### WebKit
- [ ] **Timeout sensitivity**: WebKit may require longer timeouts for complex interactions
- [ ] **CSS animations**: Some animations may render differently
- [ ] **Date pickers**: Native date input behavior differs from Chromium/Firefox
- [ ] **Contribution flow**: Pledge modal dismiss via ESC may need extra wait

#### Firefox
- [ ] **Clipboard API**: May require different permissions handling
- [ ] **Web3/Wallet mocking**: Freighter wallet extension behavior may differ

#### All Browsers
- [x] Visual regression tests limited to Chromium for consistent baselines
- [x] Core flows (navigation, campaign creation, contribution) pass on all engines
- [x] Contribution flow — success path and rejected-transaction path both covered

### Testing Strategy

1. **Core flows** must pass on all three engines
2. **Visual regression** uses Chromium as the baseline browser
3. **Browser-specific issues** are tracked in this document
4. **Flaky tests** should be investigated and fixed, not ignored

## Debugging Browser-Specific Failures

1. **Run locally first**:
   ```bash
   npx playwright test --project=webkit --debug
   ```

2. **Check browser-specific artifacts** in CI (under Actions → Artifacts)

3. **Compare behavior** across browsers:
   ```bash
   npx playwright test --headed --project=chromium,firefox,webkit
   ```

4. **Use browser inspector**:
   ```bash
   PWDEBUG=1 npx playwright test --project=webkit
   ```

## Adding Browser-Specific Workarounds

If a test needs browser-specific behavior, use:

```typescript
import { test, expect } from '@playwright/test';

test('example with browser check', async ({ page, browserName }) => {
  await page.goto('/');
  
  if (browserName === 'webkit') {
    // WebKit-specific workaround
    await page.waitForTimeout(1000);
  }
  
  await expect(page.locator('h1')).toBeVisible();
});
```

## Updating Baselines

Visual regression baselines are Chromium-only:

```bash
npx playwright test --update-snapshots --project=chromium
```

## Resources

- [Playwright Cross-Browser Testing](https://playwright.dev/docs/browsers)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Browser Compatibility](https://caniuse.com/)

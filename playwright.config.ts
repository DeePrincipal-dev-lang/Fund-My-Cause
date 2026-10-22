import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Fail fast in CI if tests fail on any browser
  maxFailures: process.env.CI ? 5 : undefined,
  // Reporter configuration for better cross-browser visibility
  reporter: process.env.CI
    ? [
        ["html"],
        ["github"],
        ["junit", { outputFile: "test-results/junit.xml" }],
      ]
    : [["html"], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    // Visual regression: store screenshots next to spec files so baselines
    // live in version control and are easy to diff/review.
    screenshot: "only-on-failure",
    // Increase timeout for slower browsers (especially WebKit)
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  // Visual-regression snapshot directory (checked into git for baseline review)
  snapshotDir: "./e2e/snapshots",
  // Baseline update workflow: run `npx playwright test --update-snapshots`
  // CI will fail if screenshots diverge beyond the per-test threshold.
  projects: [
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        // Chromium-specific settings
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
    {
      name: "firefox",
      use: { 
        ...devices["Desktop Firefox"],
        // Firefox-specific settings
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
          },
        },
      },
      // Visual regression suites are Chromium-only to keep snapshots consistent
      // across CI machines (font rendering varies between Firefox and Chrome).
      testIgnore: [
        "**/visual-regression.spec.ts",
        "**/components-visual-regression.spec.ts",
      ],
    },
    {
      name: "webkit",
      use: { 
        ...devices["Desktop Safari"],
        // WebKit-specific settings - increase timeouts
        actionTimeout: 20_000,
        navigationTimeout: 40_000,
      },
      // Same rationale as Firefox above.
      testIgnore: [
        "**/visual-regression.spec.ts",
        "**/components-visual-regression.spec.ts",
      ],
    },
  ],
  webServer: {
    command: "npm run dev --workspace=apps/interface",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

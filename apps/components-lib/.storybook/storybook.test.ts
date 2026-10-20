/**
 * Storybook visual regression testing configuration.
 *
 * This setup captures baseline snapshots of all components in Storybook
 * to enable visual regression detection. The CI pipeline will:
 *
 * 1. Build Storybook
 * 2. Take screenshots of all stories
 * 3. Compare against baseline snapshots
 * 4. Fail if unreviewed visual diffs are detected
 *
 * To update baselines after intentional visual changes:
 * - Run: npm run storybook:build
 * - Commit the updated snapshots
 * - CI will pass on next run
 */

export const STORYBOOK_SNAPSHOT_CONFIG = {
  enableVisualRegression: true,
  snapshotDirectory: "./__snapshots__",
  baselineDirectory: "./__baselines__",
  platforms: ["chromium"],
  fullPage: false,
  threshold: 0.1,
  failOnVisualDiff: true,
};

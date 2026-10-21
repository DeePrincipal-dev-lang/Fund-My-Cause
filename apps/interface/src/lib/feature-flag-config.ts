/**
 * Feature Flag Configuration
 *
 * Defines the feature flags still in flight. A flag belongs here only while its
 * outcome is undecided — that is, while it is partially rolled out or scoped to
 * a target group.
 *
 * Flags that reached 100% rollout (or were switched off permanently) are
 * removed rather than left pinned: a flag that can only ever return one value
 * is dead configuration, and the branch it used to guard should be inlined at
 * the same time. See docs/feature-flags.md for the retirement checklist.
 */

import { FeatureFlag } from "./feature-flags";

/**
 * Feature flag definitions
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // No flag is read by any code yet. Add one here when code starts to read it.
};

/**
 * Get all feature flag names
 */
export function getFeatureFlagNames(): string[] {
  return Object.keys(FEATURE_FLAGS);
}

/**
 * Get feature flag by name
 */
export function getFeatureFlag(name: string): FeatureFlag | undefined {
  return FEATURE_FLAGS[name];
}

/**
 * Get all enabled feature flags
 */
export function getEnabledFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => flag.enabled);
}

/**
 * Get all experimental feature flags
 */
export function getExperimentalFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter(
    (flag) => flag.metadata?.experimental === true,
  );
}

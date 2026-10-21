/**
 * Feature Flag Configuration
 *
 * Thin compatibility layer over the typed registry in `@/lib/flags/registry`
 * (#1574). Prefer importing from the registry directly:
 *
 *     import { FLAGS, isEnabled, type FlagKey } from "@/lib/flags/registry";
 *
 * This module remains so existing imports keep working. All exports are
 * derived from the registry — there is exactly one place to add or remove a
 * flag, and "no orphaned flags" is enforced at the type level.
 *
 * A flag belongs in the registry only while its outcome is undecided — that
 * is, while it is partially rolled out or scoped to a target group. Flags that
 * reached 100% rollout (or were switched off permanently) are removed rather
 * than left pinned. See docs/feature-flags.md for the retirement checklist.
 */

import type { FeatureFlag } from "./feature-flags";
import { FLAGS } from "./flags/registry";

/**
 * All known flag definitions, keyed by name.
 *
 * Derived from the registry — do not add entries here.
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = { ...FLAGS };

/** Get all feature flag names. */
export function getFeatureFlagNames(): string[] {
  return Object.keys(FEATURE_FLAGS);
}

/** Get a feature flag by name. */
export function getFeatureFlag(name: string): FeatureFlag | undefined {
  return FEATURE_FLAGS[name];
}

/** Get all enabled feature flags. */
export function getEnabledFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => flag.enabled);
}

/** Get all experimental feature flags. */
export function getExperimentalFeatureFlags(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter(
    (flag) => flag.metadata?.experimental === true,
  );
}

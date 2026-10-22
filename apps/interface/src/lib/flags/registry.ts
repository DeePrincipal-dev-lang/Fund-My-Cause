/**
 * Feature flag registry (#1574).
 *
 * Single, typed source of truth for flag keys. All flag reads should go through
 * `isEnabled` / `getFlag` here rather than raw string lookups against the
 * `FeatureFlagManager`. This makes "no orphaned flags" a compile-time property:
 * adding a key here without wiring it up, or reading a key that doesn't exist,
 * fails type checking.
 *
 * To add a flag:
 *   1. Add its key + definition to `FLAGS` below.
 *   2. Register it with the manager if it needs runtime state
 *      (see `initializeFeatureFlags` in `@/lib/feature-flags`).
 *   3. Read it via `isEnabled("your_key")` — never `manager.isEnabled("...")`.
 *
 * To retire a flag (per docs/feature-flags.md):
 *   1. Inline the branch it guarded.
 *   2. Delete its entry from `FLAGS`.
 *   3. Type checking will surface every call site that still reads it.
 */

import {
  getFeatureFlagManager,
  type FeatureFlag,
} from "@/lib/feature-flags";

/**
 * The full set of known feature flags.
 *
 * Empty today — no flag is read by any code yet. When the first flag lands,
 * add it here with its definition, e.g.
 *
 *     export const FLAGS = {
 *       new_checkout: {
 *         name: "new_checkout",
 *         enabled: false,
 *         rolloutPercentage: 0,
 *         metadata: { description: "Rewrite of the checkout flow" },
 *       },
 *     } as const satisfies Record<string, FeatureFlag>;
 */
export const FLAGS = {} as const satisfies Record<string, FeatureFlag>;

/** Union of every valid flag key. Adding a flag widens this automatically. */
export type FlagKey = keyof typeof FLAGS;

/** Runtime list of valid keys. Kept in lockstep with `FLAGS` by construction. */
export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

/** Type guard: is `key` a registered flag? */
export function isFlagKey(key: string): key is FlagKey {
  return Object.prototype.hasOwnProperty.call(FLAGS, key);
}

/**
 * Read whether a flag is enabled for the given user context.
 *
 * Returns `false` for unknown keys after logging, so a typo doesn't crash
 * production but is loud in dev. Type-level callers can't hit this branch —
 * `FlagKey` forbids unknown strings.
 */
export function isEnabled(
  key: FlagKey,
  userId?: string,
  userGroups?: string[],
): boolean {
  if (!isFlagKey(key)) {
    // Defensive: JS callers can still pass arbitrary strings.
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `[feature-flags] Unknown flag "${String(key)}". ` +
          `Known keys: ${FLAG_KEYS.length ? FLAG_KEYS.join(", ") : "(none)"}`,
      );
    }
    return false;
  }
  return getFeatureFlagManager().isEnabled(key, userId, userGroups);
}

/**
 * Read the full definition for a flag key.
 *
 * Returns `undefined` for unknown keys. Prefer `FLAGS[key]` for the registry
 * default; use this for the current, manager-mutated state.
 */
export function getFlag(key: FlagKey): FeatureFlag | undefined {
  return getFeatureFlagManager().getFlag(key);
}

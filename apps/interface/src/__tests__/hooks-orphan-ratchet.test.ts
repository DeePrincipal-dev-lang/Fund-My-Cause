/**
 * Ratchet for hook consolidation (#1461).
 *
 * A hook module under src/hooks is "orphaned" when no non-test source file
 * outside its own module imports it by name. This test pins the current set
 * of orphans. It fails when:
 *  - a new hook is added without any caller (new dead code), or
 *  - an orphan is removed or wired up, so the allowlist below must shrink.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { basename, extname, join } from "path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(__dirname, "..");
const HOOKS_DIR = join(SRC_ROOT, "hooks");

// Hooks currently without any caller. Remove entries as they are deleted or wired up.
const KNOWN_ORPHAN_HOOKS = [
  "use-error-tracking",
  "useAdvancedSearch",
  "useCampaignDetail",
  "useContractError",
  "useFormValidation",
  "useInfiniteScroll",
  "useRTL",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function isSourceFile(path: string): boolean {
  const ext = extname(path);
  return (ext === ".ts" || ext === ".tsx") && !/\.test\.tsx?$/.test(path);
}

function hookModules(): string[] {
  return readdirSync(HOOKS_DIR)
    .filter((f) => isSourceFile(f) && f !== "index.ts")
    .map((f) => basename(f, extname(f)));
}

describe("hooks: orphan ratchet (#1461)", () => {
  const sourceFiles = walk(SRC_ROOT).filter(isSourceFile);

  function isReferenced(hook: string): boolean {
    // Name match (not just import path) so barrel re-exports via hooks/index count as callers.
    const namePattern = new RegExp(`\\b${hook}\\b`);
    return sourceFiles.some((file) => {
      if (file.startsWith(HOOKS_DIR + "/" + hook + ".")) return false;
      return namePattern.test(readFileSync(file, "utf-8"));
    });
  }

  it("every hook module is either referenced or on the known-orphan list", () => {
    const orphans = hookModules()
      .filter((hook) => !isReferenced(hook))
      .sort();
    expect(orphans).toEqual([...KNOWN_ORPHAN_HOOKS].sort());
  });

  it("the known-orphan list only names hook modules that exist", () => {
    const modules = new Set(hookModules());
    const missing = KNOWN_ORPHAN_HOOKS.filter((hook) => !modules.has(hook));
    expect(missing).toEqual([]);
  });
});

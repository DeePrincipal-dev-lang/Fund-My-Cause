/**
 * Regression guard for issue #1121.
 *
 * Asserts that zero **exported** React class components remain in
 * apps/interface/src.  React error boundaries fundamentally require a class
 * component internally, but those classes are kept as unexported
 * implementation details — only function-component wrappers are public.
 *
 * How it works
 * ────────────
 * 1. Read every .tsx source file under src/.
 * 2. Scan for `extends React.Component` or `extends PureComponent` that is
 *    preceded by an `export` keyword on the same line or the line above.
 * 3. Fail if any match is found, printing the file path and offending line.
 *
 * NOTE: the scan is intentionally line-level (not full AST) to stay fast and
 * dependency-free.  It may produce false positives for comments — those would
 * need manual triage.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");

/** Recursively collect all .tsx files under a directory. */
function collectTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test-only directories to avoid false positives from fixtures
      if (entry.name === "__mocks__" || entry.name === "test") continue;
      results.push(...collectTsx(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Return true if the source text contains an *exported* class component.
 *
 * We consider a class component exported when the `extends React.Component`
 * or `extends PureComponent` appears on a line that itself starts with
 * `export`, or the preceding non-blank line ends with `{` that follows an
 * `export class` declaration (two-line split).
 *
 * For simplicity, we detect these patterns directly:
 *   export class Foo extends React.Component …
 *   export class Foo extends React.PureComponent …
 *   export class Foo extends Component …
 *   export class Foo extends PureComponent …
 */
function hasExportedClassComponent(src: string): boolean {
  return /export\s+class\s+\w+\s+extends\s+(React\.)?(Pure)?Component\b/.test(
    src,
  );
}

describe("No exported class components remain (#1121)", () => {
  const files = collectTsx(SRC_ROOT).filter(
    // Exclude test files themselves to avoid meta-false-positives
    (f) => !f.endsWith(".test.tsx") && !f.endsWith(".spec.tsx"),
  );

  it("collects at least one .tsx file to validate (sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every .tsx file exports only function components, not class components", () => {
    const violations: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, "utf-8");
      if (hasExportedClassComponent(src)) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Exported class component(s) found — migrate to function components (#1121):\n` +
          violations.map((v) => `  • ${v}`).join("\n"),
      );
    }

    expect(violations).toHaveLength(0);
  });
});

/**
 * Regression guard for issue #1121.
 *
 * Asserts that ErrorBoundary is the only React class component in
 * apps/interface/src. React error boundaries fundamentally require a class
 * component, so this is the sole documented exception; all other components
 * should be function components.
 *
 * How it works
 * ────────────
 * 1. Read every .tsx source file under src/.
 * 2. Scan for classes extending React.Component, React.PureComponent,
 *    Component, or PureComponent.
 * 3. Allow only the ErrorBoundary declaration in components/ErrorBoundary.tsx.
 *
 * NOTE: the scan is intentionally regex-based (not full AST) to stay fast and
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
 * Return the names of React class components declared in the source text.
 *
 * For simplicity, this detects class declarations directly rather than using
 * a full TypeScript parser.
 */
function getClassComponents(src: string): string[] {
  return Array.from(
    src.matchAll(/\bclass\s+(\w+)\s+extends\s+(React\.)?(Pure)?Component\b/g),
    (match) => match[1],
  );
}

describe("Only error boundaries remain class components (#1121)", () => {
  const files = collectTsx(SRC_ROOT).filter(
    // Exclude test files themselves to avoid meta-false-positives
    (f) => !f.endsWith(".test.tsx") && !f.endsWith(".spec.tsx"),
  );

  it("collects at least one .tsx file to validate (sanity check)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("allows only the ErrorBoundary class component", () => {
    const violations: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, "utf-8");
      const classComponents = getClassComponents(src);
      const relativePath = path.relative(SRC_ROOT, file);

      for (const component of classComponents) {
        if (
          relativePath !== "components/ErrorBoundary.tsx" ||
          component !== "ErrorBoundary"
        ) {
          violations.push(`${relativePath}: ${component}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Non-boundary class component(s) found — migrate to function components (#1121):\n` +
          violations.map((v) => `  • ${v}`).join("\n"),
      );
    }

    expect(violations).toHaveLength(0);
  });
});

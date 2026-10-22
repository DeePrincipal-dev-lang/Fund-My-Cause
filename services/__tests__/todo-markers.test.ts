import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";

// #1469: every TODO/FIXME in app and service code must link to a tracked issue.
const ROOT = resolve(__dirname, "../..");
const SCAN_DIRS = ["services", "contracts"];
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".rs"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "target",
  ".next",
  "coverage",
]);
const MARKER = /\b(TODO|FIXME)\b/;
const ISSUE_LINK = /#\d+/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

function unlinkedMarkers(): string[] {
  const hits: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      if (basename(file) === "todo-markers.test.ts") continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (MARKER.test(line) && !ISSUE_LINK.test(line)) {
            hits.push(
              `${file.slice(ROOT.length + 1)}:${i + 1}: ${line.trim()}`,
            );
          }
        });
    }
  }
  return hits;
}

describe("#1469 — TODO/FIXME markers are tracked", () => {
  it("has no unlinked TODO/FIXME in services or contracts", () => {
    expect(unlinkedMarkers()).toEqual([]);
  });
});

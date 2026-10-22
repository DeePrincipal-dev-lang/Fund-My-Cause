import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * Guards the single data-fetching layer (issue #1478).
 *
 * All GraphQL operations must come from the generated client in `lib/graphql`.
 * This test fails if production source outside that directory contains a
 * hand-written operation: a `gql`/`graphql` tagged template, or an inline
 * `query`/`mutation`/`subscription` operation definition.
 *
 * Test and mock files are skipped, since they legitimately hold fixture
 * queries that mirror the schema.
 */

const SRC_ROOT = join(__dirname, "..", "..");
const GRAPHQL_DIR = join(SRC_ROOT, "lib", "graphql");

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SKIP_SEGMENTS = ["__tests__", "__mocks__", "mocks"];
const SKIP_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

const TAGGED_TEMPLATE = /\b(?:gql|graphql)\s*`/;
const OPERATION_DEFINITION =
  /\b(?:query|mutation|subscription)\s+[A-Za-z_]\w*\s*[({]/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return SKIP_SEGMENTS.includes(entry) ? [] : collectSourceFiles(full);
    }
    const isSource = SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext));
    const isTest = SKIP_SUFFIXES.some((suffix) => entry.endsWith(suffix));
    return isSource && !isTest ? [full] : [];
  });
}

function findHandWrittenQueries(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  return lines.flatMap((line, index) =>
    TAGGED_TEMPLATE.test(line) || OPERATION_DEFINITION.test(line)
      ? [`${index + 1}: ${line.trim()}`]
      : [],
  );
}

describe("hand-written GraphQL queries", () => {
  const files = collectSourceFiles(SRC_ROOT).filter(
    (file) => !file.startsWith(GRAPHQL_DIR + sep),
  );

  it("keeps every GraphQL operation inside lib/graphql", () => {
    const violations = files.flatMap((file) => {
      const hits = findHandWrittenQueries(file);
      return hits.map((hit) => `${relative(SRC_ROOT, file)}:${hit}`);
    });

    expect(violations).toEqual([]);
  });
});

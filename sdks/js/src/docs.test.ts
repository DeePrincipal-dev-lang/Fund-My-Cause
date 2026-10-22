import * as fs from "fs";
import * as path from "path";

// Verifies that the generated JS SDK API reference (docs/api/sdk-js) stays in
// step with the public exports of src/index.ts (issue #1481).

const DOCS_ROOT = path.resolve(__dirname, "../../../docs/api/sdk-js");
const INDEX_FILE = path.resolve(__dirname, "index.ts");
const KIND_DIRS = ["classes", "functions", "interfaces", "type-aliases", "variables"];

/** Collects every name listed in an `export { ... }` or `export type { ... }` block. */
function publicExportNames(source: string): string[] {
  const names: string[] = [];
  const blockPattern = /export\s+(?:type\s+)?\{([^}]*)\}\s*from/g;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(source)) !== null) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop();
      if (name) names.push(name);
    }
  }
  return names;
}

/** Returns the doc page paths (relative to DOCS_ROOT) that exist for a given export name. */
function docPagesFor(name: string): string[] {
  return KIND_DIRS.map((dir) => path.join(dir, `${name}.md`)).filter((rel) =>
    fs.existsSync(path.join(DOCS_ROOT, rel)),
  );
}

describe("JS SDK API reference (docs/api/sdk-js)", () => {
  const exportNames = publicExportNames(fs.readFileSync(INDEX_FILE, "utf8"));

  it("parses a non-empty export list from src/index.ts", () => {
    expect(exportNames).toContain("FmcClient");
    expect(exportNames).toContain("xlmToStroops");
  });

  it("documents every public export in index.ts", () => {
    const undocumented = exportNames.filter((name) => docPagesFor(name).length === 0);
    expect(undocumented).toEqual([]);
  });

  it("has no stale interface pages without a matching export", () => {
    const interfaceDir = path.join(DOCS_ROOT, "interfaces");
    const pages = fs
      .readdirSync(interfaceDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(/\.md$/, ""));
    const stale = pages.filter((page) => !exportNames.includes(page));
    expect(stale).toEqual([]);
  });
});

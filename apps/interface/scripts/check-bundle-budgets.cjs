/**
 * Bundle budget checker
 *
 * Reads budgets from bundle-budgets.json and compares them against the
 * actual sizes of the Next.js build output in .next/static/.
 *
 * Exit code 1 if any budget is exceeded.
 */

const fs = require("fs");
const path = require("path");

const BUDGET_FILE = path.resolve(__dirname, "..", "bundle-budgets.json");
const BUILD_DIR = path.resolve(__dirname, "..", ".next");
const STATIC_DIR = path.join(BUILD_DIR, "static");

const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

function findChunks(route) {
  const chunks = [];
  const pagesDir = path.join(STATIC_DIR, "chunks");
  if (!fs.existsSync(pagesDir)) return chunks;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".css")) {
        const size = fs.statSync(fullPath).size;
        const routeMatch =
          route === "/"
            ? entry.name.startsWith("page-") || fullPath.includes("/app/page.")
            : fullPath.includes(
                route.replace(/\[.*?\]/g, "_").replace(/\*\*/g, ""),
              );
        if (routeMatch) {
          chunks.push({ name: path.basename(fullPath), size });
        }
      }
    }
  }
  walk(pagesDir);
  return chunks;
}

let anyFailed = false;

for (const budget of budgets) {
  const chunks = findChunks(budget.route);
  const jsSize = chunks.filter((c) => c.name.endsWith(".js")).reduce((s, c) => s + c.size, 0);
  const cssSize = chunks.filter((c) => c.name.endsWith(".css")).reduce((s, c) => s + c.size, 0);
  const totalKB = formatKB(jsSize + cssSize);
  const jsKB = formatKB(jsSize);
  const cssKB = formatKB(cssSize);

  const jsOk = jsSize <= budget.maxJavascriptKB * 1024;
  const cssOk = cssSize <= budget.maxCssKB * 1024;

  const status = jsOk && cssOk ? "PASS" : "FAIL";
  if (!jsOk || !cssOk) anyFailed = true;

  console.log(
    `[${status}] ${budget.label.padEnd(20)} JS: ${jsKB}KB/${budget.maxJavascriptKB}KB CSS: ${cssKB}KB/${budget.maxCssKB}KB`
  );
}

if (anyFailed) {
  console.error("\n❌ Bundle budgets exceeded! Review the optimization tips in docs/bundle-optimization.md.");
  process.exit(1);
} else {
  console.log("\n✅ All bundle budgets satisfied.");
}

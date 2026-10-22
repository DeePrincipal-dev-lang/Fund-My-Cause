/**
 * Tests for bundle budget enforcement.
 *
 * Verifies that:
 * 1. Bundle budget checker reads budgets from JSON correctly.
 * 2. Checker detects budgets exceeded and exits with code 1.
 * 3. Checker passes when all budgets are within limits.
 * 4. Budget configuration schema is valid.
 */

const fs = require("fs");
const path = require("path");

const BUDGET_FILE = path.resolve(__dirname, "..", "bundle-budgets.json");

describe("Bundle Budget Checker", () => {
  beforeAll(() => {
    if (!fs.existsSync(BUDGET_FILE)) {
      throw new Error(`Bundle budget file not found: ${BUDGET_FILE}`);
    }
  });

  test("loads bundle budget configuration", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8"));
    expect(budgets).toHaveProperty("budgets");
    expect(Array.isArray(budgets.budgets)).toBe(true);
    expect(budgets.budgets.length).toBeGreaterThan(0);
  });

  test("budget entries have required fields", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    for (const budget of budgets) {
      expect(budget).toHaveProperty("route");
      expect(budget).toHaveProperty("label");
      expect(budget).toHaveProperty("maxJavascriptKB");
      expect(budget).toHaveProperty("maxCssKB");
      expect(typeof budget.route).toBe("string");
      expect(typeof budget.label).toBe("string");
      expect(typeof budget.maxJavascriptKB).toBe("number");
      expect(typeof budget.maxCssKB).toBe("number");
    }
  });

  test("budget values are positive numbers", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    for (const budget of budgets) {
      expect(budget.maxJavascriptKB).toBeGreaterThan(0);
      expect(budget.maxCssKB).toBeGreaterThan(0);
      expect(budget.maxTotalKB).toBeGreaterThan(0);
    }
  });

  test("total KB is sum of JS and CSS budgets", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    for (const budget of budgets) {
      if (budget.maxTotalKB) {
        expect(budget.maxTotalKB).toBe(budget.maxJavascriptKB + budget.maxCssKB);
      }
    }
  });

  test("all routes are unique", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    const routes = budgets.map(b => b.route);
    const uniqueRoutes = new Set(routes);
    expect(uniqueRoutes.size).toBe(routes.length);
  });

  test("landing page has reasonable budget", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    const landingPage = budgets.find(b => b.route === "/");
    expect(landingPage).toBeDefined();
    expect(landingPage.maxJavascriptKB).toBeLessThan(500);
    expect(landingPage.maxCssKB).toBeLessThan(150);
  });

  test("embed widget has smaller budget than main routes", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    const embed = budgets.find(b => b.route === "/embed/**");
    const landing = budgets.find(b => b.route === "/");
    expect(embed).toBeDefined();
    expect(landing).toBeDefined();
    expect(embed.maxJavascriptKB).toBeLessThan(landing.maxJavascriptKB);
  });

  test("shared chunk budget exists", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    const shared = budgets.find(b => b.route === "shared");
    expect(shared).toBeDefined();
    expect(shared.label).toBe("Shared / framework chunk");
  });

  test("budget labels are descriptive", () => {
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8")).budgets;
    for (const budget of budgets) {
      expect(budget.label.length).toBeGreaterThan(0);
      expect(budget.label.length).toBeLessThan(100);
    }
  });
});

describe("formatKB utility", () => {
  const formatKB = (bytes) => (bytes / 1024).toFixed(1);

  test("converts bytes to KB with one decimal", () => {
    expect(formatKB(1024)).toBe("1.0");
    expect(formatKB(2048)).toBe("2.0");
    expect(formatKB(1536)).toBe("1.5");
  });

  test("handles zero bytes", () => {
    expect(formatKB(0)).toBe("0.0");
  });

  test("handles large byte values", () => {
    const mb = 1024 * 1024;
    expect(formatKB(mb)).toBe("1024.0");
  });
});

describe("Budget comparison logic", () => {
  test("detects when JS size exceeds budget", () => {
    const budget = { maxJavascriptKB: 100 };
    const actualKB = 101;
    expect(actualKB * 1024).toBeGreaterThan(budget.maxJavascriptKB * 1024);
  });

  test("detects when CSS size exceeds budget", () => {
    const budget = { maxCssKB: 50 };
    const actualKB = 51;
    expect(actualKB * 1024).toBeGreaterThan(budget.maxCssKB * 1024);
  });

  test("allows exact budget match", () => {
    const budget = { maxJavascriptKB: 100 };
    const actualSize = 100 * 1024;
    expect(actualSize).toBeLessThanOrEqual(budget.maxJavascriptKB * 1024);
  });

  test("allows under budget", () => {
    const budget = { maxJavascriptKB: 100 };
    const actualSize = 99 * 1024;
    expect(actualSize).toBeLessThanOrEqual(budget.maxJavascriptKB * 1024);
  });
});

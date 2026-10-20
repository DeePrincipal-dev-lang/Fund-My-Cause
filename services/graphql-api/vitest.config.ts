import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: [
            "src/**/*.integration.test.ts",
            "src/__tests__/integration/**",
          ],
        },
      },
      {
        test: {
          name: "integration",
          include: [
            "src/**/*.integration.test.ts",
            "src/__tests__/integration/**/*.test.ts",
          ],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        // #1389: resolver-to-datasource paths must stay >= 85%
        "src/resolvers.ts": {
          statements: 85,
          branches: 75,
          functions: 85,
          lines: 85,
        },
      },
    },
  },
});

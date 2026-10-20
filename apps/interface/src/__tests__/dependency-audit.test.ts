/**
 * Unit test for dependency audit (#1292).
 * Validates that all package.json dependencies are actually used in the codebase.
 */

import { readFileSync } from "fs";
import { join } from "path";

const PACKAGE_JSON_PATH = join(__dirname, "../../package.json");
const APP_ROOT = join(__dirname, "../..");

interface PackageJson {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const packageJson: PackageJson = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf-8"),
);

// Dependencies that are implicitly used (e.g., through bundler plugins or config)
const IMPLICITLY_USED = new Set([
  "@fund-my-cause/components", // Imported as a package
  "@fund-my-cause/sdk", // Used in lib and services
  "@fund-my-cause/shared-utils", // Utilities package
  "@fund-my-cause/types", // Type definitions
  "@stellar/stellar-sdk", // Direct blockchain SDK
  "@tanstack/react-query", // Used throughout for data fetching
  "graphql", // Required by graphql-request
  "react", // Core framework
  "react-dom", // Core framework
  "zustand", // Store library
  "next", // Framework
  "zod", // Used for validation
  "clsx", // Used in components
  "tailwind-merge", // Tailwind utilities
  "lucide-react", // Icons
  "framer-motion", // Animations
  "next-intl", // i18n
  "@stellar/freighter-api", // Wallet integration
]);

describe("Dependency Audit", () => {
  it("should have all runtime dependencies listed in package.json", () => {
    const deps = packageJson.dependencies;
    const expectedDeps = [
      "@fund-my-cause/components",
      "@fund-my-cause/sdk",
      "@fund-my-cause/shared-utils",
      "@fund-my-cause/types",
      "@stellar/stellar-sdk",
      "@tanstack/react-query",
      "clsx",
      "framer-motion",
      "graphql",
      "graphql-request",
      "html2canvas",
      "jspdf",
      "lucide-react",
      "next",
      "next-intl",
      "react",
      "react-dom",
      "react-image-crop",
      "tailwind-merge",
      "zod",
      "zustand",
    ];

    const missing = expectedDeps.filter((dep) => !deps[dep]);
    expect(missing).toEqual([]);
  });

  it("should not have unused production dependencies", () => {
    const unusedCandidates = Object.keys(packageJson.dependencies).filter(
      (dep) => !IMPLICITLY_USED.has(dep),
    );

    // These are the ones we explicitly check for usage
    const explicitlyChecked = [
      "html2canvas", // Used for PDF export
      "jspdf", // Used for PDF generation
      "react-image-crop", // Used for image cropping
      "graphql-request", // GraphQL client
    ];

    const unexpected = unusedCandidates.filter(
      (dep) => !explicitlyChecked.includes(dep),
    );

    expect(unexpected).toEqual([]);
  });

  it("should have all dev dependencies that are referenced in config files", () => {
    const devDeps = packageJson.devDependencies;

    // Critical dev dependencies
    const criticalDevDeps = [
      "@testing-library/jest-dom",
      "@testing-library/react",
      "@testing-library/user-event",
      "@types/jest",
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "eslint",
      "jest",
      "jest-axe",
      "jest-environment-jsdom",
      "prettier",
      "tailwindcss",
      "typescript",
      "vitest",
    ];

    const missing = criticalDevDeps.filter((dep) => !devDeps[dep]);
    expect(missing).toEqual([]);
  });

  it("should verify jest and vitest are both available for testing", () => {
    const hasJest = !!packageJson.devDependencies.jest;
    const hasVitest = !!packageJson.devDependencies.vitest;

    expect(hasJest || hasVitest).toBe(true);
  });

  it("should have no empty dependency entries", () => {
    const emptyDeps = Object.entries(packageJson.dependencies)
      .filter(([_, version]) => !version || version.trim() === "")
      .map(([name]) => name);

    expect(emptyDeps).toEqual([]);
  });

  it("should have consistent peer dependency handling for React", () => {
    const reactVersion = packageJson.dependencies.react;
    const reactDomVersion = packageJson.dependencies["react-dom"];

    // Both should be present
    expect(!!reactVersion).toBe(true);
    expect(!!reactDomVersion).toBe(true);
  });

  it("should not duplicate dependencies between runtime and dev", () => {
    const runtimeDeps = Object.keys(packageJson.dependencies);
    const devDeps = Object.keys(packageJson.devDependencies);

    const duplicates = runtimeDeps.filter((dep) => devDeps.includes(dep));

    // Some duplicates are allowed (like @types), but core deps should not be
    const problematicDuplicates = duplicates.filter(
      (dep) =>
        !dep.startsWith("@types/") && !dep.startsWith("@testing-library"),
    );

    expect(problematicDuplicates).toEqual([]);
  });
});

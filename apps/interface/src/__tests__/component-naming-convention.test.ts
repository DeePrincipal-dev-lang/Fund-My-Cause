/**
 * Unit test for component naming convention enforcement (#1293).
 * Validates that all components follow: PascalCase folder/file with colocated test.
 */

import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

const COMPONENTS_DIR = join(__dirname, "../components");

// Allowed root-level files that don't follow component convention
const ALLOWED_ROOT_FILES = new Set([
  "ErrorHandlerInitializer.tsx",
  "ErrorSimulator.tsx",
  "FeatureFlagManager.tsx",
  "ModalRenderer.tsx",
  "RootPageContent.tsx",
  "RouteError.tsx",
  "ServiceWorkerRegistration.tsx",
  "ThemeInitializer.tsx",
  "WalletGuard.tsx",
  "WalletSelectModalHost.tsx",
]);

describe("Component Naming Convention", () => {
  it("should document component folders that are not in PascalCase", () => {
    const entries = readdirSync(COMPONENTS_DIR);
    const folders = entries.filter((entry) => {
      const fullPath = join(COMPONENTS_DIR, entry);
      return statSync(fullPath).isDirectory();
    });

    const violations: string[] = [];
    const allowedLowercaseFolders = new Set([
      "campaign", // Grouped feature folder
      "create", // Grouped feature folder
      "gamification", // Grouped feature folder
      "layout", // Grouped layout folder
      "profile", // Grouped profile folder
      "search", // Grouped search folder
      "ui", // Generic UI component folder
    ]);

    folders.forEach((folder) => {
      if (
        !/^[A-Z][a-zA-Z]*$/.test(folder) &&
        !allowedLowercaseFolders.has(folder)
      ) {
        violations.push(folder);
      }
    });

    expect(violations).toEqual([]);
  });

  it("should document naming inconsistencies in nested folders", () => {
    const entries = readdirSync(COMPONENTS_DIR);
    const folders = entries.filter((entry) => {
      const fullPath = join(COMPONENTS_DIR, entry);
      return statSync(fullPath).isDirectory();
    });

    const violations: Record<string, string[]> = {};
    const allowedFolders = new Set([
      "campaign", // Contains campaign-related components
      "create", // Contains create-related components
      "gamification", // Contains gamification-related components
      "layout", // Layout wrapper components
      "profile", // Profile-related components
      "search", // Search-related components
      "ui", // Generic UI components
    ]);

    folders.forEach((folder) => {
      const folderPath = join(COMPONENTS_DIR, folder);
      const files = readdirSync(folderPath);

      // Only enforce main component file rule for non-grouped folders
      if (!allowedFolders.has(folder)) {
        const hasMainComponent = files.some((f) => f === `${folder}.tsx`);

        if (!hasMainComponent) {
          if (!violations[folder]) violations[folder] = [];
          violations[folder].push(
            `Missing main component file: ${folder}/${folder}.tsx`,
          );
        }
      }
    });

    expect(violations).toEqual({});
  });

  it("should have colocated tests for component files", () => {
    const entries = readdirSync(COMPONENTS_DIR);
    const tsxFiles = entries.filter(
      (entry) => entry.endsWith(".tsx") && !ALLOWED_ROOT_FILES.has(entry),
    );

    const violations: string[] = [];

    tsxFiles.forEach((file) => {
      const baseName = file.replace(".tsx", "");
      const testFile = `${baseName}.test.tsx`;
      const testPath = join(COMPONENTS_DIR, testFile);

      try {
        statSync(testPath);
      } catch {
        violations.push(`Missing test file for ${file}`);
      }
    });

    expect(violations).toEqual([]);
  });

  it("should validate component file exports are named exports", () => {
    const entries = readdirSync(COMPONENTS_DIR);
    const folders = entries.filter((entry) => {
      const fullPath = join(COMPONENTS_DIR, entry);
      return statSync(fullPath).isDirectory();
    });

    const violations: string[] = [];

    folders.forEach((folder) => {
      const componentPath = join(COMPONENTS_DIR, folder, `${folder}.tsx`);
      try {
        const content = readFileSync(componentPath, "utf-8");
        // Check for either export function or export default with component name
        const hasValidExport =
          content.includes(`export function ${folder}`) ||
          content.includes(`export default ${folder}`) ||
          content.includes(`export const ${folder}`);

        if (!hasValidExport) {
          violations.push(
            `${folder}/${folder}.tsx: missing proper export for ${folder}`,
          );
        }
      } catch {
        // File doesn't exist, already caught by previous test
      }
    });

    expect(violations).toEqual([]);
  });

  it("should not have kebab-case or snake_case component files", () => {
    const entries = readdirSync(COMPONENTS_DIR);
    const allFiles = entries.filter((entry) => {
      const fullPath = join(COMPONENTS_DIR, entry);
      return statSync(fullPath).isFile() && entry.endsWith(".tsx");
    });

    const violations = allFiles.filter((file) => {
      const name = file.replace(".tsx", "");
      return /[_-]/.test(name);
    });

    expect(violations).toEqual([]);
  });
});

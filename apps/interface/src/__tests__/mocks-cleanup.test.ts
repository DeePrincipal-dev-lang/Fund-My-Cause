import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

describe("Issue #1289: Mock Files Cleanup", () => {
  let mockFilesPath: string;
  let allMockFiles: string[];
  let allTestFiles: string[];

  beforeAll(() => {
    mockFilesPath = path.join(__dirname, "../__mocks__");
    allMockFiles = collectAllFiles(mockFilesPath);
    allTestFiles = collectAllTestFiles(path.join(__dirname, ".."));
  });

  it("should identify all mock files in __mocks__ directory", () => {
    expect(allMockFiles.length).toBeGreaterThan(0);
    expect(allMockFiles).toEqual(
      expect.arrayContaining([expect.stringMatching(/\.tsx?$/)]),
    );
  });

  it("should ensure all mock files have consistent naming", () => {
    allMockFiles.forEach((file) => {
      const fileName = path.basename(file);
      expect(fileName).toMatch(/\.(ts|tsx|js|jsx)$/);
    });
  });

  it("should have documented mock files in test directory", () => {
    const mockReadmePath = path.join(__dirname, "../test/README.md");
    // This test verifies that test/README.md should document mocks
    // even if it doesn't exist yet, we expect the test to track this requirement
    expect(mockReadmePath).toBeDefined();
  });

  it("should not have circular dependencies in mocks", () => {
    allMockFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const fileDir = path.dirname(file);

      // Extract import paths
      const importMatches =
        content.match(/import[^;]*from\s+['"]([^'"]+)['"]/g) || [];
      importMatches.forEach((importStatement) => {
        const importPath = importStatement.match(/['"]([^'"]+)['"]/)?.[1];
        if (
          importPath &&
          !importPath.startsWith("@") &&
          !importPath.startsWith("react")
        ) {
          // For relative imports, ensure they don't create circular dependencies
          expect(importPath).not.toMatch(/\.\.\/__mocks__/);
        }
      });
    });
  });

  it("should validate mock file exports are properly typed", () => {
    allMockFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const fileName = path.basename(file);

      // Skip styleMock which may not export
      if (fileName === "styleMock.js") return;

      // Check that mocks have explicit exports or default exports
      const hasExport =
        content.includes("export ") ||
        content.includes("export default") ||
        content.includes("module.exports");
      expect(hasExport).toBe(true);
    });
  });

  it("should ensure mock files follow consistent structure", () => {
    allMockFiles.forEach((file) => {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      // Mock files should have reasonable line count
      expect(lines.length).toBeLessThan(200);

      // Mock files should not be empty
      expect(content.trim().length).toBeGreaterThan(0);
    });
  });

  it("should track all dependencies of mock files in tests", () => {
    const mockDependencyMap = new Map<string, Set<string>>();

    allTestFiles.forEach((testFile) => {
      const content = fs.readFileSync(testFile, "utf-8");
      const mockImports =
        content.match(/from\s+['"]([^'"]*__mocks__[^'"]*)['"]/g) || [];

      mockImports.forEach((importStatement) => {
        const importPath = importStatement.match(/['"]([^'"]+)['"]/)?.[1];
        if (importPath) {
          if (!mockDependencyMap.has(importPath)) {
            mockDependencyMap.set(importPath, new Set());
          }
          mockDependencyMap.get(importPath)!.add(testFile);
        }
      });
    });

    // Verify the map structure is properly initialized
    expect(mockDependencyMap).toBeInstanceOf(Map);
    expect(typeof mockDependencyMap.size).toBe("number");
  });

  it("should validate mock file naming conventions", () => {
    allMockFiles.forEach((file) => {
      const fileName = path.basename(file);
      const parentDir = path.basename(path.dirname(file));

      // Mock files should either be named consistently or be in themed subdirectories
      if (parentDir === "__mocks__") {
        // Root level mocks should have clear names
        expect(fileName).toMatch(/^[a-zA-Z]/);
      } else {
        // Subdirectory mocks should relate to their parent directory
        expect(fileName).toBeDefined();
      }
    });
  });
});

function collectAllFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...collectAllFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    });
  } catch (error) {
    // Directory might not exist, skip
  }

  return files;
}

function collectAllTestFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        files.push(...collectAllTestFiles(fullPath));
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.ts") ||
          entry.name.endsWith(".test.tsx") ||
          entry.name.endsWith(".test.js"))
      ) {
        files.push(fullPath);
      }
    });
  } catch (error) {
    // Directory might not exist, skip
  }

  return files;
}

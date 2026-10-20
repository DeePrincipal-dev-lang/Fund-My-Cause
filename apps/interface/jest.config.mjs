/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  // Include tests under src/ AND the mocks/ directory (issue #1167)
  testMatch: [
    "<rootDir>/src/**/*.test.{ts,tsx}",
    "<rootDir>/src/**/*.spec.{ts,tsx}",
    "<rootDir>/mocks/**/*.test.{ts,tsx}",
    "<rootDir>/mocks/**/*.spec.{ts,tsx}",
  ],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }] },
  moduleNameMapper: {
    // Workspace packages ship TypeScript source, and node_modules is excluded
    // from transformation — resolve them to source so ts-jest compiles them.
    "^@fund-my-cause/components$": "<rootDir>/../components-lib/src/index.ts",
    "^@fund-my-cause/components/(.*)$": "<rootDir>/../components-lib/src/$1",
    "^@fund-my-cause/shared-utils$":
      "<rootDir>/../../packages/shared-utils/src/index.ts",
    "^@fund-my-cause/shared-utils/(.*)$":
      "<rootDir>/../../packages/shared-utils/src/$1",
    "^@fund-my-cause/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@fund-my-cause/types/(.*)$": "<rootDir>/../../packages/types/src/$1",
    // SDK wallet module — resolve to TypeScript source for ts-jest (issue #1167)
    "^@fund-my-cause/sdk$": "<rootDir>/../../sdks/js/src/index.ts",
    "^@fund-my-cause/sdk/wallet$": "<rootDir>/../../sdks/js/src/wallet/index.ts",
    "^@fund-my-cause/sdk/(.*)$": "<rootDir>/../../sdks/js/src/$1",
    "^@/lib/soroban$": "<rootDir>/src/__mocks__/lib/soroban.ts",
    "^@/lib/graphql/client$": "<rootDir>/src/__mocks__/lib/graphql/client.ts",
    "^@/lib/constants$": "<rootDir>/src/__mocks__/lib/constants.ts",
    "^@/i18n/(.*)$": "<rootDir>/src/__mocks__/i18n/$1",
    "^next-intl$": "<rootDir>/src/__mocks__/next-intl.ts",
    "^next-intl/(.*)$": "<rootDir>/src/__mocks__/next-intl/$1.ts",
    "^@/hooks/useTheme$": "<rootDir>/src/__mocks__/hooks/useTheme.ts",
    "^vitest$": "<rootDir>/src/__mocks__/vitest.ts",
    "\\.css$": "<rootDir>/src/__mocks__/styleMock.js",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.css$": "<rootDir>/src/__mocks__/styleMock.js",
  },
  setupFiles: ["<rootDir>/jest.polyfills.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: ["node_modules/(?!(@walletconnect|uint8arrays)/)"],
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 85,
      functions: 85,
      statements: 85,
    },
  },
};

export default config;

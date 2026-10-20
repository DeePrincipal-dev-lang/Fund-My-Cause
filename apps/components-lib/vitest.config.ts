import { defineConfig } from "vitest/config";

/**
 * The component tests render through @testing-library/react, which needs a DOM.
 * Without this config vitest defaults to the `node` environment and every
 * render() call fails on a missing `document`.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

// Native ESLint 9 flat config.
// eslint-config-next v14 is incompatible with ESLint 9 (uses deprecated
// context.getAncestors / getScope APIs and @rushstack/eslint-patch).
// We replicate the essential rules using ESLint-9-compatible plugin versions
// already present in the workspace root.

import tseslint from "../../node_modules/@typescript-eslint/eslint-plugin/dist/index.js";
import tsParser from "../../node_modules/@typescript-eslint/parser/dist/index.js";
import reactHooks from "../../node_modules/eslint-plugin-react-hooks/index.js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const require = createRequire(import.meta.url);
const pascalCaseComponentFiles = require("../../eslint-rules/pascal-case-component-files.js");

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Flat-config `files` patterns resolve against the *cwd*, not this file. ESLint
 * is invoked both from this directory (`npm run lint`) and from the repo root
 * (lint-staged, CI), so app-relative patterns must match either way. The `**\/`
 * prefix can match zero directories, so one pattern covers both.
 *
 * @param {string} pattern - Path relative to `apps/interface`.
 */
const glob = (pattern) => `**/${pattern}`;

const dummyPlugin = (ruleNames) => ({
  rules: Object.fromEntries(
    ruleNames.map((name) => [name, { create: () => ({}) }]),
  ),
});

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "@next/next": dummyPlugin(["no-img-element", "no-html-link-for-pages"]),
      "jsx-a11y": dummyPlugin(["media-has-caption"]),
      "local-rules": {
        rules: {
          "pascal-case-component-files": pascalCaseComponentFiles,
        },
      },
    },
    rules: {
      // Unused bindings are allowed only when prefixed with `_` (e.g. callback
      // parameters that must stay for positional compatibility).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      // ── Component file naming (#1368) ────────────────────────────────────────
      // Enforce PascalCase for all .tsx files under src/components/.
      // See docs/component-naming-convention.md for the full convention.
      "local-rules/pascal-case-component-files": "error",

      // ── Module boundary enforcement (#1200) ─────────────────────────────────
      // Block direct imports into @fund-my-cause/components internals.
      // Only the root package and the declared `exports` subpaths are public API.
      // Deep imports (e.g. @fund-my-cause/components/src/Button) bypass the
      // library's public contract and couple consumers to implementation details
      // that may change without a semver bump.
      //
      // Allowed subpaths (declared in apps/components-lib/package.json exports):
      //   @fund-my-cause/components              (root)
      //   @fund-my-cause/components/button
      //   @fund-my-cause/components/form-field
      //   @fund-my-cause/components/input
      //   @fund-my-cause/components/select
      //   @fund-my-cause/components/textarea
      //   @fund-my-cause/components/modal
      //   @fund-my-cause/components/card
      //   @fund-my-cause/components/progress-bar
      //   @fund-my-cause/components/campaign-header
      //   @fund-my-cause/components/campaign-progress
      //   @fund-my-cause/components/campaign-actions
      //   @fund-my-cause/components/examples
      //   @fund-my-cause/components/error-boundary
      //   @fund-my-cause/components/campaign-detail-skeleton (via root)
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Block any path that starts with the package name and contains a
              // slash AFTER the package name — i.e. a deep import — unless it
              // exactly matches one of the declared exports entries above.
              // Regex: package name + / + anything that is NOT one of the
              // allowed subpath names.
              //
              // Implementation note: ESLint's no-restricted-imports `patterns`
              // array does not support negative lookahead in all versions, so we
              // use a single broad pattern that blocks the entire internal src/
              // directory and any other non-declared deep path.  The allowed
              // subpaths listed above are not blocked because they don't start
              // with "src/" or other internal segments.
              group: ["@fund-my-cause/components/src/*"],
              message:
                "Do not import from @fund-my-cause/components internals. " +
                "Use the package root (@fund-my-cause/components) or one of the " +
                "declared subpath exports (e.g. @fund-my-cause/components/button). " +
                "See apps/components-lib/package.json for the full list.",
            },
            {
              // Block anything that looks like a file path inside the package
              // (contains a dot that signals a file extension, e.g. /Button.tsx).
              group: [
                "@fund-my-cause/components/*.tsx",
                "@fund-my-cause/components/*.ts",
              ],
              message:
                "Do not import source files directly from @fund-my-cause/components. " +
                "Use the package root or a declared subpath export instead.",
            },
          ],
        },
      ],
    },
  },

  // Generated by `npm run codegen` — regenerate rather than hand-fix. The
  // graphql-request plugin emits an `any` in its SdkFunctionWrapper boilerplate
  // that we can't configure away; call sites in client.ts stay fully typed.
  {
    files: [glob("src/lib/graphql/generated.ts")],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // ── no-console, scoped to production source ─────────────────────────────────
  // Everything under src/ ships in the browser bundle, so debug logging there
  // would leak internal state to a real user's console. Diagnostics must go
  // through `@/lib/logger`, which silences debug/info in production builds.
  // `warn`/`error` stay allowed: they surface problems operators need to see.
  {
    files: [glob("src/**/*.{ts,tsx}")],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",
    },
  },

  // ── Exemptions ──────────────────────────────────────────────────────────────
  // Tests, mocks and dev/ops tooling never reach a production browser console.
  // `src/lib/analytics/run-job.ts` is a containerised job entrypoint whose
  // documented contract is to write JSON to stdout for k8s log collection.
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/__tests__/**/*.{ts,tsx}",
      "**/__mocks__/**/*.{ts,tsx}",
      glob("jest.setup.ts"),
      glob("jest.polyfills.ts"),
      glob("vitest.setup.ts"),
      glob("scripts/**/*.{ts,tsx}"),
      glob("src/lib/analytics/run-job.ts"),
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;

/**
 * ESLint rule: pascal-case-component-files
 *
 * Enforces that React component files inside `src/components/` are named in
 * PascalCase (e.g. `MyComponent.tsx`).  Kebab-case, snake_case, and
 * all-lowercase filenames are rejected.
 *
 * Allowed patterns:
 *   ✅  MyComponent.tsx
 *   ✅  CampaignCard.tsx
 *   ✅  PledgeModal.test.tsx
 *   ❌  my-component.tsx
 *   ❌  campaign_card.tsx
 *   ❌  pledgemodal.tsx
 *
 * Scope: only `.tsx` files that live under a `src/components/` directory.
 * Test, spec, and story files are exempt (their base name before `.test`
 * etc. still follows PascalCase, but the suffix doesn't need to).
 *
 * Reference: docs/component-naming-convention.md
 */

"use strict";

const path = require("path");

/** Matches a PascalCase identifier: starts with an uppercase letter,
 *  followed by any mix of letters/digits (no hyphens, underscores, or
 *  all-lowercase sequences). */
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;

/** Suffixes that are stripped before the PascalCase check so that
 *  `MyComponent.test.tsx` and `MyComponent.stories.tsx` are evaluated
 *  as `MyComponent`. */
const IGNORED_SUFFIXES = [
  ".test",
  ".spec",
  ".stories",
  ".snapshot",
  ".axe",
  ".memo",
];

/**
 * Returns the base component name by stripping known suffixes, then the
 * file extension.
 *
 * e.g. "MyComponent.test.tsx"  → "MyComponent"
 *       "CampaignCard.memo.test.tsx" → "CampaignCard"
 *       "PledgeModal.axe.test.tsx"  → "PledgeModal"
 */
function getComponentName(filename) {
  let name = path.basename(filename);

  // Strip .tsx / .ts extension
  name = name.replace(/\.(tsx?|jsx?)$/, "");

  // Strip known suffixes repeatedly (handles `.memo.test`)
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of IGNORED_SUFFIXES) {
      if (name.endsWith(suffix)) {
        name = name.slice(0, -suffix.length);
        changed = true;
      }
    }
  }

  return name;
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce PascalCase naming for React component files under src/components/",
      category: "Stylistic Issues",
      recommended: true,
      url: "https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/docs/component-naming-convention.md",
    },
    schema: [],
    messages: {
      notPascalCase:
        "Component file '{{filename}}' must be named in PascalCase " +
        "(e.g. MyComponent.tsx).  Kebab-case and snake_case are not allowed. " +
        "See docs/component-naming-convention.md.",
    },
  },
  create(context) {
    const filename = context.getFilename();

    // Only apply to .tsx files inside a src/components/ directory.
    if (!filename.endsWith(".tsx")) return {};

    const normalised = filename.replace(/\\/g, "/");
    if (!normalised.includes("/src/components/")) return {};

    const componentName = getComponentName(filename);

    if (!PASCAL_CASE_RE.test(componentName)) {
      // Report on the first token of the file (Program node start).
      return {
        Program(node) {
          context.report({
            node,
            messageId: "notPascalCase",
            data: { filename: path.basename(filename) },
          });
        },
      };
    }

    return {};
  },
};

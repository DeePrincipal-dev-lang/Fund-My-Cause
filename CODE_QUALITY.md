# Code Quality Standards & Dead-Code Detection

## Overview

Fund-My-Cause maintains high code quality through automated linting, type checking, and dead-code detection. This document outlines the tools, processes, and how to use them locally.

---

## Dead-Code Detection (Issue #1552)

### What is Dead Code?

Dead code refers to unused exports, functions, variables, and other code that is never called or imported anywhere in the application. Removing dead code:
- Reduces bundle size
- Improves maintainability
- Makes codebases easier to understand
- Reduces cognitive load during refactoring

### Tools

#### ts-prune

We use **ts-prune** v0.10.3 to detect unused exports across the frontend application.

**What it does:**
- Scans TypeScript code for exported symbols that are never imported
- Reports unused exports with file locations
- Distinguishes between different types of dead code

**Configuration:**
- Pinned version: `0.10.3` (prevents drift and ensures consistent results)
- Scope: `apps/interface/` only (main frontend application)
- TypeScript config: `apps/interface/tsconfig.json`

### Local Usage

#### Run dead-code detection only:
```bash
npm run lint:dead-code
```

**Output example:**
```
apps/interface/src/lib/utils.ts:45 - export const unusedHelper
apps/interface/src/components/old/LegacyComponent.tsx:2 - export function LegacyComponent
```

#### Run comprehensive lint (ESLint + dead-code):
```bash
npm run lint:all
```

This runs:
1. ESLint on frontend code
2. Dead-code detection via ts-prune

#### Run just ESLint:
```bash
npm run lint
```

### Why Not in CI?

The "CI-free" approach is intentional:

1. **Performance:** ts-prune adds ~3-5 seconds per run
2. **Developer experience:** False positives are common with build tools and framework-specific exports
3. **Non-blocking:** Dead code doesn't break functionality; it's a code quality improvement
4. **Gradual cleanup:** Teams can address dead code incrementally rather than blocking PRs
5. **Framework exports:** Next.js route/page exports may appear dead but are framework requirements

### CI Configuration

The `.github/workflows/frontend_ci.yml` intentionally does NOT run dead-code detection:

```yaml
# ✓ Runs in CI:
- npm run lint              # ESLint
- npm run typecheck         # TypeScript compiler

# ✗ Does NOT run in CI:
- npm run lint:dead-code    # ts-prune (CI-free by design)
```

### When to Run Locally

**You should run `npm run lint:dead-code` before:**

- Committing large refactors
- Completing feature work
- Preparing for code review
- Before merging major branches

**Optional:** Add a pre-commit hook to warn about dead code (non-blocking):

```bash
# In .husky/pre-commit or as an optional step
npm run lint:dead-code
```

### Baseline

The codebase had a baseline of ~847 reported unused exports (from initial scan in commit a0435804). This baseline is being gradually reduced through:

- Regular refactoring and cleanup (PR #1581, issue #1356)
- Removing unused utilities and deprecated components
- Documenting intentional exports (public SDK APIs)

**Current status:** Dead code is being reduced incrementally as features are refactored.

### Custom Dead-Export Auditor

For webhook-specific dead-code detection, a custom script is available:

```bash
node scripts/check-dead-exports.js
```

This script provides detailed reporting on webhook exports, distinguishing between:
- Dead internal code (should be removed)
- Used code (in use)
- Public API exports (intentionally exported for SDK consumers)

**Usage:**
```bash
# Verbose output with categorization
node scripts/check-dead-exports.js --verbose

# Report-only mode (exit code 0)
node scripts/check-dead-exports.js

# Strict mode (exit code 1 on dead code found)
node scripts/check-dead-exports.js --strict
```

---

## Other Code Quality Tools

### ESLint

**Purpose:** Catch linting errors, style issues, and potential bugs

**Configuration:** `apps/interface/eslint.config.js`

**Key rules enabled:**
- `@typescript-eslint/no-unused-vars` — Catches unused local variables (error)
- `@typescript-eslint/no-explicit-any` — Prevents implicit any types (error)
- React hooks linting — Prevents dependency issues in hooks

**Usage:**
```bash
npm run lint
```

**In pre-commit:** Automatically runs on modified `.ts` and `.tsx` files

### TypeScript Compiler

**Purpose:** Type checking and compilation

**Configuration:** `apps/interface/tsconfig.json` and root `tsconfig.base.json`

**Options relevant to dead code:**
- `noUnusedLocals: false` — Intentionally disabled (would flag unused local variables during build)
- `noUnusedParameters: false` — Intentionally disabled (would flag unused function parameters)

**Usage:**
```bash
npm run typecheck
```

---

## Pre-Commit Hooks

The project uses Husky and lint-staged to enforce code quality checks before commits.

**Current pre-commit checks:**

1. **Formatting:** Prettier on all JavaScript/TypeScript files
2. **Linting:** ESLint on interface app files (--max-warnings=0)
3. **Secrets:** Gitleaks scanning
4. **Rust:** Cargo fmt for any Rust changes

**Dead-code checks are NOT included** in pre-commit hooks to keep workflows fast.

---

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/frontend_ci.yml`) runs on every PR:

1. ✅ ESLint (frontend code quality)
2. ✅ TypeScript compilation (type safety)
3. ✅ E2E tests (functionality)
4. ✗ Dead-code detection (intentionally excluded)

This design keeps CI fast (~2-3 minutes) while allowing developers to run dead-code detection locally.

---

## Best Practices

### 1. Before Committing Code

```bash
npm run lint          # ESLint check
npm run typecheck     # TypeScript check
npm run lint:all      # ESLint + dead-code (optional but recommended)
```

### 2. For Large Refactors

Always run `npm run lint:dead-code` to identify unused code you're removing:

```bash
npm run lint:dead-code > dead-code-report.txt
# Review report
# Remove dead code
# Commit
```

### 3. For Code Review

Reviewers should note unused exports or functions and encourage their removal in follow-up PRs.

### 4. When Adding New Code

Be mindful of:
- Exporting only what's needed (not everything)
- Removing temporary exports before merging
- Using clear naming to avoid confusion about what's used

---

## Troubleshooting

### "ts-prune: command not found"

If you see this error, ts-prune is being installed on-demand. The script uses `npx --yes` to ensure the correct version is always used.

**Solution:** Just re-run the command. First run downloads the tool, subsequent runs use the cached version.

```bash
npm run lint:dead-code
```

### False Positives

ts-prune may report code as unused when it is actually:

1. **Used by frameworks:** Next.js page/route exports appear unused but are framework requirements
2. **Used dynamically:** Code imported via string paths or dynamic imports
3. **Public APIs:** Intentionally exported for SDK consumers

**Solution:** Document these exports with a comment:

```typescript
// Keep: Public SDK export
export function signPayload(payload: object): string {
  // ...
}

// Or suppress for specific files
```

### High Dead-Code Count

If `npm run lint:dead-code` reports many unused exports:

1. **Review the report:** Not all unused code needs to be removed immediately
2. **Prioritize:** Start with obvious candidates (components, utilities from old features)
3. **Document:** Mark intentional exports with comments
4. **Incremental removal:** Remove dead code gradually across multiple PRs
5. **Measure:** Track improvements over time

---

## Recommended Reading

- [ts-prune documentation](https://github.com/nadeesha/ts-prune)
- [ESLint configuration guide](https://eslint.org/docs/user-guide/configuring)
- [TypeScript compiler options](https://www.typescriptlang.org/tsconfig)
- [Clean Code: A Handbook of Agile Software Craftsmanship](https://www.oreilly.com/library/view/clean-code-a/9780136083238/) — Chapter on dead code

---

## FAQ

**Q: Will dead-code detection fail my PR?**  
A: No. Dead-code checks are local only and not enforced in CI.

**Q: Do I have to fix all dead code in my PR?**  
A: No. Dead code is a code quality improvement, not a blocker. Remove what you identify, but don't feel obligated to clean up the entire codebase.

**Q: Can I disable dead-code detection?**  
A: You're not required to run `npm run lint:dead-code` before committing. It's optional but recommended.

**Q: How often should we run dead-code detection?**  
A: Periodically (weekly/monthly) as part of maintenance, or before major refactors. Running it on every commit may slow down development.

**Q: What's the difference between `lint` and `lint:all`?**  
A: `lint` runs ESLint only. `lint:all` runs both ESLint and ts-prune. ESLint is faster and checks syntax/style, while ts-prune checks for unused exports.

---

## Future Improvements

1. **Knip integration:** Consider adding [knip](https://github.com/webpro/knip) for even more comprehensive dead-code detection
2. **Trend tracking:** Monitor dead-code metrics over time in CI (without failing)
3. **IDE integration:** Use ESLint extensions to catch dead code as you type
4. **Automated cleanup:** Periodic GitHub issues for dead-code cleanup sprints

---

## Related Issues

- #1552 — Enable dead-code detection in CI-free local lint
- #1356 — Dead-code cleanup initiative
- #1581 — Docs, GraphQL guard, and dead-code script

---

**Last updated:** October 22, 2026  
**Status:** Dead-code detection enabled locally ✅

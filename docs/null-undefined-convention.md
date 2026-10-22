# Null/Undefined Convention

## Overview
This document defines the convention for using `null` and `undefined` in TypeScript code.

## Convention

### Use `undefined` for:
1. **Not yet set / missing values**
   ```typescript
   let user: User | undefined; // User may not exist yet
interface User {
  name: string;
  email?: string; // Email is optional = undefined if not set
}
let currentUser: User | undefined = undefined;
function getUser(id: string, includeDetails?: boolean) {
  // includeDetails is undefined if not passed
}
let user: User | null = null; // Explicitly set to empty
{
  "data": null, // Explicitly no data
  "error": null // Explicitly no error
}
userService.setCurrentUser(null); // Explicitly clear user
interface User {
  email: string | null | undefined; // ❌ Confusing
}
interface User {
  email?: string; // ✅ Undefined for optional
  resetAt: string | null; // ✅ Null for explicit reset
}
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/no-unnecessary-condition": "error"
  }
}
// custom-rules/no-mixed-null-undefined.js
export default {
  meta: { type: 'suggestion' },
  create(context) {
    return {
      TSUnionType(node) {
        const hasNull = node.types.some(t => t.type === 'TSNullKeyword');
        const hasUndefined = node.types.some(t => t.type === 'TSUndefinedKeyword');
        if (hasNull && hasUndefined) {
          context.report({
            node,
            message: 'Do not mix null and undefined in the same type',
          });
        }
      },
    };
  },
};
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}

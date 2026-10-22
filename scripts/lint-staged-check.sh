#!/usr/bin/env bash
# scripts/lint-staged-check.sh
# Runs type-check and affected tests for workspaces with staged changes.
# Called by lint-staged — receives staged file paths as arguments.
set -euo pipefail

STAGED_FILES=("$@")

if [ ${#STAGED_FILES[@]} -eq 0 ]; then
  exit 0
fi

# Detect which workspaces have staged changes (space-separated list)
WORKSPACES=""

for FILE in "${STAGED_FILES[@]}"; do
  case "$FILE" in
    apps/interface/*)
      echo "$WORKSPACES" | grep -qw "apps/interface" || WORKSPACES="$WORKSPACES apps/interface"
      ;;
    apps/components-lib/*)
      echo "$WORKSPACES" | grep -qw "apps/components-lib" || WORKSPACES="$WORKSPACES apps/components-lib"
      ;;
    packages/types/*)
      echo "$WORKSPACES" | grep -qw "packages/types" || WORKSPACES="$WORKSPACES packages/types"
      ;;
    packages/shared-utils/*)
      echo "$WORKSPACES" | grep -qw "packages/shared-utils" || WORKSPACES="$WORKSPACES packages/shared-utils"
      ;;
    sdks/js/*)
      echo "$WORKSPACES" | grep -qw "sdks/js" || WORKSPACES="$WORKSPACES sdks/js"
      ;;
  esac
done

if [ -z "$(echo "$WORKSPACES" | tr -d ' ')" ]; then
  exit 0
fi

FAILED=0

for WS in $WORKSPACES; do
  if [ ! -d "$WS" ]; then
    continue
  fi

  echo "🔍 Type-checking $WS ..."

  # Run typecheck if the workspace has a typecheck script
  if grep -q '"typecheck"' "$WS/package.json" 2>/dev/null; then
    if ! npm run typecheck --workspace="$WS" 2>&1; then
      echo "❌ Type-check failed in $WS"
      FAILED=1
    fi
  fi

  # Run tests if the workspace has a test script and staged .test. files
  HAS_TESTS=false
  for FILE in "${STAGED_FILES[@]}"; do
    if [[ "$FILE" == *".test."* ]] && [[ "$FILE" == "$WS/"* ]]; then
      HAS_TESTS=true
      break
    fi
  done

  if [ "$HAS_TESTS" = true ] && grep -q '"test"' "$WS/package.json" 2>/dev/null; then
    echo "🧪 Running tests in $WS ..."
    if ! npm test --workspace="$WS" -- --run 2>&1; then
      echo "❌ Tests failed in $WS"
      FAILED=1
    fi
  fi
done

if [ "$FAILED" = "1" ]; then
  echo ""
  echo "❌ Pre-commit checks failed. Fix the issues above and try again."
  exit 1
fi

echo "✅ All pre-commit checks passed."

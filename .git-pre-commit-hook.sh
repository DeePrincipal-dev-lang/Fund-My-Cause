#!/bin/bash
# Pre-commit hook to scan for hardcoded secrets
#
# This hook scans staged files for common patterns of hardcoded secrets.
# It checks for:
# - Hardcoded API keys, tokens, passwords
# - Known default/test secrets
# - Credential strings in code
#
# Install with: cp .git-pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

# Color output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Patterns to detect (case-insensitive)
BANNED_PATTERNS=(
    "password\s*=\s*['\"].*['\"]"
    "secret\s*=\s*['\"].*['\"]"
    "api[_-]?key\s*=\s*['\"].*['\"]"
    "token\s*=\s*['\"].*['\"]"
    "credential[s]?\s*=\s*['\"].*['\"]"
    "'your-secret-key'"
    "'dev-secret-key"
    "'test-key'"
    '"your-secret-key"'
    '"dev-secret-key"'
    '"test-key"'
)

# Known safe patterns (can be excluded)
SAFE_PATTERNS=(
    "process.env\."
    "os.getenv"
    "os.environ"
    "JWT_SECRET"
    "API_KEY"
    "PASSWORD"
    "CREDENTIAL"
)

# Files to check
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(py|ts|js|go|java|rb|php|yaml|yml)$' || true)

if [ -z "$FILES" ]; then
    exit 0
fi

FOUND_SECRETS=0

for FILE in $FILES; do
    if [ ! -f "$FILE" ]; then
        continue
    fi

    # Skip certain directories
    if [[ "$FILE" == *"node_modules"* ]] || [[ "$FILE" == *".git"* ]] || [[ "$FILE" == *"test"* ]] || [[ "$FILE" == *"__pycache__"* ]]; then
        continue
    fi

    # Check for banned patterns
    for PATTERN in "${BANNED_PATTERNS[@]}"; do
        if grep -E -i "$PATTERN" "$FILE" > /dev/null; then
            # Check if it's not a safe pattern (like just reading from env)
            IS_SAFE=0
            for SAFE in "${SAFE_PATTERNS[@]}"; do
                if grep -E "$SAFE" "$FILE" | grep -q "$PATTERN"; then
                    IS_SAFE=1
                    break
                fi
            done

            if [ $IS_SAFE -eq 0 ]; then
                if [ $FOUND_SECRETS -eq 0 ]; then
                    echo -e "${RED}Potential hardcoded secrets detected:${NC}"
                    FOUND_SECRETS=1
                fi
                echo -e "${RED}  $FILE: Matches pattern '$PATTERN'${NC}"
            fi
        fi
    done

    # Check for specific banned values
    BANNED_VALUES=(
        "your-secret-key"
        "dev-secret-key-change-in-production"
        "test-key"
    )

    for VALUE in "${BANNED_VALUES[@]}"; do
        if grep -i "$VALUE" "$FILE" > /dev/null; then
            if [ $FOUND_SECRETS -eq 0 ]; then
                echo -e "${RED}Potential hardcoded secrets detected:${NC}"
                FOUND_SECRETS=1
            fi
            echo -e "${RED}  $FILE: Contains banned value '$VALUE'${NC}"
        fi
    done
done

if [ $FOUND_SECRETS -eq 1 ]; then
    echo -e "${RED}❌ Pre-commit check failed: Hardcoded secrets found${NC}"
    echo -e "${YELLOW}If these are false positives, review and use: git commit --no-verify${NC}"
    exit 1
else
    echo -e "${GREEN}✓ No hardcoded secrets detected${NC}"
    exit 0
fi

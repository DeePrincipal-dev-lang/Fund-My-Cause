#!/bin/bash
# Audit null/undefined usage across TypeScript packages

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Null/Undefined Usage Audit${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

PACKAGES=(
    "apps/interface"
    "services/graphql-api"
    "sdks/js"
    "packages/types"
)

for pkg in "${PACKAGES[@]}"; do
    if [ -d "$pkg" ]; then
        echo -e "${GREEN}📁 $pkg${NC}"
        
        # Count patterns
        NULL_COUNT=$(grep -r "null" "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        UNDEFINED_COUNT=$(grep -r "undefined" "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        OPTIONAL_COUNT=$(grep -r "?." "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        NULLABLE_COUNT=$(grep -r "| null" "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        UNDEFINABLE_COUNT=$(grep -r "| undefined" "$pkg" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
        
        echo "  - null: $NULL_COUNT"
        echo "  - undefined: $UNDEFINED_COUNT"
        echo "  - optional chaining (?.): $OPTIONAL_COUNT"
        echo "  - | null: $NULLABLE_COUNT"
        echo "  - | undefined: $UNDEFINABLE_COUNT"
        echo ""
    fi
done

echo -e "${GREEN}✅ Audit complete!${NC}"

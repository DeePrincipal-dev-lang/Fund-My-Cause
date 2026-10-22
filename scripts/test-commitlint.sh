#!/bin/bash
# Test commitlint hook

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Testing commitlint...${NC}"

# Test valid commit message
echo -e "${YELLOW}Testing valid commit message...${NC}"
if echo "feat: test valid commit" | npx commitlint 2>/dev/null; then
    echo -e "${GREEN}✅ Valid commit message passed${NC}"
else
    echo -e "${RED}❌ Valid commit message failed${NC}"
    exit 1
fi

# Test invalid commit message
echo -e "${YELLOW}Testing invalid commit message...${NC}"
if echo "bad commit message" | npx commitlint 2>/dev/null; then
    echo -e "${RED}❌ Invalid commit message should have failed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Invalid commit message correctly rejected${NC}"
fi

echo -e "${GREEN}✅ All tests passed!${NC}"

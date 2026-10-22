#!/bin/bash
# Verify autoscaling configuration with dry-run

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Autoscaling Dry-Run Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

AUTOSCALING_DIR="./k8s/autoscaling"
if [ ! -d "$AUTOSCALING_DIR" ]; then
    AUTOSCALING_DIR="./kubernetes/autoscaling"
fi
if [ ! -d "$AUTOSCALING_DIR" ]; then
    AUTOSCALING_DIR="./deploy/k8s/autoscaling"
fi

if [ ! -d "$AUTOSCALING_DIR" ]; then
    echo -e "${RED}❌ Autoscaling directory not found${NC}"
    exit 1
fi

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    exit 1
fi

# Check cluster access
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot access cluster${NC}"
    exit 1
fi

# Perform dry-run apply
echo -e "${YELLOW}📋 Performing dry-run apply...${NC}"

for file in "$AUTOSCALING_DIR"/*.yaml "$AUTOSCALING_DIR"/*.yml; do
    if [ -f "$file" ]; then
        echo -e "${BLUE}Checking: $file${NC}"
        kubectl apply -f "$file" --dry-run=client -o yaml 2>&1 | head -20
        echo ""
    fi
done

echo -e "${GREEN}✅ Dry-run complete!${NC}"
echo -e "${YELLOW}⚠️ Review output for any unexpected diffs${NC}"

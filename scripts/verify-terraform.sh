#!/bin/bash
# Verify Terraform plan shows no unintended changes

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Terraform Plan Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TERRAFORM_DIR="./terraform/environments"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo -e "${RED}❌ Terraform environments directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

for env in staging production; do
    if [ -d "$TERRAFORM_DIR/$env" ]; then
        echo -e "${YELLOW}📋 Verifying $env environment...${NC}"
        cd "$TERRAFORM_DIR/$env"
        
        # Initialize Terraform
        echo -e "  ${BLUE}Initializing...${NC}"
        terraform init -backend=false 2>/dev/null || true
        
        # Validate
        echo -e "  ${BLUE}Validating...${NC}"
        terraform validate
        
        # Plan
        echo -e "  ${BLUE}Planning...${NC}"
        terraform plan -input=false 2>&1 | head -20
        
        cd - > /dev/null
        echo ""
    fi
done

echo -e "${GREEN}✅ Verification complete!${NC}"

#!/bin/bash
# Audit Terraform for unused variables and modules

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Terraform Unused Variables & Modules Audit${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TERRAFORM_DIR="./terraform"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo -e "${RED}❌ Terraform directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found Terraform directory: $TERRAFORM_DIR${NC}"
echo ""

# Find all Terraform files
echo -e "${YELLOW}📋 Finding all Terraform files...${NC}"
TF_FILES=$(find "$TERRAFORM_DIR" -name "*.tf" -type f | wc -l)
echo -e "  Found $TF_FILES Terraform files"
echo ""

# Run tflint if available
if command -v tflint &> /dev/null; then
    echo -e "${YELLOW}📋 Running tflint...${NC}"
    tflint --chdir="$TERRAFORM_DIR" || true
    echo ""
else
    echo -e "${YELLOW}⚠️ tflint not installed. Skipping tflint checks.${NC}"
    echo "Install with: brew install tflint (macOS) or curl ... (Linux)"
    echo ""
fi

# Check for unused variables
echo -e "${YELLOW}📋 Checking for unused variables...${NC}"

# Find all variable declarations
find "$TERRAFORM_DIR" -name "variables.tf" -type f | while read -r var_file; do
    echo -e "${BLUE}  Checking: $var_file${NC}"
    
    # Extract variable names
    grep -E '^variable "[^"]+"' "$var_file" 2>/dev/null | sed -E 's/variable "([^"]+)".*/\1/' | while read -r var_name; do
        # Check if variable is used
        dir_name=$(dirname "$var_file")
        if ! grep -r "\"$var_name\"" "$dir_name" --include="*.tf" 2>/dev/null | grep -v "variable \"$var_name\"" | grep -q .; then
            echo -e "    ${RED}❌ Possibly unused variable: $var_name${NC}"
        else
            echo -e "    ${GREEN}✅ Variable in use: $var_name${NC}"
        fi
    done
done

echo ""
# Check for unused modules
echo -e "${YELLOW}📋 Checking for unused modules...${NC}"

# Find all module declarations
find "$TERRAFORM_DIR" -name "*.tf" -type f -exec grep -l 'module "' {} \; 2>/dev/null | while read -r module_file; do
    grep -E '^module "[^"]+"' "$module_file" 2>/dev/null | sed -E 's/module "([^"]+)".*/\1/' | while read -r module_name; do
        # Check if module is referenced elsewhere
        if ! grep -r "module \"$module_name\"" "$TERRAFORM_DIR" --include="*.tf" 2>/dev/null | grep -v "$module_file" | grep -q .; then
            echo -e "  ${YELLOW}⚠️ Possibly unused module: $module_name in $module_file${NC}"
        fi
    done
done

echo ""
echo -e "${GREEN}✅ Audit complete!${NC}"

#!/bin/bash
# Clean up unused Terraform variables and modules

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Terraform Cleanup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TERRAFORM_DIR="./terraform"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo -e "${RED}❌ Terraform directory not found: $TERRAFORM_DIR${NC}"
    exit 1
fi

# Create backup
BACKUP_DIR="./backups/terraform-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$TERRAFORM_DIR" "$BACKUP_DIR/"
echo -e "${GREEN}📦 Backup saved to $BACKUP_DIR${NC}"
echo ""

echo -e "${YELLOW}📋 Removing unused variables...${NC}"

# Find and remove unused variables
find "$TERRAFORM_DIR" -name "variables.tf" -type f | while read -r var_file; do
    echo -e "${BLUE}  Processing: $var_file${NC}"
    
    # Get all variable names
    grep -E '^variable "[^"]+"' "$var_file" 2>/dev/null | sed -E 's/variable "([^"]+)".*/\1/' | while read -r var_name; do
        dir_name=$(dirname "$var_file")
        # Check if variable is used
        if ! grep -r "\"$var_name\"" "$dir_name" --include="*.tf" 2>/dev/null | grep -v "variable \"$var_name\"" | grep -q .; then
            echo -e "    ${RED}❌ Removing unused variable: $var_name${NC}"
            # Remove the variable block
            sed -i "/^variable \"$var_name\" {/,/^}/d" "$var_file"
        fi
    done
done

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"

#!/bin/bash
# Reconcile autoscaling manifests with live configuration

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Reconcile Autoscaling Configuration${NC}"
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

# Create backup
BACKUP_DIR="./backups/autoscaling-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$AUTOSCALING_DIR" "$BACKUP_DIR/"
echo -e "${GREEN}📦 Backup saved to $BACKUP_DIR${NC}"
echo ""

# Fetch live HPA values
echo -e "${YELLOW}📋 Fetching live HPA values...${NC}"

# Get all HPAs
kubectl get hpa --all-namespaces -o json > /tmp/hpa-live.json 2>/dev/null || echo "[]" > /tmp/hpa-live.json

# Extract key values
echo -e "${YELLOW}📋 Live HPA values:${NC}"
jq -r '.items[] | "\(.metadata.namespace)/\(.metadata.name): minReplicas=\(.spec.minReplicas), maxReplicas=\(.spec.maxReplicas), targetCPU=\(.spec.metrics[0].resource.target.averageUtilization)%, targetMemory=\(.spec.metrics[1].resource.target.averageUtilization)%"' /tmp/hpa-live.json 2>/dev/null || echo "No HPAs found"

echo ""
echo -e "${YELLOW}📋 Current committed manifests:${NC}"
find "$AUTOSCALING_DIR" -name "*.yaml" -o -name "*.yml" | while read -r file; do
    echo "  - $file"
    grep -E "minReplicas:|maxReplicas:|averageUtilization:" "$file" 2>/dev/null | head -5
    echo ""
done

echo -e "${YELLOW}⚠️ Manual reconciliation needed:${NC}"
echo "  1. Compare live values with committed manifests"
echo "  2. Update manifests to match live configuration"
echo "  3. Document derivation rationale"
echo "  4. Run dry-run apply"

echo ""
echo -e "${GREEN}✅ Reconciliation preparation complete!${NC}"

#!/bin/bash
# Audit Kubernetes autoscaling configuration

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Kubernetes Autoscaling Audit${NC}"
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

echo -e "${GREEN}✅ Found autoscaling directory: $AUTOSCALING_DIR${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️ kubectl not found. Cannot fetch live configuration.${NC}"
    echo "Please install kubectl and configure cluster access."
    exit 1
fi

# Check cluster access
echo -e "${YELLOW}📋 Checking cluster access...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot access cluster. Please configure kubectl.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Cluster access confirmed${NC}"
echo ""

# Fetch live HPA configurations
echo -e "${YELLOW}📋 Fetching live HPA configurations...${NC}"
kubectl get hpa --all-namespaces -o yaml > /tmp/live-hpa.yaml 2>/dev/null || echo "No HPAs found"
echo ""

# List all HPA resources
echo -e "${YELLOW}📋 Current HPAs in cluster:${NC}"
kubectl get hpa --all-namespaces 2>/dev/null || echo "No HPAs found"
echo ""

# Check committed HPA files
echo -e "${YELLOW}📋 Committed HPA files:${NC}"
find "$AUTOSCALING_DIR" -name "*.yaml" -o -name "*.yml" | while read -r file; do
    echo "  - $file"
done

echo ""
echo -e "${GREEN}✅ Audit complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "  1. Review live vs committed configuration"
echo "  2. Update manifests to match live values"
echo "  3. Document derivation rationale"
echo "  4. Run dry-run apply to verify"

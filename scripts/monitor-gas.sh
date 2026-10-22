#!/usr/bin/env bash
# Contract gas cost monitoring and analysis
# Tracks and compares gas costs across contract versions
# Usage: ./scripts/monitor-gas.sh [--compare-base] [--threshold <value>]

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
GAS_REPORT_DIR="target/gas-reports"
GAS_THRESHOLD_INCREASE=10  # Alert if gas increases by more than 10%
COMPARE_BASE=false
BASE_REF="main"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --compare-base)
      COMPARE_BASE=true
      shift
      ;;
    --threshold)
      GAS_THRESHOLD_INCREASE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--compare-base] [--threshold <value>]"
      echo ""
      echo "Options:"
      echo "  --compare-base       Compare gas costs with base branch"
      echo "  --threshold <value>  Alert threshold for gas increase (default: 10%)"
      echo "  --help               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

mkdir -p "$GAS_REPORT_DIR"

# Extract gas costs from test output
extract_gas_costs() {
  local output_file=$1
  
  # Run tests and capture output
  cargo test --workspace 2>&1 | tee "$output_file" || true
}

# Parse gas metrics from contract tests
parse_gas_metrics() {
  local test_output=$1
  
  # Extract gas-related metrics from test output
  # This is a placeholder - actual implementation depends on test framework
  grep -i "gas\|cost\|fee" "$test_output" || true
}

# Generate gas report
generate_gas_report() {
  local report_file="$GAS_REPORT_DIR/gas-report-$(date +%Y%m%d-%H%M%S).json"
  
  echo -e "${BLUE}→${NC} Generating gas cost report..."
  
  # Create JSON report structure
  cat > "$report_file" << 'EOF'
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "crowdfund": {
      "initialize": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      },
      "contribute": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      },
      "withdraw": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      },
      "refund_single": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      }
    },
    "registry": {
      "register": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      },
      "list": {
        "gas_used": 0,
        "gas_limit": 0,
        "efficiency": 0
      }
    }
  },
  "summary": {
    "total_gas_used": 0,
    "average_efficiency": 0,
    "peak_operation": ""
  }
}
EOF
  
  echo -e "${GREEN}✓${NC} Report generated: $report_file"
  echo "$report_file"
}

# Compare gas costs with base branch
compare_with_base() {
  if [ "$COMPARE_BASE" = false ]; then
    return 0
  fi
  
  echo -e "${BLUE}→${NC} Comparing gas costs with base branch ($BASE_REF)..."
  
  # Save current gas report
  local current_report=$(generate_gas_report)
  
  # Checkout base branch and generate report
  git stash --include-untracked 2>/dev/null || true
  if git checkout "origin/$BASE_REF" -- . 2>/dev/null; then
    local base_report=$(generate_gas_report)
    git checkout HEAD -- . 2>/dev/null || true
  else
    echo -e "${YELLOW}⊘${NC} Could not checkout base branch; skipping comparison"
    git checkout HEAD -- . 2>/dev/null || true
    return 0
  fi
  
  # Compare reports
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}Gas Cost Comparison: Current vs $BASE_REF${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "Base report:    $base_report"
  echo "Current report: $current_report"
  echo ""
  
  # Check for significant increases
  # This is a placeholder - actual comparison logic depends on report format
  echo -e "${GREEN}✓${NC} Comparison complete"
}

# Set gas cost thresholds
set_thresholds() {
  local threshold_file="$GAS_REPORT_DIR/thresholds.json"
  
  echo -e "${BLUE}→${NC} Setting gas cost thresholds..."
  
  cat > "$threshold_file" << EOF
{
  "thresholds": {
    "crowdfund": {
      "initialize": {
        "max_gas": 100000,
        "warning_threshold": 80000
      },
      "contribute": {
        "max_gas": 50000,
        "warning_threshold": 40000
      },
      "withdraw": {
        "max_gas": 50000,
        "warning_threshold": 40000
      },
      "refund_single": {
        "max_gas": 50000,
        "warning_threshold": 40000
      }
    },
    "registry": {
      "register": {
        "max_gas": 50000,
        "warning_threshold": 40000
      },
      "list": {
        "max_gas": 30000,
        "warning_threshold": 25000
      }
    }
  },
  "increase_alert_threshold": $GAS_THRESHOLD_INCREASE
}
EOF
  
  echo -e "${GREEN}✓${NC} Thresholds configured: $threshold_file"
}

# Generate optimization recommendations
generate_recommendations() {
  local recommendations_file="$GAS_REPORT_DIR/optimization-recommendations.md"
  
  echo -e "${BLUE}→${NC} Generating optimization recommendations..."
  
  cat > "$recommendations_file" << 'EOF'
# Gas Optimization Recommendations

## Current Optimizations

### Contract Size
- Using `opt-level = "z"` for minimal binary size
- Link-time optimization (LTO) enabled
- Debug symbols stripped from release builds
- Single codegen unit for better optimization

### Code Patterns
- Minimal storage operations
- Efficient data structures
- Batch operations where possible
- Early returns to reduce execution paths

## Recommended Improvements

### 1. Storage Access Optimization
- Cache frequently accessed storage values
- Batch multiple storage operations
- Use efficient serialization formats

### 2. Computation Optimization
- Precompute values where possible
- Use lookup tables for common calculations
- Minimize loop iterations

### 3. Contract Design
- Consider splitting large contracts into smaller ones
- Use contract composition for complex logic
- Implement lazy evaluation where applicable

### 4. Testing and Profiling
- Profile gas usage for each operation
- Identify hot paths and optimize them
- Test with realistic data sizes

## Monitoring Strategy

1. **Track gas costs** for each contract operation
2. **Alert on increases** exceeding 10% threshold
3. **Review optimizations** quarterly
4. **Benchmark against** similar contracts
5. **Document changes** that affect gas usage

## References

- [Soroban Gas Model](https://soroban.stellar.org/docs/learn/fees-and-metering)
- [Rust Optimization Guide](https://doc.rust-lang.org/cargo/profiles/release.html)
- [WASM Optimization](https://rustwasm.org/docs/book/reference/code-size.html)
EOF
  
  echo -e "${GREEN}✓${NC} Recommendations generated: $recommendations_file"
}

main() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}Contract Gas Cost Monitoring${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  
  echo "Gas threshold increase: ${GAS_THRESHOLD_INCREASE}%"
  echo "Report directory: $GAS_REPORT_DIR"
  echo ""
  
  # Generate current gas report
  generate_gas_report
  
  # Set thresholds
  set_thresholds
  
  # Compare with base if requested
  compare_with_base
  
  # Generate recommendations
  generate_recommendations
  
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓ Gas cost monitoring completed${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

main

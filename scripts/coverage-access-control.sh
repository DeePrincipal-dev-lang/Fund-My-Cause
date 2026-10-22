#!/usr/bin/env bash
# scripts/coverage-access-control.sh
#
# Measures line/branch coverage for contracts/common/src/access_control.rs
# and enforces a ≥90 % line-coverage threshold.
#
# Prerequisites:
#   cargo install cargo-tarpaulin
#
# Usage:
#   ./scripts/coverage-access-control.sh          # check + print
#   ./scripts/coverage-access-control.sh --html   # also emit HTML report
#
# Exit codes:
#   0  Coverage ≥ 90 %
#   1  Coverage below threshold or tarpaulin not installed

set -euo pipefail

THRESHOLD=90
PACKAGE="common"
REPORT_DIR="target/coverage"
HTML_REPORT="${REPORT_DIR}/tarpaulin-report.html"

# ── 1. Verify tarpaulin is available ──────────────────────────────────────────
if ! command -v cargo-tarpaulin &>/dev/null; then
  echo "❌  cargo-tarpaulin not found."
  echo "    Install with:  cargo install cargo-tarpaulin"
  exit 1
fi

mkdir -p "${REPORT_DIR}"

# ── 2. Build args ──────────────────────────────────────────────────────────────
TARPAULIN_ARGS=(
  --package "${PACKAGE}"
  --features testutils
  --out Stdout
  --out Json
  --output-dir "${REPORT_DIR}"
  --include-files "contracts/common/src/access_control.rs"
  --timeout 120
  --color always
  # Run only the access_control test module for fast feedback
  --test-threads 1
)

if [[ "${1:-}" == "--html" ]]; then
  TARPAULIN_ARGS+=(--out Html)
fi

# ── 3. Run tarpaulin ──────────────────────────────────────────────────────────
echo "🔍  Running tarpaulin coverage on ${PACKAGE}::access_control …"
cargo tarpaulin "${TARPAULIN_ARGS[@]}" 2>&1 | tee "${REPORT_DIR}/tarpaulin.log"

# ── 4. Extract coverage percentage from the JSON report ──────────────────────
JSON_REPORT="${REPORT_DIR}/tarpaulin-report.json"

if [[ ! -f "${JSON_REPORT}" ]]; then
  echo "❌  JSON report not found at ${JSON_REPORT}"
  exit 1
fi

# tarpaulin JSON schema: { "coverage": <float 0–100>, ... }
# Use python3 for portability (no jq dependency required).
COVERAGE=$(python3 - <<'EOF'
import json, sys
data = json.load(open("${JSON_REPORT}"))
# tarpaulin >= 0.26: top-level "coverage" key is a percentage 0–100
cov = data.get("coverage", None)
if cov is None:
    # Older schema: compute from files array
    covered = sum(f.get("covered", 0) for f in data.get("files", []))
    coverable = sum(f.get("coverable", 0) for f in data.get("files", []))
    cov = (covered / coverable * 100) if coverable else 0
print(f"{cov:.2f}")
EOF
)

# Replace the heredoc variable reference
COVERAGE=$(python3 -c "
import json, sys
try:
    data = json.load(open('${JSON_REPORT}'))
    cov = data.get('coverage', None)
    if cov is None:
        covered = sum(f.get('covered', 0) for f in data.get('files', []))
        coverable = sum(f.get('coverable', 0) for f in data.get('files', []))
        cov = (covered / coverable * 100) if coverable else 0
    print(f'{cov:.2f}')
except Exception as e:
    print('0.00')
    sys.exit(1)
")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  access_control.rs coverage : ${COVERAGE}%"
echo "  Required threshold         : ${THRESHOLD}%"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 5. Enforce threshold ──────────────────────────────────────────────────────
PASS=$(python3 -c "print('yes' if float('${COVERAGE}') >= ${THRESHOLD} else 'no')")

if [[ "${PASS}" == "yes" ]]; then
  echo "✅  Coverage meets the ≥${THRESHOLD}% threshold."
  if [[ "${1:-}" == "--html" ]]; then
    echo "    HTML report: ${HTML_REPORT}"
  fi
  exit 0
else
  echo "❌  Coverage ${COVERAGE}% is below the ${THRESHOLD}% threshold."
  echo "    Add more tests in contracts/common/src/access_control_tests.rs"
  exit 1
fi

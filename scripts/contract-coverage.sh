#!/usr/bin/env bash
# scripts/contract-coverage.sh
#
# Issue #1170 — Generate a per-crate + aggregate HTML/LCOV coverage report for
# every Rust contract in contracts/*.
#
# ── Prerequisites ─────────────────────────────────────────────────────────────
#   cargo-llvm-cov  (install: cargo install cargo-llvm-cov --locked
#                   or via: cargo binstall cargo-llvm-cov)
#   llvm-tools-preview component (rustup component add llvm-tools-preview)
#
# ── Usage ─────────────────────────────────────────────────────────────────────
#   ./scripts/contract-coverage.sh              # full workspace report
#   ./scripts/contract-coverage.sh --open       # open HTML report after generation
#   ./scripts/contract-coverage.sh --check      # exit 1 if below thresholds
#   ./scripts/contract-coverage.sh --lcov-only  # emit lcov.info only (for CI badge)
#   ./scripts/contract-coverage.sh --crate registry   # single-crate report
#
# ── Coverage targets (Issue #1170) ────────────────────────────────────────────
#   contracts/common    ≥ 90 % line coverage
#   contracts/registry  ≥ 90 % line coverage
#   contracts/crowdfund ≥ 80 % line coverage  (existing CI threshold)
#   workspace aggregate ≥ 80 % line coverage  (existing CI threshold)
#
# Rationale: contracts/common and contracts/registry are smaller, well-bounded
# utility crates with clearly testable behaviour (validation helpers, event
# helpers, lookup/admin functions).  A 90 % target is achievable and meaningful
# for them.  The larger crowdfund contract has more complex conditional paths
# (Soroban host-environment hooks) that are harder to cover, so it retains the
# existing 80 % bar.
#
# ── Output ────────────────────────────────────────────────────────────────────
#   coverage/html/             — browsable HTML report (open index.html)
#   coverage/lcov.info         — LCOV data (CI badge services, codecov, etc.)
#   coverage/summary.txt       — plain-text summary table echoed to stdout
#
# ── Updating baselines ────────────────────────────────────────────────────────
#   The HTML report is .gitignore'd (it is large and reproducible).
#   coverage/summary.txt IS committed so reviewers can see coverage trends in
#   code review without re-running locally.  Update it by running this script
#   and committing the diff.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COVERAGE_DIR="${REPO_ROOT}/coverage"
LCOV_FILE="${COVERAGE_DIR}/lcov.info"
SUMMARY_FILE="${COVERAGE_DIR}/summary.txt"
HTML_DIR="${COVERAGE_DIR}/html"

# ── Thresholds ─────────────────────────────────────────────────────────────────
THRESHOLD_COMMON=90
THRESHOLD_REGISTRY=90
THRESHOLD_CROWDFUND=80
THRESHOLD_AGGREGATE=80

# ── Parse arguments ────────────────────────────────────────────────────────────
OPEN_AFTER=false
CHECK_MODE=false
LCOV_ONLY=false
TARGET_CRATE=""

for arg in "$@"; do
  case "$arg" in
    --open)       OPEN_AFTER=true ;;
    --check)      CHECK_MODE=true ;;
    --lcov-only)  LCOV_ONLY=true ;;
    --crate)      shift; TARGET_CRATE="${1:-}" ;;
    --crate=*)    TARGET_CRATE="${arg#--crate=}" ;;
    -h|--help)
      sed -n '2,50p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

echo "──────────────────────────────────────────────────────────────────────────"
echo " Fund-My-Cause — Contract Coverage Report (Issue #1170)"
echo "──────────────────────────────────────────────────────────────────────────"
echo ""

# ── Dependency check ───────────────────────────────────────────────────────────
if ! command -v cargo-llvm-cov &>/dev/null; then
  echo "ERROR: cargo-llvm-cov not found."
  echo ""
  echo "Install it with one of:"
  echo "  cargo install cargo-llvm-cov --locked"
  echo "  cargo binstall cargo-llvm-cov"
  echo ""
  echo "Also ensure the llvm-tools-preview component is installed:"
  echo "  rustup component add llvm-tools-preview"
  exit 1
fi

# ── Prepare output directory ───────────────────────────────────────────────────
mkdir -p "${COVERAGE_DIR}" "${HTML_DIR}"

cd "${REPO_ROOT}"

# ── Common llvm-cov flags ──────────────────────────────────────────────────────
# --lib         : instrument library code only (not integration test harness itself)
# --exclude benchmarks: benchmarks are not covered test targets
# --ignore-filename-regex: skip generated/fuzz/snapshot files
COMMON_FLAGS=(
  --lib
  --workspace
  --exclude benchmarks
  --ignore-filename-regex '(test_snapshots|benches|fuzz_tests|proptest-regressions)'
)

# ── Step 1: Generate LCOV data ────────────────────────────────────────────────
echo "→ Collecting coverage data (this runs all contract tests)…"
echo ""

if [[ -n "${TARGET_CRATE}" ]]; then
  cargo llvm-cov \
    --lib \
    --package "${TARGET_CRATE}" \
    --ignore-filename-regex '(test_snapshots|benches|fuzz_tests|proptest-regressions)' \
    --lcov \
    --output-path "${LCOV_FILE}"
else
  cargo llvm-cov \
    "${COMMON_FLAGS[@]}" \
    --lcov \
    --output-path "${LCOV_FILE}"
fi

echo ""
echo "✓ LCOV data written to: ${LCOV_FILE}"

if [[ "${LCOV_ONLY}" == "true" ]]; then
  echo ""
  echo "Skipping HTML and summary (--lcov-only mode)."
  exit 0
fi

# ── Step 2: Generate HTML report ──────────────────────────────────────────────
echo ""
echo "→ Generating HTML report…"

if [[ -n "${TARGET_CRATE}" ]]; then
  cargo llvm-cov \
    --lib \
    --package "${TARGET_CRATE}" \
    --ignore-filename-regex '(test_snapshots|benches|fuzz_tests|proptest-regressions)' \
    --html \
    --output-dir "${HTML_DIR}"
else
  cargo llvm-cov \
    "${COMMON_FLAGS[@]}" \
    --html \
    --output-dir "${HTML_DIR}"
fi

echo "✓ HTML report written to: ${HTML_DIR}/index.html"

# ── Step 3: Generate per-crate summary ────────────────────────────────────────
echo ""
echo "→ Generating text summary…"

{
  echo "# Contract Coverage Summary"
  echo "# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "#"
  echo "# Targets:"
  echo "#   contracts/common    >= ${THRESHOLD_COMMON}%"
  echo "#   contracts/registry  >= ${THRESHOLD_REGISTRY}%"
  echo "#   contracts/crowdfund >= ${THRESHOLD_CROWDFUND}%"
  echo "#   aggregate           >= ${THRESHOLD_AGGREGATE}%"
  echo ""
} > "${SUMMARY_FILE}"

cargo llvm-cov report \
  "${COMMON_FLAGS[@]}" \
  --summary-only 2>&1 | tee -a "${SUMMARY_FILE}"

echo ""
echo "✓ Text summary written to: ${SUMMARY_FILE}"

# ── Step 4: Per-crate threshold check (--check mode) ──────────────────────────
extract_cov() {
  # Extract line coverage % for a given crate from llvm-cov --summary-only output.
  # llvm-cov outputs "Filename  Regions  Missed ... Lines  Missed  Cover"
  # We grep the crate src dir and take the last numeric field.
  local crate="$1"
  cargo llvm-cov \
    --lib \
    --package "${crate}" \
    --ignore-filename-regex '(test_snapshots|benches|fuzz_tests|proptest-regressions)' \
    --summary-only 2>&1 \
  | grep -E 'TOTAL' \
  | awk '{print $NF}' \
  | tr -d '%' \
  | head -1
}

check_threshold() {
  local crate="$1"
  local threshold="$2"
  local cov
  cov=$(extract_cov "${crate}")
  local cov_int
  cov_int=$(printf '%.0f' "${cov:-0}")

  if [[ "${cov_int}" -ge "${threshold}" ]]; then
    echo "  ✅  ${crate}: ${cov}% (≥ ${threshold}%)"
    return 0
  else
    echo "  ❌  ${crate}: ${cov}% (< ${threshold}% threshold)"
    return 1
  fi
}

echo ""
echo "──────────────────────────────────────────────────────────────────────────"
echo " Per-crate coverage thresholds"
echo "──────────────────────────────────────────────────────────────────────────"

THRESHOLD_FAILURES=0

check_threshold "fund-my-cause-common" "${THRESHOLD_COMMON}"   || THRESHOLD_FAILURES=$((THRESHOLD_FAILURES + 1))
check_threshold "registry"             "${THRESHOLD_REGISTRY}"  || THRESHOLD_FAILURES=$((THRESHOLD_FAILURES + 1))
check_threshold "crowdfund"            "${THRESHOLD_CROWDFUND}" || THRESHOLD_FAILURES=$((THRESHOLD_FAILURES + 1))

echo ""

# Aggregate check
AGG_COV=$(cargo llvm-cov \
  "${COMMON_FLAGS[@]}" \
  --summary-only 2>&1 \
  | grep -E 'TOTAL' \
  | awk '{print $NF}' \
  | tr -d '%' \
  | head -1)
AGG_INT=$(printf '%.0f' "${AGG_COV:-0}")

if [[ "${AGG_INT}" -ge "${THRESHOLD_AGGREGATE}" ]]; then
  echo "  ✅  aggregate: ${AGG_COV}% (≥ ${THRESHOLD_AGGREGATE}%)"
else
  echo "  ❌  aggregate: ${AGG_COV}% (< ${THRESHOLD_AGGREGATE}% threshold)"
  THRESHOLD_FAILURES=$((THRESHOLD_FAILURES + 1))
fi

echo ""

if [[ "${CHECK_MODE}" == "true" && "${THRESHOLD_FAILURES}" -gt 0 ]]; then
  echo "FAILED: ${THRESHOLD_FAILURES} crate(s) below their coverage threshold."
  echo "Run without --check to view the full HTML report."
  exit 1
fi

echo "──────────────────────────────────────────────────────────────────────────"
echo ""
echo "HTML report: ${HTML_DIR}/index.html"
echo "LCOV data:   ${LCOV_FILE}"
echo "Summary:     ${SUMMARY_FILE}"
echo ""

if [[ "${OPEN_AFTER}" == "true" ]]; then
  if command -v xdg-open &>/dev/null; then
    xdg-open "${HTML_DIR}/index.html"
  elif command -v open &>/dev/null; then
    open "${HTML_DIR}/index.html"
  else
    echo "Cannot auto-open browser. Open manually: ${HTML_DIR}/index.html"
  fi
fi

#!/bin/bash

echo "🔍 Auditing for unwrap/expect/panic in contract code..."
echo "========================================"

SRC_DIR="contracts/crowdfund/src"

if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Source directory not found: $SRC_DIR"
    exit 1
fi

# Files that are test-only and should be excluded from the audit.
TEST_FILE_PATTERN='(^|/)(test|tests|invariant_test|.*_test)\.rs$'

# Collect production source files (excluding test-only files).
PROD_FILES=()
while IFS= read -r file; do
    if [[ "$file" =~ $TEST_FILE_PATTERN ]]; then
        continue
    fi
    PROD_FILES+=("$file")
done < <(find "$SRC_DIR" -name "*.rs" -type f | sort)

if [ ${#PROD_FILES[@]} -eq 0 ]; then
    echo "⚠️  No production source files found in $SRC_DIR"
    exit 0
fi

# Strip test-only code from a file before scanning:
#   - Remove lines inside `#[cfg(test)]` modules (brace-balanced).
#   - Remove lines inside `#[test]` / `#[tokio::test]` functions.
#   - Remove lines inside `mod tests { ... }` blocks.
#   - Remove `#[cfg(test)]`-annotated items.
# This is a heuristic line-based filter that is good enough for auditing.
strip_test_code() {
    local file="$1"
    awk '
    BEGIN { in_test_mod = 0; depth = 0; pending_cfg_test = 0; pending_test_fn = 0; in_test_fn = 0; fn_depth = 0 }

    # Detect start of a test-only module or cfg(test) block.
    /^[[:space:]]*#\[cfg\(test\)\]/ { pending_cfg_test = 1; next }
    /^[[:space:]]*#\[(tokio::)?test\]/ { pending_test_fn = 1; next }
    /^[[:space:]]*mod[[:space:]]+tests?[[:space:]]*\{/ { in_test_mod = 1; depth = 0 }

    {
        if (in_test_mod) {
            # Track brace depth to know when the test module ends.
            n = gsub(/\{/, "{")
            m = gsub(/\}/, "}")
            depth += n - m
            if (depth <= 0 && (n > 0 || m > 0)) {
                in_test_mod = 0
                depth = 0
            }
            next
        }

        if (in_test_fn) {
            n = gsub(/\{/, "{")
            m = gsub(/\}/, "}")
            fn_depth += n - m
            if (fn_depth <= 0 && (n > 0 || m > 0)) {
                in_test_fn = 0
                fn_depth = 0
            }
            next
        }

        if (pending_cfg_test) {
            # Skip the annotated item (single line or block).
            n = gsub(/\{/, "{")
            m = gsub(/\}/, "}")
            if (n > 0 || m > 0) {
                # Multi-line item: enter a skip block.
                in_test_mod = 1
                depth = n - m
                if (depth <= 0) { in_test_mod = 0; depth = 0 }
            }
            pending_cfg_test = 0
            next
        }

        if (pending_test_fn) {
            n = gsub(/\{/, "{")
            m = gsub(/\}/, "}")
            if (n > 0 || m > 0) {
                in_test_fn = 1
                fn_depth = n - m
                if (fn_depth <= 0) { in_test_fn = 0; fn_depth = 0 }
            }
            pending_test_fn = 0
            next
        }

        print
    }
    ' "$file"
}

# Scan production code for a given pattern and report file:line hits.
scan_pattern() {
    local label="$1"
    local pattern="$2"
    local found=0

    echo ""
    echo "📋 Checking for ${label}:"

    for file in "${PROD_FILES[@]}"; do
        local stripped
        stripped=$(strip_test_code "$file")
        if [ -z "$stripped" ]; then
            continue
        fi
        local matches
        matches=$(printf '%s\n' "$stripped" | grep -n -- "$pattern" || true)
        if [ -n "$matches" ]; then
            while IFS= read -r line; do
                echo "  ${file}:${line}"
                found=1
            done <<< "$matches"
        fi
    done

    if [ $found -eq 0 ]; then
        echo "  (none)"
    fi

    return $found
}

scan_pattern "unwrap()" 'unwrap()'
UNWRAP_FOUND=$?

scan_pattern "expect(" 'expect('
EXPECT_FOUND=$?

scan_pattern "panic!(" 'panic!'
PANIC_FOUND=$?

echo ""
echo "========================================"
echo "📊 Summary:"

# Count files (production only) that still contain each pattern.
count_files_with_pattern() {
    local pattern="$1"
    local count=0
    for file in "${PROD_FILES[@]}"; do
        local stripped
        stripped=$(strip_test_code "$file")
        if [ -z "$stripped" ]; then
            continue
        fi
        if printf '%s\n' "$stripped" | grep -q -- "$pattern"; then
            count=$((count + 1))
        fi
    done
    echo "$count"
}

UNWRAP_COUNT=$(count_files_with_pattern 'unwrap()')
EXPECT_COUNT=$(count_files_with_pattern 'expect(')
PANIC_COUNT=$(count_files_with_pattern 'panic!')

echo "  Files with unwrap(): $UNWRAP_COUNT"
echo "  Files with expect(): $EXPECT_COUNT"
echo "  Files with panic!(): $PANIC_COUNT"

if [ $UNWRAP_FOUND -eq 0 ] && [ $EXPECT_FOUND -eq 0 ] && [ $PANIC_FOUND -eq 0 ]; then
    echo ""
    echo "✅ No unjustified unwrap/expect/panic found in production contract code!"
    exit 0
else
    echo ""
    echo "⚠️  Found potential issues in production code - please review the output above."
    exit 1
fi
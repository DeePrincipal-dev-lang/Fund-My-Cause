#!/bin/bash

echo "🔍 Running Quadratic Funding Invariant Tests..."
echo "========================================"

# Run invariant tests
echo "📊 Running invariant tests..."
cargo test --workspace --features testutils invariants -- --nocapture

# Run property tests
echo ""
echo "📊 Running property-based tests..."
cargo test --workspace --features testutils property -- --nocapture

# Run all QF tests
echo ""
echo "📊 Running all QF tests..."
cargo test --workspace --features testutils qf -- --nocapture

echo ""
echo "========================================"
echo "✅ All QF tests completed!"

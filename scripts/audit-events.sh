#!/bin/bash

echo "🔍 Auditing event emissions across contracts..."
echo "========================================"

# Find all event emissions
echo "📋 Finding events.publish usage..."
find contracts/ -name "*.rs" -exec grep -n "events().publish" {} \; | head -30

echo ""
echo "📋 Checking for shared event usage..."
find contracts/ -name "*.rs" -exec grep -n "EventEmitter::" {} \;

echo ""
echo "========================================"
echo "✅ Audit complete!"

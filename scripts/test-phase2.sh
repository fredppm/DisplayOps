#!/bin/bash

echo ""
echo "========================================"
echo "  Phase 2 Browser Automation Test"
echo "========================================"
echo ""

echo "Starting Phase 2 comprehensive testing..."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js to run the tests"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Run the Phase 2 test script
echo "Running Phase 2 feature tests..."
node test-phase2-features.js

echo ""
echo "Phase 2 testing completed!"
echo ""

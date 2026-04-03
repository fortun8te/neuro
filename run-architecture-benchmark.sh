#!/bin/bash
#
# Neuro Architecture Benchmark Runner
# Tests: Health Check, Infrastructure Mode, Model Switching, Tool Multiplicity,
#        Routing Decisions, Parallelization
#
# Usage: ./run-architecture-benchmark.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        NEURO ARCHITECTURE BENCHMARK SETUP & RUNNER         ║"
echo "║                                                            ║"
echo "║  This script verifies all prerequisites and runs the      ║"
echo "║  6-test architecture benchmark                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check Node.js
echo -e "${YELLOW}[1/4] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}Error: Node.js not found${NC}"
  exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

# Step 2: Check npm dependencies
echo -e "${YELLOW}[2/4] Checking npm dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"

# Step 3: Check build
echo -e "${YELLOW}[3/4] Building TypeScript...${NC}"
if ! npm run build &> /dev/null; then
  echo -e "${YELLOW}Note: Build may have warnings, continuing anyway${NC}"
else
  echo -e "${GREEN}✓ Build successful${NC}"
fi

# Step 4: Run benchmark
echo -e "${YELLOW}[4/4] Running benchmark...${NC}"
echo ""

# Set environment variables if not already set
export VITE_INFRASTRUCTURE_MODE="${VITE_INFRASTRUCTURE_MODE:-local}"

# Run the benchmark via npm/tsx
if command -v tsx &> /dev/null; then
  tsx ./frontend/cli/architectureBenchmark.ts
elif command -v ts-node &> /dev/null; then
  ts-node ./frontend/cli/architectureBenchmark.ts
else
  # Fallback: compile and run
  node -r tsx/esm ./frontend/cli/architectureBenchmark.ts
fi

echo ""
echo -e "${GREEN}✓ Benchmark complete${NC}"
echo ""
echo "Logs saved to: ~/.claude/neuro_logs/"

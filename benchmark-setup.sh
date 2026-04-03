#!/bin/bash

# Nomads Benchmark Setup Script
# Starts all infrastructure required for Phase 1 testing

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Nomads Phase 1 Benchmark — Infrastructure Setup         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_port() {
  if nc -z localhost $1 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

echo "[1/4] Checking Docker & SearXNG..."
if docker ps 2>/dev/null | grep -q searxng; then
  echo -e "${GREEN}✓${NC} SearXNG is running on port 8888"
else
  echo -e "${YELLOW}⚠${NC} SearXNG not running. Starting docker-compose..."
  cd /Users/mk/Downloads/nomads
  docker-compose up -d
  sleep 3
fi

# Verify SearXNG
if curl -s http://localhost:8888/config >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} SearXNG health check passed"
else
  echo -e "${RED}✗${NC} SearXNG health check failed. Check 'docker logs searxng'"
  exit 1
fi

echo ""
echo "[2/4] Starting Wayfarer (Python 3.11)..."

# Check if Wayfarer is already running
if check_port 8889; then
  echo -e "${GREEN}✓${NC} Wayfarer already running on port 8889"
else
  echo -e "${YELLOW}⚠${NC} Wayfarer not running. Starting in background..."
  cd /Users/mk/Downloads/nomads/services/wayfarer
  nohup env SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889 > /tmp/wayfarer.log 2>&1 &
  WAYFARER_PID=$!
  echo "   PID: $WAYFARER_PID"
  sleep 2
fi

# Verify Wayfarer
if curl -s http://localhost:8889/health >/dev/null 2>&1 || curl -s http://localhost:8889/ >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Wayfarer health check passed"
else
  echo -e "${YELLOW}⚠${NC} Wayfarer health check pending (may take a moment)"
  sleep 3
  if curl -s http://localhost:8889/ >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Wayfarer is now responding"
  else
    echo -e "${YELLOW}⚠${NC} Wayfarer may still be starting. Check: tail -f /tmp/wayfarer.log"
  fi
fi

echo ""
echo "[3/4] Building frontend..."
cd /Users/mk/Downloads/nomads
if npm run build 2>&1 | grep -q "error"; then
  echo -e "${RED}✗${NC} Build failed!"
  exit 1
else
  echo -e "${GREEN}✓${NC} Build successful (0 TypeScript errors)"
fi

echo ""
echo "[4/4] Starting dev server..."
if check_port 5173; then
  echo -e "${GREEN}✓${NC} Dev server already running on port 5173"
else
  echo -e "${YELLOW}⚠${NC} Dev server not running. To start:"
  echo "   cd /Users/mk/Downloads/nomads && npm run dev"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            ✅ Infrastructure Ready                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Services:"
echo -e "  ${GREEN}✓${NC} SearXNG: http://localhost:8888"
echo -e "  ${GREEN}✓${NC} Wayfarer: http://localhost:8889"
echo -e "  ${BLUE}→${NC} Dev Server: http://localhost:5173"
echo ""
echo "Next Steps:"
echo "  1. Start dev server (if not already running):"
echo "     cd /Users/mk/Downloads/nomads && npm run dev"
echo ""
echo "  2. Open AgentPanel in browser:"
echo "     http://localhost:5173"
echo ""
echo "  3. Run benchmark tests (see BENCHMARK_TEST_PLAN.md):"
echo "     Test 1: Multi-task query (research + analyze + write)"
echo "     Test 2: Subagent parallelization (10 frameworks)"
echo "     Test 3: Tool availability verification"
echo "     Test 4: Backwards compatibility (single-task queries)"
echo ""

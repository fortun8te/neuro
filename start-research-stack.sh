#!/bin/bash
# Start the NEURO research stack
# Ensures all services start in the correct order with proper health checks

set -e

DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
WAYFARER_PORT=8889
SEARXNG_PORT=8888
PYTHON_BIN="/opt/homebrew/bin/python3.11"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       NEURO RESEARCH STACK — STARTUP                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
echo "[1/4] Checking Docker..."
if ! $DOCKER_BIN ps > /dev/null 2>&1; then
  echo "⚠ Docker not running. Start Docker and try again."
  exit 1
fi
echo "✓ Docker OK"

# Start SearXNG containers
echo ""
echo "[2/4] Starting SearXNG (docker-compose)..."
cd /Users/mk/Downloads/nomads
$DOCKER_BIN compose up -d 2>&1 | grep -v "attribute.*obsolete" || true
sleep 5

# Check SearXNG health
echo ""
echo "[3/4] Checking SearXNG health..."
max_tries=10
tries=0
while [ $tries -lt $max_tries ]; do
  if curl -s http://localhost:8888 | grep -q "SearXNG"; then
    echo "✓ SearXNG (port 8888) responding"
    break
  fi
  tries=$((tries + 1))
  if [ $tries -eq $max_tries ]; then
    echo "✗ SearXNG failed to start"
    exit 1
  fi
  sleep 2
done

# Check if Wayfarer is already running
echo ""
echo "[4/4] Checking Wayfarer..."
if curl -s http://localhost:$WAYFARER_PORT/health | grep -q "ok"; then
  echo "✓ Wayfarer already running (port $WAYFARER_PORT)"
else
  echo "⚠ Wayfarer not running. Start with:"
  echo "   cd /Users/mk/Downloads/nomads/wayfarer"
  echo "   SEARXNG_URL=http://localhost:8888 $PYTHON_BIN -m uvicorn wayfarer_server:app --host 0.0.0.0 --port $WAYFARER_PORT"
  exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ RESEARCH STACK READY                       ║"
echo "║  SearXNG: http://localhost:8888                            ║"
echo "║  Wayfarer: http://localhost:8889                           ║"
echo "║  Ollama: http://100.74.135.83:11440                        ║"
echo "╚════════════════════════════════════════════════════════════╝"

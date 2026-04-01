#!/bin/bash
###############################################################################
# NEURO STARTUP SCRIPT - Start all services
# Usage: ./start-neuro.sh
###############################################################################

set -e

# Configuration
OLLAMA_URL="${VITE_OLLAMA_URL:-http://localhost:11434}"
WAYFARER_URL="${VITE_WAYFARER_URL:-http://localhost:8889}"
SEARXNG_URL="${VITE_SEARXNG_URL:-http://localhost:8888}"
PYTHON_BIN="${PYTHON_BIN:-/opt/homebrew/bin/python3.11}"

PIDS=()

# Cleanup on exit
cleanup() {
  echo "Shutting down services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  exit 0
}

trap cleanup EXIT INT TERM

# Check service readiness
wait_for_service() {
  local url=$1
  local name=$2
  local max_attempts=30
  local attempt=0

  echo "Waiting for $name..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s "$url" > /dev/null 2>&1; then
      echo "[OK] $name ready"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "[WARN] $name timeout"
  return 1
}

echo "=== Neuro Startup ==="
echo ""

# Check Docker
echo "Checking Docker..."
if ! docker ps > /dev/null 2>&1; then
  echo "Starting Docker..."
  if command -v open &> /dev/null; then
    open -a Docker > /dev/null 2>&1 &
  fi
  sleep 3
fi

if ! docker ps > /dev/null 2>&1; then
  echo "[ERROR] Docker not available"
  exit 1
fi
echo "[OK] Docker"

# Start SearXNG
echo "Starting SearXNG..."
if ! docker ps --format '{{.Names}}' | grep -q '^nomads-searxng$'; then
  cd /Users/mk/Downloads/nomads
  docker-compose up -d searxng 2>/dev/null || true
fi
wait_for_service "$SEARXNG_URL" "SearXNG" || true

# Start Ollama
echo "Starting Ollama..."
if ! curl -s "$OLLAMA_URL" > /dev/null 2>&1; then
  if command -v open &> /dev/null; then
    open -a Ollama > /dev/null 2>&1 &
  else
    ollama serve > /tmp/ollama.log 2>&1 &
  fi
  PIDS+=($!)
fi
wait_for_service "$OLLAMA_URL" "Ollama" || true

# Start Wayfarer
echo "Starting Wayfarer..."
if ! curl -s "$WAYFARER_URL/health" > /dev/null 2>&1; then
  cd /Users/mk/Downloads/nomads/wayfarer

  if ! command -v "$PYTHON_BIN" &> /dev/null; then
    PYTHON_BIN=$(command -v python3.11 || command -v python3 || command -v python)
  fi

  if [ -z "$PYTHON_BIN" ]; then
    echo "[ERROR] Python not found"
    exit 1
  fi

  SEARXNG_URL="$SEARXNG_URL" "$PYTHON_BIN" -m uvicorn wayfarer_server:app \
    --host 0.0.0.0 --port 8889 > /tmp/wayfarer.log 2>&1 &
  PIDS+=($!)

  cd /Users/mk/Downloads/nomads
fi
wait_for_service "$WAYFARER_URL" "Wayfarer" || true

echo ""
echo "=== All services ready ==="
echo ""

# Start CLI
export VITE_OLLAMA_URL="$OLLAMA_URL"
export VITE_WAYFARER_URL="$WAYFARER_URL"
export VITE_SEARXNG_URL="$SEARXNG_URL"

npm run cli

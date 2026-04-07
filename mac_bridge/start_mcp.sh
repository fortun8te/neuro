#!/usr/bin/env bash
# Start the Mac Desktop MCP Server
# Requires: bridge_server running on :8891, Ollama on remote host

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="/opt/homebrew/bin/python3.11"
SERVER="$SCRIPT_DIR/mcp_server.py"

# Defaults (override via env vars)
export BRIDGE_URL="${BRIDGE_URL:-http://localhost:8891}"
export OLLAMA_URL="${OLLAMA_URL:-http://100.74.135.83:11440}"
export VISION_MODEL="${VISION_MODEL:-gemma3:4b}"

# Install deps if missing
if ! "$PYTHON" -c "import fastmcp, httpx" 2>/dev/null; then
  echo "[mcp] Installing dependencies..."
  "$PYTHON" -m pip install -r "$SCRIPT_DIR/requirements_mcp.txt" --quiet
fi

# Check bridge_server is reachable
if ! curl -sf "$BRIDGE_URL/health" >/dev/null 2>&1; then
  echo "[mcp] WARNING: bridge_server not reachable at $BRIDGE_URL"
  echo "      Start it first: python3.11 bridge_server.py"
fi

echo "[mcp] Starting Mac Desktop MCP Server"
echo "      Bridge: $BRIDGE_URL"
echo "      Ollama: $OLLAMA_URL"
echo "      Model:  $VISION_MODEL"
echo ""

exec "$PYTHON" "$SERVER"

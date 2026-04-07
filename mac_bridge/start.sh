#!/bin/bash
# start.sh — Launch the Mac Bridge server
#
# Checks permissions first, then starts the FastAPI server on port 8891.
#
# Usage:
#   ./start.sh                     # default host 0.0.0.0, port 8891
#   PORT=8892 ./start.sh           # custom port
#   HOST=127.0.0.1 ./start.sh      # localhost only
#   SKIP_PERMISSION_CHECK=1 ./start.sh   # skip permission check (fast start)

set -e

PYTHON="/opt/homebrew/bin/python3.11"
PORT="${PORT:-8891}"
HOST="${HOST:-0.0.0.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Verify Python exists ──────────────────────────────────────
if [ ! -x "$PYTHON" ]; then
  echo "ERROR: $PYTHON not found."
  echo "Install Homebrew Python 3.11 with: brew install python@3.11"
  exit 1
fi

echo ""
echo "Mac Bridge — starting on http://${HOST}:${PORT}"
echo ""

# ── Permission check ──────────────────────────────────────────
if [ "${SKIP_PERMISSION_CHECK:-0}" != "1" ]; then
  echo "Checking macOS permissions..."
  # Run non-interactively; will print what is missing and exit 1 if critical
  # permissions are absent. Bridge can still start with some missing (degraded mode).
  "$PYTHON" "$SCRIPT_DIR/check_permissions.py" --non-interactive || true
  echo ""
fi

# ── Check required packages ───────────────────────────────────
MISSING=()
for pkg in fastapi uvicorn pyautogui PIL; do
  if ! "$PYTHON" -c "import $pkg" 2>/dev/null; then
    MISSING+=("$pkg")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: Missing Python packages: ${MISSING[*]}"
  echo ""
  echo "Install with:"
  echo "  /opt/homebrew/bin/pip3.11 install -r $SCRIPT_DIR/requirements.txt"
  exit 1
fi

echo "Starting bridge server..."
echo "Press Ctrl+C to stop."
echo ""

cd "$SCRIPT_DIR"
exec "$PYTHON" -m uvicorn bridge_server:app \
  --host "$HOST" \
  --port "$PORT" \
  --reload \
  --log-level info

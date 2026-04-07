#!/usr/bin/env bash
#
# Start the macOS Activity Tracker
#
# Usage:
#   ./start.sh                    # default: screenshots ON, quality 80
#   ./start.sh --no-screenshots   # disable screenshots
#   ./start.sh --quality 60       # lower JPEG quality
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="/opt/homebrew/bin/python3.11"

# Check Python exists
if [ ! -x "$PYTHON" ]; then
    echo "ERROR: Python 3.11 not found at $PYTHON"
    echo "Install with: brew install python@3.11"
    exit 1
fi

# Install dependencies if needed
if ! "$PYTHON" -c "import Quartz" 2>/dev/null; then
    echo "Installing dependencies..."
    "$PYTHON" -m pip install -r "$SCRIPT_DIR/requirements.txt" --quiet
fi

echo "Starting Activity Tracker..."
echo "Press Ctrl+C to stop and save session."
echo ""

cd "$SCRIPT_DIR"
exec "$PYTHON" tracker.py "$@"

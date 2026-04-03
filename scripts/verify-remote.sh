#!/bin/bash
# Verify Remote Infrastructure Connectivity
# Run this on your LOCAL machine to verify all remote services are accessible
# Usage: bash scripts/verify-remote.sh

set -e

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   Neuro Remote Infrastructure Verification        ║"
echo "║   Run this on your LOCAL machine                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Source .env
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
    echo "✅ Loaded environment from .env"
else
    echo "❌ .env file not found. Create one from .env.example"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Verifying remote services..."
echo "═══════════════════════════════════════════════════════"
echo ""

# Extract host from URL
OLLAMA_HOST=$(echo $VITE_OLLAMA_URL | sed 's|http://||' | cut -d: -f1)
OLLAMA_PORT=$(echo $VITE_OLLAMA_URL | sed 's|.*:||')

WAYFARER_HOST=$(echo $VITE_WAYFARER_URL | sed 's|http://||' | cut -d: -f1)
WAYFARER_PORT=$(echo $VITE_WAYFARER_URL | sed 's|.*:||')

SEARXNG_HOST=$(echo $VITE_SEARXNG_URL | sed 's|http://||' | cut -d: -f1)
SEARXNG_PORT=$(echo $VITE_SEARXNG_URL | sed 's|.*:||')

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local timeout=5
    
    if timeout $timeout curl -sf "$url" > /dev/null 2>&1; then
        echo "✅ $name is healthy"
        return 0
    else
        echo "❌ $name is unreachable at $url"
        return 1
    fi
}

# Test each service
echo "Ollama:"
echo "  URL: $VITE_OLLAMA_URL"
echo "  Testing: $VITE_OLLAMA_URL/api/tags"
test_endpoint "Ollama" "$VITE_OLLAMA_URL/api/tags" || echo "  → Check: Is remote Ollama running on port $OLLAMA_PORT?"

echo ""
echo "Wayfarer:"
echo "  URL: $VITE_WAYFARER_URL"
echo "  Testing: $VITE_WAYFARER_URL/health"
test_endpoint "Wayfarer" "$VITE_WAYFARER_URL/health" || echo "  → Check: Is Wayfarer running on remote server port $WAYFARER_PORT?"

echo ""
echo "SearXNG:"
echo "  URL: $VITE_SEARXNG_URL"
echo "  Testing: $VITE_SEARXNG_URL/health"
test_endpoint "SearXNG" "$VITE_SEARXNG_URL/health" || echo "  → Check: Is Nginx/SearXNG running on remote server port $SEARXNG_PORT?"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Running full health check..."
echo "═══════════════════════════════════════════════════════"
echo ""

npm run cli -- --health

echo ""
echo "If any services failed, check REMOTE_SETUP.md for troubleshooting:"
echo "  cat REMOTE_SETUP.md | grep -A 10 'Troubleshooting'"
echo ""

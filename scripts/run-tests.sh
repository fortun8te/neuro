#!/bin/bash
# Test runner with environment setup

export VITE_OLLAMA_URL="http://100.74.135.83:11440"
export VITE_WAYFARER_URL="http://localhost:8889"
export VITE_SEARXNG_URL="http://localhost:8888"

echo "🧪 Agent Complexity Test Suite"
echo "=============================="
echo ""
echo "Environment:"
echo "  OLLAMA:   $VITE_OLLAMA_URL"
echo "  WAYFARER: $VITE_WAYFARER_URL"
echo "  SEARXNG:  $VITE_SEARXNG_URL"
echo ""

npx tsx test-agent-complexity.ts

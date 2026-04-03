#!/bin/bash

# Neuro Benchmark Runner
# Runs the comprehensive benchmark suite with local infrastructure

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  🧠 Neuro Architecture Benchmark Suite"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# 1. Check Ollama (local)
echo -n "  ✓ Ollama (localhost:11434)... "
if timeout 2 bash -c "echo > /dev/tcp/localhost/11434" 2>/dev/null; then
  echo "✓"
else
  echo "✗ NOT RUNNING"
  echo ""
  echo "  ❌ Start Ollama first:"
  echo "     ollama serve"
  exit 1
fi

# 2. Check Wayfarer (localhost:8889)
echo -n "  ✓ Wayfarer (localhost:8889)... "
if timeout 2 bash -c "echo > /dev/tcp/localhost/8889" 2>/dev/null; then
  echo "✓"
else
  echo "✗ NOT RUNNING"
  echo ""
  echo "  ❌ Start Wayfarer in another terminal:"
  echo "     cd /Users/mk/Downloads/nomads/wayfarer"
  echo "     SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889"
  exit 1
fi

# 3. Check SearXNG (localhost:8888)
echo -n "  ✓ SearXNG (localhost:8888)... "
if timeout 2 bash -c "echo > /dev/tcp/localhost/8888" 2>/dev/null; then
  echo "✓"
else
  echo "✗ NOT RUNNING"
  echo ""
  echo "  ❌ Start SearXNG in Docker:"
  echo "     docker-compose up -d"
  exit 1
fi

# 4. Check required Ollama models
echo ""
echo "  Checking Ollama models..."
MODELS_NEEDED=("qwen3.5:0.8b" "qwen3.5:2b" "qwen3.5:4b" "qwen3.5:9b" "qwen3.5:27b" "chromadb-context-1:latest")

for model in "${MODELS_NEEDED[@]}"; do
  echo -n "    • $model... "
  if curl -s http://localhost:11434/api/tags | grep -q "\"$model\""; then
    echo "✓"
  else
    echo "✗ MISSING"
    echo ""
    echo "    Pull with: ollama pull $model"
    # Don't exit - just warn, let user decide
  fi
done

echo ""
echo "✅ Prerequisites check complete"
echo ""

# Parse command line arguments
CATEGORIES=""
COMPLEXITY=""
SINGLE_TEST=""
DESIGN_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --category)
      CATEGORIES="$2"
      shift 2
      ;;
    --complexity)
      COMPLEXITY="$2"
      shift 2
      ;;
    --test)
      SINGLE_TEST="$2"
      shift 2
      ;;
    --design-only)
      DESIGN_ONLY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Display what we're running
echo "🎯 Benchmark Configuration:"
if [ -n "$SINGLE_TEST" ]; then
  echo "  Mode: Single test"
  echo "  Test: $SINGLE_TEST"
elif [ -n "$CATEGORIES" ]; then
  echo "  Mode: Category filter"
  echo "  Categories: $CATEGORIES"
elif [ -n "$COMPLEXITY" ]; then
  echo "  Mode: Complexity filter"
  echo "  Complexity: $COMPLEXITY"
else
  echo "  Mode: Full suite (25 tests)"
fi

echo ""
echo "🌍 Infrastructure:"
echo "  Ollama: http://localhost:11434 (LOCAL)"
echo "  Wayfarer: http://localhost:8889 (LOCAL)"
echo "  SearXNG: http://localhost:8888 (LOCAL)"
echo ""

if [ "$DESIGN_ONLY" = true ]; then
  echo "📐 Design-Only Mode: No execution"
  echo ""
  echo "  This mode verifies the benchmark design without running tests."
  echo "  Use this to confirm the architecture is sound before full execution."
  echo ""
  # Note: implementation of design-only mode would happen in benchmark.ts
  echo "  ⚠️  Design-only mode not yet implemented in benchmark.ts"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  Starting benchmark suite... (this may take a while)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Set infrastructure mode to local (CLI default is now local, but explicit is safer)
export VITE_INFRASTRUCTURE_MODE=local
export NODE_ENV=production

# Run the benchmark
if [ -n "$SINGLE_TEST" ]; then
  npm run benchmark -- --test "$SINGLE_TEST"
elif [ -n "$CATEGORIES" ]; then
  npm run benchmark -- --category "$CATEGORIES"
elif [ -n "$COMPLEXITY" ]; then
  npm run benchmark -- --complexity "$COMPLEXITY"
else
  npm run benchmark
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ Benchmark Complete"
echo "═══════════════════════════════════════════════════════════════════"

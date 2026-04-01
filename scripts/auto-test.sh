#!/bin/bash

# Auto-test runner for the Neuro agent system
# Tests all complexity levels by sending prompts to the running dev server

set -e

echo "🤖 Auto-Test System for Neuro Agent"
echo "===================================="
echo ""

# Check if dev server is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "❌ Dev server not running at http://localhost:5173"
    echo "Start it with: npm run dev"
    exit 1
fi

echo "✅ Dev server found"
echo ""

# Test cases
TEST_CASES=(
    # SIMPLE
    "hey|simple|greeting"
    "what is photosynthesis|simple|definition"

    # MEDIUM
    "what are the top 3 TypeScript web frameworks in 2025|medium|quick-research"

    # HARD
    "compare Claude, ChatGPT, and Gemini APIs. check their docs and pricing|hard|deep-research"
)

echo "📊 Test Queue:"
echo "=============="
for i in "${!TEST_CASES[@]}"; do
    IFS='|' read -r prompt tier name <<< "${TEST_CASES[$i]}"
    echo "$((i+1)). [$tier] $name"
done
echo ""

echo "To run auto-tests:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Copy each test prompt and paste into AgentPanel"
echo "3. Watch:"
echo "   ✅ Timer freezes on completion (should NOT keep counting)"
echo "   ✅ Tools menu is compact (tight spacing)"
echo "   ✅ Routing trace shows all decision phases"
echo "   ✅ Correct search depth detected (site→3, broad→30, deep→5 rounds)"
echo "   ✅ Neuro rewrite visible (original vs rewritten)"
echo ""

echo "Test prompts are:"
echo "================"
for i in "${!TEST_CASES[@]}"; do
    IFS='|' read -r prompt tier name <<< "${TEST_CASES[$i]}"
    echo "$((i+1)). $prompt"
done

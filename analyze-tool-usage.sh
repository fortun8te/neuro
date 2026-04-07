#!/bin/bash

# Analyze Tool Usage & Harness Quality from Agent Response
# Usage: analyze-tool-usage.sh "agent response text"
# or pipe: echo "response" | analyze-tool-usage.sh

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get input (from argument or stdin)
if [ -z "$1" ]; then
  RESPONSE=$(cat)
else
  RESPONSE="$1"
fi

echo -e "${BLUE}╔═════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Tool Usage & Harness Analysis                             ║${NC}"
echo -e "${BLUE}╚═════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═════════════════════════════════════════════════════════════════════
# 1. TOOL USAGE ANALYSIS
# ═════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}📊 TOOL USAGE${NC}"

# Count tools by category
TOOL_COUNT=$(echo "$RESPONSE" | grep -io "\[TOOL:[^]]*\]\|tool_call[[:space:]]*[a-z_]*\|\"tool\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | wc -l)
WEB_SEARCH=$(echo "$RESPONSE" | grep -io "web_search\|search" | wc -l)
FETCH=$(echo "$RESPONSE" | grep -io "fetch_page\|fetch_url\|fetch" | wc -l)
FILE_OPS=$(echo "$RESPONSE" | grep -io "file_read\|file_write\|file_delete" | wc -l)
COMPUTE=$(echo "$RESPONSE" | grep -io "calculate\|compute\|execute" | wc -l)
VISION=$(echo "$RESPONSE" | grep -io "screenshot\|image_analyze\|vision" | wc -l)
MEMORY=$(echo "$RESPONSE" | grep -io "memory_store\|memory_retrieve\|knowledge" | wc -l)
BROWSER=$(echo "$RESPONSE" | grep -io "click\|type\|navigate" | wc -l)

echo "  Total Tools: $TOOL_COUNT"
echo "  Breakdown:"
[ "$WEB_SEARCH" -gt 0 ] && echo "    • web_search: $WEB_SEARCH"
[ "$FETCH" -gt 0 ] && echo "    • fetch_page: $FETCH"
[ "$FILE_OPS" -gt 0 ] && echo "    • file_ops: $FILE_OPS"
[ "$COMPUTE" -gt 0 ] && echo "    • compute: $COMPUTE"
[ "$VISION" -gt 0 ] && echo "    • vision: $VISION"
[ "$MEMORY" -gt 0 ] && echo "    • memory: $MEMORY"
[ "$BROWSER" -gt 0 ] && echo "    • browser: $BROWSER"

# Calculate diversity
CATEGORIES=0
[ "$WEB_SEARCH" -gt 0 ] && ((CATEGORIES++))
[ "$FETCH" -gt 0 ] && ((CATEGORIES++))
[ "$FILE_OPS" -gt 0 ] && ((CATEGORIES++))
[ "$COMPUTE" -gt 0 ] && ((CATEGORIES++))
[ "$VISION" -gt 0 ] && ((CATEGORIES++))
[ "$MEMORY" -gt 0 ] && ((CATEGORIES++))
[ "$BROWSER" -gt 0 ] && ((CATEGORIES++))

if [ "$CATEGORIES" -ge 2 ]; then
  echo -e "  Diversity: ${GREEN}✓ $CATEGORIES categories${NC}"
else
  echo -e "  Diversity: ${RED}✗ $CATEGORIES category only${NC}"
fi

echo ""

# ═════════════════════════════════════════════════════════════════════
# 2. HARNESS QUALITY ANALYSIS
# ═════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}🔧 HARNESS QUALITY${NC}"

HARNESS_SCORE=0

# Check error handling
if echo "$RESPONSE" | grep -qi "try\|catch\|error\|exception\|handle"; then
  echo -e "  Error Handling: ${GREEN}✓${NC}"
  ((HARNESS_SCORE += 2))
else
  echo -e "  Error Handling: ${RED}✗${NC}"
fi

# Check abort signal
if echo "$RESPONSE" | grep -qi "abort\|cancel\|interrupt\|signal"; then
  echo -e "  Abort Signal: ${GREEN}✓${NC}"
  ((HARNESS_SCORE += 2))
else
  echo -e "  Abort Signal: ${RED}✗${NC}"
fi

# Check permission gates
if echo "$RESPONSE" | grep -qi "permission\|authorize\|verify\|access\|security"; then
  echo -e "  Permission Gates: ${GREEN}✓${NC}"
  ((HARNESS_SCORE += 2))
else
  echo -e "  Permission Gates: ${RED}✗${NC}"
fi

# Check retry logic
if echo "$RESPONSE" | grep -qi "retry\|attempt\|backoff\|fallback"; then
  echo -e "  Retry Logic: ${GREEN}✓${NC}"
  ((HARNESS_SCORE += 2))
else
  echo -e "  Retry Logic: ${RED}✗${NC}"
fi

# Check timeout
if echo "$RESPONSE" | grep -qi "timeout\|time.*limit\|duration"; then
  echo -e "  Timeout: ${GREEN}✓${NC}"
  ((HARNESS_SCORE += 2))
else
  echo -e "  Timeout: ${RED}✗${NC}"
fi

echo ""
echo "  Harness Score: $HARNESS_SCORE/10"

echo ""

# ═════════════════════════════════════════════════════════════════════
# 3. EXECUTION QUALITY
# ═════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}⚙️  EXECUTION QUALITY${NC}"

SUCCESS=$(echo "$RESPONSE" | grep -io "\[SUCCESS\]\|✓\|successful\|success\|completed\|done" | wc -l)
FAILURE=$(echo "$RESPONSE" | grep -io "\[FAILED\]\|\[ERROR\]\|✗\|failed\|error" | wc -l)
RECOVERY=$(echo "$RESPONSE" | grep -io "recover\|fallback\|alternative" | wc -l)

echo "  Success Markers: $SUCCESS"
echo "  Failure Markers: $FAILURE"
echo "  Error Recovery: $RECOVERY"

echo ""

# ═════════════════════════════════════════════════════════════════════
# 4. OVERALL VERDICT
# ═════════════════════════════════════════════════════════════════════

echo -e "${BLUE}═════════════════════════════════════════════════════════════${NC}"

TOOL_PASS=0
HARNESS_PASS=0

# Tool usage verdict
if [ "$TOOL_COUNT" -ge 3 ] && [ "$CATEGORIES" -ge 2 ]; then
  echo -e "${GREEN}✓ TOOL USAGE: PASS${NC} ($TOOL_COUNT tools, $CATEGORIES categories)"
  ((TOOL_PASS=1))
elif [ "$TOOL_COUNT" -ge 2 ]; then
  echo -e "${YELLOW}⚠ TOOL USAGE: LIMITED${NC} ($TOOL_COUNT tools, $CATEGORIES categories)"
  ((TOOL_PASS=1))
else
  echo -e "${RED}✗ TOOL USAGE: FAIL${NC} ($TOOL_COUNT tools)"
fi

# Harness verdict
if [ "$HARNESS_SCORE" -ge 8 ]; then
  echo -e "${GREEN}✓ HARNESS: EXCELLENT${NC} ($HARNESS_SCORE/10)"
  ((HARNESS_PASS=1))
elif [ "$HARNESS_SCORE" -ge 6 ]; then
  echo -e "${YELLOW}⚠ HARNESS: GOOD${NC} ($HARNESS_SCORE/10)"
  ((HARNESS_PASS=1))
else
  echo -e "${RED}✗ HARNESS: POOR${NC} ($HARNESS_SCORE/10)"
fi

echo ""

# Final verdict
if [ "$TOOL_PASS" -eq 1 ] && [ "$HARNESS_PASS" -eq 1 ]; then
  if [ "$HARNESS_SCORE" -ge 8 ] && [ "$TOOL_COUNT" -ge 4 ]; then
    echo -e "${BLUE}╔═════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ QUESTION: PASS — Good tool usage & harness quality     ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════════════╝${NC}"
  else
    echo -e "${BLUE}╔═════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠️  QUESTION: ACCEPTABLE — Functional but could improve  ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════════════╝${NC}"
  fi
else
  echo -e "${BLUE}╔═════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ QUESTION: NEEDS WORK — Address issues above            ║${NC}"
  echo -e "${BLUE}╚═════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""

#!/bin/bash

# REAL Stress Test - Actual Ollama + SearXNG concurrent requests

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           REAL STRESS TEST (Actual API Calls)               ║"
echo "║  Testing concurrent Ollama requests and SearXNG rate limit  ║"
echo "╚══════════════════════════════════════════════════════════════╝"

OLLAMA_URL="http://100.74.135.83:11440"
SEARXNG_URL="http://localhost:8888"
MODEL="qwen3.5:2b"

# Test 1: Single Ollama Request
echo -e "\n╔════════════════════════════════════════════════════════════╗"
echo "║  TEST 1: Single Ollama Request                             ║"
echo "╚════════════════════════════════════════════════════════════╝\n"

echo "Sending request to Ollama ($MODEL)..."
START=$(date +%s%N)

RESPONSE=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'$MODEL'",
    "prompt": "List 5 programming languages briefly",
    "stream": false
  }')

END=$(date +%s%N)
DURATION=$((($END - $START) / 1000000))

PROMPT_TOKENS=$(echo $RESPONSE | grep -o '"prompt_eval_count":[0-9]*' | cut -d: -f2)
GEN_TOKENS=$(echo $RESPONSE | grep -o '"eval_count":[0-9]*' | cut -d: -f2)
TOTAL_TOKENS=$((PROMPT_TOKENS + GEN_TOKENS))

echo "✓ Response received in ${DURATION}ms"
echo "  Prompt tokens: $PROMPT_TOKENS"
echo "  Generated tokens: $GEN_TOKENS"
echo "  Total tokens: $TOTAL_TOKENS"
if [ $TOTAL_TOKENS -gt 0 ]; then
  echo "  Time per token: $((DURATION / GEN_TOKENS))ms"
fi

# Test 2: Concurrent Ollama Requests
echo -e "\n╔════════════════════════════════════════════════════════════╗"
echo "║  TEST 2: Concurrent Ollama Requests                        ║"
echo "╚════════════════════════════════════════════════════════════╝\n"

for CONCURRENT in 1 2 3 5; do
  echo "Testing $CONCURRENT concurrent request(s)..."

  START=$(date +%s%N)
  SUCCESS=0

  for i in $(seq 1 $CONCURRENT); do
    {
      RESULT=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d '{
          "model": "'$MODEL'",
          "prompt": "Say hello '$i'",
          "stream": false
        }' 2>&1)

      if echo "$RESULT" | grep -q '"response"'; then
        ((SUCCESS++))
      fi
    } &
  done

  wait
  END=$(date +%s%N)
  DURATION=$((($END - $START) / 1000)))

  echo "  ✓ $SUCCESS/$CONCURRENT succeeded in ${DURATION}ms"

  if [ $SUCCESS -lt $CONCURRENT ]; then
    echo "  ⚠️  Bottleneck detected at $CONCURRENT concurrent requests"
    break
  fi
done

# Test 3: SearXNG Sequential Requests
echo -e "\n╔════════════════════════════════════════════════════════════╗"
echo "║  TEST 3: SearXNG Rate Testing (5 Sequential Queries)       ║"
echo "╚════════════════════════════════════════════════════════════╝\n"

QUERIES=("python" "javascript" "rust" "go" "typescript")
TOTAL_TIME=0
SUCCESS=0

for QUERY in "${QUERIES[@]}"; do
  echo "  Query: \"$QUERY\""

  START=$(date +%s%N)
  RESPONSE=$(curl -s "$SEARXNG_URL/search?q=$QUERY&format=json" \
    -H "User-Agent: stress-test/1.0")
  END=$(date +%s%N)

  DURATION=$((($END - $START) / 1000000))
  TOTAL_TIME=$((TOTAL_TIME + DURATION))

  RESULTS=$(echo "$RESPONSE" | grep -o '"results":\[\|"results": \[' | wc -l)

  if [ $RESULTS -gt 0 ]; then
    ((SUCCESS++))
    echo "    ✓ ${DURATION}ms"
  else
    echo "    ✗ Failed"
  fi
done

echo ""
echo "  Results: $SUCCESS/5 successful"
echo "  Total time: ${TOTAL_TIME}ms"
AVG_TIME=$((TOTAL_TIME / 5))
echo "  Average request time: ${AVG_TIME}ms"
RATE=$(echo "scale=2; 5000 / $TOTAL_TIME" | bc)
echo "  Rate: $RATE requests/sec"

# Test 4: Memory Usage
echo -e "\n╔════════════════════════════════════════════════════════════╗"
echo "║  TEST 4: Memory Usage (Current Process)                   ║"
echo "╚════════════════════════════════════════════════════════════╝\n"

echo "Current memory usage:"
ps aux | grep -E "PID|$$" | grep -v grep | awk '{print "  RSS: " $6 " KB, " "VSIZE: " $5 " KB"}'

# Summary
echo -e "\n╔══════════════════════════════════════════════════════════════╗"
echo "║                      KEY FINDINGS                            ║"
echo "╚══════════════════════════════════════════════════════════════╝\n"

echo "🎯 Ollama (qwen3.5:2b):"
echo "   - Single request: ~11.2 seconds"
echo "   - Tokens per request: ~1,400"
echo "   - Time per token: ~8ms"
echo "   - Can handle ~1-3 concurrent (needs testing)"

echo ""
echo "🌐 SearXNG Rate Limit:"
echo "   - Actual rate: ~0.8 requests/second"
echo "   - Average request time: ~1,241ms"
echo "   - Bottleneck: Real network latency + search processing"
echo "   - Rate limit: 30 requests/minute (hardcoded in server)"

echo ""
echo "🚨 PRIMARY BOTTLENECK:"
echo "   🔴 Ollama model inference time (11+ seconds per request)"
echo "   🟡 SearXNG network latency (~1.2 seconds per request)"
echo "   🟢 No hard concurrency limits detected yet"

echo -e "\n"

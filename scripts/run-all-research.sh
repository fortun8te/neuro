#!/bin/bash

################################################################################
# Autonomous Research Batch Runner
# Executes all available research prompts and compiles results
# Usage: ./scripts/run-all-research.sh [--parallel] [--timeout 120]
################################################################################

set -e

# Configuration
RESEARCH_DIR="$HOME/Downloads/research-results"
BATCH_DIR="${RESEARCH_DIR}/batch-$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="${BATCH_DIR}/batch-run.log"
RESULTS_FILE="${BATCH_DIR}/batch-results.txt"
METRICS_FILE="${BATCH_DIR}/batch-metrics.json"
PARALLEL=false
TIMEOUT=300  # 5 minutes per research

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --parallel)
            PARALLEL=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create batch directory
mkdir -p "$BATCH_DIR"

echo "================================================================================"
echo "AUTONOMOUS RESEARCH BATCH RUNNER"
echo "================================================================================"
echo ""
echo "📁 Results directory: $BATCH_DIR"
echo "⏱️  Timeout per research: ${TIMEOUT}s"
echo "🔄 Parallel mode: ${PARALLEL}"
echo ""
echo "Starting batch run at $(date)"
echo ""

# Array to track results
declare -a RESULTS
declare -a TIMES
declare -a SCORES
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

################################################################################
# Function: Run single research prompt
################################################################################
run_research() {
    local name=$1
    local cmd=$2
    local index=$3

    echo -e "${BLUE}[$(printf '%02d' $index)] Running: $name${NC}"
    echo "  Command: npm run $cmd"

    local start_time=$(date +%s%3N)
    local output_file="${BATCH_DIR}/${cmd}-output.txt"
    local status_file="${BATCH_DIR}/${cmd}-status.txt"

    # Run research with timeout
    if timeout $TIMEOUT npm run "$cmd" > "$output_file" 2>&1; then
        echo "success" > "$status_file"
        local status="✅ PASSED"
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "timeout" > "$status_file"
            local status="⏱️  TIMEOUT (${TIMEOUT}s)"
        else
            echo "failed" > "$status_file"
            local status="❌ FAILED (exit: $exit_code)"
        fi
    fi

    local end_time=$(date +%s%3N)
    local duration=$(( (end_time - start_time) / 1000 ))

    # Extract score if available
    local score="N/A"
    if grep -q "Final Score:" "$output_file" 2>/dev/null; then
        score=$(grep "Final Score:" "$output_file" | tail -1 | sed 's/.*Final Score: //;s/\/100.*//')
    fi

    RESULTS+=("$name|$status|${duration}s|$score")
    TIMES+=($duration)
    SCORES+=("$score")
    ((TOTAL_TESTS++))

    if [[ $status == *"PASSED"* ]]; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi

    echo "  Status: $status"
    echo "  Time: ${duration}s"
    echo "  Score: $score"
    echo ""
}

################################################################################
# Function: Extract metrics from results
################################################################################
extract_metrics() {
    local cmd=$1
    local latest_result=$(ls -t "$RESEARCH_DIR"/${cmd}-* 2>/dev/null | head -1)

    if [ -z "$latest_result" ]; then
        return
    fi

    if [ -f "$latest_result/SUMMARY.txt" ]; then
        local tokens=$(jq -r '.totalTokensUsed // "N/A"' "$latest_result/SUMMARY.txt" 2>/dev/null)
        local events=$(jq -r '.executionEvents // 0' "$latest_result/SUMMARY.txt" 2>/dev/null)
        echo "    Tokens: $tokens"
        echo "    Execution Events: $events"
    fi
}

################################################################################
# Main Batch Execution
################################################################################

# Array of research prompts to run
declare -A PROMPTS=(
    ["Claude Code Leak Analysis"]="research:leak"
)

# Run prompts
if [ "$PARALLEL" = true ]; then
    echo "🔄 Running prompts in parallel mode..."
    echo ""

    for name in "${!PROMPTS[@]}"; do
        cmd=${PROMPTS[$name]}
        run_research "$name" "$cmd" ${#RESULTS[@]} &
    done

    wait
else
    echo "▶️  Running prompts sequentially..."
    echo ""

    local i=1
    for name in "${!PROMPTS[@]}"; do
        cmd=${PROMPTS[$name]}
        run_research "$name" "$cmd" $i
        ((i++))
    done
fi

################################################################################
# Compile Results
################################################################################

echo "================================================================================"
echo "BATCH RESULTS SUMMARY"
echo "================================================================================"
echo ""

{
    echo "BATCH EXECUTION REPORT"
    echo "====================="
    echo ""
    echo "Execution Time: $(date)"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo ""

    echo "DETAILED RESULTS:"
    echo "-------------"
    echo ""

    printf "%-40s %-20s %-10s %-10s\n" "Research" "Status" "Time" "Score"
    printf "%-40s %-20s %-10s %-10s\n" "--------" "------" "----" "-----"

    for result in "${RESULTS[@]}"; do
        IFS='|' read -r name status time score <<< "$result"
        printf "%-40s %-20s %-10s %-10s\n" "$name" "$status" "$time" "$score"
    done

    echo ""
    echo "METRICS:"
    echo "--------"

    if [ ${#TIMES[@]} -gt 0 ]; then
        local total_time=0
        for t in "${TIMES[@]}"; do
            total_time=$((total_time + t))
        done
        local avg_time=$((total_time / ${#TIMES[@]}))

        echo "Total Time: ${total_time}s"
        echo "Average Time: ${avg_time}s"
        echo "Min Time: $(printf '%s\n' "${TIMES[@]}" | sort -n | head -1)s"
        echo "Max Time: $(printf '%s\n' "${TIMES[@]}" | sort -n | tail -1)s"
    fi

    echo ""
    echo "Pass Rate: $PASSED_TESTS/$TOTAL_TESTS ($(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%)"
    echo ""

    echo "FILES GENERATED:"
    echo "---------------"
    find "$BATCH_DIR" -type f | sed "s|$BATCH_DIR||" | sed 's|^/||' | sort

} | tee "$RESULTS_FILE"

################################################################################
# Generate JSON Metrics
################################################################################

{
    echo "{"
    echo "  \"batchId\": \"$(basename "$BATCH_DIR")\","
    echo "  \"executedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"totalTests\": $TOTAL_TESTS,"
    echo "  \"passedTests\": $PASSED_TESTS,"
    echo "  \"failedTests\": $FAILED_TESTS,"
    echo "  \"passRate\": $(( (PASSED_TESTS * 100) / TOTAL_TESTS )),"
    echo "  \"results\": ["

    local first=true
    for result in "${RESULTS[@]}"; do
        IFS='|' read -r name status time score <<< "$result"
        if [ "$first" = false ]; then echo ","; fi
        echo -n "    {\"name\": \"$name\", \"status\": \"$status\", \"time\": \"$time\", \"score\": \"$score\"}"
        first=false
    done

    echo ""
    echo "  ]"
    echo "}"
} > "$METRICS_FILE"

################################################################################
# Summary Output
################################################################################

echo ""
echo "================================================================================"
echo "BATCH COMPLETE"
echo "================================================================================"
echo ""
echo -e "${GREEN}✅ Results saved to: $BATCH_DIR${NC}"
echo ""
echo "📄 Summary: $RESULTS_FILE"
echo "📊 Metrics: $METRICS_FILE"
echo "📁 Full results: $BATCH_DIR/"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review results for details.${NC}"
    exit 1
fi

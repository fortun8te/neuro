#!/bin/bash
###############################################################################
# GAIA Setup Validation Test
#
# Validates that all infrastructure is in place before running the full
# benchmark. Tests:
#   - Files exist and are executable
#   - Ollama is reachable and has required models
#   - Node.js and dependencies installed
#   - JSONL format works
#   - HF connectivity (optional)
#
# Usage:
#   ./test-gaia-setup.sh [--full]
#
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OLLAMA_URL="${VITE_OLLAMA_URL:-http://100.74.135.83:11440}"
FULL_TEST=false

if [ "$1" = "--full" ]; then
  FULL_TEST=true
fi

# ─────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

test_file_exists() {
  local file="$1"
  local name="$2"

  if [ -f "$file" ]; then
    log_success "$name exists"
    return 0
  else
    log_error "$name missing: $file"
    return 1
  fi
}

test_file_executable() {
  local file="$1"
  local name="$2"

  if [ -x "$file" ]; then
    log_success "$name is executable"
    return 0
  else
    log_warning "$name not executable (trying to fix...)"
    chmod +x "$file" 2>/dev/null && {
      log_success "Made $name executable"
      return 0
    }
    return 1
  fi
}

test_command_exists() {
  local cmd="$1"
  local name="${2:-$cmd}"

  if command -v "$cmd" &> /dev/null; then
    local version=$($cmd --version 2>&1 | head -1)
    log_success "$name installed ($version)"
    return 0
  else
    log_error "$name not found (install with: brew install $cmd)"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────

test_files() {
  log_header "1. Checking Required Files"

  local failed=0

  test_file_exists "$SCRIPT_DIR/run-gaia-full.mjs" "run-gaia-full.mjs" || ((failed++))
  test_file_executable "$SCRIPT_DIR/run-gaia-full.mjs" "run-gaia-full.mjs" || ((failed++))

  test_file_exists "$SCRIPT_DIR/submit-to-gaia.sh" "submit-to-gaia.sh" || ((failed++))
  test_file_executable "$SCRIPT_DIR/submit-to-gaia.sh" "submit-to-gaia.sh" || ((failed++))

  test_file_exists "$SCRIPT_DIR/gaia-cli.sh" "gaia-cli.sh" || ((failed++))
  test_file_executable "$SCRIPT_DIR/gaia-cli.sh" "gaia-cli.sh" || ((failed++))

  test_file_exists "$SCRIPT_DIR/GAIA_BENCHMARK_GUIDE.md" "GAIA_BENCHMARK_GUIDE.md" || ((failed++))
  test_file_exists "$SCRIPT_DIR/GAIA_SETUP.md" "GAIA_SETUP.md" || ((failed++))

  return $failed
}

test_tools() {
  log_header "2. Checking System Tools"

  local failed=0

  test_command_exists "node" "Node.js" || ((failed++))
  test_command_exists "jq" "jq (JSON processor)" || ((failed++))
  test_command_exists "curl" "curl" || ((failed++))
  test_command_exists "bash" "bash" || ((failed++))

  return $failed
}

test_node_version() {
  log_header "3. Checking Node.js Version"

  local version=$(node --version | sed 's/v//')
  local major=$(echo $version | cut -d. -f1)

  if [ "$major" -ge 18 ]; then
    log_success "Node.js v$version (v18+)"
    return 0
  else
    log_error "Node.js v$version (need v18+)"
    return 1
  fi
}

test_ollama_connectivity() {
  log_header "4. Checking Ollama Connectivity"

  local failed=0

  log_info "Testing Ollama at: $OLLAMA_URL"

  if ! timeout 5 curl -s "$OLLAMA_URL/api/tags" > /tmp/ollama-tags.json 2>/dev/null; then
    log_error "Cannot reach Ollama at $OLLAMA_URL"
    log_info "Make sure:"
    echo "  - Ollama is running"
    echo "  - URL is correct (current: $OLLAMA_URL)"
    echo "  - Set VITE_OLLAMA_URL if using different host"
    return 1
  fi

  log_success "Ollama is reachable"

  # Check required models
  local models=("qwen3.5:0.8b" "qwen3.5:2b" "qwen3.5:4b" "qwen3.5:9b")
  local available_models=$(jq -r '.models[].name' /tmp/ollama-tags.json 2>/dev/null || echo "")

  echo ""
  log_info "Checking for required models:"

  for model in "${models[@]}"; do
    if echo "$available_models" | grep -q "$model"; then
      log_success "$model available"
    else
      log_warning "$model not found (will be downloaded on first use)"
    fi
  done

  return 0
}

test_jsonl_format() {
  log_header "5. Testing JSONL Format"

  local test_jsonl="/tmp/test-gaia.jsonl"

  cat > "$test_jsonl" << 'EOF'
{"task_id": "1", "model_answer": "Paris"}
{"task_id": "2", "model_answer": "1912"}
{"task_id": "3", "model_answer": "7"}
EOF

  log_info "Generated test JSONL file"

  # Validate
  local line=0
  while IFS= read -r json_line; do
    ((line++))
    if ! echo "$json_line" | jq . > /dev/null 2>&1; then
      log_error "Line $line: Invalid JSON"
      return 1
    fi

    local task_id=$(echo "$json_line" | jq -r '.task_id // empty')
    local answer=$(echo "$json_line" | jq -r '.model_answer // empty')

    if [ -z "$task_id" ] || [ -z "$answer" ]; then
      log_error "Line $line: Missing required fields"
      return 1
    fi
  done < "$test_jsonl"

  log_success "JSONL format valid ($line lines)"
  rm -f "$test_jsonl"
  return 0
}

test_submission_validation() {
  log_header "6. Testing Submission Validation"

  # Create test results
  local test_results="/tmp/test-results.jsonl"
  cat > "$test_results" << 'EOF'
{"task_id": "1", "model_answer": "Paris"}
{"task_id": "2", "model_answer": "1912"}
EOF

  log_info "Running validation script on test file..."

  if "$SCRIPT_DIR/submit-to-gaia.sh" --validate --jsonl "$test_results" 2>&1 | grep -q "Valid JSONL"; then
    log_success "Submission validation works"
    rm -f "$test_results"
    return 0
  else
    log_error "Submission validation failed"
    rm -f "$test_results"
    return 1
  fi
}

test_cli_wrapper() {
  log_header "7. Testing CLI Wrapper"

  if "$SCRIPT_DIR/gaia-cli.sh" help > /dev/null 2>&1; then
    log_success "CLI wrapper works"
    return 0
  else
    log_error "CLI wrapper failed"
    return 1
  fi
}

test_mini_run() {
  if [ "$FULL_TEST" != true ]; then
    return 0
  fi

  log_header "8. Running Mini Benchmark (1 question, timeout 30s)"

  timeout 30 node "$SCRIPT_DIR/run-gaia-full.mjs" --questions 1 2>&1 | head -20

  if [ $? -eq 0 ]; then
    log_success "Mini benchmark completed"
    return 0
  else
    log_error "Mini benchmark failed or timed out"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║     GAIA Benchmark Setup Validation Test                   ║${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  local failed=0

  test_files || ((failed++))
  test_tools || ((failed++))
  test_node_version || ((failed++))
  test_ollama_connectivity || ((failed++))
  test_jsonl_format || ((failed++))
  test_submission_validation || ((failed++))
  test_cli_wrapper || ((failed++))

  if [ "$FULL_TEST" = true ]; then
    test_mini_run || ((failed++))
  fi

  # Summary
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Ready to run GAIA benchmark:"
    echo ""
    echo "  ./gaia-cli.sh run --questions 50"
    echo ""
    echo "Or for full workflow (including submission):"
    echo ""
    echo "  export HF_TOKEN='hf_your_token'"
    echo "  ./gaia-cli.sh full --questions 100"
    echo ""
  else
    echo -e "${RED}✗ $failed check(s) failed${NC}"
    echo ""
    echo "Fix the issues above and try again:"
    echo ""
    echo "  ./test-gaia-setup.sh"
    echo ""
    return 1
  fi

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

main

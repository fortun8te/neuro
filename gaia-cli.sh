#!/bin/bash
###############################################################################
# GAIA Benchmark CLI Wrapper
#
# Convenient single-command interface for running GAIA benchmarks and
# submitting results to the Hugging Face leaderboard.
#
# Usage:
#   ./gaia-cli.sh run [--questions 100] [--verbose]
#   ./gaia-cli.sh resume [--questions 100]
#   ./gaia-cli.sh analyze [--jsonl results.jsonl]
#   ./gaia-cli.sh submit [--jsonl results.jsonl]
#   ./gaia-cli.sh full [--questions 100]       # run + submit
#   ./gaia-cli.sh validate
#   ./gaia-cli.sh help
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
RUN_GAIA="$SCRIPT_DIR/run-gaia-full.mjs"
SUBMIT_GAIA="$SCRIPT_DIR/submit-to-gaia.sh"
JSONL_FILE="gaia-results.jsonl"
CHECKPOINT_FILE="gaia-checkpoint.json"
METADATA_FILE="gaia-results-metadata.json"
QUESTIONS=50

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
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

show_help() {
  cat << EOF
${CYAN}GAIA Benchmark CLI${NC}

Convenient interface for running GAIA benchmarks and submitting to HF leaderboard.

${CYAN}Commands:${NC}

  run [OPTIONS]        Run benchmark on N questions
  resume [OPTIONS]     Resume from checkpoint
  analyze [FILE]       Show results analysis
  submit [FILE]        Submit to HF leaderboard
  full [OPTIONS]       Run + submit (full workflow)
  validate             Validate JSONL format
  info                 Show current status
  help                 Show this help

${CYAN}Options:${NC}

  --questions N        Number of questions (default: 50)
  --output FILE        JSONL output file (default: gaia-results.jsonl)
  --checkpoint FILE    Checkpoint file (default: gaia-checkpoint.json)
  --verbose            Show detailed output
  --dry-run            Show what would do (submit only)

${CYAN}Examples:${NC}

  # Quick run: 50 questions
  ./gaia-cli.sh run

  # Full run: 100 questions with verbose output
  ./gaia-cli.sh run --questions 100 --verbose

  # Resume from checkpoint
  ./gaia-cli.sh resume --questions 100

  # Full workflow: run + submit
  ./gaia-cli.sh full --questions 100

  # Analyze results
  ./gaia-cli.sh analyze gaia-results.jsonl

  # Submit results
  export HF_TOKEN='hf_...'
  ./gaia-cli.sh submit

${CYAN}Workflow:${NC}

  1. Run benchmark:
     ./gaia-cli.sh run --questions 100

  2. Check results:
     ./gaia-cli.sh analyze

  3. Submit to HF:
     export HF_TOKEN='hf_your_token'
     ./gaia-cli.sh submit

  Or all-in-one:
     ./gaia-cli.sh full --questions 100

${CYAN}Setup:${NC}

  1. Get HF token: https://huggingface.co/settings/tokens
  2. Export token: export HF_TOKEN='hf_xxxx'
  3. Run benchmark: ./gaia-cli.sh run

EOF
}

show_status() {
  log_header "Current Status"

  if [ -f "$JSONL_FILE" ]; then
    local count=$(wc -l < "$JSONL_FILE")
    log_success "Results file: $JSONL_FILE ($count entries)"
  else
    log_warning "No results file found"
  fi

  if [ -f "$CHECKPOINT_FILE" ]; then
    local completed=$(jq -r '.completedCount // 0' "$CHECKPOINT_FILE" 2>/dev/null || echo "?")
    log_success "Checkpoint: $CHECKPOINT_FILE (completed: $completed)"
  else
    log_warning "No checkpoint file found"
  fi

  if [ -f "$METADATA_FILE" ]; then
    local accuracy=$(jq -r '.accuracy // "?"' "$METADATA_FILE" 2>/dev/null || echo "?")
    local runtime=$(jq -r '.totalTimeSeconds // "?"' "$METADATA_FILE" 2>/dev/null || echo "?")
    log_success "Metadata: accuracy=$accuracy%, runtime=${runtime}s"
  else
    log_warning "No metadata file found"
  fi

  echo ""
}

show_analysis() {
  local file="${1:-$JSONL_FILE}"

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  local metadata_file="${file%-results.jsonl}-results-metadata.json"

  if [ ! -f "$metadata_file" ]; then
    log_error "Metadata file not found: $metadata_file"
    return 1
  fi

  log_header "Results Analysis"

  # Overall
  local accuracy=$(jq -r '.accuracy // "N/A"' "$metadata_file")
  local total=$(jq -r '.totalQuestions // 0' "$metadata_file")
  local runtime=$(jq -r '.totalTimeSeconds // 0' "$metadata_file")
  local avgTime=$(jq -r '.avgTimePerQuestion // 0' "$metadata_file")

  echo "Overall Performance:"
  echo "  Accuracy:           $accuracy%"
  echo "  Total Questions:    $total"
  echo "  Total Runtime:      ${runtime}s"
  echo "  Avg per Question:   ${avgTime}s"
  echo ""

  # By difficulty
  echo "By Difficulty:"
  jq -r '.byDifficulty | to_entries[] | "  \(.key): \(.value.correct)/\(.value.total)"' "$metadata_file"
  echo ""

  # By category
  echo "By Category:"
  jq -r '.byCategory | to_entries[] | "  \(.key): \(.value.correct)/\(.value.total)"' "$metadata_file" | head -10
  if [ "$(jq -r '.byCategory | length' "$metadata_file")" -gt 10 ]; then
    echo "  ..."
  fi
  echo ""
}

cmd_run() {
  # Parse options
  local verbose=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --questions)
        QUESTIONS="$2"
        shift 2
        ;;
      --verbose)
        verbose="--verbose"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  log_header "Running GAIA Benchmark"
  log_info "Questions: $QUESTIONS"
  log_info "Output: $JSONL_FILE"
  echo ""

  node "$RUN_GAIA" --questions "$QUESTIONS" --output "$JSONL_FILE" $verbose

  if [ $? -eq 0 ]; then
    echo ""
    log_success "Benchmark completed"
    log_info "Results saved to: $JSONL_FILE"
    log_info "Metadata saved to: $METADATA_FILE"
    echo ""
  else
    log_error "Benchmark failed"
    return 1
  fi
}

cmd_resume() {
  # Parse options
  local verbose=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --questions)
        QUESTIONS="$2"
        shift 2
        ;;
      --verbose)
        verbose="--verbose"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  if [ ! -f "$CHECKPOINT_FILE" ]; then
    log_error "No checkpoint found. Run 'gaia-cli run' first."
    return 1
  fi

  log_header "Resuming from Checkpoint"
  log_info "Checkpoint: $CHECKPOINT_FILE"
  log_info "Questions: $QUESTIONS"
  echo ""

  node "$RUN_GAIA" --questions "$QUESTIONS" --checkpoint "$CHECKPOINT_FILE" --resume --output "$JSONL_FILE" $verbose

  if [ $? -eq 0 ]; then
    echo ""
    log_success "Resume completed"
    echo ""
  else
    log_error "Resume failed"
    return 1
  fi
}

cmd_analyze() {
  local file="${1:-$JSONL_FILE}"
  show_analysis "$file"
}

cmd_validate() {
  log_header "Validating Results"
  "$SUBMIT_GAIA" --validate
}

cmd_submit() {
  # Parse options
  local dry_run=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --jsonl)
        JSONL_FILE="$2"
        shift 2
        ;;
      --dry-run)
        dry_run="--dry-run"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  log_header "Submitting to Hugging Face"
  log_info "Results file: $JSONL_FILE"
  echo ""

  "$SUBMIT_GAIA" "$JSONL_FILE" $dry_run
}

cmd_full() {
  # Parse options
  local verbose=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --questions)
        QUESTIONS="$2"
        shift 2
        ;;
      --verbose)
        verbose="--verbose"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  # Run benchmark
  if ! cmd_run --questions "$QUESTIONS" $verbose; then
    log_error "Benchmark failed, skipping submission"
    return 1
  fi

  # Validate
  if ! cmd_validate; then
    log_error "Validation failed, skipping submission"
    return 1
  fi

  # Show analysis
  cmd_analyze

  # Submit
  if [ -z "$HF_TOKEN" ]; then
    log_warning "HF_TOKEN not set, skipping submission"
    log_info "To submit, run:"
    echo "  export HF_TOKEN='your_hf_token'"
    echo "  ./gaia-cli.sh submit"
    return 0
  fi

  read -p "Submit results now? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cmd_submit
  fi
}

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

main() {
  local cmd="${1:-help}"

  case "$cmd" in
    run)
      shift
      cmd_run "$@"
      ;;
    resume)
      shift
      cmd_resume "$@"
      ;;
    analyze)
      shift
      cmd_analyze "$@"
      ;;
    validate)
      cmd_validate
      ;;
    submit)
      shift
      cmd_submit "$@"
      ;;
    full)
      shift
      cmd_full "$@"
      ;;
    info|status)
      show_status
      ;;
    help|-h|--help)
      show_help
      ;;
    *)
      log_error "Unknown command: $cmd"
      echo ""
      show_help
      exit 1
      ;;
  esac
}

main "$@"

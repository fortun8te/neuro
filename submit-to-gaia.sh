#!/bin/bash
###############################################################################
# GAIA Leaderboard Submission Script
#
# Validates and submits GAIA benchmark results to Hugging Face leaderboard.
#
# Usage:
#   ./submit-to-gaia.sh [--jsonl results.jsonl] [--metadata metadata.json]
#   ./submit-to-gaia.sh --validate                      (validate format only)
#   ./submit-to-gaia.sh --dry-run                       (show what would submit)
#
# Requirements:
#   - jq (for JSON processing)
#   - curl (for API calls)
#   - Hugging Face API token (in HF_TOKEN env var or prompted)
#
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
JSONL_FILE="${1:-gaia-results.jsonl}"
METADATA_FILE="${JSONL_FILE%-results.jsonl}-results-metadata.json"
HF_REPO="gaia-benchmark/leaderboard"
HF_DATASET_REPO="gaia-benchmark/GAIA"
VALIDATE_ONLY=false
DRY_RUN=false

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --jsonl)
      JSONL_FILE="$2"
      shift 2
      ;;
    --metadata)
      METADATA_FILE="$2"
      shift 2
      ;;
    --validate)
      VALIDATE_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +2 | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

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

check_requirements() {
  local missing=()

  if ! command -v jq &> /dev/null; then
    missing+=("jq")
  fi

  if ! command -v curl &> /dev/null; then
    missing+=("curl")
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo ""
    echo "Install with:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      echo "  brew install ${missing[*]}"
    else
      echo "  sudo apt-get install ${missing[*]}"
    fi
    exit 1
  fi
}

validate_jsonl_format() {
  local file="$1"
  local line_num=0
  local valid=true

  log_info "Validating JSONL format..."

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  while IFS= read -r line; do
    ((line_num++))

    # Skip empty lines
    [ -z "$line" ] && continue

    # Validate JSON
    if ! echo "$line" | jq . > /dev/null 2>&1; then
      log_error "Line $line_num: Invalid JSON"
      echo "  $line"
      valid=false
      continue
    fi

    # Check required fields
    local task_id=$(echo "$line" | jq -r '.task_id // empty')
    local model_answer=$(echo "$line" | jq -r '.model_answer // empty')

    if [ -z "$task_id" ]; then
      log_error "Line $line_num: Missing 'task_id' field"
      valid=false
    fi

    if [ -z "$model_answer" ]; then
      log_error "Line $line_num: Missing 'model_answer' field"
      valid=false
    fi
  done < "$file"

  if [ "$valid" = true ]; then
    local count=$(wc -l < "$file")
    log_success "Valid JSONL: $count entries"
    return 0
  else
    return 1
  fi
}

validate_metadata() {
  local file="$1"

  log_info "Validating metadata..."

  if [ ! -f "$file" ]; then
    log_warning "Metadata file not found: $file"
    return 0
  fi

  # Validate JSON
  if ! jq empty "$file" 2>/dev/null; then
    log_error "Invalid JSON in metadata: $file"
    return 1
  fi

  # Check key fields
  local required_fields=("benchmark" "harness" "timestamp" "accuracy" "totalQuestions")
  for field in "${required_fields[@]}"; do
    if ! jq -e ".$field" "$file" > /dev/null 2>&1; then
      log_warning "Missing metadata field: $field"
    fi
  done

  log_success "Metadata valid"
  return 0
}

show_submission_info() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║           GAIA Submission Information                      ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  log_info "Results file: $JSONL_FILE"
  if [ -f "$JSONL_FILE" ]; then
    local count=$(wc -l < "$JSONL_FILE")
    echo "   Questions: $count"
    echo "   Size: $(du -h "$JSONL_FILE" | cut -f1)"
  fi
  echo ""

  if [ -f "$METADATA_FILE" ]; then
    log_info "Metadata file: $METADATA_FILE"
    echo "   Accuracy: $(jq -r '.accuracy // "N/A"' "$METADATA_FILE")%"
    echo "   Runtime: $(jq -r '.totalTimeSeconds // "N/A"' "$METADATA_FILE")s"
    echo "   Timestamp: $(jq -r '.timestamp // "N/A"' "$METADATA_FILE")"
    echo ""
  fi

  log_info "Target: Hugging Face GAIA Leaderboard"
  echo "   Repo: https://huggingface.co/spaces/$HF_REPO"
  echo ""
}

check_hf_token() {
  if [ -z "$HF_TOKEN" ]; then
    log_warning "HF_TOKEN not set in environment"
    echo ""
    echo "To submit results, you need a Hugging Face API token:"
    echo "  1. Go to https://huggingface.co/settings/tokens"
    echo "  2. Create a new token with 'write' permissions"
    echo "  3. Export it: export HF_TOKEN='hf_xxxxxxxxxxxx'"
    echo ""
    echo "Or set it now:"
    read -sp "Hugging Face API Token: " HF_TOKEN
    echo ""

    if [ -z "$HF_TOKEN" ]; then
      log_error "No token provided. Cannot submit."
      return 1
    fi
  fi
  return 0
}

prepare_submission() {
  local tmpdir=$(mktemp -d)
  trap "rm -rf $tmpdir" EXIT

  log_info "Preparing submission package..."

  # Copy files
  cp "$JSONL_FILE" "$tmpdir/results.jsonl"
  if [ -f "$METADATA_FILE" ]; then
    cp "$METADATA_FILE" "$tmpdir/metadata.json"
  fi

  # Create submission manifest
  local manifest=$(cat <<EOF
{
  "submission_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files": [
    "results.jsonl"
  ],
  "metadata": {
    "accuracy": $(jq -r '.accuracy // 0' "$METADATA_FILE" 2>/dev/null || echo "null"),
    "model": "NEURO 5-Phase Harness",
    "harness_version": "1.0"
  }
}
EOF
)
  echo "$manifest" > "$tmpdir/submission.json"

  log_success "Submission package ready in: $tmpdir"
  echo "  results.jsonl"
  if [ -f "$METADATA_FILE" ]; then
    echo "  metadata.json"
  fi
  echo "  submission.json"
  echo ""

  echo "$tmpdir"
}

submit_to_huggingface() {
  local submission_dir="$1"

  log_info "Submitting to Hugging Face leaderboard..."
  echo ""

  if [ "$DRY_RUN" = true ]; then
    log_warning "DRY RUN - Not actually submitting"
    echo "Would submit:"
    echo "  curl -X POST https://huggingface.co/api/gaia/submit \\"
    echo "    -H 'Authorization: Bearer \$HF_TOKEN' \\"
    echo "    -F 'submission=@$submission_dir/submission.json' \\"
    echo "    -F 'results=@$submission_dir/results.jsonl'"
    return 0
  fi

  # Create multipart form
  local response=$(curl -s -X POST \
    "https://huggingface.co/api/gaia/submit" \
    -H "Authorization: Bearer $HF_TOKEN" \
    -F "submission=@$submission_dir/submission.json" \
    -F "results=@$submission_dir/results.jsonl")

  # Check response
  if echo "$response" | jq empty 2>/dev/null; then
    local status=$(echo "$response" | jq -r '.status // "unknown"')
    local submission_id=$(echo "$response" | jq -r '.submission_id // empty')

    if [ "$status" = "success" ] || [ "$status" = "submitted" ]; then
      log_success "Submitted successfully!"
      echo "  Submission ID: $submission_id"
      echo "  Status: $status"
      echo ""
      echo "Track your submission at:"
      echo "  https://huggingface.co/spaces/$HF_REPO"
      return 0
    else
      log_error "Submission failed: $status"
      echo "Response: $response"
      return 1
    fi
  else
    log_error "Invalid response from server"
    echo "Response: $response"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║    GAIA Benchmark - Hugging Face Leaderboard Submission    ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  check_requirements

  # Validate format
  if ! validate_jsonl_format "$JSONL_FILE"; then
    exit 1
  fi

  if ! validate_metadata "$METADATA_FILE"; then
    if [ "$VALIDATE_ONLY" = true ]; then
      exit 1
    fi
  fi

  if [ "$VALIDATE_ONLY" = true ]; then
    log_success "Validation passed"
    exit 0
  fi

  show_submission_info

  # Check token
  if ! check_hf_token; then
    exit 1
  fi

  # Prepare and submit
  submission_dir=$(prepare_submission)

  if ! submit_to_huggingface "$submission_dir"; then
    exit 1
  fi

  echo "═════════════════════════════════════════════════════════════"
}

main

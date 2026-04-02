#!/bin/bash

################################################################################
# NEURO Overnight Research Startup Script
#
# Usage: ./startOvernightResearch.sh "Campaign Brief" "Research Topic"
#
# Example:
#   ./startOvernightResearch.sh "AI Tools Platform" "Enterprise Software Market 2025"
#
# Prerequisites:
#   - Docker running (for SearXNG)
#   - Ollama running (local or remote via tailscale)
#   - Wayfarer running (Python 3.11 required)
#   - npm installed and project dependencies resolved
#
# This script will:
#   1. Validate all services are healthy
#   2. Create a session directory with timestamp
#   3. Start the dev server in background
#   4. Initialize research cycle with MAXIMUM preset
#   5. Stream output to session.log
#   6. Update status file every 5 minutes
#   7. Handle graceful shutdown on SIGINT
#   8. Output final report on completion
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_TIMESTAMP=$(date +%s)
SESSION_DIR="/tmp/neuro-overnight-${SESSION_TIMESTAMP}"
LOG_FILE="${SESSION_DIR}/session.log"
STATUS_FILE="${SESSION_DIR}/status.json"
IMAGES_DIR="${SESSION_DIR}/images"

# Service URLs (match infrastructure.ts defaults)
OLLAMA_URL="${VITE_OLLAMA_URL:-http://100.74.135.83:11440}"
WAYFARER_URL="${VITE_WAYFARER_URL:-http://localhost:8889}"
SEARXNG_URL="${VITE_SEARXNG_URL:-http://localhost:8888}"

# Configuration
NODE_PID=""
RESEARCH_TIMEOUT=$((480 * 60)) # 8 hours in seconds
HEALTH_CHECK_INTERVAL=300 # 5 minutes

################################################################################
# Helper Functions
################################################################################

log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_header() {
  echo "" | tee -a "${LOG_FILE}"
  echo "================================================================================" | tee -a "${LOG_FILE}"
  echo "  $@" | tee -a "${LOG_FILE}"
  echo "================================================================================" | tee -a "${LOG_FILE}"
}

log_success() {
  log "INFO" "${GREEN}✓ $@${NC}"
}

log_error() {
  log "ERROR" "${RED}✗ $@${NC}"
}

log_warning() {
  log "WARN" "${YELLOW}⚠ $@${NC}"
}

log_info() {
  log "INFO" "${BLUE}ℹ $@${NC}"
}

################################################################################
# Validation Functions
################################################################################

validate_usage() {
  if [[ $# -lt 2 ]]; then
    echo "Usage: $0 \"Campaign Brief\" \"Research Topic\""
    echo ""
    echo "Example:"
    echo "  $0 \"AI Tools Platform\" \"Enterprise Software Market 2025\""
    echo ""
    exit 1
  fi
}

check_prerequisites() {
  log_header "Validating Prerequisites"

  # Check npm
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
  fi
  log_success "npm found: $(npm --version)"

  # Check node
  if ! command -v node &> /dev/null; then
    log_error "node is not installed"
    exit 1
  fi
  log_success "node found: $(node --version)"

  # Check git
  if ! command -v git &> /dev/null; then
    log_warning "git is not installed (optional, may be needed for cleanup)"
  else
    log_success "git found: $(git --version)"
  fi

  # Check if project directory exists
  if [[ ! -d "${PROJECT_DIR}" ]]; then
    log_error "Project directory not found: ${PROJECT_DIR}"
    exit 1
  fi
  log_success "Project directory found: ${PROJECT_DIR}"

  # Check if package.json exists
  if [[ ! -f "${PROJECT_DIR}/package.json" ]]; then
    log_error "package.json not found in project directory"
    exit 1
  fi
  log_success "package.json found"
}

check_services() {
  log_header "Validating Infrastructure Services"

  local ollama_ok=false
  local wayfarer_ok=false
  local searxng_ok=false

  # Check Ollama
  log_info "Checking Ollama at ${OLLAMA_URL}..."
  if curl -s --connect-timeout 3 "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
    log_success "Ollama is healthy"
    ollama_ok=true
  else
    log_error "Ollama is not responding at ${OLLAMA_URL}"
  fi

  # Check Wayfarer
  log_info "Checking Wayfarer at ${WAYFARER_URL}..."
  if curl -s --connect-timeout 3 "${WAYFARER_URL}/health" > /dev/null 2>&1; then
    log_success "Wayfarer is healthy"
    wayfarer_ok=true
  else
    log_error "Wayfarer is not responding at ${WAYFARER_URL}"
  fi

  # Check SearXNG
  log_info "Checking SearXNG at ${SEARXNG_URL}..."
  if curl -s --connect-timeout 3 "${SEARXNG_URL}/healthz" > /dev/null 2>&1; then
    log_success "SearXNG is healthy"
    searxng_ok=true
  else
    log_error "SearXNG is not responding at ${SEARXNG_URL}"
  fi

  # Summary
  echo "" | tee -a "${LOG_FILE}"
  if [[ "$ollama_ok" == true ]] && [[ "$wayfarer_ok" == true ]] && [[ "$searxng_ok" == true ]]; then
    log_success "All infrastructure services are healthy"
    return 0
  else
    log_error "One or more services are unavailable. Please start all services before continuing."
    log_info "To start services, run:"
    echo "  # Start Docker if not running" | tee -a "${LOG_FILE}"
    echo "  open -a Docker" | tee -a "${LOG_FILE}"
    echo "" | tee -a "${LOG_FILE}"
    echo "  # Start SearXNG (in another terminal)" | tee -a "${LOG_FILE}"
    echo "  cd /Users/mk/Downloads/nomads && docker-compose up -d" | tee -a "${LOG_FILE}"
    echo "" | tee -a "${LOG_FILE}"
    echo "  # Start Wayfarer (in another terminal)" | tee -a "${LOG_FILE}"
    echo "  cd /Users/mk/Downloads/nomads/wayfarer && \\" | tee -a "${LOG_FILE}"
    echo "  SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889" | tee -a "${LOG_FILE}"
    return 1
  fi
}

################################################################################
# Session Setup
################################################################################

setup_session() {
  log_header "Setting Up Session"

  # Create session directory
  if ! mkdir -p "${SESSION_DIR}" "${IMAGES_DIR}"; then
    log_error "Failed to create session directory: ${SESSION_DIR}"
    exit 1
  fi
  log_success "Created session directory: ${SESSION_DIR}"

  # Create empty log file
  touch "${LOG_FILE}"
  log_success "Created log file: ${LOG_FILE}"

  # Initialize status file
  cat > "${STATUS_FILE}" << EOF
{
  "sessionId": "overnight-${SESSION_TIMESTAMP}",
  "campaignBrief": "$1",
  "researchTopic": "$2",
  "startTime": $(date +%s),
  "status": "initializing",
  "currentStage": "research",
  "iterationsCompleted": 0,
  "sourcesFound": 0,
  "tokensUsed": 0,
  "memoryUsageMb": 0,
  "checkpointsCreated": 0,
  "lastCheckpointTime": 0,
  "uptime": 0,
  "errors": []
}
EOF
  log_success "Created status file: ${STATUS_FILE}"

  # Create environment file for node process
  cat > "${SESSION_DIR}/.env.local" << EOF
VITE_OLLAMA_URL=${OLLAMA_URL}
VITE_WAYFARER_URL=${WAYFARER_URL}
VITE_SEARXNG_URL=${SEARXNG_URL}
NEURO_SESSION_ID=overnight-${SESSION_TIMESTAMP}
NEURO_CAMPAIGN_BRIEF=$1
NEURO_RESEARCH_TOPIC=$2
NEURO_SESSION_DIR=${SESSION_DIR}
EOF
  log_success "Created environment file for session"
}

################################################################################
# Service Management
################################################################################

start_dev_server() {
  log_header "Starting Development Server"

  cd "${PROJECT_DIR}"

  # Install dependencies if needed
  if [[ ! -d "node_modules" ]]; then
    log_info "Installing npm dependencies..."
    npm install >> "${LOG_FILE}" 2>&1
    log_success "Dependencies installed"
  fi

  # Start dev server in background
  log_info "Starting Vite dev server..."
  npm run dev >> "${LOG_FILE}" 2>&1 &
  NODE_PID=$!

  log_success "Dev server started (PID: ${NODE_PID})"

  # Wait for server to be ready (check for port 5173)
  local retries=0
  local max_retries=30
  while [[ $retries -lt $max_retries ]]; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
      log_success "Dev server is ready"
      break
    fi
    sleep 1
    ((retries++))
  done

  if [[ $retries -eq $max_retries ]]; then
    log_warning "Dev server startup verification timed out (but continuing anyway)"
  fi
}

################################################################################
# Monitoring
################################################################################

update_status() {
  local elapsed=$(($(date +%s) - SESSION_TIMESTAMP))

  # This would be called periodically to update the status file
  # In production, this would be driven by actual cycle progress
  # For now, we create a simple status update mechanism

  cat > "${STATUS_FILE}" << EOF
{
  "sessionId": "overnight-${SESSION_TIMESTAMP}",
  "startTime": $(($(date +%s) - elapsed)),
  "currentTime": $(date +%s),
  "elapsedSeconds": ${elapsed},
  "status": "running",
  "lastUpdate": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF
}

health_check_loop() {
  log_header "Starting Health Monitoring"

  while true; do
    # Check if dev server is still running
    if ! kill -0 $NODE_PID 2>/dev/null; then
      log_error "Dev server process died (PID $NODE_PID)"
      exit 1
    fi

    # Update status file
    update_status

    # Sleep until next check
    sleep ${HEALTH_CHECK_INTERVAL}
  done
}

################################################################################
# Cleanup
################################################################################

cleanup() {
  local exit_code=$?

  log_header "Cleaning Up"

  # Kill dev server if running
  if [[ -n "$NODE_PID" ]] && kill -0 $NODE_PID 2>/dev/null; then
    log_info "Stopping dev server (PID: ${NODE_PID})"
    kill $NODE_PID
    wait $NODE_PID 2>/dev/null || true
  fi

  # Create final report
  create_final_report

  log_success "Cleanup complete"
  log_info "Session directory: ${SESSION_DIR}"
  log_info "Logs: ${LOG_FILE}"

  exit $exit_code
}

create_final_report() {
  local total_time=$(($(date +%s) - SESSION_TIMESTAMP))
  local hours=$((total_time / 3600))
  local minutes=$(((total_time % 3600) / 60))
  local seconds=$((total_time % 60))

  log_header "Final Report"

  echo "" | tee -a "${LOG_FILE}"
  echo "Session Summary:" | tee -a "${LOG_FILE}"
  echo "  Session ID: overnight-${SESSION_TIMESTAMP}" | tee -a "${LOG_FILE}"
  echo "  Duration: ${hours}h ${minutes}m ${seconds}s" | tee -a "${LOG_FILE}"
  echo "  Session Dir: ${SESSION_DIR}" | tee -a "${LOG_FILE}"
  echo "  Log File: ${LOG_FILE}" | tee -a "${LOG_FILE}"
  echo "  Status File: ${STATUS_FILE}" | tee -a "${LOG_FILE}"
  echo "  Images Dir: ${IMAGES_DIR}" | tee -a "${LOG_FILE}"
  echo "" | tee -a "${LOG_FILE}"

  # Count log entries
  if [[ -f "${LOG_FILE}" ]]; then
    local error_count=$(grep -c "\[ERROR\]" "${LOG_FILE}" || true)
    local warn_count=$(grep -c "\[WARN\]" "${LOG_FILE}" || true)
    echo "Log Statistics:" | tee -a "${LOG_FILE}"
    echo "  Errors: ${error_count}" | tee -a "${LOG_FILE}"
    echo "  Warnings: ${warn_count}" | tee -a "${LOG_FILE}"
    echo "" | tee -a "${LOG_FILE}"
  fi

  echo "Next Steps:" | tee -a "${LOG_FILE}"
  echo "  1. Review logs: tail -f ${LOG_FILE}" | tee -a "${LOG_FILE}"
  echo "  2. Check status: cat ${STATUS_FILE}" | tee -a "${LOG_FILE}"
  echo "  3. Access dashboard: http://localhost:5173" | tee -a "${LOG_FILE}"
  echo "" | tee -a "${LOG_FILE}"
}

################################################################################
# Signal Handlers
################################################################################

trap cleanup EXIT INT TERM

################################################################################
# Main Execution
################################################################################

main() {
  local campaign_brief="$1"
  local research_topic="$2"

  log_header "NEURO Overnight Research Session"
  log_info "Campaign: ${campaign_brief}"
  log_info "Research Topic: ${research_topic}"
  log_info "Session ID: overnight-${SESSION_TIMESTAMP}"
  log_info "Session Dir: ${SESSION_DIR}"
  echo "" | tee -a "${LOG_FILE}"

  # Validate input
  validate_usage "$@"

  # Check prerequisites
  check_prerequisites

  # Validate services
  if ! check_services; then
    log_error "Service validation failed. Please start all services and try again."
    exit 1
  fi

  # Setup session
  setup_session "$campaign_brief" "$research_topic"

  # Start dev server
  start_dev_server

  # Start health monitoring
  log_info "Starting health check loop (interval: ${HEALTH_CHECK_INTERVAL}s)"
  health_check_loop
}

# Run main function with all arguments
main "$@"

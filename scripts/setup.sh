#!/bin/bash
# ─────────────────────────────────────────────
# Nomads — One-command setup
# Run: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────

set -e

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

step() { echo -e "\n${BOLD}${GREEN}[$1/7]${RESET} ${BOLD}$2${RESET}"; }
info() { echo -e "  ${DIM}$1${RESET}"; }
warn() { echo -e "  ${YELLOW}$1${RESET}"; }
fail() { echo -e "  ${RED}$1${RESET}"; exit 1; }
ok()   { echo -e "  ${GREEN}done${RESET}"; }

echo -e "\n${BOLD}Welcome to Nomads${RESET}"
echo -e "${DIM}Setting up everything you need...${RESET}\n"

# ── 1. Check dependencies ──
step 1 "Checking dependencies"

# Docker
if command -v docker &>/dev/null; then
  info "Docker found"
else
  fail "Docker not installed. Get it at https://docker.com/products/docker-desktop"
fi

# Node
if command -v node &>/dev/null; then
  NODE_V=$(node -v)
  info "Node $NODE_V found"
else
  fail "Node.js not installed. Get it at https://nodejs.org"
fi

# npm
if command -v npm &>/dev/null; then
  info "npm found"
else
  fail "npm not found"
fi

# Python 3.10+ (for Wayfarer)
PYTHON=""
for p in python3.11 python3.12 python3.10 python3; do
  if command -v $p &>/dev/null; then
    PY_V=$($p --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    PY_MAJOR=$(echo $PY_V | cut -d. -f1)
    PY_MINOR=$(echo $PY_V | cut -d. -f2)
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
      PYTHON=$p
      info "Python $PY_V found ($p)"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  warn "Python 3.10+ not found. Wayfarer (web research) won't work."
  warn "Install with: brew install python@3.11"
fi

ok

# ── 2. Start Docker ──
step 2 "Starting Docker"

if docker info &>/dev/null 2>&1; then
  info "Docker already running"
else
  info "Starting Docker Desktop..."
  open -a Docker 2>/dev/null || true
  # Wait for Docker to be ready
  TRIES=0
  while ! docker info &>/dev/null 2>&1; do
    sleep 2
    TRIES=$((TRIES + 1))
    if [ $TRIES -gt 30 ]; then
      fail "Docker didn't start after 60s. Start it manually and re-run."
    fi
  done
  info "Docker is ready"
fi
ok

# ── 3. Start services (SearXNG + MinIO) ──
step 3 "Starting services (search engine + file storage)"

cd "$(dirname "$0")"

# Create docker-compose if it doesn't exist or update it
if [ ! -f docker-compose.yml ]; then
  cat > docker-compose.yml << 'DCEOF'
version: '3.8'

services:
  searxng:
    image: searxng/searxng
    container_name: nomads-search
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888
    restart: unless-stopped

  minio:
    image: minio/minio
    container_name: nomads-storage
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - nomads_storage:/data
    environment:
      MINIO_ROOT_USER: nomads
      MINIO_ROOT_PASSWORD: nomads-local-dev
    restart: unless-stopped

volumes:
  nomads_storage:
DCEOF
  info "Created docker-compose.yml"
fi

# Check if MinIO service exists in compose file, add if not
if ! grep -q "minio:" docker-compose.yml; then
  warn "Adding MinIO to existing docker-compose.yml..."
  cat >> docker-compose.yml << 'MCEOF'

  minio:
    image: minio/minio
    container_name: nomads-storage
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - nomads_storage:/data
    environment:
      MINIO_ROOT_USER: nomads
      MINIO_ROOT_PASSWORD: nomads-local-dev
    restart: unless-stopped
MCEOF
  # Add volume if not present
  if ! grep -q "nomads_storage:" docker-compose.yml; then
    echo -e "\nvolumes:\n  nomads_storage:" >> docker-compose.yml
  fi
fi

docker-compose up -d 2>/dev/null || docker compose up -d 2>/dev/null
info "SearXNG running on http://localhost:8888"
info "MinIO running on http://localhost:9000 (console: http://localhost:9001)"
ok

# ── 4. Setup MinIO bucket ──
step 4 "Setting up file storage"

# Wait for MinIO to be ready
sleep 2
TRIES=0
while ! curl -s http://localhost:9000/minio/health/live &>/dev/null; do
  sleep 1
  TRIES=$((TRIES + 1))
  if [ $TRIES -gt 15 ]; then
    warn "MinIO not responding yet, skipping bucket setup. You can run this later."
    break
  fi
done

# Install mc (MinIO client) if not present, create default bucket
if curl -s http://localhost:9000/minio/health/live &>/dev/null; then
  # Use docker exec to create bucket via MinIO client inside container
  docker exec nomads-storage mc alias set local http://localhost:9000 nomads nomads-local-dev 2>/dev/null || true
  docker exec nomads-storage mc mb local/nomads-files 2>/dev/null || true
  docker exec nomads-storage mc anonymous set download local/nomads-files 2>/dev/null || true
  info "Created 'nomads-files' bucket"
fi
ok

# ── 5. Install npm dependencies ──
step 5 "Installing dependencies"

if [ -f package.json ]; then
  npm install --silent 2>/dev/null
  info "npm packages installed"
else
  warn "No package.json found. Are you in the right directory?"
fi
ok

# ── 6. Setup Wayfarer (web research) ──
step 6 "Setting up Wayfarer (web research engine)"

if [ -d "wayfarer" ] && [ -n "$PYTHON" ]; then
  cd wayfarer
  if [ ! -d "venv" ]; then
    $PYTHON -m venv venv 2>/dev/null || true
    info "Created Python virtual environment"
  fi
  if [ -f "requirements.txt" ]; then
    ./venv/bin/pip install -q -r requirements.txt 2>/dev/null || true
    info "Installed Wayfarer dependencies"
  fi
  cd ..
else
  if [ -z "$PYTHON" ]; then
    warn "Skipping Wayfarer (Python 3.10+ required)"
  else
    warn "Wayfarer directory not found, skipping"
  fi
fi
ok

# ── 7. Create .env if missing ──
step 7 "Finalizing"

if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# Nomads Environment
VITE_OLLAMA_URL=http://100.74.135.83:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
VITE_MINIO_URL=http://localhost:9000
VITE_MINIO_BUCKET=nomads-files
ENVEOF
  info "Created .env with default config"
else
  # Add MinIO vars if missing
  if ! grep -q "VITE_MINIO_URL" .env; then
    echo -e "\n# File Storage (MinIO)\nVITE_MINIO_URL=http://localhost:9000\nVITE_MINIO_BUCKET=nomads-files" >> .env
    info "Added MinIO config to .env"
  fi
fi
ok

# ── Done ──
echo -e "\n${BOLD}${GREEN}Setup complete!${RESET}\n"
echo -e "  ${BOLD}To start Nomads:${RESET}"
echo -e "  ${DIM}npm run dev${RESET}\n"
echo -e "  ${BOLD}To start Wayfarer (web research):${RESET}"
echo -e "  ${DIM}cd wayfarer && SEARXNG_URL=http://localhost:8888 ../wayfarer/venv/bin/python -m uvicorn wayfarer_server:app --port 8889${RESET}\n"
echo -e "  ${BOLD}Services:${RESET}"
echo -e "  ${DIM}App:        http://localhost:5173${RESET}"
echo -e "  ${DIM}Search:     http://localhost:8888${RESET}"
echo -e "  ${DIM}Storage:    http://localhost:9000 (console: :9001)${RESET}"
echo -e "  ${DIM}Wayfarer:   http://localhost:8889${RESET}\n"

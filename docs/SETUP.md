# Setup Guide — Ad Agent / Nomads

## Quick Start

```bash
git clone <repo>
cd nomads
npm install
cp .env.example .env
# Edit .env with your infrastructure endpoints
npm run dev
```

---

## Infrastructure Setup

The project uses 3 external services. You can run them **locally** or point to **remote endpoints**.

### Option 1: Local Setup (All on your machine)

```bash
# 1. Start Docker + SearXNG
docker-compose up -d

# 2. Start Wayfarer (web scraping)
cd wayfarer
SEARXNG_URL=http://localhost:8888 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889
cd ..

# 3. Start Ollama (if not already running)
# On Mac: open /Applications/Ollama.app
# Or: ollama serve

# 4. Create .env with local endpoints
cat > .env << 'EOF'
VITE_OLLAMA_URL=http://localhost:11434
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
EOF

# 5. Start dev server
npm run dev
```

### Option 2: Remote Setup (Services on another PC)

**On remote PC (192.168.1.100 or similar):**

```bash
# 1. Start SearXNG
docker run -d -p 8888:8888 searxng/searxng

# 2. Start Wayfarer
cd wayfarer
SEARXNG_URL=http://localhost:8888 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# 3. Start Ollama
ollama serve
```

**On your development machine:**

```bash
# Create .env pointing to remote PC
cat > .env << 'EOF'
VITE_OLLAMA_URL=http://192.168.1.100:11434
VITE_WAYFARER_URL=http://192.168.1.100:8889
VITE_SEARXNG_URL=http://192.168.1.100:8888
EOF

npm run dev
```

### Option 3: Hybrid (Remote Ollama + Local Wayfarer)

```bash
cat > .env << 'EOF'
VITE_OLLAMA_URL=http://100.74.135.83:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
EOF
```

---

## Services Overview

| Service | Port | Purpose | Local? | Remote? |
|---------|------|---------|--------|---------|
| **Ollama** | 11434 | LLM inference (Qwen models) | ✅ Heavy | ✅ Recommended |
| **Wayfarer** | 8889 | Web scraping + Playwright screenshots | ❌ Headless browser = CPU-intensive | ✅ Recommended |
| **SearXNG** | 8888 | Meta-search (Docker container) | ✅ Light | ✅ Optional |

**Heat/CPU Impact:**
- Ollama alone: 🔥🔥 (GPU intensive)
- Wayfarer alone: 🔥 (headless browser)
- SearXNG alone: ✅ (minimal)

**Recommendation:** Run Ollama + Wayfarer on a powerful remote machine, keep your dev machine light.

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```bash
# Required (LLM service)
VITE_OLLAMA_URL=http://your-machine:11434

# Optional but recommended (web scraping)
VITE_WAYFARER_URL=http://your-machine:8889
VITE_SEARXNG_URL=http://your-machine:8888

# Optional (Firebase auth — leave blank to skip)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
```

---

## Verification

Check if services are reachable:

```bash
# Check Ollama
curl http://your-machine:11434/api/tags

# Check Wayfarer
curl http://your-machine:8889/health

# Check SearXNG
curl http://your-machine:8888/healthz
```

All should return 200 OK.

---

## Development

```bash
# Start dev server
npm run dev

# Run research CLI
npm run research:questions

# Run specific test questions
npm run research:questions:simple    # Quick test
npm run research:questions:complex   # Complex analysis
```

---

## Troubleshooting

**"Connection refused on port 8889"**
- Wayfarer not running. Start it: `cd wayfarer && python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889`

**"No tokens after 45s"**
- Ollama timed out. Check if models are loaded: `curl http://machine:11434/api/tags`
- Or increase timeout in code if network is slow

**"Headless browser heating up system"**
- You're running Wayfarer locally. Move it to a remote machine and point `VITE_WAYFARER_URL` to the remote endpoint.

---

## Docker Compose (Local)

```bash
# Start all local services
docker-compose up -d

# Check status
docker-compose ps

# Stop everything
docker-compose down
```

Requires: `docker-compose.yml` with SearXNG + optional other services.


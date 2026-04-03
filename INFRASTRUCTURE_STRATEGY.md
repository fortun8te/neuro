# Infrastructure Strategy: Local Development + Remote Production

**Status:** ✅ Ready for Production
**Date:** April 3, 2026
**Architecture:** Environment-aware (local/remote modes)

---

## Overview

The system supports two infrastructure modes:

1. **LOCAL** (Development) — All services run on user's machine
2. **REMOTE** (Production) — All services run on remote servers via Tailscale VPN

The infrastructure configuration automatically switches based on:
1. Environment variable: `VITE_INFRASTRUCTURE_MODE`
2. Browser localStorage: `neuro_infrastructure_mode`
3. Default: `local` (CLI) / browser-dependent (browser)

---

## Local Development Mode

### Purpose
- Fast iteration without VPN dependency
- All services on user's machine (localhost)
- Manual service startup for control

### Services Needed

| Service | Port | Command | Notes |
|---------|------|---------|-------|
| SearXNG | 8888 | `docker-compose up -d` | Docker container |
| Wayfarer | 8889 | `cd services/wayfarer && python3.11 -m uvicorn wayfarer_server:app --port 8889` | Python 3.11 required |
| Ollama | 11434 | Remote (Tailscale) OR local Ollama | Model inference |

### Environment Setup

```bash
# .env (local development)
VITE_INFRASTRUCTURE_MODE=local
VITE_OLLAMA_URL=http://localhost:11434
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
VITE_SEARXNG_CONCURRENCY=32
VITE_WAYFARER_CONCURRENCY=20
```

### How to Start Local Services

**Option 1: Automated Setup Script**
```bash
/Users/mk/Downloads/nomads/benchmark-setup.sh
```

**Option 2: Manual Startup (3 terminals)**

Terminal 1: SearXNG via Docker
```bash
cd /Users/mk/Downloads/nomads
docker-compose up -d
```

Terminal 2: Wayfarer (Python)
```bash
cd /Users/mk/Downloads/nomads/services/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889
```

Terminal 3: Dev Server
```bash
cd /Users/mk/Downloads/nomads
npm run dev
```

### Local Development Constraints
- ⚠️ Ollama must be accessible (either local or remote)
- ⚠️ SearXNG requires Docker
- ⚠️ Wayfarer requires Python 3.11 + pvlwebtools
- ⚠️ Services must be manually started

---

## Remote Production Mode

### Purpose
- Scalable, managed infrastructure
- Load-balanced services
- Handles high concurrency
- All services on remote servers via Tailscale VPN

### Remote Infrastructure

| Service | Remote Host | Port | Technology | Capacity |
|---------|-------------|------|------------|----------|
| Ollama | 100.74.135.83 | 11434 | GPU server | 9b/27b models |
| Wayfarer | 100.74.135.83 | 8889 | Python FastAPI | 8 instances, concurrency 50+ |
| SearXNG | 100.74.135.83 | 8888 | Load-balanced cluster | 16 instances, concurrency 64+ |

### Environment Setup

```bash
# .env.production
VITE_INFRASTRUCTURE_MODE=remote
VITE_OLLAMA_URL=http://100.74.135.83:11434
VITE_WAYFARER_URL=http://100.74.135.83:8889
VITE_SEARXNG_URL=http://100.74.135.83:8888
VITE_SEARXNG_CONCURRENCY=64
VITE_SEARXNG_INSTANCES=16
VITE_WAYFARER_CONCURRENCY=50
```

### Deployment to Vercel (Production)

1. **Set environment variables in Vercel Dashboard:**
   ```
   VITE_INFRASTRUCTURE_MODE=remote
   VITE_OLLAMA_URL=http://100.74.135.83:11434
   VITE_WAYFARER_URL=http://100.74.135.83:8889
   VITE_SEARXNG_URL=http://100.74.135.83:8888
   ```

2. **Vercel automatically:**
   - Reads `.env.production` OR Vercel dashboard secrets
   - Builds with `npm run build`
   - Deploys to Vercel edge network

3. **User connects to:**
   - Frontend: `https://nomads.vercel.app` (Vercel CDN)
   - Backend services: Remote servers via Tailscale VPN

### Production Requirements
- ✅ Tailscale VPN connection to 100.74.135.83
- ✅ Remote Ollama running and accessible
- ✅ Remote Wayfarer service (load-balanced)
- ✅ Remote SearXNG cluster (load-balanced)
- ✅ Vercel deployment with correct env vars

---

## Architecture Comparison

### Local Development
```
User's Machine (localhost)
├─ Frontend (http://localhost:5173)
├─ SearXNG (http://localhost:8888) — Docker
├─ Wayfarer (http://localhost:8889) — Python
└─ Ollama (http://localhost:11434) — Optional local instance
```

### Remote Production
```
Vercel CDN (Global)
└─ Nomads App (https://nomads.vercel.app)
    └─ Tailscale VPN (100.74.135.83)
        ├─ Ollama (11434) — GPU server
        ├─ Wayfarer (8889) — Load-balanced cluster
        └─ SearXNG (8888) — Load-balanced cluster
```

---

## Configuration Precedence

The system reads infrastructure config in this order:

1. **Environment Variables** (highest priority)
   - `VITE_INFRASTRUCTURE_MODE` → 'local' or 'remote'
   - `VITE_OLLAMA_URL` → full URL override
   - `VITE_WAYFARER_URL` → full URL override
   - `VITE_SEARXNG_URL` → full URL override

2. **localStorage** (browser only)
   - `neuro_infrastructure_mode` → user toggle in Settings
   - Only applies in browser, not CLI

3. **Default Mode**
   - CLI/server-side: `'local'`
   - Browser without setting: `'local'`

**Example: Force Remote Mode**
```bash
# Override via environment variable
VITE_INFRASTRUCTURE_MODE=remote npm run build

# Or use Vercel dashboard secrets for production
```

---

## Service Health Checks

### Check All Services
```bash
# CLI check (automatic)
npm run cli -- --health

# Manual checks
curl http://localhost:8888/config        # SearXNG
curl http://localhost:8889/              # Wayfarer
curl http://localhost:11434/api/tags     # Ollama
```

### Setup Verification Script
```bash
/Users/mk/Downloads/nomads/benchmark-setup.sh
```

---

## Switching Between Modes

### Via Environment Variable
```bash
# Development (default)
npm run dev

# Development with remote services
VITE_INFRASTRUCTURE_MODE=remote npm run dev

# Production build
npm run build  # reads .env.production automatically
```

### Via UI Settings (Browser)
1. Open AgentPanel
2. Settings → Infrastructure
3. Toggle between "Local" and "Remote"
4. Refresh page

---

## Common Scenarios

### Scenario 1: Local Development
```bash
# Setup (first time)
/Users/mk/Downloads/nomads/benchmark-setup.sh
npm run dev

# Open http://localhost:5173 in browser
```

### Scenario 2: Test Remote Services Without Full Deploy
```bash
# Use remote services while developing locally
VITE_INFRASTRUCTURE_MODE=remote npm run dev

# Open http://localhost:5173 in browser
# App will connect to remote services instead of localhost
```

### Scenario 3: Production Deployment
```bash
# Vercel automatically picks up .env.production
# No manual action needed — automatic deployment to https://nomads.vercel.app
```

### Scenario 4: Emergency Fallback (Local → Remote)
```bash
# If local services fail, force remote mode
VITE_INFRASTRUCTURE_MODE=remote npm run dev
```

---

## Performance Tuning

### Local Development (Conservative)
```
VITE_SEARXNG_CONCURRENCY=32       # Local machine resources
VITE_WAYFARER_CONCURRENCY=20      # 20 Playwright instances
VITE_SEARXNG_INSTANCES=8          # Docker-compose setup
```

### Remote Production (Aggressive)
```
VITE_SEARXNG_CONCURRENCY=64       # Load-balanced cluster
VITE_WAYFARER_CONCURRENCY=50      # Multiple server instances
VITE_SEARXNG_INSTANCES=16         # Large cluster
```

---

## Troubleshooting

### Issue: "Failed to fetch from SearXNG"
**Check:**
1. Is the infrastructure mode correct?
   ```bash
   # Check current mode
   VITE_INFRASTRUCTURE_MODE=local npm run dev
   ```
2. Are local services running? (`docker ps`, `ps aux | grep wayfarer`)
3. Is Tailscale VPN connected? (if using remote mode)

### Issue: "Wayfarer not responding"
**Check:**
1. Is Python 3.11 available?
   ```bash
   /opt/homebrew/bin/python3.11 --version
   ```
2. Is SEARXNG_URL set?
   ```bash
   echo $SEARXNG_URL  # Should show http://localhost:8888
   ```
3. Are dependencies installed?
   ```bash
   pip install pvlwebtools fastapi uvicorn
   ```

### Issue: "Remote services unreachable"
**Check:**
1. Is Tailscale VPN connected?
   ```bash
   tailscale status
   ```
2. Can you ping the remote host?
   ```bash
   ping 100.74.135.83
   ```
3. Is `VITE_INFRASTRUCTURE_MODE=remote` set?

---

## Security Considerations

### Local Development
- ✅ Services only accessible on localhost
- ✅ No external network exposure
- ✅ API keys stored locally in .env (not committed)

### Remote Production
- ✅ Tailscale VPN provides encrypted tunnel
- ✅ .env.production should use Vercel secrets (not committed)
- ✅ Services only accessible via VPN, not public
- ✅ Frontend on Vercel CDN (separate from backend)

### Never Commit Sensitive Data
```bash
# .env is in .gitignore (don't commit)
# .env.production should use Vercel secrets UI
# API keys and secrets only in secure storage
```

---

## Files Related to Infrastructure

| File | Purpose |
|------|---------|
| `frontend/config/infrastructure.ts` | Mode selection & URL routing |
| `.env` | Local development secrets |
| `.env.example` | Documentation template |
| `.env.production` | Remote production config |
| `vercel.json` | Vercel deployment config |
| `benchmark-setup.sh` | Local service startup automation |
| `INFRASTRUCTURE_STRATEGY.md` | This file — architecture guide |

---

## Next Steps

### For Local Development
1. Run `benchmark-setup.sh` (once)
2. Start dev server: `npm run dev`
3. Open http://localhost:5173

### For Production
1. Set Vercel environment variables (VITE_* vars)
2. Merge to main branch
3. Vercel automatically deploys to https://nomads.vercel.app
4. Uses remote services via Tailscale VPN

---

## Questions?

Refer to:
- `BENCHMARK_TEST_PLAN.md` — How to run local tests
- `IMPLEMENTATION_SUMMARY.md` — Phase 1 changes
- `REAL_SYSTEM_ARCHITECTURE.md` — System overview

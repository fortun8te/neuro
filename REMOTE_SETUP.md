# Neuro Remote Infrastructure Setup

## ⚠️ IMPORTANT: Remote-Only Deployment

Neuro is optimized for **remote infrastructure deployment**. Do **NOT** run Ollama, Wayfarer, or SearXNG locally on your machine. Use remote Docker instances instead.

---

## Architecture

```
┌─ Your Machine ─────────────────────────────────┐
│  npm run cli                                   │
│  ├─ Research agents                            │
│  ├─ State management                           │
│  └─ Parallelization orchestration              │
└────────────────┬────────────────────────────────┘
                 │ HTTP/REST
                 │
        ┌────────▼──────────────────────────────────┐
        │ Remote Docker (4-8 instances)             │
        │                                            │
        │  ┌─ SearXNG Cluster ─────────────────┐   │
        │  │ • searxng-1 (8888)                │   │
        │  │ • searxng-2 (8889)                │   │
        │  │ • searxng-3 (8890) [optional]     │   │
        │  │ • searxng-4 (8891) [optional]     │   │
        │  └────────────────────────────────────┘   │
        │                                            │
        │  ┌─ Nginx Load Balancer ──────────────┐  │
        │  │ Port 80: Round-robin to SearXNG    │  │
        │  │ Health check: /health              │  │
        │  └────────────────────────────────────┘  │
        │                                            │
        │  ┌─ Wayfarer Service ─────────────────┐  │
        │  │ Python 3.11 + Playwright          │  │
        │  │ Port 8889 (or 8890+)              │  │
        │  │ Concurrent instances (4-8)        │  │
        │  └────────────────────────────────────┘  │
        │                                            │
        │  ┌─ Ollama (Remote) ──────────────────┐  │
        │  │ Models: qwen3.5, gpt-oss-20b       │  │
        │  │ Port: 11434 or custom              │  │
        │  └────────────────────────────────────┘  │
        │                                            │
        └────────────────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Configure Environment Variables

Edit `.env` to point to **remote servers only**:

```bash
# REMOTE OLLAMA (not localhost!)
VITE_OLLAMA_URL=http://100.74.135.83:11440

# REMOTE WAYFARER (Python service)
VITE_WAYFARER_URL=http://your-remote-server.com:8889

# REMOTE SEARXNG (with nginx load balancer)
VITE_SEARXNG_URL=http://your-remote-server.com:80
```

**⚠️ DO NOT USE:**
- ❌ `http://localhost:11434` (local Ollama)
- ❌ `http://localhost:8889` (local Wayfarer)
- ❌ `http://localhost:8888` (local SearXNG)

### Step 2: Start Remote Docker Services

On your **remote server** (not your local machine):

```bash
# Clone the repo on the remote machine
git clone https://github.com/yourusername/neuro.git
cd neuro

# Start SearXNG cluster + Nginx load balancer
docker-compose up -d searxng-1 searxng-2 nginx

# Expected output:
# Creating searxng-1 ... done
# Creating searxng-2 ... done
# Creating neuro-nginx ... done

# Verify services are running
docker-compose ps

# Check health
curl http://localhost:80/health    # Should return "healthy"
```

### Step 3: Start Wayfarer (Python Service)

On the **remote server**:

```bash
# Install dependencies (one-time)
cd wayfarer
pip3.11 install -r requirements.txt

# Start Wayfarer with SearXNG pointing to load balancer
SEARXNG_URL=http://localhost:80 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# Or run in screen/tmux for persistent background execution
screen -S wayfarer -d -m bash -c "SEARXNG_URL=http://localhost:80 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889"
```

### Step 4: Verify Remote Connectivity

On **your local machine**:

```bash
# Check health from your machine
npm run cli -- --health

# Expected output:
# ✅ Ollama       OK       (11ms)
# ✅ Wayfarer     OK       (45ms)
# ✅ SearXNG      OK       (23ms)
```

---

## Scaling to 8 Instances

To scale SearXNG from 2 to 4+ instances:

### Edit docker-compose.yml:

```yaml
services:
  searxng-3:
    image: searxng/searxng:latest
    container_name: searxng-3
    ports:
      - "8890:8080"
    environment:
      - SEARXNG_BASE_URL=http://localhost:8890/
    volumes:
      - ./searxng/settings.yml:/etc/searxng/settings.yml:ro
    networks:
      - neuro-network
    restart: unless-stopped

  searxng-4:
    image: searxng/searxng:latest
    container_name: searxng-4
    ports:
      - "8891:8080"
    # ... same as searxng-3
```

### Edit nginx.conf:

```nginx
upstream searxng {
    least_conn;
    server searxng-1:8080 max_fails=3 fail_timeout=30s;
    server searxng-2:8080 max_fails=3 fail_timeout=30s;
    server searxng-3:8080 max_fails=3 fail_timeout=30s;
    server searxng-4:8080 max_fails=3 fail_timeout=30s;
}
```

### Restart:

```bash
docker-compose up -d
```

---

## Graceful Offline Handling

If a remote service is offline, Neuro will:

1. **Report the status clearly:**
   ```
   ⚠️ Offline services (graceful degradation):
    • Wayfarer: http://remote-server.com:8889
      → Connection refused: Is remote Docker running?
   ```

2. **Continue with degraded functionality:**
   - Research will skip web scraping
   - Parallelization still works with available services
   - Core cycle completes with cached results

3. **Never silently fail** — Always tell you which service is offline and why

---

## Troubleshooting

### "Connection refused" for Wayfarer/SearXNG

**Problem:** Services running on remote server, but you can't reach them

**Solution:**
1. Check firewall allows ports 8888-8891 on remote server
2. Verify `.env` has correct remote IP/domain
3. Test directly: `curl http://remote-server.com:8889/health`

### Ollama Timeout

**Problem:** `Timeout after 5000ms` for Ollama

**Solution:**
1. SSH to remote server: `ssh user@remote-server`
2. Check Ollama is running: `ollama serve`
3. Verify port is open: `curl http://localhost:11434/api/tags`
4. Update `.env` with correct remote IP

### SearXNG Returns Errors

**Problem:** Search queries fail even though service is online

**Solution:**
1. Check nginx is routing correctly: `curl http://remote:80/search?q=test`
2. Check SearXNG instances: `docker-compose logs searxng-1`
3. Verify load balancer has both instances: `docker-compose ps`

---

## Performance Tuning

### Optimize for Parallelization

With 4-8 SearXNG instances, Neuro can run:
- **5 parallel researchers** without bottleneck
- **Parallel objections + taste** while research completes
- **Full cycle speedup** 2-3x over sequential

```bash
# See parallelization gains
npm run cli -- --parallel

# Example output:
# Basic Parallel Execution: 2.99x speedup
# Parallel Cycle Stages: 1.31x speedup
```

### Monitor Remote Services

```bash
# SSH to remote server
ssh user@remote-server

# Watch Docker containers
docker-compose ps

# See resource usage
docker stats

# View Wayfarer logs
screen -r wayfarer
```

---

## Security Notes

### Network Security

- ✅ Docker network isolation (containers can talk)
- ✅ Nginx load balancer (single entry point)
- ⚠️ Open ports to internet? Use VPN or SSH tunneling

### SSH Tunneling (for external remotes)

```bash
# From your machine: tunnel to remote
ssh -L 8888:remote-server:8888 \
    -L 8889:remote-server:8889 \
    -L 11440:remote-server:11440 \
    user@remote-server

# Then .env points to localhost
VITE_OLLAMA_URL=http://localhost:11440
VITE_WAYFARER_URL=http://localhost:8889
VITE_SEARXNG_URL=http://localhost:8888
```

---

## Deployment Checklist

- [ ] Remote server has Docker + Docker Compose installed
- [ ] `.env` points to remote services (not localhost)
- [ ] SearXNG instances running: `docker-compose ps`
- [ ] Nginx load balancer running and healthy
- [ ] Wayfarer service running on remote
- [ ] Local machine can reach all services: `npm run cli -- --health`
- [ ] Parallelization tests pass: `npm run cli -- --parallel`
- [ ] Full benchmark passes: `npm run cli -- --benchmark`

---

## Common Commands

```bash
# Check all services healthy
npm run cli -- --health

# Run parallelization tests
npm run cli -- --parallel

# Run full architecture benchmark
npm run cli -- --benchmark

# View logs on remote
docker-compose logs searxng-1    # SearXNG instance 1
docker-compose logs -f nginx     # Follow nginx logs

# Restart a service
docker-compose restart searxng-1
docker-compose restart nginx

# Stop all services
docker-compose down

# View resource usage
docker stats
```

---

## Why Remote-Only?

1. **Performance:** Remote instances have better CPUs for parallel processing
2. **Isolation:** Prevents local machine slowdowns
3. **Scalability:** Easy to add 4-8 instances without touching your machine
4. **Reliability:** Services stay running even if your dev machine sleeps
5. **Cost:** Efficient resource utilization across instances

**Never run Ollama locally. Always use remote infrastructure.**


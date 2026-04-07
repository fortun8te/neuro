# Local Mode: Development Setup Guide

## Overview

**Local Mode** allows you to run the entire Nomads system on your local machine using only **qwen3.5:2b** (530MB model). This is perfect for:

- 🧪 **Testing tools and integrations** without needing remote infrastructure
- 💻 **Development without network dependency** (works offline except for web research)
- 🎓 **Learning** how the system works
- 🖥️ **Limited VRAM machines** (16GB RAM minimum)

## Quick Start (10 minutes)

### 1. Start Docker Services (SearXNG + Nginx)

```bash
cd /Users/mk/Downloads/nomads
docker-compose up -d
```

This starts:
- **SearXNG instances** (ports 8888, 8890)
- **Nginx load balancer** (port 8888 → routes to SearXNG)
- Auto-routes all search queries locally

### 2. Install & Run Ollama

```bash
# Download from: https://ollama.ai
# macOS: brew install ollama
# Or visit: https://ollama.ai/download

# Start Ollama server
ollama serve

# In another terminal, pull qwen3.5:2b (one-time, ~530MB)
ollama pull qwen3.5:2b
```

### 3. Start Wayfarer (Web Scraping)

In a third terminal:

```bash
cd /Users/mk/Downloads/nomads/wayfarer
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889
```

### 4. Configure Environment

Copy `.env.local.example` to `.env.local`:

```bash
cd /Users/mk/Downloads/nomads
cp .env.local.example .env.local
```

The defaults in `.env.local` will auto-use:
- **Ollama**: http://localhost:11434
- **SearXNG**: http://localhost:8888 (via Docker)
- **Wayfarer**: http://localhost:8889 (Python server)

### 5. Start Dev Server

```bash
npm run dev
```

That's it! All local services are automatically connected and the system uses qwen3.5:2b for everything.

---

## How It Works

### Automatic Local Service Routing

When `VITE_INFRASTRUCTURE_MODE=local`, the system **automatically routes all traffic to local services**:

| Service | Local | Remote |
|---------|-------|--------|
| **Ollama** | localhost:11434 | 100.74.135.83:11434 |
| **SearXNG** | localhost:8888 (Docker) | 100.74.135.83:8888 |
| **Wayfarer** | localhost:8889 (Python) | 100.74.135.83:8889 |

**Important**: In local mode, the system will NOT attempt to use remote services. All requests are sent to localhost.

### Model Mapping (Local vs Production)

In `frontend/utils/modelConfig.ts`, the system checks the infrastructure mode:

```typescript
export function getModelForStage(stage: string): string {
  // In LOCAL MODE: Use lightweight 2b for everything
  if (isLocalMode()) {
    return LOCAL_MODEL_CONFIG[stage] || 'qwen3.5:2b';
  }
  // In PRODUCTION: Use configured high-quality models
  return MODEL_CONFIG[stage] || 'qwen3.5:4b';
}
```

### What Changes in Local Mode

| Feature | Production | Local Mode | Impact |
|---------|-----------|-----------|--------|
| **Chat** | qwen3.5:9b | qwen3.5:2b | Faster, slightly lower quality |
| **Research** | qwen3.5:4b/9b | qwen3.5:2b | Works, simplified |
| **Vision** | qwen3.5:2b | qwen3.5:2b | Same (already lightweight) |
| **Creative** | nemotron:120b | qwen3.5:2b | Much faster, lower creative quality |
| **Reasoning** | nemotron:120b | qwen3.5:2b | Simplified logic chains |
| **VRAM** | 40+ GB | 2-4 GB | ✅ Works on normal laptops |
| **Speed** | Slower | 2-3x faster | ✅ Quick feedback loops |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           Nomads App (React Frontend)                           │
├─────────────────────────────────────────────────────────────────┤
│  modelConfig.ts: isLocalMode()                                  │
│    ├─ TRUE  → Use LOCAL_MODEL_CONFIG (qwen3.5:2b)             │
│    └─ FALSE → Use MODEL_CONFIG (production models)             │
├─────────────────────────────────────────────────────────────────┤
│  infrastructure.ts: INFRASTRUCTURE.getMode()                    │
│    ├─ local  → localhost (all services)                        │
│    └─ remote → 100.74.135.83 (all services via Tailscale)     │
├─────────────────────────────────────────────────────────────────┤
│                    LOCAL MODE ROUTING                           │
│  ┌──────────────────────────────────────────────────┐          │
│  │ Ollama:   http://localhost:11434                │          │
│  │ SearXNG:  http://localhost:8888 (Docker)        │          │
│  │ Wayfarer: http://localhost:8889 (Python)        │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
│  ALL AUTOMATIC when VITE_INFRASTRUCTURE_MODE=local             │
│  No network dependency, no remote servers needed               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features That Work in Local Mode

✅ **Chat & Conversations**
- Full chat interface
- Message history
- Multi-turn conversations
- Context window: 32K tokens

✅ **Tool Testing**
- File upload & reading
- Image analysis (lighter)
- Screenshot capture
- Command execution
- Web browsing (basic)

✅ **Agent Tools**
- Tool selection & calling
- Parameter inference
- Basic planning
- Action execution

✅ **Research Features** (Simplified)
- Web scraping (if Wayfarer running locally)
- Search integration
- Page compression
- Result synthesis

✅ **Creative Generation**
- Ad copy writing
- Text generation
- Style variations

---

## Features with Limitations in Local Mode

⚠️ **Lower Output Quality**
- Creative output less sophisticated (no branded voice)
- Reasoning shallower (no deep planning)
- Vision analysis less detailed (but still functional)

⚠️ **Slower on Complex Tasks**
- Research orchestration: More iterations needed
- Deep reasoning: May be too simplistic
- Long document analysis: Memory constraints

⚠️ **Research Requires Extra Setup**
- To use research: Need Wayfarer running locally:
  ```bash
  cd wayfarer && SEARXNG_URL=http://localhost:9001 \
    /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app \
    --host 0.0.0.0 --port 8891
  ```

---

## Environment Variables Reference

### Required for Local Mode

```env
# Enable local infrastructure mode
VITE_INFRASTRUCTURE_MODE=local
```

When set to `local`, all services automatically use localhost ports.

### Optional (Override Defaults)

```env
# Override default Ollama port
VITE_OLLAMA_URL=http://localhost:11434

# Override default Wayfarer port (if running on different port)
VITE_WAYFARER_URL=http://localhost:8889

# Override default SearXNG port (if running on different port)
VITE_SEARXNG_URL=http://localhost:8888
```

**Default behavior in local mode (without overrides):**
- Ollama: `http://localhost:11434`
- SearXNG: `http://localhost:8888` (Docker via nginx)
- Wayfarer: `http://localhost:8889` (Python server)

---

## Troubleshooting

### Error: "Connection refused localhost:11434"

**Problem:** Ollama not running

**Solution:**
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Pull the model
ollama pull qwen3.5:2b
```

### Error: "Model not found: qwen3.5:2b"

**Problem:** Model not pulled yet

**Solution:**
```bash
ollama pull qwen3.5:2b
```

This downloads ~530MB (one-time only).

### Response is Very Slow

**Problem:** Model running on CPU instead of GPU

**Solution:**
1. Install GPU drivers (NVIDIA/AMD)
2. Restart Ollama
3. Check status:
   ```bash
   ollama list
   ```
   Should show `qwen3.5:2b` with GPU in use

### Response Quality Is Worse Than Expected

**Expected:** This is normal! qwen3.5:2b is much smaller than production models (9b, 120b). For testing this is fine.

**Workaround:** Switch to production mode for quality:
```bash
# Edit .env.local
VITE_INFRASTRUCTURE_MODE=remote
# Then restart dev server
```

---

## Switching Between Modes

### Quick Toggle (UI)

1. Open Settings → Infrastructure
2. Select "Local" or "Remote"
3. System restarts with new mode

### Environment Variable

Edit `.env.local`:
```env
VITE_INFRASTRUCTURE_MODE=local  # or "remote"
```

Then restart dev server:
```bash
npm run dev
```

---

## Performance Expectations

### Inference Time per Request

| Model | Task | Time |
|-------|------|------|
| qwen3.5:2b | Simple Q&A | 1-2 sec |
| qwen3.5:2b | Page compression | 3-5 sec |
| qwen3.5:2b | Creative writing | 5-8 sec |
| qwen3.5:2b | Complex reasoning | 10-15 sec |

### Memory Usage

- **Ollama process:** ~1.5 GB (qwen3.5:2b loaded)
- **Browser/Dev server:** ~1 GB
- **Total:** ~3-4 GB (plenty of headroom on 16GB RAM)

---

## Advanced: Combining Modes

### Hybrid Mode (Not Recommended)

You can mix local + remote, but this is complex:

```env
VITE_INFRASTRUCTURE_MODE=local
VITE_OLLAMA_URL=http://100.74.135.83:11434  # Use remote Ollama
```

This works but defeats the purpose (you still need network access).

---

## Disabling Features in Local Mode

### Disable Web Research

Edit `src/hooks/useCycleLoop.ts`:

```typescript
// Skip research phase in local mode
if (INFRASTRUCTURE.getMode() === 'local') {
  skipResearchPhase = true;  // Use cached data instead
}
```

### Disable Vision Analysis

Edit `frontend/utils/visionAgent.ts`:

```typescript
if (INFRASTRUCTURE.getMode() === 'local') {
  // Skip vision, return placeholder
  return { image_base64: '', analysis: 'skipped' };
}
```

---

## Code Examples

### Check if in Local Mode

```typescript
import { isLocalMode } from '@/utils/modelConfig';

if (isLocalMode()) {
  console.log('Running in LOCAL MODE - using qwen3.5:2b only');
  // Disable heavy features, adjust expectations
}
```

### Get Model for Current Mode

```typescript
import { getModelForStage } from '@/utils/modelConfig';

const model = getModelForStage('chat');  // Returns 'qwen3.5:2b' in local mode
```

### Get Infrastructure Mode

```typescript
import { INFRASTRUCTURE } from '@/config/infrastructure';

const mode = INFRASTRUCTURE.getMode();  // 'local' or 'remote'
const ollamaUrl = INFRASTRUCTURE.ollamaUrl;  // http://localhost:11434 in local mode
```

---

## FAQs

**Q: Can I use GPU acceleration in local mode?**
A: Yes! Ollama auto-detects and uses GPU if available (CUDA/Metal). Much faster than CPU.

**Q: What if I have limited VRAM?**
A: qwen3.5:2b needs ~2.5GB VRAM. If you have less, it will use CPU (slower but works).

**Q: Can I use other models in local mode?**
A: Yes! Edit `.env.local` and pull a different model:
```bash
ollama pull llama2:7b
# Then edit modelConfig.ts to use it
```

**Q: Is local mode production-ready?**
A: No, it's for testing/development only. Quality is lower, and research features are simplified.

**Q: How do I go back to production?**
A: Set `VITE_INFRASTRUCTURE_MODE=remote` in `.env.local`

**Q: What about privacy/data?**
A: Local mode keeps everything on your machine. No data sent anywhere. ✅ More private.

---

## Next Steps

1. ✅ Install Ollama and qwen3.5:2b
2. ✅ Copy `.env.local.example` to `.env.local`
3. ✅ Set `VITE_INFRASTRUCTURE_MODE=local`
4. ✅ Run `npm run dev`
5. 🧪 Start testing!

---

## Support

For issues with local mode:
1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Verify model is installed: `ollama list`
3. Check browser console for errors (F12 → Console)
4. Review `.env.local` settings

Happy testing! 🚀

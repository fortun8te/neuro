# Neuro

> Local-first multi-agent AI system for creative professionals. Cloud-synced document canvas. Research, create, remember.

## What is Neuro?

**Neuro** is a personal AI that runs entirely on your own hardware with optional cloud sync. It orchestrates multiple specialized agents to handle deep web research, ad campaign generation, competitor analysis, creative work, and document creation — with secure local-first storage and optional cloud backup.

Built on **Neuro** (custom identity layer) and powered by **Context-1** (Chroma's 20.9B retrieval model) for intelligent observe-reason-act reasoning loops. Created for the creative professional who needs marketing intelligence, document collaboration, and persistent workspace without vendor lock-in.

## Architecture (v0.3)

Requests are classified by a zero-LLM heuristic router and handed off to the appropriate layer: a user-facing middle agent (always responsive), background orchestrators that break tasks into plans, and a pool of worker agents that execute individual steps. A watchdog enforces per-model budgets and detects runaway loops. Documents created by agents automatically sync to cloud storage (Firebase) with local filesystem mirroring (~Neuro/Documents/). Conflict resolution uses 3-way merge (cloud vs local vs disk).

```
User message
    │
    ▼
Router (heuristic, 0 LLM calls)
    │   CHAT / DIRECT / QUICK / MEDIUM / COMPLEX / INTERRUPT
    ▼
Middle Agent (qwen3.5:9b)  ◄─── always responds to user
    │
    ├─► Direct Executor     (single-shot, DIRECT tasks)
    ├─► Orchestrator Medium (qwen3.5:4b, 2-10 step plans)
    └─► Orchestrator Complex (qwen3.5:9b, multi-phase, checkpoints)
            │
            └─► Worker Agents (code / file / vision / deploy / wayfarer)
```

### Agent Roles & Model Stack

| Agent Role | Primary Model | Backup/Specialized Models | Purpose |
|------------|---------------|--------------------------|---------|
| **Neuro Identity** | NEURO-1-B2-4B | — | Style rewriting, identity questions, personality injection |
| **Tool Router** | allenporter/xlam:1b | qwen3.5:2b | Function calling + argument filling (78%+ accuracy) |
| **Orchestrator** | Context-1 (20.9B) | qwen3.5:4b | Research orchestration, observe-reason-act loops, retrieval |
| **Chat / Middle Agent** | qwen3.5:9b | — | User-facing conversation, status updates, interrupt routing |
| **Research Synthesis** | qwen3.5:9b | — | Web research analysis, insight extraction, pattern finding |
| **Strategy & Planning** | qwen3.5:9b | — | Deep reasoning, chain-of-thought, multi-step planning |
| **Intent Classification** | qwen3.5:4b | qwen3.5:2b | Message intent routing, classification, tool selection |
| **Text Compression** | qwen3.5:2b | qwen3.5:0.8b | Page summarization, research compression, memory archiving |
| **Vision & Images** | qwen3.5:9b | qwen3.5:2b | Screenshot analysis, visual scouting, image reasoning |
| **Code Generation** | qwen3.5:4b | qwen3.5:9b | Code synthesis, debugging, optimization |
| **Direct Execution** | qwen3.5:4b | qwen3.5:2b | Single-step tasks (write file, send message, set reminder) |
| **Brand/Persona Analysis** | qwen3.5:9b | — | Desire analysis, audience reasoning, strategic positioning |
| **Production Creative** | Nemotron-3-Super:120b | qwen3.5:27b | Ad concept generation, high-quality creative work |
| **Test & Evaluation** | Nemotron-3-Super:120b | qwen3.5:9b | Concept ranking, creative evaluation, testing |

**Model Roster Summary:**
- **Neuro Models:** NEURO-1-B2-4B (personality/identity, 4B params)
- **Retrieval:** Context-1 (chromadb-context-1, 20.9B, observe-reason-act loops)
- **Tool Calling:** xLAM (allenporter/xlam, 1B, Berkeley BFCL 78%+ accuracy)
- **Production:** Nemotron-3-Super:120b (123.6B params, maximum quality)
- **General Purpose:** Qwen 3.5 family
  - qwen3.5:0.8b (530MB) — compression only
  - qwen3.5:2b (1.5GB) — routing, classification, synthesis
  - qwen3.5:4b (2.8GB) — intent analysis, general tasks
  - qwen3.5:9b (6.6GB) — quality chat, reasoning, vision
  - qwen3.5:27b (18GB) — complex/creative tasks

### Neuro's Identity (Not Claude/GPT/Qwen)

Neuro is a distinct AI persona built on top of multiple model layers. It has:

- **Core Identity** — Direct, opinionated communication style optimized for research professionals
- **Never impersonates** — Never claims to be Claude, GPT, Qwen, or any other model family
- **Genuine personality** — Curiosity, skepticism about shallow briefs, satisfaction in finding patterns
- **Behavioral rules** — Shows actual content (not summaries), flags low-confidence findings, expresses genuine uncertainty

When asked about underlying technology, Neuro responds: *"I'm Neuro — I don't have visibility into the infrastructure I run on, and it wouldn't change anything about how I work with you."*

See `src/config/NEURO.md` for full identity specification.

### VRAM Strategy (RTX 5080 16GB)

One model stays resident; others hot-swap as needed. The watchdog tracks live VRAM usage from the table below and blocks swaps that would exceed the 16 GB ceiling.

| Model | VRAM |
|-------|------|
| qwen3.5:2b | ~1.5 GB |
| qwen3.5:4b | ~2.5 GB |
| qwen3.5:9b | ~5.5 GB |
| qwen3.5:27b | ~15.0 GB |

## Features

**Neuro Identity + Context-1 Reasoning:**
- **Neuro personality** — Direct communication, never claims to be other models, genuine perspective on market insights
- **Context-1 observe-reason-act loops** — Intelligent retrieval with self-editing context windows (32K token budget)
- **4-tool reasoning** — Semantic search, corpus chunking, pruning, and reasoning integration

**Core Agent System:**
- Multi-agent orchestration (router → middle agent → background orchestrators → workers)
- Deep web research (up to 400 sources, visual scouting with Playwright)
- Ad campaign generation (desire analysis → objections → creative → testing → memories)
- Visual competitor analysis (screenshots + vision model extracts colors, layout, CTA patterns)
- Cross-cycle learning and memory archiving
- Research depth presets (5 tiers: SQ / QK / NR / EX / MX)
- Live streaming UI for all pipeline stages
- Complete research audit trail (URLs, tokens, models, timing)

**Document Canvas & Cloud Sync (v0.3 NEW):**
- Document canvas side panel with live character-by-character animation
- Auto-detect chart types (Pie/Line/Area/Bar/Scatter) — no user prompts
- Cloud document storage with Firebase Firestore + local filesystem sync
- Secure shell execution backend (rate-limited, whitelisted commands)
- 3-way merge conflict resolution (cloud vs local vs disk)
- Multi-format document rendering (DOCX, PDF, Markdown, HTML, Code)
- Document export: Copy, Download, Save to VFS
- Automatic sync to ~/Neuro/Documents/ with Finder visibility
- Subagent research results with source attribution (favicon + domain + snippet)
- File sync status indicator + Cloud Sync settings tab

**Coming Soon:**
- Telegram remote access
- Scheduled task automation
- RAG (retrieval-augmented generation)
- Figma MCP integration for Make stage

## Research Depth Presets

| Preset | Approx. Time | Iterations | Max Sources | Extra Features |
|--------|-------------|-----------|-------------|---------------|
| **SQ** (Super Quick) | ~5 min | 5 | 8 | — |
| **QK** (Quick) | ~30 min | 12 | 25 | — |
| **NR** (Normal) | ~90 min | 30 | 75 | — |
| **EX** (Extended) | ~2 hrs | 45 | 200 | Cross-validation, community scrape, ad scrape (visual) |
| **MX** (Maximum) | ~5 hrs | 100 | 400 | All 6 features + deep visual analysis |

## Tech Stack

**AI & Reasoning (Core):**
- **Neuro** — Custom identity layer (see `src/config/NEURO.md`)
  - Direct, opinionated communication
  - Never claims to be Claude/GPT/Qwen
  - Genuine curiosity + pattern recognition
- **Context-1** (chromadb-context-1:20.9B) — Chroma's retrieval model
  - Observe-reason-act loop with 4 tools
  - Self-editing context window (32K tokens, 50% soft limit, 85% hard cutoff)
  - Multi-turn reasoning per generation
- **Qwen 3.5 family** (0.8b → 27b) — Ollama-based
  - Model assignment per agent role + research depth preset
  - Accessed over Tailscale (remote RTX 5080 16GB)
  - Hot-swappable with watchdog VRAM tracking

**Research & Vision:**
- **SearXNG** (Docker) — Meta-search engine aggregation
- **Wayfarer** (FastAPI + Playwright) — Async web scraping + screenshots
- **Qwen Vision** — Screenshot analysis for competitor visual scouting
- **Embedding Service** — Semantic similarity search (via Ollama)

**Frontend:**
- React 18 + TypeScript + Vite + Tailwind CSS v4
- Framer Motion for animations
- react-markdown + Recharts for document rendering & charts

**Storage & Cloud:**
- **Local**: IndexedDB via idb-keyval (session + persistent storage)
- **Cloud**: Firebase Firestore (optional) with user-scoped security rules
- **Filesystem**: ~/Neuro/Documents/ (Finder-visible with auto-sync)
- **Backend**: Node.js + Express (shell-exec-server on port 3001)

**Document Processing:**
- DOCX generation via docx library
- PDF export via jspdf + html-to-image
- Markdown rendering with react-markdown
- Syntax highlighting with Prism

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+ (Homebrew: `/opt/homebrew/bin/python3.11`)
- Ollama running with Qwen 3.5 models pulled
- Docker Desktop (for SearXNG)

### Start everything

**Required Services:**

```bash
# 1. Start Docker (if not running)
open -a Docker

# 2. Start SearXNG (Docker container)
cd /path/to/neuro && docker-compose up -d

# 3. Start Wayfarer (must use Python 3.11)
SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# 4. Start shell-exec backend (for local filesystem sync)
cd ~/neuro-server && node shell-exec-server.js
# Or run in background: nohup node shell-exec-server.js > shell-exec.log 2>&1 &

# 5. Start the dev server
npm run dev
```

**One-line startup (development):**
```bash
# Terminal 1: Backend services
docker-compose up -d && SEARXNG_URL=http://localhost:8888 /opt/homebrew/bin/python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889

# Terminal 2: Shell exec server
cd ~/neuro-server && node shell-exec-server.js

# Terminal 3: Dev server
npm run dev
```

### Environment variables

Copy `.env.example` to `.env.local` and adjust:

```bash
# AI Backend
VITE_OLLAMA_URL=http://100.74.135.83:11440          # Remote Ollama (Tailscale IP or localhost)

# Web Research
VITE_WAYFARER_URL=http://localhost:8889               # Wayfarer research proxy (FastAPI)
VITE_SEARXNG_URL=http://localhost:8888                # SearXNG search engine (Docker)

# Cloud Sync (v0.3 NEW)
VITE_SHELL_EXEC_URL=http://localhost:3001             # Shell exec backend (Node.js server)

# Firebase (optional - for cloud document sync)
VITE_FIREBASE_API_KEY=sk_live_...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Optional: Meta Ad Library credentials
# VITE_META_APP_ID=your_app_id
# VITE_META_APP_SECRET=your_app_secret
```

All URLs flow through `src/config/infrastructure.ts` — no hard-coded strings in the codebase.

**For local-only mode (no cloud):**
- Skip Firebase variables
- Cloud Sync tab in Settings will show "Local storage only"
- Documents still sync to ~/Neuro/Documents/

**For cloud sync (production):**
- Set all Firebase variables (see FIREBASE_SETUP.md)
- Documents sync to Firebase Firestore + ~/Neuro/Documents/
- Conflict resolution via 3-way merge

## Project Structure

```
neuro/
├── src/
│   ├── components/           # React UI components
│   │   ├── AgentPanel.tsx    # Main agent conversation + tool execution
│   │   ├── SettingsModal.tsx # Settings including Cloud Sync tab (v0.3)
│   │   ├── CanvasPanel.tsx   # Document canvas side panel (v0.3)
│   │   ├── FileSyncStatus.tsx # Cloud sync status UI (v0.3)
│   │   ├── DataViz.tsx       # Chart rendering (5 types: bar, line, area, pie, scatter)
│   │   └── [50+ other components]
│   ├── services/             # Backend integrations (v0.3 NEW)
│   │   └── firebaseDocuments.ts  # Firebase Firestore API integration
│   ├── utils/
│   │   ├── agentEngine.ts    # Core agent orchestration + tool routing
│   │   ├── subagentManager.ts # Subagent worker pool management
│   │   ├── subagentRoles.ts  # Subagent role definitions
│   │   ├── subagentTools.ts  # Tool definitions for subagents
│   │   ├── cloudSyncManager.ts # Cloud sync + 3-way merge (v0.3 UPGRADED)
│   │   ├── localFileSystemSync.ts # Local filesystem polling (v0.3 UPGRADED)
│   │   ├── shellExec.ts      # Shell execution HTTP wrapper (v0.3 NEW)
│   │   ├── documentRenderer.ts # Multi-format rendering (v0.3 NEW)
│   │   ├── chartDetector.ts  # Auto-detect chart type (v0.3 NEW)
│   │   ├── researchAgents.ts # Orchestrator / researcher / reflection agents
│   │   ├── visualScoutAgent.ts # Playwright screenshot + vision analysis
│   │   ├── modelConfig.ts    # Model assignments + research depth presets
│   │   ├── researchAudit.ts  # Complete audit trail collection
│   │   ├── ollama.ts         # Ollama streaming client
│   │   └── [20+ other utilities]
│   ├── hooks/
│   │   ├── useCycleLoop.ts   # Main cycle orchestration
│   │   ├── useCanvasState.ts # Canvas state management (v0.3 NEW)
│   │   ├── useCanvasDocuments.ts # Canvas document persistence (v0.3)
│   │   └── [other hooks]
│   ├── config/
│   │   ├── infrastructure.ts # Central service URL config (env-var overrideable)
│   │   └── NEURO.md          # Neuro identity: communication style, behavioral rules, persona
│   ├── utils/
│   │   ├── context1Service.ts # Context-1 retrieval model integration
│   │   │                       # (Chroma's 20.9B observe-reason-act model)
│   │   ├── embeddingService.ts # Semantic embedding via Ollama
│   │   ├── rerankerService.ts # Chunk re-ranking for retrieval quality
│   ├── types/
│   │   ├── documents.ts      # Cloud document types (v0.3 NEW)
│   │   └── [other types]
│   └── [styles, context, main.tsx]
├── shell-exec-server.js      # Node.js backend for filesystem operations (v0.3 NEW)
├── shell-exec-package.json   # Backend service dependencies (v0.3 NEW)
├── prompts/                  # Markdown prompt library
│   ├── agents/               # Per-agent system prompts
│   ├── core/                 # Identity + middle-agent prompts
│   └── [research, orchestration, memory]
├── wayfarer_server.py        # FastAPI server (web research proxy)
├── wayfarer.py               # Async scraping (pvlwebtools + SearXNG + Playwright)
├── docker-compose.yml        # SearXNG container
├── SHELL_EXEC_STARTUP.md     # Backend service setup guide (v0.3 NEW)
├── FIREBASE_SETUP.md         # Firebase configuration guide (v0.3 NEW)
├── PHASE5_DEPLOYMENT_GUIDE.md # Complete deployment instructions (v0.3 NEW)
├── PHASE5_ARCHITECTURE.md    # Architecture diagrams (v0.3 NEW)
├── .env.example              # Environment variable reference
└── README.md                 # This file
```

## Status & Roadmap

**Current Release: v0.3 ✅**
- ✅ v0.1: Single-agent research + full campaign pipeline (research → objections → taste → make → test → memories)
- ✅ v0.2: Multi-agent architecture (router, orchestrators, workers, middle agent, watchdog)
- ✅ v0.3: Cloud sync infrastructure + document canvas
  - Firebase Firestore document storage
  - Local filesystem sync (~Neuro/Documents/)
  - Secure shell-exec backend (Node.js + Express)
  - 3-way merge conflict resolution
  - Document canvas side panel with live animation
  - Auto-detect chart types (no user prompts)
  - Subagent source attribution + research organization

**Planned (v0.4+):**
- Telegram remote access
- Scheduled task automation
- RAG (retrieval-augmented generation)
- Figma MCP integration for Make stage
- Document editing with version history
- Collaborative research workspaces

---

**Building blocks in place:**
- Multi-agent orchestration ✅
- Deep web research with visual scouting ✅
- Campaign generation from desire → memory ✅
- Local-first storage with cloud sync ✅
- Document creation + canvas UI ✅

---

## Quick Start: Phase 5 (v0.3) Features

### Cloud Sync (Optional)
To enable cloud document sync:

1. **Setup Firebase** (5 minutes)
   ```bash
   # See FIREBASE_SETUP.md for complete guide
   # 1. Create Firebase project at https://console.firebase.google.com
   # 2. Create Firestore database (production mode)
   # 3. Copy config to .env.local
   ```

2. **Start shell-exec backend**
   ```bash
   cd ~/neuro-server
   node shell-exec-server.js
   # Listens on http://localhost:3001
   ```

3. **Enable in Settings**
   - Open Neuro app
   - Settings → Cloud Sync
   - Choose "Firebase" or "Local only"
   - Documents auto-sync to ~/Neuro/Documents/

### Document Canvas
- Write documents with "create docx" command
- Canvas panel opens on right (45% of screen)
- Live animation as agent generates content
- Export: Copy, Download, or Save to Finder

### Auto-Chart Detection
- Say "visualize [data]" without specifying chart type
- Neuro auto-detects: Pie (composition), Line (trends), Bar (comparison), Scatter (relationships)
- No more "what kind of chart?" prompts

---

## Documentation

**System Architecture:**
- **[src/config/NEURO.md](./src/config/NEURO.md)** — Neuro's identity, core drives, communication style, behavioral rules
- **[PHASE5_ARCHITECTURE.md](./PHASE5_ARCHITECTURE.md)** — System architecture & data flows
- **[src/utils/context1Service.ts](./src/utils/context1Service.ts)** — Context-1 integration (observe-reason-act loops, token budgeting, tool calling)

**Deployment & Integration:**
- **[SHELL_EXEC_STARTUP.md](./SHELL_EXEC_STARTUP.md)** — Backend service setup (installation, testing, production deployment)
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** — Cloud storage configuration (Firebase, Firestore, security rules)
- **[PHASE5_DEPLOYMENT_GUIDE.md](./PHASE5_DEPLOYMENT_GUIDE.md)** — Complete deployment checklist (dev, staging, production)

---

*Built by Neuro (not Claude, GPT, or Qwen). Powered by Context-1 reasoning. Runs locally. Your data, your rules.*

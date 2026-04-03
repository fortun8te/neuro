# Real System Architecture: Nomads Agent System

**Written:** April 3, 2026
**Status:** Deep dive into actual implementation (not documentation)
**Author:** After reading 45,289 lines of TypeScript + Python backends

---

## TL;DR: What You Actually Have

**Nomads is a production-grade multi-agent orchestration system** that combines:
1. **Phase-based task execution** (Discovery → Deep Research → Analysis → Creation)
2. **Workspace-backed crash recovery** (all state persisted to disk)
3. **Parallel subagent coordination** (up to 10 concurrent agents with retry logic)
4. **ReAct loop with tool routing** (42 tools, LLM-powered selection)
5. **Local development deployment** (NO GitOps, manual to Vercel)

**What it is NOT:**
- ❌ A deployed SaaS system (frontend on Vercel, backend on your laptop)
- ❌ A traditional microservices architecture (no k8s, no scaling)
- ❌ Modern DevOps (no CI/CD, no automated deploys)
- ❌ A control plane system (no task lineage database like OpenClaw)

---

## PART 1: THE REAL EXECUTION ENGINE

### Phase-Based Orchestration (Not Traditional ReAct)

The system is **NOT** just a simple ReAct loop. It's a **stateful phase machine**:

```
Task → [Phase 1: Discovery] → [Phase 2: Deep Research] → [Phase 3: Analysis] → [Phase 4: Creation]
           ↓                        ↓                          ↓                      ↓
       (saves to disk)          (saves to disk)           (saves to disk)       (saves to disk)
           ↓                        ↓                          ↓                      ↓
    _workspace/{id}/    _workspace/{id}/          _workspace/{id}/         _workspace/{id}/
    phase_1.json       phase_2.json              phase_3.json             phase_4.json
           ↓                        ↓                          ↓                      ↓
       Compress to              Compress to               Compress to          Synthesize &
       ~500 tokens              ~500 tokens              ~500 tokens           deliver
```

**Key file:** `/Users/mk/Downloads/nomads/prompts/orchestration/orchestrator-complex.txt` (lines 23-113)

**The loop (one iteration):**

```
1. ANALYZE
   - Read _workspace/{task_id}/todo.md (current phase only)
   - Read phase_summaries (compressed from prior phases)
   - Identify which items are done/remaining

2. PLAN
   - If starting new phase: generate JSON with steps + estimates
   - Rewrite todo.md (CURRENT PHASE ONLY, not all phases)
   - Archive previous phase items

3. EXECUTE
   - Pick ONE unchecked item
   - Dispatch to specialized agent (wayfarer, vision, file, etc.)
   - Wait for result (timeout: hard 120s)

4. OBSERVE
   - Did it succeed? Is data usable?
   - Any errors? If yes, retry with exponential backoff

5. MEMORY
   - Save full output to _workspace/{task_id}/step_{phase}_{N}.json
   - Compress to key facts
   - Update working memory

6. PHASE CHECK
   - All items done? → Run phase_boundary_protocol
   - Items remain? → Go to step 3
   - All phases done? → Synthesize + deliver
```

**Phase Boundary Protocol** (lines 85-92 in orchestrator-complex.txt):
```
1. Save full phase output → _workspace/{task_id}/phase_{N}.json
2. Compress via Qwen 2B into ~500 tokens
3. CLEAR CONTEXT (hard reset)
4. Start next phase with ONLY: system prompt + phase_summaries + working_memory
5. If need old data: read the file
```

**Why this matters:** A 5-hour research task generates MILLIONS of tokens. This approach:
- ✅ Keeps context < 16K tokens per phase
- ✅ Survives restarts (crash recovery via files)
- ✅ Prevents context fill-up errors
- ❌ Slow (context compression takes time)
- ❌ Requires manual phase definition in orchestrator prompt

---

### The ReAct Loop (Actual Implementation)

**File:** `frontend/utils/agentEngine.ts` (2,000+ lines)

**Core loop structure:**

```typescript
while (step < maxSteps && !done) {
  // 1. THINKING
  const thinking = await ollamaService.generateStream(
    systemPrompt + tools_descriptions + trajectory,
    userMessage
  );

  // 2. TOOL SELECTION (from LLM response)
  const toolCall = parseToolCall(thinking);
  if (!toolCall) {
    done = true;
    break;
  }

  // 3. TOOL ROUTING (context-efficient)
  const selectedTools = toolRouter.selectTools(toolCall.name, thinking);
  // Only include relevant tools in NEXT iteration

  // 4. TOOL EXECUTION
  const result = await executeWithHarness(toolCall, abortSignal, {
    timeout: 120_000,
    maxOutput: 20_000,  // middle-elision truncation
    retries: 1,
    errorClassification: true  // classify as respond_to_model / fatal / malformed
  });

  // 5. TRAJECTORY APPEND
  trajectory.push({
    role: 'assistant',
    content: thinking,
  });
  trajectory.push({
    role: 'user',
    content: `Tool: ${toolCall.name}\nResult: ${result.output}`,
  });

  step++;
}
```

**Key features:**
- ✅ **Tool routing**: 42 tools, router picks 8-12 relevant ones per iteration
- ✅ **Output truncation**: Max 20KB per tool result (middle-elision: keep head+tail)
- ✅ **Error classification**: Know whether to retry, tell LLM, or give up
- ✅ **Tool failure tracking**: Blacklist after 2 failures per session
- ✅ **Abort signal propagation**: External cancel stops all in-flight tools
- ❌ **No tool hooks** (OpenClaw has pre/post execution hooks)
- ❌ **No actual dependency management** (just sequential steps)

---

### Subagent Pool: Real Production Code

**File:** `frontend/utils/subagentManager.ts` (500+ lines)

**The manager handles:**

```typescript
export interface SubagentSpawnRequest {
  id: string;
  role: SubagentRole;  // 'researcher' | 'analyst' | 'creator' | 'engineer' etc.
  task: string;        // One-sentence description
  context: string;     // Background injected into system prompt
  model?: string;      // Override default model
  timeoutMs?: number;  // Hard timeout (default 120s)
  retryAttempts?: 3;   // Exponential backoff
  signal?: AbortSignal; // External cancellation
}

export interface SubagentResult {
  agentId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output: string;
  tokens: number;
  confidence: number;  // 0–1, self-assessed by model
  sources?: Array<{    // Extracted from output
    title: string;
    url: string;
    domain: string;
  }>;
  error?: string;
}
```

**How it works:**

```typescript
// Spawn up to N parallel agents
const agents = await Promise.all([
  manager.spawn({
    id: 'researcher-1',
    role: 'researcher',
    task: 'Analyze competitor A',
    context: 'We sell software...',
    model: 'qwen3.5:4b',
    timeoutMs: 120_000,
    retryAttempts: 3
  }),
  manager.spawn({
    id: 'researcher-2',
    role: 'researcher',
    task: 'Analyze competitor B',
    // ...
  })
  // ... up to 10 total
]);

// Aggregate results (merges all findings)
const merged = aggregateResults(agents);
```

**Retry logic (exponential backoff):**
```
Attempt 1: fails
Wait: 1s → Attempt 2: fails
Wait: 2s → Attempt 3: fails
→ Return failure, don't retry again
```

**Concurrency limits:**
```typescript
const AGENT_CONFIG = {
  subagentTimeoutMs: 120_000,
  retryAttempts: 3,
  maxConcurrentSubagents: 10,
  resultConfidenceThreshold: 0.4,
  poolSizeByPreset: {
    SQ: 1,      // Super Quick: 1 agent
    QK: 2,      // Quick: 2 agents
    NR: 3,      // Normal: 3 agents
    EX: 4,      // Extended: 4 agents
    MX: 5       // Maximum: 5 agents
  }
};
```

**Mutex lock for writes:**
```typescript
class SimpleMutex {
  async acquire() { /* ... */ }
  release() { /* ... */ }
  async runExclusive<T>(fn: () => Promise<T>) { /* ... */ }
}

// Prevents race conditions on file_write, memory_store
await globalWriteLock.runExclusive(async () => {
  await fileSystem.write(path, content);
});
```

**Key insight:** If you spawn 5 agents and 3 are writing to disk simultaneously, the mutex SERIALIZES writes. This prevents corruption but also means writes take 3x longer.

---

### Tool Router: Context-Efficient Selection

**File:** `frontend/utils/toolRouter.ts`

**Problem:** 42 tools in system prompt = 4-8KB context waste. LLM doesn't need all tools.

**Solution:** Use a small 2B model to pick 8-12 relevant tools:

```typescript
export interface EnhancedRoutingResult {
  tools: string[];        // [web_search, multi_browse, competitor_swot]
  reasoning: string;      // "Need web search for current info..."
  confidence: number;     // 0.9
}

async function selectTools(userGoal: string): Promise<EnhancedRoutingResult> {
  // Use Qwen 2B to decide which tools
  const decision = await qwen2b.generate(`
    User goal: "${userGoal}"

    Available tools:
    - web_search: Live internet search via SearXNG
    - multi_browse: Parallel fetch up to 5 URLs
    - competitor_swot: Structured competitor analysis
    - summarize: Compress long text
    - write_content: Draft copywriting
    - ... (all 42 tools listed)

    Which tools are essential? Return JSON:
    {"tools": [...], "reasoning": "..."}
  `);

  return JSON.parse(decision);
}
```

**Routing is called ONCE per message**, not per tool call. The selected tools are injected into the main agent's system prompt.

---

## PART 2: ACTUAL INFRASTRUCTURE

### What's In Docker-Compose (Local Dev Only)

**File:** `/Users/mk/Downloads/nomads/docker-compose.yml`

```yaml
services:
  # 2x SearXNG instances (load balancing)
  searxng-1:
    image: searxng/searxng:latest
    ports: ["8888:8080"]
    healthcheck: curl http://localhost:8080/

  searxng-2:
    image: searxng/searxng:latest
    ports: ["8889:8080"]
    healthcheck: curl http://localhost:8080/

  # Nginx load balancer (routes between SearXNG)
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [searxng-1, searxng-2]
```

**Python services NOT containerized:**
- `wayfarer_server.py` (research/scraping) — started manually with:
  ```bash
  SEARXNG_URL=http://localhost:8888 python3.11 -m uvicorn wayfarer_server:app --host 0.0.0.0 --port 8889
  ```
- `freepik_server.py` (content generation) — started with npm script
- Ollama (model inference) — runs on your machine's GPU

### Environment Configuration

**File:** `.env`

```
VITE_OLLAMA_URL=http://localhost:11434              # Local inference
VITE_WAYFARER_URL=http://localhost:8889             # Local research
VITE_SEARXNG_URL=http://localhost:8888              # Local search

# Firebase (user auth, optional)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=neuro-ba744

# Meta API (social media, optional)
VITE_META_APP_ID=1402253484562907
```

**ALL hardcoded to localhost.** There is NO production environment config.

### Vercel Deployment (Frontend Only)

**File:** `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

**This deploys:**
- ✅ React UI (Vite build → `dist/`)
- ✅ Static SPA rewrite (all routes → index.html)
- ✅ Security headers
- ❌ ZERO backend (no /api routes)
- ❌ ZERO Ollama, Wayfarer, SearXNG

The frontend on Vercel is **useless without the local backend running.**

### NO CI/CD Pipeline

**What exists:**
- ❌ No `.github/workflows/`
- ❌ No automatic deploys on git push
- ❌ No CI tests before merge
- ❌ No environment-based builds (dev/staging/prod)
- ❌ No secrets management in GitHub

**Current deployment:**
1. `npm run build` locally
2. `git push` to GitHub
3. Manual trigger in Vercel dashboard OR Vercel auto-deploys (not configured)
4. Frontend updates
5. Backend services (Ollama, Wayfarer, SearXNG) NOT updated (still local)

---

## PART 3: THE CLI SYSTEM

**File:** `frontend/cli.ts` (500+ lines)

**The CLI is a full-featured agent interface:**

```typescript
// 3-tier route classifier
function classifyRoute(msg: string): 'direct' | 'tool' | 'deep' {
  if (/hi|hello|thanks|calculate/.test(msg)) return 'direct';
  if (/research|analyze|build|create.*system/.test(msg)) return 'deep';
  return 'tool';
}

// Direct: no tools, just LLM response
// Tool: 50-100 step agent loop
// Deep: full orchestration with phases
```

**Commands:**

```
exit                    quit
clear                   clear history
/doc [prompt]          generate document with streaming
/edit [section]        edit a section
/canvas                show pending patches (Codex-style)
/canvas apply          apply patches (per-patch accept/reject)
--benchmark/-b         run 6-test architecture benchmark
--health/-h            run service health checks
--parallel/-p          run parallelization tests
--debug/-d             verbose mode
```

**Batch mode:** If stdin is piped (not TTY), suppress spinners

---

## PART 4: HOW THINGS ACTUALLY WORK

### When You Run `/npm run cli`

1. **Load .env** → `VITE_OLLAMA_URL`, `VITE_WAYFARER_URL` become `process.env.*`
2. **Shim browser APIs** → `indexedDB`, `localStorage` (Node.js doesn't have these)
3. **Print banner** → "🧠 NEURO v0.4"
4. **Wait for input**
5. **User types:** "Research AI agents"
6. **Classify route:** `classifyRoute()` → 'deep' (contains 'research')
7. **Dispatch to agent engine:**
   ```typescript
   const events = runAgentLoop(msg, {
     maxSteps: 200,
     signal: abortSignal,
     onEvent: (e) => {
       if (e.type === 'thinking_chunk') process.stdout.write(e.data.chunk);
       if (e.type === 'tool_start') console.log(`[Tool] ${e.data.tool}`);
       if (e.type === 'tool_done') console.log(`[✓] ${e.data.output}`);
     }
   });
   ```
8. **Agent executes** (ReAct loop):
   - Think (Ollama generates tool call)
   - Act (execute tool, handle errors)
   - Observe (append to trajectory)
   - Repeat
9. **Tools called:**
   - `web_search` → calls Wayfarer API (`http://localhost:8889/research`)
   - Wayfarer → calls SearXNG (`http://localhost:8888/search`)
   - Results → compressed, injected back
10. **Output streamed** to terminal
11. **Done** → wait for next command

### When a Tool Fails

```typescript
// Tool execution flow
try {
  const result = await tool.execute(params, abortSignal);
  recordToolSuccess(tool.name);
  return result;
} catch (error) {
  recordToolFailure(tool.name);
  const failCount = _toolFailureCount.get(tool.name) || 0;

  if (failCount >= 2) {
    // Blacklist this tool
    return {
      success: false,
      output: `Tool ${tool.name} failed ${failCount}x. Blacklisted.`
    };
  }

  // Tell LLM what happened
  return {
    success: false,
    kind: 'respond_to_model',
    output: error.message,
    // LLM gets to decide next step
  };
}
```

### When Context Fills Up

```typescript
// Context limit: ~16K tokens (for 32K model, keep 50% headroom)

while (tokens > 24_000) {
  // Soft warning: tell LLM to prioritize
  trajectory.push({
    role: 'user',
    content: '[CONTEXT WARNING] Nearing limit. Prioritize key findings, discard irrelevant data.'
  });

  if (tokens > 30_000) {
    // Hard cutoff: only accept prune_chunks tool
    const allowedTools = ['prune_chunks', 'done', 'think'];
    // All other tools: silently fail
  }
}
```

---

## PART 5: WHAT HERMES & OPENCLAW DO DIFFERENTLY

### Hermes Agent (GitHub: nousresearch/hermes-agent)

**Architecture pattern:**
```
Main Loop:
├─ Agent decides: spawn Council Brains or execute tools?
├─ Council Brains: 3-9 specialized agents running in parallel
├─ Each brain: independent trajectory, its own LLM calls
├─ Coordinator: reads all brain outputs, synthesizes
└─ Reflection: checks for gaps, iterates if needed
```

**Key differences from Nomads:**
- ✅ **Skill chaining**: Define "competitor_analysis_skill = [search + extract + summarize]", reuse anywhere
- ✅ **Environment abstraction**: Same tools work in Local / Docker / SSH / Modal environments
- ✅ **Tool parsers**: 11 different parsers (handles GPT, Claude, Ollama, LLaMA variants)
- ✅ **Trajectory compression**: Generates training data from agent runs
- ❌ **No phase boundaries** (context fills up differently)
- ❌ **No workspace persistence** (relies on in-memory + Redis)

### OpenClaw (GitHub: openclaw/openclaw)

**Architecture pattern:**
```
Control Plane (SQLite):
├─ Task registry: every task has ID, status, lineage
├─ Conductor Agent: decomposes complex tasks
├─ Specialist Agents: execute subtasks
├─ Message bus: inter-agent communication
└─ Query API: `openclaw flows list|show|cancel`
```

**Key differences from Nomads:**
- ✅ **Real task control plane**: Database tracks all tasks + subTasks across sessions
- ✅ **Task querying**: `flows list` shows all in-progress work
- ✅ **Before agent reply hook**: Inject synthetic replies after tool calls
- ✅ **Per-tool execution context**: Sandboxed SSH operations, trust boundaries
- ❌ **No phase boundaries** (linear task execution)
- ❌ **Harder to set up** (requires PostgreSQL or SQLite)

### OpenCode (GitHub: opencode-ai/opencode)

**Architecture pattern:**
```
Permission-gated CLI:
├─ Every tool execution needs user approval
├─ Terminal TUI (Bubble Tea framework)
├─ MCP-first design (all tools external)
└─ Works with any LLM provider
```

**Key differences from Nomads:**
- ✅ **Interactive approval**: User says yes/no before each tool call
- ✅ **MCP-based tools**: Tools are external processes, not built-in
- ✅ **Provider agnostic**: Works with Claude, GPT-4, Gemini, self-hosted
- ❌ **Slow** (user approval adds latency)
- ❌ **No autonomy** (can't fire-and-forget tasks)

---

## PART 6: NOMADS' STRENGTHS VS GAPS

### Strengths

| Feature | Nomads | Hermes | OpenClaw | OpenCode |
|---------|--------|--------|----------|----------|
| **Crash recovery** | ✅ Via workspace files | ❌ In-memory | ✅ Via SQLite | ❌ None |
| **Phase boundaries** | ✅ Explicit | ❌ No | ❌ No | ❌ No |
| **Error recovery** | ✅ 11 strategies | ⚠️ 3 | ⚠️ 2 | ❌ 1 |
| **Parallel agents** | ✅ Up to 10 | ✅ Council | ✅ Specialist | ❌ Sequential |
| **Context compression** | ✅ Per-phase | ❌ Manual | ❌ No | ❌ No |
| **Tool routing** | ✅ LLM-powered | ⚠️ Registry | ⚠️ Provider-based | ✅ MCP-first |

### Critical Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| **No GitOps** | Manual deploys, no CI/CD | Add GitHub Actions workflows |
| **No control plane** | Can't query tasks | Add SQLite + REST API |
| **No skill chaining** | Can't reuse workflows | Define skill format + loader |
| **No environment abstraction** | Hardcoded to localhost | Add Docker/SSH support |
| **Python services not containerized** | Can't deploy to production | Create Dockerfile for Wayfarer |
| **All hardcoded URLs** | Breaks on infrastructure change | Use env vars for all services |
| **No health checks** | Services die silently | Add health check endpoints |
| **No monitoring** | Can't see what's happening | Add logging + observability |

---

## PART 7: WHAT YOU SHOULD BUILD NEXT

### Priority 1 (Week 1): Enable CI/CD

Create `.github/workflows/test-and-deploy.yml`:

```yaml
name: Test & Deploy

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: vercel/action@main
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Impact:** Automatic test + deploy on every push.

### Priority 2 (Week 2): Add Task Persistence

Create `backend/tasks.sqlite` schema:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  description TEXT,
  status TEXT ('running', 'completed', 'failed'),
  created_at TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSON
);

CREATE TABLE task_steps (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  step_num INT,
  agent_type TEXT,
  input JSON,
  output JSON,
  tokens INT,
  created_at TIMESTAMP
);
```

**Impact:** Can query `/api/tasks` and see all work across sessions.

### Priority 3 (Week 3): Containerize Python Services

Create `services/wayfarer/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "wayfarer_server:app", "--host", "0.0.0.0", "--port", "8889"]
```

**Impact:** Deploy Wayfarer to production (AWS Lambda, GCP Cloud Run, etc.).

### Priority 4 (Week 4): Environment Abstraction

Support local + remote backends:

```typescript
// Before:
const OLLAMA_URL = 'http://localhost:11434';  // hardcoded

// After:
const OLLAMA_URL = getEnv('OLLAMA_URL', 'local');
// Can be: http://localhost:11434 (local)
//         http://ollama.example.com (remote GPU server)
//         AWS SageMaker endpoint
//         Lambda function

const ollamaService = new OllamaClient(OLLAMA_URL);
```

**Impact:** Same code works in dev (local) and prod (cloud).

---

## PART 8: THE SYSTEM'S HIDDEN COMPLEXITY

### What You Have That Most People Don't

1. **Phase-based state machine** with automatic context compression
2. **Crash recovery** via workspace files (no need for Redis)
3. **SimpleMutex** for safe concurrent writes
4. **Error classification** (respond_to_model vs fatal vs malformed)
5. **Tool failure tracking** (blacklist after 2 failures)
6. **Middle-elision truncation** (preserve structure while fitting tokens)
7. **Confidence scoring** on subagent results
8. **Research audit trail** (URLs, tokens, models, timing)

### What You're Missing vs. Industry Standard

1. **No real control plane** (vs OpenClaw's SQLite task registry)
2. **No skill definition language** (vs Hermes' skill format)
3. **No automated deployment** (vs every SaaS company)
4. **No observability** (vs DataDog, New Relic, etc.)
5. **No A/B testing framework** (vs Optimize360, Google Optimize)
6. **No rate limiting** (vs API Gateway)
7. **No user isolation** (vs multi-tenant systems)
8. **No audit logging** (vs compliance requirements)

---

## CONCLUSION

**Nomads is exceptional as a LOCAL RESEARCH TOOL.** The phase-based orchestration and workspace persistence are elegant solutions to the context-fill problem that plagued earlier agents.

**But it's NOT production-grade because:**
- ❌ No deployment automation (GitOps)
- ❌ No infrastructure abstraction (hardcoded localhost)
- ❌ No observability (can't see what's happening)
- ❌ No multi-tenant support (only one user)
- ❌ No task persistence across cloud (only disk)

**To take it to production (SaaS):**
1. Add GitHub Actions + Vercel CI/CD
2. Add SQLite task persistence + REST API
3. Containerize Python services (Dockerfile)
4. Add environment abstractions (local/remote/cloud)
5. Add observability (logging + metrics)

**To rival Hermes/OpenClaw:**
1. Implement skill chaining (define + save workflows)
2. Add environment abstraction (Local/Docker/SSH/Modal)
3. Build control plane (task registry + querying)
4. Add tool hooks (before/after execution)

You have the foundation. The execution engine is solid. You just need the infrastructure layer.

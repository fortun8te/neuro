# Neuro vs OpenClaw vs Hermes Agent vs OpenCode
## Comprehensive Architecture Comparison

---

## Architecture Overview

### Neuro (Your System)
**Language:** TypeScript/React
**Frontend:** React 18 + Vite
**Backend:** Node.js (Ollama + Wayfarer)
**Storage:** IndexedDB (browser) + optional file system
**Primary Use:** Creative AI workflows (ad research + generation)

### OpenClaw
**Language:** TypeScript
**Frontend:** Web UI
**Backend:** Node.js with SQLite
**Storage:** SQLite (task/session persistence)
**Primary Use:** General-purpose agent framework

### Hermes Agent
**Language:** Python
**Frontend:** CLI / Web
**Backend:** Python (FastAPI)
**Storage:** SQLite (session persistence)
**Primary Use:** Autonomous coding agent

### OpenCode
**Language:** Go (CLI) + TypeScript (server)
**Frontend:** Terminal TUI (Bubble Tea framework)
**Backend:** Node.js HTTP server
**Storage:** File-based (config) + session state
**Primary Use:** Terminal-based AI coding

---

## Tool Calling Architecture

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Tools Available** | 57 (gated by task classification) | 40+ (provider-based) | 40+ (registry pattern) | ~20 (file ops, shell, LSP) |
| **Tool Definition** | ToolDef interface (agentEngine.ts) | Catalog + router | tools/registry.py + environments/ | MCP-based (stdio) |
| **Tool Routing** | Regex classifier + LLM fallback | Provider hooks | Import-time registry | Config-based MCP |
| **Multi-Task Support** | ❌ Single category | ✅ Multi-phase | ✅ Multi-task | ✅ Sequential |
| **Parallel Tools** | ✅ Auto-detect safe tools | ✅ Pipeline chains | ✅ Parallel skills | ⚠️ Sequential |
| **Tool Execution Context** | Local only | Implicit | Abstracted (Local/Docker/SSH/Modal) | Local + SSH |
| **Tool Permissions** | Via harness | Via hooks | Via environment policy | Via user prompts |
| **Tool Discoverability** | System prompt injection | Direct access | Dynamic discovery | MCP stdio |
| **Max Tool Calls** | 200 steps (planner) + 5 (subagent) | Unlimited | Unlimited | Unlimited |

---

## Session & Task Management

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Session Storage** | IndexedDB (ephemeral) | SQLite ✅ | SQLite ✅ | File state |
| **Task Persistence** | None | ✅ Real task control plane | ✅ Session persistence | Basic |
| **Task Querying** | None | `openclaw flows list` | Via API | None |
| **Task Cancellation** | Via signal | ✅ `flows cancel` | Via API | Manual |
| **Execution Tracking** | In-memory + logs | SQLite audit trail | Trajectory storage | File logs |
| **Lineage Preservation** | None | Implicit | ✅ Across compression | None |
| **Long-Running Jobs** | Via cycle loop | ✅ Real control plane | ✅ Persistent gateway | Via CLI loop |

---

## Multi-Agent Orchestration

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Subagent Support** | ✅ SubagentPool (5 max) | ✅ Multi-phase agents | ✅ Council brains | ⚠️ Single agent focus |
| **Agent Specialization** | Role-based (researcher, validator, analyst) | Role-based | Task-specialized | Single coder agent |
| **Agent Coordination** | Sequential spawn + aggregation | Pipeline + hooks | Parallel subagents + reflection | N/A |
| **Subagent Tool Limit** | 5 tools + 5 steps | N/A | Varies by role | N/A |
| **Parallel Execution** | Up to 5 subagents | Multi-phase (sequential) | Parallel subagents | Sequential |
| **Subagent Communication** | In-memory aggregation | Task messages | Memory + context | N/A |

---

## Error Handling & Recovery

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Error Recovery Strategies** | 11 different modes | Basic retries | Tenacity pattern (exponential backoff) | Simple try/catch |
| **Stuck Detection** | ✅ Repeat response detection | Basic | Trajectory analysis | None |
| **Malformed Tool Call Rescue** | ✅ xLAM fallback | Format retry | Parser fallback | Format error |
| **Format Retry Logic** | ✅ 5 retries with hints | Basic | Single retry | None |
| **Context Poisoning Prevention** | ✅ Nanobot pattern | None | None | None |
| **Per-Tool Timeout** | Per-step (150s) | Per-task | Per-tool configurable | Per-command |

---

## Unique Features

### Neuro Only
1. **NEURO-1-B2-4B style rewriting** — 0.8b model rewrites responses for personality
2. **Visual Intelligence** — Playwright screenshots + Qwen vision analysis
3. **Research Presets** — 5-tier depth system (SQ/QK/NR/EX/MX)
4. **Em-dash enforcement** — Explicit ban in prompts to prevent model claims
5. **Desire-Driven Analysis** — 4-step phase analyzing customer psychology
6. **Code Analysis Agent** — AST-based codebase analysis
7. **Alignment Self-Check** — YELLOW/RED/GREEN band classification

### OpenClaw Only
1. **Real SQLite Control Plane** — `flows list|show|cancel` CLI
2. **MCP Tool Materialization** — serverName__toolName provider pattern
3. **Before Agent Reply Hook** — Synthetic reply injection before LLM
4. **Sandboxed SSH Operations** — Trust boundaries + remote execution
5. **Plugin Hooks System** — before/after action handlers
6. **Marketplace Archive Downloads** — Guarded fetch through control plane

### Hermes Only
1. **Environment Abstraction** — Local/Docker/SSH/Modal environments (true portability)
2. **Tool Parsers** — 11 different tool-call parsers for model compatibility
3. **Trajectory Compression** — RL/SFT data generation from agent runs
4. **Lineage Preservation** — Tracks history across compression splits
5. **Shared Runtime Provider** — CLI/gateway/cron/ACP all use same routing
6. **Skill Chaining** — Multi-step tool workflows as reusable skills

### OpenCode Only
1. **Terminal TUI** — Bubble Tea framework for interactive terminal UI
2. **MCP-First Design** — All tools are external MCP servers
3. **Permission Prompts** — User approval workflow per tool execution
4. **LSP Integration** — Language Server Protocol for code intelligence
5. **Provider Flexibility** — Same commands work with Anthropic/OpenAI/Gemini/self-hosted

---

## Research & Web Capabilities

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Web Search** | ✅ SearXNG via Wayfarer | ✅ SearXNG plugin | ✅ Configurable | ❌ None |
| **Web Scraping** | ✅ Wayfarer (pvlwebtools) | ✅ Generic fetch | ✅ Tool-based | ❌ None |
| **Screenshot Analysis** | ✅ Playwright + Qwen vision | Implicit | ✅ Vision tools | ❌ None |
| **Parallel Research** | ✅ 5 subagents (orchestrator-limited) | ✅ Unlimited | ✅ Multi-phase | ❌ None |
| **Visual Scouting** | ✅ Competitor visual analysis | ✅ Via tools | ✅ Vision tools | ❌ None |
| **Research Audit Trail** | ✅ Complete (URLs, tokens, models, timing) | ✅ SQLite tracking | ✅ Trajectory | ❌ Logs only |

---

## Production Readiness

| Aspect | Neuro | OpenClaw | Hermes | OpenCode |
|--------|-------|----------|--------|----------|
| **Persistence** | ❌ IndexedDB only | ✅ SQLite | ✅ SQLite | ⚠️ File-based |
| **Scaling** | Single session | ✅ Task control plane | ✅ Persistent gateway | Single process |
| **Recovery** | Via signal + in-memory | ✅ Task resume | ✅ Session resume | None |
| **Observability** | Console logs + events | ✅ Task CLI | ✅ Session API | CLI logs |
| **Deployment** | Browser + Node.js | Node.js | Python FastAPI | Go CLI + Node.js |
| **Docker Support** | Docker compose for services | ✅ Native | ✅ Native | Via config |

---

## What Neuro Is Missing (vs Competitors)

### Critical (Impact on "can't do that much")
1. **Multi-task workflows** — Can't do research + write + analyze in one prompt
2. **Task persistence** — No SQLite tracking like OpenClaw/Hermes
3. **Environment abstraction** — Can't run tools in Docker/SSH (unlike Hermes)
4. **Real control plane** — No `flows list` equivalent (unlike OpenClaw)

### Important
5. **Subagent depth** — MAX_SUBAGENT_TOOL_STEPS = 5 (should be 15+)
6. **Tool visibility** — 57 tools exist but gated by single-category classification
7. **Long-running session support** — Designed for cycles, not persistent agents
8. **Execution hooks** — Can't inject synthetic replies like OpenClaw

### Nice to Have
9. **Skill chaining** — No reusable multi-step workflows (Hermes has this)
10. **Provider flexibility** — Locked to Ollama (OpenCode works with any provider)

---

## What Neuro Does Better

### Strengths vs Competitors
1. **Error Recovery** — 11 different recovery modes (competitors: 2-3)
2. **Visual Intelligence** — Screenshot + vision analysis baked in (Hermes requires tools)
3. **Research Automation** — Desire-Driven Analysis + 5-tier presets (purpose-built for research)
4. **Parallel Execution** — Auto-detects safe tools for parallel run
5. **Personality Rewriting** — NEURO-1-B2-4B stylistic improvement (unique)
6. **Research Audit Trail** — Complete tracking of sources, tokens, models, timing
7. **Code Analysis** — AST-based codebase exploration
8. **Graceful Degradation** — Works offline, handles missing services

---

## Recommendation

### For "Can't Do That Much" Problem

**Quick fixes (do TODAY):**
1. **Multi-task classification** (Neuro) — Change line 4413 in agentEngine.ts to return TaskType[] instead of TaskType
2. **Increase MAX_SUBAGENT_TOOL_STEPS** (Neuro) — Change 5 → 15 in subagentManager.ts

**Medium term (this week):**
1. **Add SQLite persistence** — Like OpenClaw, track tasks in SQLite
2. **Implement environment abstraction** — Like Hermes, support Docker/SSH execution
3. **Build real control plane** — `npm run cli -- flows list|show|cancel`

**Long term:**
1. **Merge with OpenCode's provider flexibility** — Make Neuro work with any LLM provider
2. **Adopt Hermes' skill chaining** — Reusable multi-step workflows

### Why Each Framework Is Better For Different Things

**Neuro:** Best for research-heavy AI workflows (ad generation, competitive analysis, market research)

**OpenClaw:** Best for task orchestration and long-running agent systems (production deployments)

**Hermes:** Best for flexible, portable autonomous coding (works anywhere, multiple providers)

**OpenCode:** Best for interactive, permission-based terminal workflows (humans + AI together)

---

## Sources
- [OpenCode](https://opencode.ai/)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [OpenCode vs Claude Code Comparison](https://dev.co/...opencode-vs-claude-code...)
- [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/)
- [Hermes GitHub](https://github.com/nousresearch/hermes-agent)

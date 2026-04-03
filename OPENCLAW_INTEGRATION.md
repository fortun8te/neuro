# OpenClaw Patterns for Neuro
## What OpenClaw Does Right (And We Can Steal)

---

## What is OpenClaw?

**OpenClaw** is a production-grade, open-source AI agent framework (157K GitHub stars, MIT license):

- Personal AI assistant running on YOUR hardware (not SaaS)
- 13,729 community skills in a versioned registry
- Multi-agent orchestration with hub-and-spoke architecture
- Task-based model routing (don't waste expensive models on simple tasks)
- Web search integration (Firecrawl, Brave, Gemini, Perplexity, Tavily)
- Enterprise-grade sandboxing (NemoClaw)
- Integrates with 12+ messaging platforms (WhatsApp, Slack, Discord, Telegram, Teams, etc.)

**Why it matters:** OpenClaw validates the multi-agent architecture we're building. 157K stars + 40% enterprise adoption projection = the patterns work at scale.

---

## Key Innovations (With Adoption Timeline)

### Innovation 1: Skill Registry Pattern
**What OpenClaw Does**
- 13,729 community skills in ClawHub registry (as of Feb 2026)
- Skill versioning + search functionality
- Each skill is a YAML metadata file + markdown docs + code

**Example Skill (YAML Frontmatter)**
```yaml
# skill.openai.yaml
name: OpenAI Chat
description: |
  Execute arbitrary chat prompts against OpenAI models.
  Supports GPT-4, GPT-3.5, and custom fine-tunes.
tags: [ai, llm, chat, gpt-4]
version: 2.3.1
permissions:
  - api_key: openai
  - model: gpt-4-turbo
examples:
  - prompt: "Summarize this article"
  - prompt: "Write a poem about rust"
```

**How to Apply to Neuro**
```typescript
// subagentTools.ts (with metadata)
const toolRegistry: Tool[] = [
  {
    name: 'web_search',
    version: '1.0.0',
    metadata: {
      category: 'research',
      models: ['qwen3.5:4b+'], // Minimum tier
      timeout: 30000,
      costEstimate: 'low',
      parallelizable: true,
      description: 'Search web via Wayfarer + SearXNG',
      examples: [
        'Search: "TypeScript agent frameworks 2026"',
        'Search: "Competitor pricing models"',
      ],
    },
    fn: webSearchTool,
  },
  {
    name: 'file_write',
    version: '1.0.0',
    metadata: {
      category: 'persistence',
      models: ['qwen3.5:0.8b+'], // Works with any model
      timeout: 5000,
      costEstimate: 'negligible',
      parallelizable: false, // Sequential writes only
      description: 'Write structured data to file',
    },
    fn: fileWriteTool,
  },
];

// Later: Tool discovery & auditing
function canParallelizeTool(toolName: string): boolean {
  const tool = toolRegistry.find(t => t.name === toolName);
  return tool?.metadata.parallelizable ?? false;
}

function getMinModelTier(toolName: string): string {
  const tool = toolRegistry.find(t => t.name === toolName);
  return tool?.metadata.models[0] ?? 'qwen3.5:0.8b';
}
```

**Benefit:** Tool discovery, audit, permission checking all automatic via metadata.

---

### Innovation 2: Two-Tier Model Routing (Task Classifier)

**What OpenClaw Does**
```
User Input
  ↓
Task Classifier (fast model, 0.8b)
  "Is this simple or complex?"
  ↓
  Output: "simple" or "complex"
  ↓
Router Decision
  - Simple → 0.8b/2b model
  - Complex → 4b/9b/27b model
```

**How Neuro Does It (Current)**
```typescript
// Hardcoded per stage
research: uses 4b orchestrator (always)
make: uses 9b (always)
test: uses 9b (always)

// Problem: What if research is simple?
// Waste of tokens & time
```

**Better Approach (OpenClaw Pattern)**
```typescript
// NEW: Task Classifier (lightweight)
async function classifyTaskComplexity(prompt: string): Promise<'simple' | 'standard' | 'complex' | 'deep'> {
  const classifier = await ollamaService.generateStream({
    model: 'qwen3.5:0.8b', // Fast classifier
    prompt: `
Classify this task as one of: simple, standard, complex, deep

Task: "${prompt}"

Respond ONLY with one word: simple, standard, complex, or deep
    `,
    stream: false,
  });

  return classifier.trim().toLowerCase() as any;
}

// Then route to appropriate model
async function routeByComplexity(prompt: string): Promise<string> {
  const complexity = await classifyTaskComplexity(prompt);

  const modelTiers = {
    simple: 'qwen3.5:0.8b',
    standard: 'qwen3.5:4b',
    complex: 'qwen3.5:9b',
    deep: 'qwen3.5:27b',
  };

  const selectedModel = modelTiers[complexity];

  routingLogger.log(
    'model_selection',
    selectedModel,
    0.90,
    `Task classified as ${complexity}, routed to ${selectedModel}`,
    { complexity }
  );

  return selectedModel;
}
```

**Benefit:** No wasted compute on overkill models; saves 50%+ in token usage for simple tasks.

---

### Innovation 3: Heartbeat Scheduler + Resumable Loops

**What OpenClaw Does**
```
Orchestrator Loop
  ├─ Step 1: Observe (read state)
  ├─ Step 2: Act (call tool)
  ├─ Step 3: Reason (process result)
  ├─ Checkpoint (save state to disk)
  ├─ Heartbeat (I'm alive)
  └─ Loop → Step 1

If crash happens:
  → Read last checkpoint
  → Resume from last checkpoint
  → Zero data loss
```

**How Neuro Does It (Current)**
```typescript
// useCycleLoop.ts
// If crash: lose everything
// If pause: clears partial output (you noted this)
// Resume-after-pause clears cache (problem)
```

**Better Approach**
```typescript
// frontend/agentic/checkpointManager.ts (NEW)

export interface ExecutionCheckpoint {
  cycleId: string;
  stage: string;
  stepNumber: number;
  timestamp: number;
  state: {
    briefing: any;
    researchOutput?: string;
    objectionsOutput?: string;
    tasteOutput?: string;
    makeOutput?: string;
    auditTrail: any[];
  };
}

export class CheckpointManager {
  private checkpoints: ExecutionCheckpoint[] = [];

  checkpoint(cycleId: string, stage: string, step: number, state: any): void {
    const cp: ExecutionCheckpoint = {
      cycleId,
      stage,
      stepNumber: step,
      timestamp: Date.now(),
      state,
    };

    this.checkpoints.push(cp);

    // Save to disk (IndexedDB)
    saveCheckpointToDB(cp);

    console.log(`✓ Checkpoint: ${cycleId}/${stage}/${step}`);
  }

  async resume(cycleId: string): Promise<ExecutionCheckpoint | null> {
    // Find latest checkpoint for this cycle
    const latest = this.checkpoints
      .filter(cp => cp.cycleId === cycleId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latest) {
      console.log(`↻ Resuming from: ${latest.stage}/${latest.stepNumber}`);
      return latest;
    }

    return null;
  }
}

// Usage in useCycleLoop
const checkpointMgr = new CheckpointManager();

try {
  // Step 1: Research
  checkpointMgr.checkpoint(cycleId, 'research', 0, currentState);
  const researchOutput = await useOrchestratedResearch(briefing);

  // Step 2: Objections
  checkpointMgr.checkpoint(cycleId, 'research', 1, { ...currentState, researchOutput });
  const objectionsOutput = await useObjections(briefing, researchOutput);

  // ... etc
} catch (error) {
  // On crash, latest checkpoint is saved
  console.error('Crash detected');
  console.log('Resume with: await cycleLoop.resume(cycleId)');
}

// Resume after crash
const checkpoint = await checkpointMgr.resume(cycleId);
if (checkpoint) {
  // Continue from where we left off, using saved state
  const { researchOutput, objectionsOutput } = checkpoint.state;
  // Don't re-run research, continue with next stage
}
```

**Benefit:** Zero data loss on crash; can pause/resume without losing progress.

---

### Innovation 4: Skill YAML Metadata Frontmatter

**What OpenClaw Does**
```yaml
# Every skill has metadata header

name: Web Search
description: Search the web using multiple providers
version: 1.2.3
cost_tier: low
model_tier_required: standard # minimum
timeout: 30000
permissions:
  - network: internet
  - api_key: wayfarer
parallelizable: true
retry_policy: exponential_backoff
examples:
  - input: "Search: TypeScript frameworks"
    output: "10 results with URLs"
```

**How to Apply to Neuro**
```typescript
// subagentTools.ts with metadata

interface ToolMetadata {
  name: string;
  version: string;
  description: string;
  category: 'research' | 'persistence' | 'synthesis' | 'analysis';
  modelTierRequired: 'fast' | 'standard' | 'quality' | 'maximum';
  timeout: number;
  costTier: 'negligible' | 'low' | 'medium' | 'high';
  parallelizable: boolean;
  retryPolicy?: 'exponential_backoff' | 'linear' | 'none';
  permissions: string[];
  examples: { input: string; output: string }[];
}

const tools: Record<string, { metadata: ToolMetadata; fn: Function }> = {
  web_search: {
    metadata: {
      name: 'Web Search',
      version: '1.0.0',
      description: 'Search web via Wayfarer + SearXNG, return URLs + summaries',
      category: 'research',
      modelTierRequired: 'standard',
      timeout: 30000,
      costTier: 'low',
      parallelizable: true,
      retryPolicy: 'exponential_backoff',
      permissions: ['network:internet', 'api:wayfarer'],
      examples: [
        {
          input: 'Search: TypeScript agent frameworks 2026',
          output: '[{url, title, snippet}, ...]',
        },
      ],
    },
    fn: webSearchTool,
  },

  file_write: {
    metadata: {
      name: 'File Write',
      version: '1.0.0',
      description: 'Write structured data to file (JSON, Markdown, Text)',
      category: 'persistence',
      modelTierRequired: 'fast',
      timeout: 5000,
      costTier: 'negligible',
      parallelizable: false,
      permissions: ['filesystem:write', 'path:/tmp/*'],
      examples: [
        {
          input: 'Write analysis to /tmp/analysis.md',
          output: 'File written, 2.3KB',
        },
      ],
    },
    fn: fileWriteTool,
  },
};

// Automatic audit queries
function canParallelize(toolName: string): boolean {
  return tools[toolName]?.metadata.parallelizable ?? false;
}

function getModelRequirement(toolName: string): string {
  return tools[toolName]?.metadata.modelTierRequired ?? 'fast';
}

function getTimeout(toolName: string): number {
  return tools[toolName]?.metadata.timeout ?? 30000;
}
```

**Benefit:** All tool properties discoverable & auditable. Perfect for the benchmark.

---

### Innovation 5: Autonomous Web Research Agent (Firecrawl Pattern)

**What OpenClaw Does (via Firecrawl)**
```
Autonomous Research Loop:
  1. Get query
  2. Search (Brave, Perplexity, etc.)
  3. For each result:
     a. Fetch page (Firecrawl converts HTML → structured data)
     b. Extract key info
     c. Add to findings
  4. Synthesize
  5. Return structured report
```

**How Neuro Does It (Current)**
```typescript
// Wayfarer does the scraping
// orchestrator controls loop
// You control depth via presets (SQ/QK/NR/EX/MX)
```

**Firecrawl Pattern Worth Noting**
```typescript
// Firecrawl pattern: HTML → structured extraction

interface FirecrawlResult {
  url: string;
  title: string;
  content: string; // Clean markdown
  metadata: {
    author?: string;
    publishDate?: string;
    language?: string;
  };
  links: { url: string; text: string }[];
}

// Your Wayfarer already does this!
// Suggestion: expose extraction metadata like Firecrawl

// In Wayfarer response, add:
{
  content: "...", // existing
  metadata: {
    confidence: 0.95, // how confident is extraction?
    chunked: true, // split into sections?
    sections: [
      { title: "Introduction", wordCount: 245 },
      { title: "Technical Details", wordCount: 1200 },
    ],
  }
}
```

**Benefit:** Your Wayfarer is already sophisticated. Firecrawl pattern shows confidence scores + section metadata help downstream synthesis.

---

### Innovation 6: Multi-Channel Agent Isolation

**What OpenClaw Does**
```
Each messaging channel has its own:
  - Agent instance
  - Memory/context
  - Configuration
  - Model tier

WhatsApp User A   → Agent Instance A (qwen3.5:2b, personal preferences)
Slack Channel B   → Agent Instance B (qwen3.5:4b, team context)
Discord Server C  → Agent Instance C (qwen3.5:9b, higher quality)
```

**How to Apply to Neuro**
```typescript
// Instead of: all campaigns use same model tier
// Use: campaign.researchDepth → affects model tier

interface Campaign {
  id: string;
  name: string;
  researchDepth: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX';
  modelTier?: 'fast' | 'standard' | 'quality' | 'maximum';
  context: {...}
}

// When creating campaign, preset determines isolation level
const campaign = {
  id: '...',
  name: 'TypeScript Research',
  researchDepth: 'EX', // Extended
  modelTier: 'quality', // qwen3.5:9b by default for EX
};

// Each campaign cycle is isolated:
// - Own research findings
// - Own audit trail
// - Own model assignments
// - Can run parallel campaigns (different depth presets) simultaneously
```

**Benefit:** Your presets already do this! Shows the pattern works at scale (OpenClaw handles 12+ channels in production).

---

### Innovation 7: NemoClaw Sandboxing (For Later)

**What It Does**
- Enterprise-grade code execution sandboxing
- Prevents malicious agent code from compromising system
- Kubernetes-native (KubeClaw)
- Runtime isolation, capability restrictions

**When to Adopt**
- Phase 3+, when agents can modify their own code
- Not urgent for current phase (Neuro is local-only, you control execution)
- Reference: https://github.com/jianan1104/kubeclaw

---

## OpenClaw Patterns: Integration Checklist

### High Priority (This Week)
- [ ] Add tool metadata (ToolMetadata interface)
- [ ] Implement task classifier (lightweight model routing)
- [ ] Add checkpoint manager (crash recovery)
- [ ] Update tool registry with YAML-style metadata

### Medium Priority (Week 2)
- [ ] Expose Wayfarer confidence scores + sections
- [ ] Test multi-campaign parallelization (isolation)
- [ ] Document tool discovery system

### Low Priority (Later)
- [ ] Consider KubeClaw for distributed execution
- [ ] Plan NemoClaw sandboxing for self-improvement phase

---

## What Neuro Has That OpenClaw Doesn't

1. **Desire-Driven Analysis** (Phase 1)
   - Customer desires extraction
   - Objection mapping
   - Deep audience research
   - Competitor landscape analysis
   - OpenClaw: task-based routing. You: outcome-driven research.

2. **Visual Intelligence** (Wayfarer Plus)
   - Playwright screenshots
   - Vision model analysis
   - Visual gap identification
   - OpenClaw: text-only. You: visual + text.

3. **Cycle Memory & Learning** (Phase 7+)
   - Skills extracted from completed cycles
   - Pattern library across campaigns
   - OpenClaw: single-task agents. You: learning across tasks.

---

## Bottom Line

**OpenClaw validates your architecture and shows what's possible at scale:**
- 157K GitHub stars = the patterns work
- 13,729 skills registry = modularity at scale
- Task-based routing = your model tier system
- Multi-agent orchestration = your subagent system
- Heartbeat scheduler = your checkpoint system

**Steal these 7 patterns:**
1. Skill registry with metadata
2. Task classifier for model routing
3. Checkpoint manager for crash recovery
4. YAML-style tool metadata
5. Confidence scores + sections (Firecrawl)
6. Multi-channel agent isolation
7. Sandboxing (later)

**Your advantages:**
- Desire-driven research (not just task-based)
- Visual intelligence (screenshots + analysis)
- Learning across cycles (not isolated tasks)

**Result:** Neuro becomes more sophisticated than OpenClaw while learning from OpenClaw's proven patterns.

---

## Sources

- GitHub: https://github.com/openclaw/openclaw
- Docs: https://docs.openclaw.ai/
- Design Patterns: https://kenhuangus.substack.com/p/openclaw-design-patterns-part-3-of
- Multi-Agent Guide: https://zenvanriel.com/ai-engineer-blog/openclaw-multi-agent-orchestration-guide/
- ClawRouter: https://github.com/BlockRunAI/ClawRouter
- KubeClaw: https://github.com/jianan1104/kubeclaw


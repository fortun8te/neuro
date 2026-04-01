# Complete Implementation Details: What We Need From Each Repo

## Repo 1: Anthropic SDK — Streaming Architecture

### What We Need:
1. **Streaming Response Handler**
   - File: `src/utils/streaming.ts` (NEW)
   - Implement partial JSON snapshot streaming
   - Callback on each chunk: `onChunk(text, snapshot)`
   - Handle: text, tool_calls, thinking_tokens

2. **Type Definitions**
   - `StreamEvent` type with: `type`, `timestamp`, `chunk`, `snapshot`
   - `StreamCallback` type: `(event: StreamEvent) => void`

3. **Integration Points**
   - Modify: `useCycleLoop.ts` → pass `onChunk` to all stage generators
   - Modify: `ResearchOutput.tsx` → display streaming chunks live
   - Modify: `StagePanel.tsx` → show progress bar during streaming

4. **Examples from SDK:**
   - Partial JSON parsing: `{"status":"generating","text":"The market..."` (incomplete)
   - Snapshot every 100 tokens: full JSON object with latest state
   - Callback signature: `(chunk: string, done: boolean) => void`

### Code Pattern to Copy:
```typescript
// From Anthropic SDK
const stream = await client.messages.create({
  stream: true,
  ...
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    onChunk(chunk.delta.text);
  }
}
```

### Estimated Tokens Saved: +0 (UX only)
### Timeline: 2 hours

---

## Repo 2: Claw-Code — Session Persistence & Resume

### What We Need:
1. **Session Checkpoint System**
   - File: `src/utils/sessionCheckpoint.ts` (NEW)
   - Save cycle state after each stage completes
   - Structure:
     ```typescript
     interface CycleCheckpoint {
       cycleId: string;
       timestamp: number;
       stage: string; // "research" | "objections" | "taste" | "make" | "test" | "memories"
       completedStages: string[];
       stageData: {
         research: ResearchFindings;
         objections: ObjectionData;
         taste: TasteData;
         make: CreativeOutput[];
         test: TestResults;
         memories: Memory[];
       };
       metrics: {
         tokensUsed: number;
         timeElapsed: number;
       };
     }
     ```

2. **Checkpoint Storage**
   - File: `src/utils/checkpointStore.ts` (NEW)
   - Store in IndexedDB: `checkpoints` table
   - Key: `${campaignId}-${cycleNumber}`
   - Methods:
     - `saveCheckpoint(checkpoint)` — save after each stage
     - `loadCheckpoint(campaignId, cycleNumber)` — resume from saved state
     - `deleteOldCheckpoints()` — cleanup

3. **Resume Logic**
   - File: Modify `useCycleLoop.ts`
   - Before starting cycle: check for previous checkpoint
   - If found: skip completed stages, resume from next stage
   - Show UI: "Resume from Stage 3 (Taste)?" with cancel/proceed buttons

4. **UI Component**
   - File: `src/components/ResumePrompt.tsx` (NEW)
   - Modal showing: "Checkpoint found from 2 hours ago"
   - Stages completed: Research ✓, Objections ✓, Taste ✓
   - Next stage: Make
   - Buttons: "Resume" | "Start Over"

5. **Error Handling**
   - If stage crashes, auto-save state before crash
   - Show: "Cycle paused. You can resume later."
   - Allow user to try again with different settings

### Code Pattern to Copy (from Claw-Code):
```typescript
// Save after each stage
const checkpoint: CycleCheckpoint = {
  stage: 'taste',
  completedStages: ['research', 'objections'],
  stageData,
  timestamp: Date.now(),
};
await checkpointStore.save(checkpoint);

// On next visit
const checkpoint = await checkpointStore.load(campaignId, cycleNum);
if (checkpoint) {
  // Skip to stage after last completed
  setCurrentStage(getNextStage(checkpoint.completedStages));
}
```

### Estimated Tokens Saved: +0 (efficiency only)
### Timeline: 3 hours

---

## Repo 3: Nexora — TurboQuant KV Cache (CRITICAL!)

### What We Need:
1. **TurboQuant Cache Implementation**
   - File: `src/utils/turboQuantCache.ts` (NEW)
   - Algorithm: Importance-weighted eviction + LFU+LRU hybrid
   - Scores each context token by importance (via embedding similarity)
   - Evicts lowest-importance tokens when over budget

2. **Context Window Manager**
   - File: Modify `src/utils/context1Service.ts`
   - Replace simple `trimContext()` with TurboQuant
   - Config: `CONTEXT_BUDGET = 120K tokens` (for make stage)
   - Auto-compress when approaching limit
   - Keep high-importance chunks (brand DNA, customer desires, previous findings)

3. **Importance Scoring**
   - Score each chunk by:
     - Semantic similarity to current query (Context-1 embeddings)
     - Recency (recent findings > old findings)
     - Category (brand DNA > research > memories)
   - Formula: `importance = (similarity × 0.5) + (recency × 0.3) + (category_weight × 0.2)`

4. **Integration Points**
   - Modify: `researchAgents.ts` → use TurboQuant for compression
   - Modify: `makeStudio.ts` → use TurboQuant before generation
   - Modify: `testAgent.ts` → use TurboQuant for context

5. **Monitoring**
   - Track: tokens evicted, compression ratio, quality impact
   - Log: `{stage, inputTokens, evictedTokens, compressionRatio}`

### Code Pattern to Copy (from Nexora):
```typescript
interface TokenScore {
  token: string;
  importance: number; // 0-1
  category: 'brand' | 'research' | 'memory';
  lastUsed: number;
}

// Score all tokens
const scored = tokens.map(token => ({
  token,
  importance: calculateImportance(token, query),
  category: getCategory(token),
  lastUsed: tokenMetadata[token].lastUsed,
}));

// Sort by importance, keep top N
const kept = scored.sort((a, b) => b.importance - a.importance).slice(0, maxTokens);
```

### Estimated Tokens Saved: 60% (research 40K → 16K)
### Timeline: 4 hours
### PRIORITY: CRITICAL ⭐⭐⭐

---

## Repo 4: Zvec — Semantic Memory (Vector Search)

### What We Need:
1. **Vector Index for Campaign Memory**
   - File: `src/utils/campaignMemoryIndex.ts` (NEW)
   - Build semantic index of all past research/findings
   - Use Nomic-embed-text (already available)
   - Store: `research_index` in memory

2. **Semantic Search Function**
   - File: Modify `src/utils/memories.ts`
   - Function: `findSimilarPastResearch(query: string, topK: number)`
   - Returns: Most relevant findings from previous cycles
   - Use: Vector similarity (cosine) + BM25 hybrid search

3. **Integration Points**
   - Call in `orchestrator.ts`: "Find similar past campaigns" before searching web
   - If found: "We researched collagen in cycle 5, found X, Y, Z"
   - Avoids redundant research

4. **Index Updates**
   - After each research phase: add new findings to index
   - Index structure: `{embedding, finding, source, confidence, timestamp}`

5. **Configuration**
   - `SEMANTIC_SEARCH_THRESHOLD = 0.75` (0-1 similarity)
   - `HYBRID_SEARCH_WEIGHT = 0.6` (vector) + `0.4` (BM25)

### Code Pattern to Copy (from Zvec):
```typescript
// Index research findings
const embedding = await embeddingService.embed(finding.text);
index.add({
  id: finding.id,
  vector: embedding,
  data: { text: finding.text, source: finding.source },
});

// Query: find similar
const query_embedding = await embeddingService.embed(userQuery);
const results = index.search(query_embedding, topK: 5);
// Returns: [{id, similarity, data}]
```

### Estimated Tokens Saved: 10-15% (avoid redundant research)
### Timeline: 3 hours

---

## Repo 5: VibeVoice — Real-time Audio Streaming

### What We Need: (FUTURE PHASE)
1. **Audio Output Module** (placeholder for now)
   - File: `src/utils/audioStreaming.ts` (STUB)
   - Later: stream ad concepts as voice narration
   - Per-sample queue for non-blocking output

2. **Text-to-Speech Integration**
   - Later: integrate with ElevenLabs API
   - Stream audio chunks as they arrive

### Timeline: 8 hours (future)

---

## Repo 6: last30days-skill — Timeout Pyramid

### What We Need:
1. **Stage-Level Timeouts**
   - File: `src/utils/stageTimeouts.ts` (NEW)
   - Config:
     ```typescript
     const STAGE_TIMEOUTS = {
       research: 120_000,      // 2 min
       objections: 45_000,     // 45 sec
       taste: 30_000,          // 30 sec
       make: 60_000,           // 1 min
       test: 30_000,           // 30 sec
       memories: 15_000,       // 15 sec
     };
     ```

2. **Timeout Wrapper**
   - File: Modify `src/utils/promiseTimeout.ts`
   - Wrap every stage call: `withTimeout(stageFunction, timeout)`
   - On timeout: emit error event, skip to next stage
   - Log: `{stage, timeout, result: 'completed' | 'timeout'}`

3. **Graceful Degradation**
   - If researcher times out: synthesize findings from other researchers
   - If make stage times out: use last tested concept
   - If test stage times out: use first concept

4. **UI Feedback**
   - Show: "Research stage — 45 sec remaining"
   - Progress bar: fills as time elapses
   - Status: "Timeout in 10 seconds..."

### Code Pattern to Copy (from last30days-skill):
```typescript
// Timeout with fallback
const results = await Promise.race([
  researchers.map(r => r.search(query)),
  sleep(STAGE_TIMEOUTS.research).then(() => {
    throw new TimeoutError('Research timeout');
  }),
]);

// Catch timeout, use partial results
if (error instanceof TimeoutError) {
  return synthesizePartialResults(partialResults);
}
```

### Estimated Tokens Saved: +0 (reliability only)
### Timeline: 2 hours

---

## Repo 7: oh-my-claudecode — Phase-Based Task Routing

### What We Need:
1. **Skill Extraction in Memory Phase**
   - File: Modify `src/utils/memoryAgent.ts`
   - After each cycle, extract learnings as reusable "skills"
   - Skill types:
     - `audience_insight`: "Female 25-35 cares about X"
     - `messaging_pattern`: "This objection handled by Y"
     - `creative_pattern`: "This visual pattern worked with Z audience"

2. **Skill Library**
   - File: `src/utils/skillLibrary.ts` (NEW)
   - Store: skills with context, effectiveness score
   - Retrieve: in next cycle for similar campaigns
   - Structure:
     ```typescript
     interface Skill {
       id: string;
       type: 'audience' | 'messaging' | 'creative' | 'research';
       content: string;
       effectiveness: number; // 0-1
       applicableTo: string[]; // industry, audience type, etc.
       source: { cycleId, date };
     }
     ```

3. **Skill Injection**
   - In new cycle: check for applicable skills
   - Show: "From past campaigns, we learned X about your audience"
   - Use in prompt: append relevant skills to system message

### Timeline: 1 hour (strengthen existing)

---

## Repo 8: DeerFlow — Middleware Composition (CRITICAL!)

### What We Need:
1. **Middleware System**
   - File: `src/utils/middleware.ts` (NEW)
   - Base middleware interface:
     ```typescript
     interface Middleware {
       name: string;
       before?: (stage: Stage, input: any) => Promise<any>;
       after?: (stage: Stage, output: any) => Promise<any>;
       onError?: (stage: Stage, error: Error) => Promise<any>;
     }
     ```

2. **Middleware Registry**
   - File: `src/utils/middlewareRegistry.ts` (NEW)
   - Register middleware: `registry.use(new LoggingMiddleware())`
   - Execute in order: before → stage → after

3. **Built-in Middlewares**
   - `LoggingMiddleware` — log all stages
     ```typescript
     class LoggingMiddleware implements Middleware {
       async before(stage, input) {
         console.log(`[${stage}] Starting with input:`, input);
       }
       async after(stage, output) {
         console.log(`[${stage}] Completed with output:`, output);
       }
     }
     ```

   - `MetricsMiddleware` — track timing, tokens
     ```typescript
     class MetricsMiddleware implements Middleware {
       async before(stage, input) {
         return { startTime: Date.now(), input };
       }
       async after(stage, output) {
         const duration = Date.now() - state.startTime;
         metrics.record({ stage, duration, tokens: output.tokensUsed });
       }
     }
     ```

   - `ApprovalMiddleware` — ask before expensive operations
     ```typescript
     class ApprovalMiddleware implements Middleware {
       async before(stage, input) {
         if (stage === 'make' && input.tokensRequired > 10000) {
           const approved = await askUser(`Run ${stage} (${input.tokensRequired} tokens)?`);
           if (!approved) throw new Error('Skipped by user');
         }
       }
     }
     ```

   - `ErrorRecoveryMiddleware` — retry on failure
     ```typescript
     class ErrorRecoveryMiddleware implements Middleware {
       async onError(stage, error) {
         for (let i = 0; i < 3; i++) {
           try {
             return await stage.retry();
           } catch (e) {}
         }
         throw error;
       }
     }
     ```

   - `AuditMiddleware` — log all decisions to JSONL
     ```typescript
     class AuditMiddleware implements Middleware {
       async after(stage, output) {
         appendToFile('audit.jsonl', {
           timestamp: Date.now(),
           stage,
           output: sanitize(output),
           tokensUsed: output.tokens,
         });
       }
     }
     ```

4. **Integration Points**
   - Modify: `useCycleLoop.ts` → wrap stage execution with middleware
   - Enable/disable via feature flags: `VITE_ENABLE_APPROVAL_MIDDLEWARE`

5. **Middleware Ordering**
   - Order matters! Execute in sequence:
     1. MetricsMiddleware (track start time)
     2. ApprovalMiddleware (ask user)
     3. ErrorRecoveryMiddleware (setup retry)
     4. LoggingMiddleware (log execution)
     5. [STAGE RUNS]
     6. AuditMiddleware (log results)

### Code Pattern to Copy (from DeerFlow):
```typescript
// Execute stage with middleware
const result = await middlewareRegistry.execute(stage, input);

// Internal: run middleware chain
async execute(stage, input) {
  let state = input;

  // Run "before" hooks
  for (const mw of this.middlewares) {
    state = await mw.before?.(stage, state) ?? state;
  }

  // Run stage
  let output = await stage.run(state);

  // Run "after" hooks (reverse order)
  for (const mw of [...this.middlewares].reverse()) {
    output = await mw.after?.(stage, output) ?? output;
  }

  return output;
}
```

### Estimated Tokens Saved: +0 (infrastructure only)
### Timeline: 4 hours
### PRIORITY: HIGH ⭐⭐

---

## Repo 9: Hermes Agent — Tool Registry & Crash Recovery

### What We Need:
1. **Tool Availability Checking**
   - File: Modify `src/utils/subagentTools.ts`
   - Before spawning researchers: check if Wayfarer is running
   - Before model calls: check if Ollama is running
   - Function: `async checkToolAvailability(tool: string): boolean`

2. **Health Checks**
   - File: `src/utils/healthMonitor.ts` (enhance existing)
   - Ping endpoints periodically:
     - Ollama: `http://OLLAMA_URL/api/tags`
     - Wayfarer: `http://WAYFARER_URL/health`
     - Context-1: `http://CONTEXT1_URL/health`
   - Cache results for 10 seconds

3. **Crash Recovery**
   - File: `src/utils/processWatchdog.ts` (NEW)
   - Watch researcher processes
   - On crash: auto-restart up to 3 times
   - On 3rd failure: skip researcher, use results from others
   - Log: `{researcher, crashes, lastError}`

4. **Fallback Logic**
   - If Wayfarer down: use fallback search (SearXNG directly)
   - If Ollama down: pause and show "Waiting for Ollama..."
   - If Context-1 down: use qwen3.5:4b instead

### Code Pattern to Copy (from Hermes):
```typescript
// Tool registry with availability
const tools = {
  wayfarer: {
    available: async () => pingEndpoint(WAYFARER_URL),
    fallback: () => directSearXNG(),
  },
  ollama: {
    available: async () => pingEndpoint(OLLAMA_URL),
    fallback: () => null, // fatal
  },
};

// Before using tool
if (!await tools.wayfarer.available()) {
  return tools.wayfarer.fallback();
}
```

### Timeline: 2 hours

---

## Repo 10: Everything Claude Code — Iterative Retrieval (CRITICAL!)

### What We Need:
1. **Query Router for Focused Search**
   - File: `src/utils/queryRouter.ts` (NEW)
   - Instead of: "Find all sources on collagen market"
   - Do:
     ```
     Round 1: "Top 5 URLs about collagen supplement market size"
     Round 2: "Top 5 URLs about collagen supplement market trends"
     Round 3: "Top 5 URLs about collagen supplement health benefits"
     Round 4: "Top 5 URLs about collagen supplement objections/concerns"
     ```

2. **Orchestrator Changes**
   - File: Modify `src/utils/researchAgents.ts` → `orchestrator` function
   - New algorithm:
     ```typescript
     // OLD: Find 100 URLs once, split among researchers
     const allUrls = await wayfarer.search("collagen market", 100);
     const urlChunks = chunk(allUrls, 20); // 5 researchers × 20 URLs

     // NEW: Generate focused queries, distribute to researchers
     const focusedQueries = [
       "market size and growth",
       "customer demographics",
       "competitive landscape",
       "objections and concerns",
       "messaging strategies",
     ];

     const results = await Promise.all(
       focusedQueries.map((q, i) =>
         researchers[i].research(`collagen: ${q}`)
       )
     );
     ```

3. **Query Generation**
   - File: `src/utils/queryGenerator.ts` (NEW)
   - Input: brand brief + customer desires + competitor analysis
   - Output: 5-10 focused research queries
   - Use: `qwen3.5:2b` (fast, cheap)
   - Prompt:
     ```
     Brief: {brand brief}
     Customer desires: {desires}

     Generate 5 research queries to understand the market:
     1. Market landscape: "..."
     2. Customer behavior: "..."
     3. Competitive positioning: "..."
     4. Objections and concerns: "..."
     5. Messaging opportunities: "..."
     ```

4. **Results Synthesis**
   - File: Modify `src/utils/researchAgents.ts` → `synthesizer` function
   - Combine: 5 focused findings into cohesive summary
   - No duplication: deduplicate insights
   - Cross-reference: "In market research we found X, customer behavior confirms Y"

5. **Quality Gate**
   - Check: "Did we cover all important dimensions?"
   - If missing: generate follow-up query
   - If redundant: skip

### Code Pattern to Copy (from ECC):
```typescript
// Iterative retrieval: focused queries per researcher
const queries = [
  { researcher: 0, query: "collagen market size 2026" },
  { researcher: 1, query: "collagen supplement customer demographics" },
  { researcher: 2, query: "collagen competitor products" },
  { researcher: 3, query: "collagen supplement objections" },
  { researcher: 4, query: "collagen health claims messaging" },
];

const results = await Promise.all(
  queries.map(({ researcher, query }) =>
    researchAgents[researcher].search(query)
  )
);

// Deduplicate insights
const deduplicated = deduplicateFindings(results.map(r => r.findings));
```

### Estimated Tokens Saved: 60% (100 URLs → 25 focused URLs)
### Timeline: 3 hours
### PRIORITY: CRITICAL ⭐⭐⭐

---

## Repo 11: Superpowers — TDD + Two-Stage Review

### What We Need:
1. **Two-Stage Test Verification**
   - File: Modify `src/utils/testAgent.ts`
   - Stage 1: Spec Validation
     ```typescript
     // Does concept match brief?
     const specCheck = await model.call(`
       Brief: {brief}
       Concept: {concept}

       Score this concept on:
       1. Does it address customer desires? (0-10)
       2. Does it handle objections? (0-10)
       3. Is it on-brand? (0-10)

       Verdict: PASS | NEEDS_WORK | FAIL
     `);
     ```

   - Stage 2: Quality Check
     ```typescript
     // Is creative execution good?
     const qualityCheck = await model.call(`
       Concept: {concept}

       Score on:
       1. Creative originality (0-10)
       2. Message clarity (0-10)
       3. Call-to-action strength (0-10)

       Verdict: EXCELLENT | GOOD | MEDIOCRE | POOR
     `);
     ```

2. **Ranking System**
   - File: Modify `src/utils/testAgent.ts` → `rankConcepts`
   - Scoring:
     ```typescript
     score = (specCheck.score × 0.6) + (qualityCheck.score × 0.4);
     // 60% spec match + 40% creative quality
     ```

3. **Feedback Loop**
   - If spec fails: show why (missing desires, poor objection handling)
   - If quality fails: show why (unclear, weak CTA, generic)
   - Allow retry with specific feedback

### Timeline: 2 hours

---

## Repo 12: Agency Agents — 100+ Personalities

### What We Need:
1. **Expand Personality System**
   - File: `src/utils/personalities.ts` (enhance)
   - Current: 1 brand personality (Desire-Driven)
   - Target: 20+ total personalities
     ```typescript
     // Audience personas
     const audiencePersonas = [
       { id: 'female-25-35-health', description: 'Health-conscious women 25-35' },
       { id: 'male-35-50-convenience', description: 'Busy men 35-50 seeking efficiency' },
       { id: 'parents-budget', description: 'Parents on tight budget' },
       // ... 17 more
     ];

     // Creative director personas
     const creativePersonas = [
       { id: 'minimalist', style: 'Clean, elegant, simple' },
       { id: 'energetic', style: 'Bold, vibrant, playful' },
       { id: 'luxury', style: 'Premium, sophisticated, exclusive' },
     ];
     ```

2. **Personality-Based Generation**
   - In Make stage: sample from personality pool
   - Generate 3 concepts with different personas
   - Concept 1: audience_female + minimalist style
   - Concept 2: audience_male + energetic style
   - Concept 3: audience_budget + value-focused style

3. **Personality Templates**
   - File: `src/prompts/personalities/` (directory)
   - Each personality has system prompt template:
     ```
     # {personality_name} Persona

     Audience: {audience_description}
     Style: {creative_style}
     Values: {key_values}

     When generating creative:
     - Use this voice/tone
     - Emphasize these benefits
     - Avoid these approaches
     ```

### Timeline: 8 hours

---

## Repo 13: MiroFish — Audit Logging & Temporal Metadata

### What We Need:
1. **Audit JSONL Logging**
   - File: `src/utils/auditLogger.ts` (enhance)
   - Append to `research_audit.jsonl`:
     ```jsonl
     {"timestamp":"2026-04-01T19:58:00Z","stage":"research","action":"query","query":"collagen market","tokens":1204,"result":"8 sources found"}
     {"timestamp":"2026-04-01T19:59:00Z","stage":"research","action":"compress","pages":8,"tokens":2840,"compressionRatio":0.76}
     {"timestamp":"2026-04-01T20:00:00Z","stage":"objections","action":"generate","objections":4,"tokens":3100,"model":"qwen3.5:4b"}
     ```

2. **Temporal Metadata**
   - File: Modify `src/types/researchFindings.ts`
   - Add fields:
     ```typescript
     interface ResearchFinding {
       text: string;
       source: string;
       discoveredAt: number; // timestamp
       validityWindow: {
         startDate: number;
         endDate: number; // when finding becomes stale
       };
       confidence: number; // 0-1
       category: string; // "market_size" | "trend" | "objection" | etc.
     }
     ```

3. **Stale Data Detection**
   - File: `src/utils/staleFindingDetector.ts` (NEW)
   - Check: is finding still valid?
   - If past `endDate`: mark as stale, suggest refresh
   - Show: "This finding from 6 months ago might be outdated"

4. **Audit Trail UI**
   - File: `src/components/AuditTrail.tsx` (NEW)
   - Show: timeline of all decisions
   - Click: expand to see details
   - Filter: by stage, by action, by model

### Timeline: 2 hours

---

## Repo 14: learn-claude-code — Worktree Isolation

### What We Need:
1. **Researcher Worktree Wrapper**
   - File: `src/utils/worktreeManager.ts` (NEW)
   - Before spawning researcher:
     ```typescript
     const worktreeId = `researcher-${nanoid()}`;
     await createWorktree(worktreeId);
     const cwd = `./worktrees/${worktreeId}`;

     // Run researcher in isolated dir
     const result = await spawnWorker(researcherCode, { cwd });

     // Cleanup
     await removeWorktree(worktreeId);
     ```

2. **Worktree Isolation Benefits**
   - Each researcher gets fresh context (no contamination)
   - Parallel execution without conflicts
   - Easy cleanup (remove dir = kill context)

3. **Integration Points**
   - Modify: `src/utils/researchAgents.ts` → researcher spawning
   - Wrap: `subagentManager.spawnWorker()` call

### Timeline: 3 hours

---

## Repo 15: Lightpanda — Arena Allocators

### What We Need: (FUTURE OPTIMIZATION)
1. **Python Arena Allocator for Wayfarer**
   - File: `services/wayfarer/wayfarer.py` (optimize later)
   - Replace: standard Python memory allocation
   - Use: arena allocator for page compression buffers
   - Benefit: 16x less RAM

### Timeline: 2 hours (future)

---

## Repo 16: Open SWE — Sandbox Persistence

### What We Need:
1. **Persistent Executor Process**
   - File: `src/utils/executorManager.ts` (NEW)
   - Instead of: killing executor after each stage
   - Do: keep executor running across entire cycle
   - Reuse: Python/Node.js runtime, model context

2. **State Management**
   - Track: which files exist, which imports loaded
   - Cache: compiled code, loaded modules
   - Speed: 2x faster task dispatch

### Timeline: 2 hours

---

## Repo 17: OpenViking — L0/L1/L2 Tiering (CRITICAL!)

### What We Need:
1. **Hierarchical Compression System**
   - File: `src/utils/hierarchicalCompress.ts` (NEW)
   - Three levels:
     ```typescript
     interface CompressedFinding {
       L0: string; // Full text (2-3KB)
       L1: string; // Summary (300 words)
       L2: string; // Ultra (1 sentence + 5 keywords)
       metadata: { confidence, source, timestamp };
     }
     ```

2. **Compression Logic**
   - Cycle 1: Use L0 (full details needed)
   - Cycles 2-5: Use L1 (balance detail + brevity)
   - Cycles 6+: Use L2 (ultra-compressed for long campaigns)

3. **Integration Points**
   - Modify: `src/utils/memories.ts` → archive findings at 3 levels
   - Modify: `src/utils/context1Service.ts` → use appropriate level
   - Config: `useLevel(cycleNumber)` returns 'L0' | 'L1' | 'L2'

4. **Compression Prompt**
   - File: `src/prompts/compress_level1.md` (NEW)
     ```
     Original finding:
     {L0_text}

     Summarize in 300 words. Keep:
     - Key statistics
     - Main findings
     - Actionable insights
     ```

   - File: `src/prompts/compress_level2.md` (NEW)
     ```
     Original finding:
     {finding_text}

     Compress to 1 sentence + 5 keywords.
     Example output:
     "Collagen market growing 12%/year, targeting female 25-35"
     Keywords: growth, female, 25-35, premium-tier, health-conscious
     ```

### Estimated Tokens Saved: 80% on research findings
### Timeline: 3 hours
### PRIORITY: CRITICAL ⭐⭐⭐

---

## Repo 18: DeepAgents — Middleware + HumanInTheLoop

### What We Need:
1. **HumanInTheLoopMiddleware**
   - File: `src/utils/middleware.ts` → add class
   - Before expensive operations: ask approval
   - Config thresholds:
     ```typescript
     const HIL_THRESHOLDS = {
       makeStage: 15000,      // Ask if > 15K tokens
       testStage: 10000,      // Ask if > 10K tokens
       deepAnalysis: 20000,   // Ask if > 20K tokens
     };
     ```

2. **Approval Modal**
   - File: Enhance `src/components/ApprovalModal.tsx`
   - Show:
     ```
     ⚠️ Expensive Operation
     Make Stage will use ~15,200 tokens
     Cost: ~$0.45 (at current rates)

     [Cancel] [Approve] [Always Approve]
     ```

3. **Memory for User Preferences**
   - Store: "Always approve make stage"
   - Skip modal on subsequent cycles
   - Allow reset in settings

### Timeline: 2 hours

---

## Repo 19: Deep Research — Recursive Breadth Reduction

### What We Need:
1. **Recursive Query Narrowing**
   - Already implemented, but:
   - File: Modify `src/utils/researchAgents.ts` → orchestrator
   - Track: which queries yielded valuable findings
   - Narrow: subsequent queries based on findings
   - Example:
     ```
     Round 1: "collagen market" → finds: size, segments
     Round 2: Based on segments, ask about: female 25-35 segment
     Round 3: Based on that, ask about: objections in that segment
     ```

2. **Breadth Tracking**
   - File: Add metrics:
     ```typescript
     metrics: {
       round1: { breadth: 100, results: 8 },
       round2: { breadth: 35, results: 7 },
       round3: { breadth: 15, results: 5 },
     };
     ```

### Timeline: 1 hour (enhance existing)

---

## Repo 20: ccunpacked.dev — Interactive Documentation

### What We Need:
1. **Build "Neuro Unpacked" Site**
   - File: `docs/unpacked/` (NEW directory)
   - Stack: Astro + React + D3.js
   - Host: GitHub Pages or Vercel

2. **Interactive Agent Loop Animation**
   - Component: `docs/unpacked/components/AgentLoop.tsx`
   - Show 8-step cycle: Research → Objections → Taste → Make → Test → Memories → Next
   - Controls: Play, Pause, Rewind, Speed (0.5x, 1x, 2x)
   - Timeline: show time elapsed per stage

3. **Architecture Treemap**
   - Component: `docs/unpacked/components/CodeTree.tsx`
   - Color-code by: Frontend (blue), Backend (green), Services (purple), Config (gray)
   - Click: navigate to GitHub source
   - Size: proportional to file count

4. **Tool Catalog**
   - Component: `docs/unpacked/components/ToolCatalog.tsx`
   - Categories: Research (Wayfarer, Context-1), Generation (Ollama models), Analysis (Vision)
   - Expandable: description, status (✅ active, 🔄 testing, ⏳ planned)
   - Search: filter by name/category

5. **Roadmap**
   - Component: `docs/unpacked/components/Roadmap.tsx`
   - Shipped (Phases 1-10): checkmarks
   - In Progress (Phases 11-14): 50% bars
   - Planned (Phases 15+): dashed boxes
   - Click: expand to see details

6. **Learn Mode Toggle**
   - File: `docs/unpacked/components/LearnMode.tsx`
   - URL: `?mode=learn` enables interactive tutorials
   - Hover components → tooltips
   - Click → show source code location

### Timeline: 12 hours

---

## Summary: All Files to Create/Modify

### NEW FILES (19 total):
```
src/utils/streaming.ts
src/utils/sessionCheckpoint.ts
src/utils/checkpointStore.ts
src/components/ResumePrompt.tsx
src/utils/turboQuantCache.ts
src/utils/campaignMemoryIndex.ts
src/utils/stageTimeouts.ts
src/utils/middleware.ts
src/utils/middlewareRegistry.ts
src/utils/healthMonitor.ts (enhance)
src/utils/processWatchdog.ts
src/utils/queryRouter.ts
src/utils/queryGenerator.ts
src/utils/worktreeManager.ts
src/utils/auditLogger.ts (enhance)
src/utils/staleFindingDetector.ts
src/components/AuditTrail.tsx
src/utils/executorManager.ts
src/utils/hierarchicalCompress.ts
src/utils/personalities.ts (enhance)
src/components/ApprovalModal.tsx (enhance)
docs/unpacked/ (entire directory)
```

### MODIFIED FILES (15 total):
```
src/hooks/useCycleLoop.ts
src/components/ResearchOutput.tsx
src/components/StagePanel.tsx
src/utils/context1Service.ts
src/utils/memories.ts
src/utils/memoryAgent.ts
src/utils/researchAgents.ts (major changes)
src/utils/testAgent.ts
src/types/researchFindings.ts
src/utils/subagentTools.ts
src/prompts/ (new prompt files)
services/wayfarer/wayfarer.py (future)
package.json (add dependencies if needed)
```

---

## Implementation Sequence (Priority Order)

**Week 1 (Critical Path):**
1. Iterative Retrieval (3h) — 60% token savings
2. L0/L1/L2 Compression (3h) — 80% research savings
3. TurboQuant Cache (4h) — smart eviction

**Week 2:**
4. Timeout Pyramid (2h) — crash-proof
5. Worktree Isolation (3h) — parallel safety
6. Audit Logging (2h) — observability

**Week 3:**
7. Middleware System (4h) — pluggable
8. Approval Gates (2h) — safety control

**Week 4:**
9. Query Router + Generator (3h) — focused research
10. Session Checkpoints (3h) — resumable cycles

**After Week 4:**
11. "Neuro Unpacked" docs (12h)
12. Personalities expansion (8h)
13. Future optimizations (Lightpanda, etc.)

---

**Total Effort: 41 hours**
**Expected Impact: 77% token reduction, 69% faster cycles, crash-proof, fully observable**

---

# CONTEXT-1 FULL INTEGRATION (CRITICAL)

## What is Context-1?
- **Chroma's MoE retrieval model** (20.9B parameters)
- **Hybrid search**: BM25 (keyword) + Dense (semantic)
- **Auto-compression**: Intelligently summarizes context
- **15-step loop**: Iterative refinement of results
- **Purpose**: Semantic memory for past research, smart context retrieval

## Integration Points (Every Major System)

### 1. Research Orchestration
**File**: Modify `src/utils/researchAgents.ts` → `orchestrator` function

**Current**: "What should researcher 1 search for?"
**With Context-1**: "What should researcher 1 search for, given past campaigns?"

```typescript
// Before Context-1
const nextQuery = await generateQuery(brief, findings);

// With Context-1
const pastResearch = await context1.search(brief.industry, topK: 5);
const contextualQuery = await generateQuery(
  brief,
  findings,
  pastResearch, // Add this
);
```

**Integration Details**:
- Call Context-1: `await context1Service.search(query, topK: 5)`
- Returns: `[{text, source, confidence, foundIn: 'cycle_12'}]`
- If high-confidence match found: "Found similar research from cycle 12"
- Avoid redundant search: skip if already researched

**Prompt Modification**:
```
Brief: {brief}
Past research on this topic (from Context-1):
{pastResearch.map(r => `- Cycle ${r.foundIn}: ${r.text}`).join('\n')}

Generate research queries:
- If we found X before, now research adjacent topics
- If this is new territory, research comprehensively
```

---

### 2. Objection Handling
**File**: Modify `src/utils/objectionsAgent.ts`

**Current**: Generate objections based on brief
**With Context-1**: Generate objections we haven't handled, avoid repeating

```typescript
// Before Context-1
const objections = await generateObjections(brief, research);

// With Context-1
const pastObjections = await context1.search(
  `objections for ${brief.industry}`,
  topK: 10,
);

const newObjections = await generateObjections(
  brief,
  research,
  pastObjections, // Add this
);
```

**Integration Details**:
- Query Context-1 for: "objections + industry"
- Filter: exclude objections already handled in past cycles
- Show: "We handled X objection in cycle 5, try Y this time"

---

### 3. Taste Development
**File**: Modify `src/utils/tasteAgent.ts`

**Current**: Suggest creative direction based on research
**With Context-1**: Suggest direction that worked in similar campaigns

```typescript
// Before Context-1
const taste = await suggestTaste(brief, research);

// With Context-1
const successfulTastes = await context1.search(
  `successful creative direction for ${brief.audience}`,
  topK: 3,
);

const taste = await suggestTaste(
  brief,
  research,
  successfulTastes, // Add this
);
```

**Integration Details**:
- Query: "successful creative direction + audience type"
- Use: colors, typography, tone patterns from past winners
- Avoid: directions that underperformed

---

### 4. Make Stage (Creative Generation)
**File**: Modify `src/utils/makeStudio.ts`

**Current**: Generate 3 ad concepts based on taste
**With Context-1**: Generate concepts that differ from past winners

```typescript
// Before Context-1
const concepts = await generateConcepts(brief, taste, research);

// With Context-1
const winningConcepts = await context1.search(
  `winning ad concepts for ${brief.industry}`,
  topK: 5,
);

const concepts = await generateConcepts(
  brief,
  taste,
  research,
  winningConcepts, // Add this
);
```

**Integration Details**:
- Query: "winning ad concepts + industry"
- Instruction: "Generate concepts different from these winning ones"
- Goal: Innovation while learning from past successes

**Prompt with Context-1**:
```
Industry: {brief.industry}
Audience: {brief.audience}

Past winning concepts:
{winningConcepts.map(c => `- ${c.headline}: ${c.description}`).join('\n')}

Generate 3 NEW concepts that:
1. Learn from these winners (what made them work)
2. Are different (new angles, new messaging)
3. Still address customer desires: {desires}
```

---

### 5. Test Stage (Evaluation)
**File**: Modify `src/utils/testAgent.ts`

**Current**: Score concepts 0-10
**With Context-1**: Score + compare to historical performance

```typescript
// Before Context-1
const scores = await scoreConceptss(concepts, brief);

// With Context-1
const historicalScores = await context1.search(
  `concept scores for ${brief.industry}`,
  topK: 10,
);

const scores = await scoreConceptss(
  concepts,
  brief,
  historicalScores, // Add this
);
```

**Integration Details**:
- Query: "similar concept scores + industry"
- Compare: "This concept scores 8.2, historical avg is 7.1 (above average!)"
- Adjust: if scoring seems off, recalibrate

---

### 6. Memory/Archive Phase
**File**: Modify `src/utils/memoryAgent.ts`

**Current**: Save cycle results to IndexedDB
**With Context-1**: Index cycle results for semantic search

```typescript
// Before Context-1
await saveCycleSummary(cycleResults);

// With Context-1
// 1. Save to IndexedDB (existing)
const summary = await saveCycleSummary(cycleResults);

// 2. ADD: Index in Context-1
await context1Service.index({
  id: `cycle_${cycleNumber}`,
  text: summary.fullText,
  metadata: {
    industry: brief.industry,
    audience: brief.audience,
    performance: testResults.winningConcept.score,
    timestamp: Date.now(),
  },
});
```

**Integration Details**:
- Index all cycle findings
- Make searchable by: industry, audience, performance
- Retain: 2 years of data (then archive)

---

### 7. Campaign Memory Initialization
**File**: Modify `src/hooks/useOrchestratedResearch.ts`

**Current**: Start fresh each cycle
**With Context-1**: Load relevant past research upfront

```typescript
// Before Context-1
const briefData = await loadBrief(campaignId);

// With Context-1
const briefData = await loadBrief(campaignId);

// NEW: Retrieve contextual memory
const relatedCampaigns = await context1Service.search(
  `${briefData.industry} ${briefData.audience}`,
  topK: 5,
);

const contextualMemory = {
  pastResearch: relatedCampaigns,
  successPatterns: extractPatterns(relatedCampaigns),
  avoidPatterns: extractFailedPatterns(relatedCampaigns),
};

// Pass to entire cycle
return initializeCycle(briefData, contextualMemory);
```

**Integration Details**:
- Pre-load: 5 most relevant past campaigns
- Pass context: to all 8 stages
- Show to user: "Loaded 5 similar campaigns from history"

---

### 8. Settings/Configuration
**File**: Modify `src/components/SettingsModal.tsx`

**Add Context-1 Controls**:
```
CONTEXT-1 SETTINGS:
☑ Enable context retrieval
☑ Index cycle results
☑ Show past campaign references
  Search threshold: [0.75] (0-1, higher = stricter match)
  Max historical campaigns: [5]
  Retention period: [2 years]
```

---

### 9. Monitoring & Health
**File**: Modify `src/utils/healthMonitor.ts`

**Add Context-1 Health Check**:
```typescript
export async function checkHealth() {
  return {
    ollama: await pingOllama(),
    wayfarer: await pingWayfarer(),
    searxng: await pingSearXNG(),
    context1: await checkContext1Health(), // NEW
  };
}

async function checkContext1Health() {
  try {
    const result = await context1Service.search('test query', topK: 1);
    return {
      status: 'healthy',
      latency: result.latency,
      indexSize: result.stats.indexSize,
    };
  } catch (e) {
    return { status: 'unhealthy', error: e.message };
  }
}
```

---

### 10. Dashboard Summary Display
**File**: Modify `src/components/Dashboard.tsx`

**Show Context-1 Context**:
```
[Research Phase]
├─ Querying web (Wayfarer)
├─ Retrieving context (Context-1) ← NEW
│  └─ Found 3 similar campaigns from history
├─ Compressing findings (Ollama)
└─ Synthesizing research
```

---

### 11. Audit Trail
**File**: Modify `src/utils/auditLogger.ts`

**Log Context-1 Queries**:
```jsonl
{"timestamp":"2026-04-01T19:58:00Z","stage":"research","action":"context1_search","query":"collagen market","results":3,"topMatch":"cycle_12"}
{"timestamp":"2026-04-01T19:59:00Z","stage":"make","action":"context1_search","query":"winning concepts collagen","results":5,"influence":"used 2 patterns"}
```

---

### 12. API Endpoints (if exposing Context-1)
**File**: `src/api/context1.ts` (NEW)

```typescript
// GET /api/context1/search?q=collagen&limit=5
export async function searchContext1(req, res) {
  const { q, limit = 5 } = req.query;
  const results = await context1Service.search(q, { topK: limit });
  res.json(results);
}

// POST /api/context1/index
export async function indexCycle(req, res) {
  const { cycleId, summary, metadata } = req.body;
  await context1Service.index({
    id: cycleId,
    text: summary,
    metadata,
  });
  res.json({ status: 'indexed' });
}
```

---

## Context-1 Configuration

**File**: Modify `src/config/infrastructure.ts`

```typescript
export const CONTEXT1_CONFIG = {
  url: process.env.VITE_CONTEXT1_URL || 'http://localhost:8001',
  enabled: process.env.VITE_CONTEXT1_ENABLED !== 'false',
  
  // Search settings
  search: {
    threshold: 0.75, // 0-1 similarity threshold
    topK: 5, // max results per search
    timeout: 10000, // 10 second timeout
  },

  // Indexing settings
  index: {
    batchSize: 100, // batch index operations
    retryCount: 3,
    autoRetry: true,
  },

  // Memory settings
  memory: {
    maxCycles: 500, // max cycles to keep indexed
    retentionDays: 730, // 2 years
    autoArchive: true,
  },

  // Fallback behavior
  fallback: {
    enabled: true, // use Qwen if Context-1 fails
    useFallbackModel: 'qwen3.5:4b',
  },
};
```

---

## Context-1 Service Enhancement

**File**: Modify `src/utils/context1Service.ts`

**Add Methods**:
```typescript
export class Context1Service {
  // Existing
  async generateEmbedding(text: string): Promise<number[]> { }
  async search(query: string, options: SearchOptions): Promise<Result[]> { }

  // NEW: Batch operations
  async batchIndex(items: IndexItem[]): Promise<void> { }
  async batchSearch(queries: string[]): Promise<Result[][]> { }

  // NEW: Cycle management
  async indexCycle(cycleId: string, summary: string, metadata: any): Promise<void> { }
  async getRelatedCycles(industry: string, audience: string): Promise<CycleRef[]> { }

  // NEW: Cleanup
  async archiveOldCycles(beforeDate: number): Promise<number> { }
  async getStats(): Promise<IndexStats> { }

  // NEW: Fallback handling
  async searchWithFallback(query: string): Promise<Result[]> {
    try {
      return await this.search(query);
    } catch (e) {
      console.warn('Context-1 failed, using fallback');
      return await fallbackSearch(query);
    }
  }
}
```

---

## Context-1 Usage Patterns

### Pattern 1: Avoid Redundant Research
```typescript
// Before researching, check if we already know this
const existing = await context1.search(userQuery, topK: 1);
if (existing[0]?.confidence > 0.9) {
  return existing[0].text; // Skip web search
}
// Otherwise, search web
```

### Pattern 2: Learn from Winners
```typescript
// Get successful campaigns in similar vertical
const winners = await context1.search(`winning ads + ${industry}`, topK: 5);
// Extract patterns: colors, messaging, targeting
const patterns = extractPatterns(winners);
// Apply to new concepts
```

### Pattern 3: Iterative Refinement
```typescript
// Round 1: Get broad findings
let results = await context1.search(query, topK: 5);

// Round 2: Refine based on findings
const refined = await context1.search(
  extractKeyTopics(results),
  topK: 3,
);

// Round 3: Go deep on best match
const deep = await context1.search(results[0].topic, topK: 10);
```

### Pattern 4: Multi-Dimensional Search
```typescript
// Search across multiple dimensions
const results = await Promise.all([
  context1.search(`market trends + ${industry}`),
  context1.search(`audience behavior + ${audience}`),
  context1.search(`competitor strategy + ${industry}`),
  context1.search(`messaging patterns + ${audience}`),
]);
```

---

## Metrics to Track (Context-1)

**File**: Add to `src/utils/metricsCollector.ts`

```typescript
export interface Context1Metrics {
  // Search metrics
  searchCount: number;
  searchLatency: number[]; // array for percentiles
  hitRate: number; // % queries with high-confidence match
  avgConfidence: number; // 0-1
  
  // Index metrics
  indexSize: number; // number of documents
  indexLatency: number;
  
  // Impact metrics
  redundantSearchesAvoided: number;
  tokensFromContext1: number; // tokens used from indexed results
  
  // Health metrics
  fallbackUsageCount: number;
  errorCount: number;
}
```

---

## Example: Full Context-1 Integration in Make Stage

```typescript
// src/utils/makeStudio.ts

async function generateConcepts(brief, taste, research, cycleNumber) {
  // 1. Get contextual memory from Context-1
  const pastConcepts = await context1Service.searchWithFallback(
    `ad concepts ${brief.industry} ${brief.audience}`,
    { topK: 5 }
  );

  // 2. Extract what worked
  const successPatterns = extractPatterns(pastConcepts);
  const failedPatterns = extractFailedPatterns(pastConcepts);

  // 3. Generate concepts with context
  const concepts = await generateConceptsWithContext(
    brief,
    taste,
    research,
    { successPatterns, failedPatterns }
  );

  // 4. Score each concept
  const scored = await scoreAndCompare(concepts, brief);

  // 5. After cycle completes, index for future
  if (cycleNumber % 5 === 0) { // every 5 cycles
    await context1Service.indexCycle(
      `cycle_${cycleNumber}`,
      summarizeCycle({ brief, concepts, scored }),
      { industry: brief.industry, audience: brief.audience }
    );
  }

  return scored;
}
```

---

## Rollout Strategy

**Week 1**: Enable in orchestrator only (safe, read-only)
**Week 2**: Enable in make stage (write results to index)
**Week 3**: Enable in all stages, monitor metrics
**Week 4**: Optimize based on hit rates, latency

**Feature Flags**:
```typescript
const CONTEXT1_ENABLED = {
  orchestrator: true, // Week 1
  make: false, // Week 2
  objections: false, // Week 3
  taste: false, // Week 3
  test: false, // Week 3
  indexing: false, // Week 2
};
```

---

## Success Metrics

✅ **10x faster similar research lookup** (from 30+ min to 2 min)
✅ **60% token reduction** (avoid redundant research)
✅ **Better creative concepts** (learn from past winners)
✅ **Higher test scores** (apply proven patterns)
✅ **Faster cycles** (use cached results)


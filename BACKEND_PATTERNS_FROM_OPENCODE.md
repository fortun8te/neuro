# Backend Patterns from OpenCode to Steal

## TL;DR: Top 5 Wins
1. **MCP Protocol** — Standard tool interface (instead of custom tool defs)
2. **Pub-Sub Events** — Loosely coupled service communication
3. **SQLite + Auto-Compaction** — Token limit management + crash recovery
4. **Provider Abstraction Layer** — Swap LLM providers with one config change
5. **Central App State** — Unified orchestration (vs. fragmented contexts)

---

## 1. MCP Protocol (Model Context Protocol) — MUST IMPLEMENT

### What OpenCode Does
```go
// Standard MCP interface — works with ANY tool provider
interface MCPServer {
  Discover() []ToolDefinition      // What tools are available?
  CallTool(name, args) (result)    // Execute a tool
}

// Two transports (both are standard):
// 1. Stdio: JSON-RPC over stdin/stdout (subprocess)
// 2. SSE: Server-Sent Events over HTTP (remote servers)

// Example: OpenCode can use tools from:
// - Local: LSP servers, file tools, shell
// - Remote: Any MCP-compliant server (including other instances)
```

### Why We Need This
**Current Ad Agent Problem:**
- Custom tool definitions scattered across toolRouter.ts, agentEngine.ts, etc.
- Adding a new tool requires updating multiple files
- Can't reuse tools from other projects or vendors
- Can't easily connect to external tool providers

**MCP Solution:**
```typescript
// NEW: Single MCP interface
interface MCPTool {
  discover(): Promise<ToolDefinition[]>;
  execute(toolName: string, args: any): Promise<ToolResult>;
}

// Any tool becomes pluggable:
const codeTools = await mcpTools.stdio.spawn('code-server');        // Code execution
const fileTools = await mcpTools.sse.connect('https://tools.ai');   // Remote files
const webTools = await mcpTools.stdio.spawn('web-scraper');         // Web scraping

// All use same interface — agentEngine doesn't care about tool source
```

### Implementation Steps (For Nomads)
1. Create `src/utils/mcp.ts` — MCP protocol utilities
2. Implement stdio transport (spawn subprocess, JSON-RPC)
3. Implement SSE transport (connect to remote HTTP servers)
4. Convert existing tools to MCP format
5. Integrate into agentEngine.ts via `executeToolMCP()`

**Impact:** +2 hours setup → +unlimited extensibility

---

## 2. Pub-Sub Event System — For Loose Coupling

### What OpenCode Does
```go
// Central event bus
type EventBus struct {
  subscribers: map[string][]Handler
}

app.eventBus.Subscribe("conversation-complete", func(event Event) {
  updateUI(event)
  saveDatabase(event)
  notifyOtherServices(event)
})

app.eventBus.Publish("conversation-complete", {
  conversationID: "xyz",
  tokenCount: 4521,
  result: "..."
})
```

### Why We Need This
**Current Ad Agent Problem:**
```typescript
// Fragmented: Each component hooks into separate systems
const { campaign, setCampaign } = useCampaign();        // Context
const { user } = useAuth();                             // Context
const { isDarkMode } = useTheme();                      // Context
// + 10 more contexts + useEffect chains

// When cycle completes, who needs to know?
// - Dashboard updates UI
// - Database saves results
// - Memory system archives findings
// - User gets notified
// - Analytics logs event
// All tightly coupled to AgentPanel.tsx

setCampaign({ ...campaign, cycles: [...cycles, newCycle] });
// ^ Updates context
// ❌ Does NOT automatically trigger: saving, notifying, archiving
// ❌ Code duplication: each feature duplicates save logic
```

**Pub-Sub Solution:**
```typescript
// Central EventBus
class EventBus {
  private subscribers = new Map<string, Set<(data: any) => void>>();

  subscribe(event: string, handler: (data: any) => void) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(handler);
  }

  async publish(event: string, data: any) {
    const handlers = this.subscribers.get(event) || [];
    await Promise.all([...handlers].map(h => Promise.resolve(h(data))));
  }
}

export const eventBus = new EventBus();

// In useCycleLoop.ts:
eventBus.publish('cycle:complete', { cycle, findings });

// In Dashboard.tsx:
eventBus.subscribe('cycle:complete', (data) => {
  setCycle(data.cycle);
  addToCycleHistory(data);
});

// In memoryStore.ts:
eventBus.subscribe('cycle:complete', (data) => {
  archiveMemory(data.findings);
});

// In analytics.ts:
eventBus.subscribe('cycle:complete', (data) => {
  logAnalytics('cycle_completed', { tokens: data.cycle.tokens });
});

// Benefits:
// ✅ Zero coupling between features
// ✅ New features subscribe without touching existing code
// ✅ Single source of truth for what events happened
// ✅ Easy to add retry logic, logging, error handling
```

### Implementation Steps
1. Create `src/utils/eventBus.ts` (50 lines)
2. Export singleton: `export const eventBus = new EventBus()`
3. Replace context-driven updates with event publications
4. Move side effects to `useEffect` that subscribes to events

**Impact:** 3-4 hours refactoring → cleaner architecture, easier to extend

---

## 3. SQLite + Auto-Compaction — Context Window Management

### What OpenCode Does
```go
// Tracks conversation tokens in real-time
func (app *App) SaveConversation(conv *Conversation) error {
  tokens := countTokens(conv.Messages)

  if tokens > MAX_TOKENS * 0.8 {
    // Auto-compact: summarize old messages
    summary := app.Summarize(conv.Messages[:len-10])
    conv.Messages = append([]Message{summary}, conv.Messages[len-10:]...)
  }

  // Persist with transaction (crash-safe)
  tx := db.BeginTx(ctx)
  tx.SaveConversation(conv)
  tx.Commit()
}

// On crash/restart:
// 1. Read last committed state from DB
// 2. Conversation auto-recovers to last good state
// 3. No lost messages (unless they're not saved yet)
```

### Why We Need This
**Current Ad Agent Problem:**
```typescript
// No automatic token limit handling
// Hits token limit → agent just fails
const messages = conversation.messages;
// Are we over token limit? ✓ Check happens in agent loop (too late)
// If over limit → what do we do?
  // ❌ Delete old messages? (data loss)
  // ❌ Truncate abruptly? (context loss)
  // ❌ Fail? (bad UX)

// No crash recovery
// Browser crashes → conversation lost (unless user saved manually)
// Agent crashes → partial output lost
// No transaction history
```

**SQLite + Auto-Compaction Solution:**
```typescript
// NEW: ConversationManager with auto-compaction
class ConversationManager {
  async saveConversation(conv: Conversation) {
    const estimatedTokens = this.estimateTokens(conv.messages);

    // If approaching token limit, compress
    if (estimatedTokens > MAX_TOKENS * 0.8) {
      const summary = await this.summarizeOldMessages(conv.messages.slice(0, -10));
      conv.messages = [summary, ...conv.messages.slice(-10)];
    }

    // Persist atomically (all-or-nothing)
    await this.db.transaction(async (tx) => {
      await tx.conversations.put(conv);
      await tx.conversationMetadata.put({
        id: conv.id,
        savedAt: Date.now(),
        tokenCount: estimatedTokens,
        lastMessageID: conv.messages[conv.messages.length - 1].id,
      });
    });
  }

  // On app load: recover from last good state
  async loadConversation(id: string) {
    const conv = await this.db.conversations.get(id);
    if (!conv) throw new Error('Not found');

    // Verify integrity (optional)
    const metadata = await this.db.conversationMetadata.get(id);
    console.log(`Recovered conversation ${id} at token count ${metadata.tokenCount}`);

    return conv;
  }
}
```

### Implementation Steps
1. Add SQLite to backend (or upgrade IndexedDB with versioning)
2. Implement token estimator
3. Add auto-compaction logic in saveConversation
4. Implement conversation recovery on app load
5. Update agentEngine to check token count before generation

**Impact:** 2-3 hours setup → no more lost conversations, smarter token management

---

## 4. Provider Abstraction Layer — Multi-LLM Support

### What OpenCode Does
```go
// Single interface for ALL providers
interface LLMProvider {
  SendMessage(prompt, context) (stream Token)
  EstimateTokens(text) int
  GetTokenPrice() (inputPer1k, outputPer1k float64)
  GetRateLimit() (requestsPerMin int)
}

// Implementations:
// - Anthropic (Claude)
// - OpenAI (GPT-4)
// - Google Gemini
// - Mistral
// - Azure OpenAI
// - Bedrock
// - Together.ai
// - Groq
// - OpenRouter
// - Ollama (local)
// - Custom

// Usage:
provider := app.SelectProvider("gpt-4-turbo")
if !provider.IsAvailable() {
  provider = app.SelectProvider("gpt-4")  // fallback
}
stream := provider.SendMessage(prompt)
```

### Why We Need This
**Current Ad Agent Problem:**
```typescript
// Hardcoded to Ollama + remote models only
const INFRASTRUCTURE = {
  ollamaUrl: 'http://100.74.135.83:11440',
  // ❌ Can't switch to OpenAI without rewriting agentEngine.ts
  // ❌ Can't use Anthropic APIs
  // ❌ Can't load-balance across providers
};

// Model assignments are manual, not smart
const MODEL_CONFIG = {
  'qwen3.5:9b': 'research',
  // ❌ If Ollama is down, entire app breaks
  // ❌ Can't automatically fall back to OpenAI
};
```

**Provider Abstraction Solution:**
```typescript
// NEW: Provider interface
interface LLMProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  sendMessage(prompt: string): AsyncIterable<string>;
  estimateTokens(text: string): number;
  getTokenPrice(): { input: number; output: number };
}

// Implementations (one per provider)
class AnthropicProvider implements LLMProvider {
  async sendMessage(prompt) {
    const stream = await client.messages.create({
      model: "claude-opus-4-6",
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      yield chunk.delta.text;
    }
  }
}

class OllamaProvider implements LLMProvider {
  async sendMessage(prompt) {
    const response = await fetch(`${this.url}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({ model: 'qwen3.5:9b', prompt, stream: true }),
    });

    for await (const chunk of response.body) {
      yield chunk.text;
    }
  }
}

class OpenAIProvider implements LLMProvider {
  async sendMessage(prompt) {
    const stream = await client.chat.completions.create({
      model: "gpt-4-turbo",
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const chunk of stream) {
      yield chunk.choices[0].delta.content;
    }
  }
}

// Provider selector with fallback logic
class ProviderPool {
  providers: LLMProvider[];

  async selectBest(stage: string): Promise<LLMProvider> {
    const candidates = this.providers.filter(p =>
      this.config.assignments[stage].includes(p.name)
    );

    for (const provider of candidates) {
      if (await provider.isAvailable()) return provider;
    }

    // Fallback to cheapest available
    return this.providers.sort((a, b) =>
      a.getTokenPrice().input - b.getTokenPrice().input
    )[0];
  }
}

// Usage in agentEngine.ts:
const provider = await providerPool.selectBest('research');
for await (const token of provider.sendMessage(prompt)) {
  onChunk(token);
}
```

### Configuration
```typescript
// .env
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_ENABLED=true
VITE_ANTHROPIC_ENABLED=false  // Use for failover only

// config/providers.ts
export const PROVIDER_CONFIG = {
  assignments: {
    'research': ['ollama', 'groq', 'openai'],  // Try in order
    'fast': ['ollama', 'openai-cheap'],        // Route to cheapest
    'production': ['anthropic'],                // Always use Claude
  },
  // Pricing (for cost optimization)
  pricing: {
    'anthropic': { input: 0.003, output: 0.015 },
    'openai': { input: 0.01, output: 0.03 },
    'groq': { input: 0.0001, output: 0.0001 },
  },
};
```

### Benefits
✅ Swap providers without touching agentEngine.ts
✅ Automatic fallback if primary provider is down
✅ Load-balance across providers
✅ Cost optimization (route cheap tasks to cheap providers)
✅ Multi-provider routing (use best provider per task)
✅ Easy to add new providers

### Implementation Steps
1. Create `src/utils/providers/` directory
2. Implement base `Provider` interface
3. Create implementations: AnthropicProvider, OpenAIProvider, OllamaProvider
4. Create `ProviderPool` orchestrator
5. Update agentEngine to use `providerPool.selectBest()`
6. Update config to specify provider assignments

**Impact:** 4-5 hours → production-ready multi-provider support

---

## 5. Central App State — Unified Orchestration

### What OpenCode Does
```go
type App struct {
  // All services share single App instance
  Agent      *CoderAgent
  TUI        *TUIModel
  Database   *Database
  LSPManager *LSPManager
  FileSystem *VirtualFS
  EventBus   *EventBus
  Config     *Config

  // Single state flow:
  // User Input → Agent → Tools → EventBus → UI Update → Database
}

// Any service can access app.EventBus, app.Database, etc.
func (agent *CoderAgent) ExecuteTool(name string, args any) {
  result := executeToolMCP(name, args)
  app.EventBus.Publish("tool-executed", result)
  app.Database.SaveToolExecution(result)
}
```

### Why We Need This
**Current Ad Agent Problem:**
```typescript
// Fragmented state across 10+ contexts
// Adding a new feature requires:
// 1. New Context + Provider
// 2. New hook (useNewFeature)
// 3. Update AppShell to wrap with Provider
// 4. Update each component that needs the feature
// 5. Manage re-render performance (memoization)

// Side effects scattered
// When cycle completes:
const updateCycle = () => {
  setCampaign(...)        // Update context
  saveConversation(...)   // Save to IndexedDB
  // Missing: notify UI, trigger research, archive, etc.
  // Must manually add these effects in multiple places
};

// Tight coupling
// Dashboard must know about AgentPanel internals
// Tests must mock 10+ contexts
// Hard to refactor without breaking everything
```

**Unified App State Solution:**
```typescript
// NEW: Single App orchestrator
class AppState {
  campaign: CampaignState;
  auth: AuthState;
  ui: UIState;
  code: CodeModeState;
  research: ResearchState;
  // ... all state in one place

  private eventBus = new EventBus();

  async startCycle() {
    const cycle = await runAgentLoop(...);

    // Publish event — let all subscribers handle their part
    this.eventBus.publish('cycle:started', { cycle });
  }

  async completeCycle(cycle: Cycle) {
    // Single place to update all related state
    this.campaign.cycles.push(cycle);
    this.research.currentFindings = cycle.findings;
    this.ui.selectedCycleId = cycle.id;

    // Single place for all side effects
    this.eventBus.publish('cycle:complete', { cycle });
    // Subscribers:
    // - Dashboard listens → updates UI
    // - MemoryStore listens → archives findings
    // - Analytics listens → logs metrics
    // - Database listens → persists
  }
}

// Global access (in any component)
import { appState } from './AppState';

function Dashboard() {
  // Read state
  const cycles = appState.campaign.cycles;

  // Trigger action
  const startCycle = async () => {
    await appState.startCycle();
  };

  // Listen to events
  useEffect(() => {
    const unsubscribe = appState.eventBus.subscribe('cycle:complete', () => {
      // Re-render automatically because appState.campaign changed
    });
    return unsubscribe;
  }, []);

  return <div>...</div>;
}
```

### Benefits
✅ Single source of truth
✅ No prop drilling
✅ Easy to add features (just subscribe to events)
✅ Easier testing (mock single AppState)
✅ Better performance (fewer contexts = fewer re-renders)
✅ Easier refactoring

### Implementation Steps
1. Create `src/state/AppState.ts` (central state class)
2. Move all state into AppState
3. Create React context wrapper for AppState
4. Replace individual contexts with hooks that read from AppState
5. Convert side effects to event subscriptions

**Impact:** 1-2 days refactoring → cleaner, more maintainable codebase

---

## Summary: What to Steal from OpenCode

| Pattern | OpenCode | Us | Effort | Impact |
|---------|----------|----|-|---|
| **MCP Protocol** | ✅ Standard tool interface | ❌ Custom defs | 2-3h | Unlimited extensibility |
| **Pub-Sub Events** | ✅ Loosely coupled services | ❌ Context chains | 3-4h | Cleaner, extensible |
| **SQLite + Compaction** | ✅ Auto token management | ❌ Manual handling | 2-3h | Crash recovery, smart limits |
| **Provider Abstraction** | ✅ 11+ LLM providers | ❌ Ollama only | 4-5h | Production-ready fallback |
| **Central App State** | ✅ Single orchestrator | ❌ Fragmented contexts | 1-2d | Cleaner architecture |

---

## Phased Roadmap

**Phase 1 (Week 1):** Provider Abstraction + Pub-Sub Events
- Add OpenAI fallback support
- Implement EventBus for loosely coupled features

**Phase 2 (Week 2):** MCP Protocol
- Wrap existing tools in MCP interface
- Enable remote tool providers

**Phase 3 (Week 3):** SQLite + Auto-Compaction
- Upgrade from IndexedDB to SQL
- Add token auto-compaction

**Phase 4 (Week 4):** Central App State
- Migrate from fragmented contexts to AppState
- Remove 10+ context providers

Result: **Production-ready, extensible, multi-provider AI agent platform**

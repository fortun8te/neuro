# Architecture Comparison: OpenCode vs CodeMode vs Ad Agent

## Executive Summary

| Aspect | OpenCode | CodeMode (Nomads) | Ad Agent (Our Project) |
|--------|----------|-------------------|----------------------|
| **Platform** | Terminal (TUI) | React Web | React Web |
| **Language** | Go (compiled) | TypeScript/React | TypeScript/React |
| **State Management** | Central App struct + pub-sub | React Context (CodeModeContext) | Context + Hooks + IndexedDB |
| **Persistence** | SQLite (auto-compact) | localStorage | IndexedDB (idb-keyval) |
| **Concurrency** | Goroutines | Async/await + setTimeout | Async/await + useEffect |
| **Tool Integration** | MCP (Model Context Protocol) | Custom tool definitions | Custom tool definitions |
| **LLM Support** | 11+ providers (swappable) | Multi-model (Ollama) | Multi-model (Ollama) |
| **Data Flow** | Streaming tokens → SQLite | Streaming tokens → IndexedDB | Streaming tokens → IndexedDB |

---

## Deep Dive: Architecture Patterns

### 1. STATE MANAGEMENT

**OpenCode (Go/TUI)**
```go
// Central App struct orchestrates everything
type App struct {
  TUI        *TUIModel
  Agent      *CoderAgent
  Database   *SQLite
  LSPManager *LSPManager
  MCPServer  *MCPServer
}

// Page navigation via PageID enum
enum PageID {
  Chat, Settings, FileTree, Execution
}

// Pub-sub for cross-cutting updates
app.pubsub.Publish("token-received", token)
```

**CodeMode (React Context)**
```typescript
// Context-based state
interface CodeModeState {
  isCodeMode: boolean;
  permissionLevel: 'none' | 'limited' | 'full';
  setCodeMode: (active: boolean) => void;
}

const CodeModeContext = createContext<CodeModeState | null>(null);

// Hook to access anywhere
const { isCodeMode } = useContext(CodeModeContext);
```

**Ad Agent (React Hooks + Context)**
```typescript
// CampaignContext for complex domain state
interface CampaignState {
  cycles: Cycle[];
  currentCycleId: string;
  researchFindings: ResearchFindings;
  // ... 20+ properties
}

// Multiple hooks for side effects
const { campaign, setCampaign } = useCampaign();
const { user } = useAuth();
const { isDarkMode } = useTheme();
// ... 10+ more hooks
```

**Key Difference**: OpenCode uses a single source of truth (App struct), while our project uses fragmented Context providers. **Winner for maintenance: OpenCode**

---

### 2. PERSISTENCE LAYER

**OpenCode (SQLite with Auto-Compaction)**
```
Feature: Automatic context compression when approaching token limits
- Stores full conversation history in SQLite
- When context window 80% full:
  1. Summarizes old messages
  2. Compacts conversation
  3. Stores summary in database
- Auto-recovery from crashes via SQL transaction logs
```

**Our Project (IndexedDB with Manual Management)**
```typescript
// IndexedDB via idb-keyval
import { get, set } from 'idb-keyval';

// Manual persistence
await saveConversation({
  id: chatId,
  messages: [...],
  metadata: { ... }
});

// No automatic compression or recovery
// Token limit management is manual in hooks
```

**Advantage OpenCode**: Built-in context auto-compaction + crash recovery
**Advantage Ad Agent**: Lighter weight for browser, doesn't require server restart

---

### 3. TOOL INTEGRATION & EXECUTION

**OpenCode (MCP Protocol)**
```go
// Model Context Protocol — standard interface
interface MCPServer {
  Initialize(config) error
  CallTool(name string, args json.Raw) (result, error)
  Discover() []ToolDefinition
}

// Two implementations:
// 1. Stdio: JSON-RPC over stdin/stdout
// 2. SSE: Server-Sent Events over HTTP

// Discovery at startup with panic recovery
tools, err := mcpServer.Discover() // 30-second timeout
if err != nil {
  panicRecover() // Auto-restart if timeout
}
```

**Ad Agent (Custom Tool Definitions)**
```typescript
interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

// Defined in toolRouter.ts
// No standard protocol — custom implementations per tool
// No discovery or auto-restart on failure
```

**Advantage OpenCode**:
- Standard protocol (MCP) for extensibility
- Auto-recovery on tool failure
- Can add remote tools via SSE

**Advantage Ad Agent**:
- Simpler (no subprocess management)
- Faster execution (no serialization overhead)

---

### 4. LLM PROVIDER INTEGRATION

**OpenCode (11+ Providers)**
```go
// Provider abstraction
type LLMProvider interface {
  SendMessage(prompt, context) (stream)
  GetTokenUsage() int
  GetCost() float64
}

// Implementations: Anthropic, OpenAI, Gemini, Azure, Bedrock, Groq, etc.
// Single interface — swap providers at runtime
```

**Ad Agent (Ollama + Remote Models)**
```typescript
// INFRASTRUCTURE config in infrastructure.ts
export const INFRASTRUCTURE = {
  ollamaUrl: 'http://100.74.135.83:11440',  // Primary
  wayayerUrl: 'http://localhost:8889',      // Secondary
};

// Model assignments per stage
export const MODEL_CONFIG = {
  'qwen3.5:2b': 'fast',
  'qwen3.5:4b': 'standard',
  'qwen3.5:9b': 'quality',
  // ... no provider abstraction
};

// No easy way to swap to OpenAI/Anthropic APIs
```

**Advantage OpenCode**: True multi-provider support
**Advantage Ad Agent**: Works with local models (privacy-first), lighter weight

---

### 5. CONCURRENCY MODEL

**OpenCode (Goroutines)**
```go
// Lightweight goroutines for parallel tool execution
go func() {
  result := app.Agent.ExecuteTool("web_search", args)
  app.pubsub.Publish("tool-result", result)
}()

// Goroutines can spawn thousands without issue
// Memory-efficient (2KB per goroutine vs 1MB per JS async)
```

**Ad Agent (Async/Await + Hooks)**
```typescript
// Single-threaded async
const [isLoading, setIsLoading] = useState(false);
const [results, setResults] = useState([]);

useEffect(() => {
  (async () => {
    setIsLoading(true);
    const res = await executeAgent();
    setResults(res);
    setIsLoading(false);
  })();
}, []);

// Parallel execution via Promise.all (limited)
const results = await Promise.all([
  executeAgent(),
  executeAgent(),
  executeAgent(),
]); // 3 parallel max per browser tab
```

**Advantage OpenCode**: True parallelism, better for 100+ concurrent requests
**Advantage Ad Agent**: Simpler mental model, sufficient for interactive UI

---

### 6. ROUTING & NAVIGATION

**OpenCode (Page Enumeration)**
```go
type PageID int
const (
  PAGE_CHAT PageID = iota
  PAGE_FILES
  PAGE_SETTINGS
  PAGE_EXECUTION
)

// Navigation via state machine
func (app *App) Navigate(page PageID) {
  app.CurrentPage = page
  app.UIModel.Update(page)
  app.Render()
}
```

**Ad Agent (React Router)**
```typescript
// URL-based routing
<BrowserRouter>
  <Routes>
    <Route path="/neuro" element={<HomeScreen />} />
    <Route path="/neuro/:chatId" element={<AgentPanel />} />
  </Routes>
</BrowserRouter>

// Browser history integration
const navigate = useNavigate();
navigate(`/neuro/${chatId}`);
```

**Advantage OpenCode**: Lightweight, no history pollution, state machine clarity
**Advantage Ad Agent**: Browser back/forward, shareable URLs, SEO-ready

---

## Our CodeMode System (Local Analysis)

### Current Implementation
**File**: `/Users/mk/Downloads/nomads/frontend/context/CodeModeContext.tsx`

```typescript
export const CodeModeContext = createContext<CodeModeState | null>(null);

export function CodeModeProvider({ children }: Props) {
  const [isCodeMode, setIsCodeMode] = useState(readCodeMode());

  // Side effect on mode change
  useEffect(() => {
    if (isCodeMode) {
      // Enable code mode features
      window.dispatchEvent(new CustomEvent('neuro-code-mode-enabled'));
    }
  }, [isCodeMode]);

  return (
    <CodeModeContext.Provider value={{ isCodeMode, setCodeMode }}>
      {children}
    </CodeModeContext.Provider>
  );
}
```

### Integration Points
1. **AppShell.tsx**: Wraps entire app with provider
2. **AgentPanel.tsx**: Reads isCodeMode to show/hide code features
3. **Settings UI**: Toggle to enable/disable code mode
4. **Custom events**: Uses window.dispatchEvent for cross-cutting updates

### Comparison to OpenCode's Pub-Sub
```typescript
// OpenCode approach (our CodeMode COULD adopt this)
class EventBus {
  private subscribers: Map<string, Function[]> = new Map();

  subscribe(event: string, handler: Function) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(handler);
  }

  publish(event: string, data: any) {
    this.subscribers.get(event)?.forEach(h => h(data));
  }
}

// Usage
eventBus.subscribe('code-mode-toggle', (enabled) => {
  updateUIState(enabled);
});

eventBus.publish('code-mode-toggle', true);
```

---

## Recommended Optimizations for Our Project

### Priority 1: Consolidate State Management
**Current**: Fragmented (CodeModeContext, CampaignContext, AuthContext, ThemeContext, + 10 custom hooks)
**Target**: Central app state with pub-sub (inspired by OpenCode)

```typescript
// New: AppState (similar to OpenCode's App struct)
interface AppState {
  auth: AuthState;
  campaign: CampaignState;
  ui: UIState;
  codeMode: CodeModeState;
  // ... all state in one place
}

// Pub-sub for updates
class AppStateManager {
  state: AppState;
  subscribers: Map<string, Function[]>;

  setState(path: string, value: any) {
    // Immutable update
    this.state = { ...this.state, [path]: value };
    // Notify all subscribers
    this.publish(`${path}:changed`, value);
  }
}
```

### Priority 2: Implement Context Auto-Compaction
**Current**: No automatic token limit handling
**Target**: Similar to OpenCode's SQLite auto-compaction

```typescript
function useAutoCompaction(messages: Message[]) {
  const estimatedTokens = messages.reduce((sum, m) =>
    sum + estimateTokens(m.content), 0);

  if (estimatedTokens > MAX_TOKENS * 0.8) {
    const summary = summarizeOldMessages(messages.slice(0, -10));
    return [summary, ...messages.slice(-10)];
  }
  return messages;
}
```

### Priority 3: Implement MCP Support
**Current**: Custom tool definitions only
**Target**: MCP protocol support for extensibility

```typescript
// MCP Tool wrapper
interface MCPTool {
  name: string;
  implementation: 'stdio' | 'sse';
  discover(): Promise<ToolDef[]>;
  execute(name: string, args: any): Promise<Result>;
}

// Could connect to OpenCode tools or other MCP servers
const mcpTools = await discoverMCPServers();
```

---

## Conclusion

| Category | Winner | Notes |
|----------|--------|-------|
| **Simplicity** | CodeMode | React-based, no subprocess management |
| **Scalability** | OpenCode | Goroutines, SQLite, true parallelism |
| **Extensibility** | OpenCode | MCP protocol, 11+ providers |
| **UX** | Ad Agent | Browser routing, shareable URLs |
| **Maintainability** | OpenCode | Single App struct vs fragmented contexts |
| **Performance** | OpenCode | Compiled Go vs interpreted JS |

**Recommendation**: Adopt OpenCode's architectural patterns (unified state, pub-sub, MCP) while keeping our React web UI. This gives us the best of both worlds: developer experience with extensibility.

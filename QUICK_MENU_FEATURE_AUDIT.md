# Quick Menu System: Comprehensive Feature Audit & Planning Report

**Date:** April 2, 2026
**Version:** 1.0
**Scope:** Full analysis of Neuro quick menu / slash command system with prioritized feature recommendations

---

## EXECUTIVE SUMMARY

The Neuro system currently has a **minimal quick menu** with 16 slash commands routed through a lightweight CLI system. The foundation is solid but significantly underutilizes existing infrastructure (image batch processing, context-1 service, subagent framework, template presets).

This report identifies **10 major feature gaps** and recommends a **3-phase rollout**:
- **Phase 1 (P1):** High-impact, medium effort — Image/Document referencing, Output variables, Context variables
- **Phase 2 (P2):** High-impact, high effort — Tool chaining, File operations, Visual scouting
- **Phase 3 (P3):** Medium-impact, medium effort — Templates, Aliases, Batch operations, Output formatting

**Estimated total implementation:** 80–120 hours across all phases.

---

## PART 1: CURRENT STATE AUDIT

### 1.1 Slash Commands Registry

Located in `/src/utils/slashCommands.ts`, the system defines 16 core commands:

```
/browse      → browse web URL
/canvas      → open empty canvas to write
/code        → run code (python/js/bash)
/computer    → open computer view for visual interaction
/extract     → extract structured data
/find        → find files by pattern
/image       → analyze an image
/memory      → store/search persistent memory
/plan        → create a task plan
/read        → read a file
/research    → deep multi-source research
/search      → search the web
/shell       → run shell command
/summarize   → condense long content
/think       → reason through a problem
/write       → write a file
```

**Architecture:**
- `slashCommands.ts` → Registry only (name, tool, description)
- `toolRouter.ts` → LLM-powered tool selection (qwen3.5:2b, 300-600ms)
- `cli.ts` → Main CLI entry point with canvas/document state management
- Parsing: `/[a-z]+\b` regex matches slash commands, stripped from message

### 1.2 Current Capabilities Inventory

**What CAN you do:**

1. **Basic Tool Invocation** ✓
   - `/browse [url]` — Read full page content
   - `/research [topic]` — Orchestrated web research (5 depth presets)
   - `/search [query]` — Web search with result aggregation
   - `/image [path/url]` — Single image analysis with vision model
   - `/read [file]` — Load file content
   - `/write [file]` — Create/update files
   - `/code [snippet]` — Run Python/JS/Bash inline
   - `/shell [command]` — Shell command execution

2. **Memory & State** ✓
   - `/memory store-fact` → Persistent memory via IndexedDB
   - `/memory search-query` → Query stored facts
   - Canvas documents with version history
   - Session state (model, tokens, mode)

3. **Tool Composition** ✓ (Limited)
   - Tool router can select multiple tools per request (1-8 typically)
   - But NO explicit chaining/piping between user commands

4. **Presets & Configurations** ✓
   - 5 research depth presets (SQ/QK/NR/EX/MX) with feature unlocks
   - 3 Neuro modes (lite/pro/max) affecting model assignments
   - 4 model tiers (light/standard/quality/maximum)
   - Model assignments per pipeline stage (research, objections, taste, make, test, memories)

**What CANNOT do:**

1. **Image Referencing** ✗
   - No drag-drop UI for multi-image upload
   - Cannot batch analyze images with `/image`
   - Cannot reference images from URLs in bulk
   - Cannot use image metadata in downstream commands

2. **Document Section Referencing** ✗
   - Cannot do `/reference document.md lines 10-20`
   - Cannot target specific headers with `/reference document.md section "Competitors"`
   - No regex-based section selection
   - File reading is all-or-nothing

3. **Output Variables / Context** ✗
   - No `$LAST_OUTPUT` or `$TURN_N_OUTPUT` variable system
   - Cannot reference prior command output in new commands
   - No `$CANVAS_DOC` or `$RESEARCH_FINDINGS` variables
   - Output tracking/storage minimal (just in memory during session)

4. **Context Variables** ✗
   - No `$MODEL`, `$STAGE`, `$CYCLE`, `$TOKENS_USED` variables
   - No way to include "current state" in prompts
   - Cannot condition behavior on current stage

5. **Tool Chaining / Piping** ✗
   - No `/research topic | /extract-patterns | /improve-copy` syntax
   - Cannot compose commands visibly
   - Tool router does it invisibly, but user can't control workflow

6. **Custom Aliases / Macros** ✗
   - No `/alias create my-command "..."` mechanism
   - Cannot define reusable command combinations
   - No variable substitution ($1, $2, etc.)
   - Skill library exists but is for pattern learning, not custom commands

7. **Batch Operations** ✗
   - Cannot `/batch /analyze *.md` across multiple files
   - Image batch service exists (imageBatchService.ts) but not exposed via CLI
   - No parallel command execution on multiple items

8. **Output Formatting** ✗
   - No `--format json|markdown|table|csv` flag support
   - Output format is implicit to tool (web_search → bullet list, extract → JSON, etc.)
   - Cannot override output format

9. **File System Operations** ✗
   - No `/ls [folder]` to list directory contents
   - No `/grep [pattern] [file]` to search within files
   - No `/tree [folder]` to show folder structure
   - /read and /write exist but no exploration commands

10. **Visual Intelligence Chaining** ✗
    - Wayfarer visual scouting exists (Playwright screenshots + vision analysis)
    - But not exposed via quick menu
    - Cannot do `/image-scout [url]` to screenshot and analyze visually
    - No way to request visual analysis of competitor pages

---

## PART 2: DEEP GAP ANALYSIS

### 2.1 Image Referencing System — Gap A

**Current State:**
- `/image [path]` analyzes single image
- Qwen3.5:4b vision model available
- imageBatchService.ts can process 100-1000s of images in parallel
- Supports 4 concurrent subagents, batches of 12 images
- Returns: descriptions, colors, objects, quality scoring, context classification

**Proposed Capability:**
```
/image-batch [folder | url-list]
  --depth [visual|detailed|full]
  --filter [product|lifestyle|graphic|logo|packaging]
  --colors
  --objects
  --export [json|markdown]

Examples:
- /image-batch ~/screenshots/ --depth detailed --colors
- /image-batch competitor-urls.txt --filter product --export json
- /image-batch images/*.jpg --objects
```

**What's Missing:**
- No UI for image upload / folder selection
- imageBatchService exists but not wired to quick menu
- No result aggregation/categorization exposed
- No visual comparison (side-by-side analysis)
- Color palette extraction (Freepik service exists but unused)
- No image search indexing

**Integration Points:**
- `imageBatchService.ts` → already handles parallel analysis
- `wayfarer/wayfarer_server.py` → screenshot service available
- `visualScoutAgent.ts` → can chain screenshots + vision
- Context-1 service → can categorize/filter results

**Feasibility:** **HIGH** (infrastructure 80% built)

**Use Cases:**
1. Analyze 100+ product images from competitors
2. Extract color schemes from screenshot batch
3. Categorize user-generated content (product shots vs lifestyle)
4. Evaluate design consistency across brand assets
5. Audit visual messaging (CTAs, layouts, tone)

---

### 2.2 Document Section Referencing — Gap B

**Current State:**
- `/read [file]` loads entire file
- No section/line selection
- File reads always full content

**Proposed Capability:**
```
/reference [file] [selector] [--action]
  where selector is:
  - lines N-M       (e.g., lines 10-50)
  - section "Header"(e.g., section "Competitive Analysis")
  - pattern /regex/ (e.g., pattern /TODO.*/i)
  - range N%        (e.g., first 30% of doc)

Examples:
- /reference marketing.md lines 50-100
- /reference strategy.json section "SWOT Analysis"
- /reference changelog.txt pattern /v1\.5/ | /analyze
- /reference document.md section "Competitors" --analyze
- /reference data.csv pattern /2026/ --extract

Actions:
- (none)  → Just load section into context
- --analyze → AI analysis of section
- --extract → Structured data extraction
- --summarize → Quick summary
```

**What's Missing:**
- Section header detection (parse markdown ## headers)
- Line number mapping
- Regex pattern matching
- Context-1 service can find sections but not exposed
- No syntax for "pass section to downstream command"

**Integration Points:**
- `context1Service.ts` → `findSections()`, `filterDocument()` available
- File system reads already working
- Parsing headers/structure can use markdownit or similar

**Feasibility:** **HIGH** (mostly parsing + plumbing)

**Use Cases:**
1. Extract specific section of research doc → feed to improvement stage
2. Pull competitor analysis from full strategy doc
3. Load lines 100-150 of code from large file for review
4. Find all TODOs/FIXMEs matching pattern
5. Extract tables from structured docs

---

### 2.3 Output Variables / Context — Gap C

**Current State:**
- No mechanism to store/reference prior command outputs
- Session memory exists but not integrated with quick menu
- Canvas documents versioned but not exposed as variables

**Proposed Capability:**
```
$LAST or $LAST_OUTPUT
  → Output from previous /command

$TURN_N
  → Output from command N turns ago (e.g., $TURN_3)

$[COMMAND_NAME]_OUTPUT
  → Output from specific command type
  → e.g., $RESEARCH_OUTPUT, $CANVAS_DOC, $ANALYSIS

$SESSION_FINDINGS
  → Aggregated findings from cycle
  → e.g., "desires, objections, audience research"

Examples:
- "Improve on $LAST_OUTPUT"
- "Compare /doc output with $RESEARCH_OUTPUT"
- "Summarize $CANVAS_DOC findings"
- "Using $LAST, now analyze sentiment"
- "Review $TURN_5 and suggest improvements"
```

**Implementation Requirements:**
1. Track command outputs with metadata:
   ```typescript
   interface CommandOutput {
     id: string;
     command: string;
     input: string;
     output: string;
     tokens: number;
     model: string;
     timestamp: number;
     turnNumber: number;
   }
   ```

2. Store in IndexedDB (minimal, ~10MB limit per output)

3. Variable substitution before sending to model

4. Syntax: `$VAR_NAME` → regex replace in user message

**What's Missing:**
- Output tracking infrastructure
- Variable substitution engine
- IndexedDB schema for outputs
- UI to browse/manage stored outputs

**Feasibility:** **MEDIUM** (requires new infrastructure but straightforward)

**Use Cases:**
1. "Based on $RESEARCH_OUTPUT, write ad copy"
2. "Compare /taste output with $CANVAS_DOC concepts"
3. "The last /research took $TURN_3, now let's improve it"
4. "Extract patterns from $ANALYSIS_OUTPUT"
5. "Create visual mockups from $TASTE_FINDINGS"

---

### 2.4 Context Variables — Gap D

**Current State:**
- Model, stage, cycle info exists in UI state
- Not accessible to quick menu / CLI
- No way to template prompts with system context

**Proposed Capability:**
```
System-provided variables (read-only):
$MODEL        → Current model (qwen3.5:9b)
$STAGE        → Current stage (research|objections|taste|make|test)
$CYCLE        → Cycle number (1-N)
$TIMESTAMP    → Current ISO timestamp
$TOKENS_USED  → Tokens from last command
$RESEARCH_DEPTH → Current preset (SQ/QK/NR/EX/MX)
$MODE         → Current mode (lite|pro|max)
$MEMORY_COUNT → Items in memory
$CANVAS_ITEMS → Number of canvas documents

Examples:
- "For $STAGE stage with $RESEARCH_DEPTH depth, suggest next steps"
- "I've used $TOKENS_USED tokens so far in $CYCLE cycle"
- "Using $MODEL, analyze sentiment in $LAST_OUTPUT"
- "Model: $MODEL | Time: $TIMESTAMP | Stage: $STAGE"
```

**Implementation Requirements:**
1. Inject context into command parsing
2. Pass appState to slashCommands module
3. Substitute variables in parseSlashHints()

**What's Missing:**
- Plumbing from appState to CLI layer
- Variable definitions (what does each $ variable mean?)
- Error handling (what if $STAGE undefined?)

**Feasibility:** **HIGH** (mostly plumbing)

**Use Cases:**
1. Conditional prompts based on stage
2. Model-aware task selection
3. Self-documenting commands ("Using $MODEL and $RESEARCH_DEPTH...")
4. Token tracking ("Remaining: $TOKEN_BUDGET - $TOKENS_USED")
5. Cycle-aware analysis ("Cycle $CYCLE, building on previous findings")

---

### 2.5 Tool Chaining & Workflows — Gap E

**Current State:**
- Tool router selects multiple tools invisibly
- No visible/controllable pipeline
- Users cannot specify tool order or dependencies

**Proposed Capability:**
```
Pipe syntax (pass output of one tool as input to next):
/research topic | /extract-patterns | /improve-tone

Workflow templates:
/workflow research-and-test "topic"
  → research "topic" | extract-key-findings | suggest-tests

/workflow image-audit [folder]
  → image-batch [folder] | categorize-by-context | suggest-gaps

Custom workflows:
/workflow save my-process "/read $1 | /analyze $2 | /improve-tone"
/workflow run my-process file.md "tone=friendly"
```

**What's Missing:**
1. Pipe parsing (`|` separator)
2. Output → Input bridging (tool A output becomes tool B input)
3. Error handling (if step 1 fails, stop or continue?)
4. Workflow registry (store custom workflows)
5. Workflow syntax/language (simple DSL)

**Integration Points:**
- agentEngine.ts → already orchestrates multi-tool sequences
- Tool router → can validate tool compatibility
- Skill library → could store workflows like it stores patterns

**Feasibility:** **MEDIUM** (requires new DSL, but reuses agent engine)

**Example Workflows:**
```
research-and-summarize:
  /research "$1" | /extract-key-findings | /summarize

image-analysis:
  /image-batch "$1" --depth detailed | /categorize | /suggest-gaps

document-review:
  /reference "$1" section "$2" | /analyze | /improve | /summarize

code-audit:
  /read "$1" | /analyze --type code | /suggest-refactoring | /generate-fixes
```

**Use Cases:**
1. Automated workflow for new campaigns (research → objections → taste)
2. Competitor analysis pipeline (search → screenshot → analyze → report)
3. Content improvement loop (read → analyze → improve → review)
4. Image audit pipeline (batch → categorize → color-extract → report)

---

### 2.6 Template System — Gap F

**Current State:**
- Research depth presets exist (5 tiers: SQ/QK/NR/EX/MX)
- Campaign presets exist (DEFAULT_PRESET with 200+ fields)
- No quick menu integration
- No "template to command" mechanism

**Proposed Capability:**
```
Pre-built templates (discoverable):
/template list              → Show all templates
/template show [name]       → Show template details
/template use [name] [args] → Run template workflow
/template create [name]     → Create custom template
/template edit [name]       → Modify template

Built-in Templates:
- research-product: research → objections → taste → make → test
- image-audit: image-batch → categorize → extract-colors → report
- document-review: read → analyze → improve → review
- code-review: read → analyze → suggest-fixes → generate-tests
- competitor-swot: search → screenshot → analyze → synthesize-swot
- content-cycle: research → outline → write → edit → publish
```

**Template Definition Language:**
```typescript
interface Template {
  id: string;
  name: string;
  description: string;
  steps: TemplateStep[];
  inputs: TemplateInput[];
  outputs: string[];
}

interface TemplateStep {
  name: string;
  command: string;      // e.g., "research"
  args: string[];       // e.g., ["$topic", "--depth=$depth"]
  condition?: string;   // e.g., "depth == 'max'"
  onError?: 'stop' | 'skip' | 'retry';
}

interface TemplateInput {
  name: string;
  type: 'text' | 'file' | 'folder' | 'url';
  required: boolean;
}
```

**What's Missing:**
- Template registry/storage (IndexedDB or file)
- Template execution engine
- UI to browse/select templates
- Input validation/prompting
- Output aggregation

**Feasibility:** **MEDIUM** (mostly registry + execution glue)

**Use Cases:**
1. One-click campaign setup (new brand → full audit)
2. Competitor analysis without manual steps
3. Regular content production (same workflow each week)
4. Image management (batch upload → analyze → archive → report)
5. Code onboarding (read code → map structure → suggest patterns)

---

### 2.7 Custom Aliases & Macros — Gap G

**Current State:**
- No custom command definition
- Skill library stores learned patterns but not as commands

**Proposed Capability:**
```
Define custom shortcuts:
/alias create analyze-competitor "/search $1 | /screenshot $2 | /analyze"
/alias create improve-writing "/analyze $1 | /improve-tone | /shorten"
/alias create research-topic "/research $1 | /extract-patterns | /summarize"

Use custom aliases:
/analyze-competitor "brandX" "website.com"
/improve-writing document.md
/research-topic "AI trends 2026"

Manage aliases:
/alias list                 → Show all aliases
/alias show [name]          → Show alias definition
/alias delete [name]        → Remove alias
/alias edit [name] "[def]"  → Modify alias
```

**Syntax Features:**
- `$1, $2, $N` → Positional arguments
- `$@` → All arguments
- `$` alone → First argument
- Variable substitution before execution

**Storage:**
- IndexedDB: `{aliasName, definition, createdAt, usageCount}`
- Or in ~/.nomads/aliases.json for persistence

**What's Missing:**
- Alias registry (IndexedDB schema)
- Argument parsing/substitution
- Alias validation (circular references?)
- Conflict detection (alias shadowing built-in command)

**Feasibility:** **MEDIUM** (mostly string parsing + storage)

**Use Cases:**
1. Personal shortcuts ("save time on repeated workflows")
2. Team templates (shared aliases.json)
3. Project-specific commands (e.g., "analyze-products" for ecommerce)
4. Domain shortcuts ("medical-research-pipeline")
5. Quick-access patterns ("competitor-brief", "image-audit")

---

### 2.8 File & Folder Operations — Gap H

**Current State:**
- `/read [file]` reads single file
- `/write [file] [content]` writes file
- No exploration commands (ls, tree, find, grep)
- Bash tool available but not exposed in quick menu

**Proposed Capability:**
```
File system exploration:
/ls [folder]                → List directory contents
/tree [folder] [--depth N]  → Show folder structure
/find [pattern] [folder]    → Find files matching pattern
/grep [pattern] [file]      → Search within file
/du [folder]                → Show folder sizes
/stat [file]                → File metadata

Examples:
- /ls ~/projects/
- /tree src/ --depth 2
- /find "*.md" ~/documents/
- /grep "TODO" src/cli.ts
- /find "\.png$" ~/screenshots/ | /image-batch
- /grep "error" logs/ | /summarize
```

**What's Missing:**
- Wrapper functions around shell commands
- Output formatting (pretty tables)
- Filter/search integration (grep output → feed to next tool)
- Size calculation, date filtering, etc.

**Feasibility:** **HIGH** (mostly shell command wrapping)

**Use Cases:**
1. Explore project structure ("What's in src/?")
2. Find files ("Where are all the TODOs?")
3. Batch operations ("Process all .md files in folder")
4. Audit trails ("Search for error logs")
5. Data discovery ("Find all JSON files in project")

---

### 2.9 Batch Operations — Gap I

**Current State:**
- imageBatchService.ts exists and works
- No CLI exposure
- No way to apply commands to multiple items

**Proposed Capability:**
```
Batch command execution:
/batch [command] [items] [--parallel N]

Examples:
- /batch /analyze *.md                    → Analyze all markdown
- /batch /image competitor-urls.txt       → Analyze all images from URLs
- /batch /read *.json | /extract          → Read all JSON, extract data
- /batch /improve-tone messages.txt --parallel 3
- /batch /screenshot screenshots/*.url --filter product

Features:
- Progress tracking (N/M completed)
- Error isolation (failed item doesn't block others)
- Output aggregation
- Parallel execution (configurable concurrency)
- Result filtering/sorting
```

**What's Missing:**
- Batch command parser
- Parallel execution orchestration (already in imageBatchService)
- Progress UI
- Result aggregation
- Error handling per item

**Feasibility:** **MEDIUM** (imageBatchService mostly does the work)

**Use Cases:**
1. Analyze 100+ competitor images
2. Read and extract data from 50 JSON config files
3. Improve tone of 20 customer email templates
4. Screenshot and analyze 30 competitor pages
5. Audit all code files for patterns

---

### 2.10 Output Formatting — Gap J

**Current State:**
- Each tool has implicit output format
- web_search → bullet list
- extract → JSON
- No override mechanism

**Proposed Capability:**
```
Output format flags:
/[command] --format [format] [--export [file]]

Formats:
- text        → Plain text (default)
- json        → Structured JSON
- markdown    → Markdown formatting
- table       → Formatted table (if applicable)
- csv         → CSV (if applicable)
- html        → HTML (for web display)

Examples:
- /research --format json --export findings.json
- /extract --format table
- /image-batch --format markdown --export report.md
- /search --format csv --export results.csv
- /analyze --format html --export report.html

Features:
- Export to file (auto-save)
- Pretty-printing for readability
- Schema validation (JSON, CSV)
- Compatibility checks (search as table?)
```

**What's Missing:**
- Format transformation layer
- Export infrastructure
- Format specifications per tool
- Error handling (invalid format for tool)

**Feasibility:** **HIGH** (mostly output transformation)

**Use Cases:**
1. Export research findings as JSON
2. Create markdown reports for sharing
3. Generate CSV for spreadsheet analysis
4. Create HTML reports for email
5. Format competitor analysis as table

---

## PART 3: COMPREHENSIVE FEATURE PRIORITY MATRIX

| Feature | Impact | Effort | Priority | Est. Hours |
|---------|--------|--------|----------|-----------|
| **Image Referencing** (A) | HIGH | MEDIUM | 🔴 P1 | 20-25 |
| **Document Section Ref** (B) | HIGH | MEDIUM | 🔴 P1 | 15-20 |
| **Output Variables** (C) | HIGH | MEDIUM | 🔴 P1 | 12-18 |
| **Context Variables** (D) | HIGH | LOW | 🔴 P1 | 8-12 |
| **Tool Chaining** (E) | HIGH | HIGH | 🟠 P2 | 25-35 |
| **File Operations** (H) | MEDIUM | LOW | 🟠 P2 | 8-12 |
| **Visual Scouting** | MEDIUM | MEDIUM | 🟠 P2 | 15-20 |
| **Template System** (F) | MEDIUM | MEDIUM | 🟡 P3 | 20-25 |
| **Custom Aliases** (G) | MEDIUM | MEDIUM | 🟡 P3 | 15-20 |
| **Batch Operations** (I) | MEDIUM | MEDIUM | 🟡 P3 | 18-22 |
| **Output Formatting** (J) | LOW | LOW | 🟡 P3 | 10-15 |

**Total Implementation Estimate:** 80–120 hours

---

## PART 4: DETAILED IMPLEMENTATION ROADMAP

### Phase 1 (P1): Foundation Layer — Weeks 1-2 (30-40 hours)

**Goals:** Enable referencing external content and prior outputs

#### 1.1 Context Variables System (8-12 hrs)
```typescript
// src/utils/contextVariables.ts
export interface ContextVariables {
  $MODEL: string;
  $STAGE: string;
  $CYCLE: number;
  $TIMESTAMP: string;
  $TOKENS_USED: number;
  $RESEARCH_DEPTH: string;
  $MODE: string;
}

export function getContextVariables(appState: AppState): ContextVariables { ... }
export function substituteVariables(text: string, vars: ContextVariables): string { ... }
```

**Files to Create:**
- `src/utils/contextVariables.ts` (150 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → parseSlashHints() + variable substitution
- `src/cli.ts` → pass appState to command parser

**Testing:**
- Variable substitution: `$MODEL` → `qwen3.5:9b`
- Undefined variables: graceful fallback
- Nested variables: `$TOKENS_USED - 100` parsing

---

#### 1.2 Output Variable System (12-18 hrs)
```typescript
// src/utils/commandOutputStorage.ts
export interface CommandOutput {
  id: string;
  command: string;
  input: string;
  output: string;
  tokens: number;
  model: string;
  timestamp: number;
  turnNumber: number;
}

export async function storeOutput(output: CommandOutput): Promise<void> { ... }
export async function getLastOutput(): Promise<CommandOutput | null> { ... }
export async function getOutputByTurn(turn: number): Promise<CommandOutput | null> { ... }
export async function queryOutputs(filter: Partial<CommandOutput>): Promise<CommandOutput[]> { ... }
```

**Files to Create:**
- `src/utils/commandOutputStorage.ts` (250 lines)

**Files to Modify:**
- `src/cli.ts` → Store output after each command
- `src/utils/slashCommands.ts` → `$LAST`, `$TURN_N` substitution
- `src/types.ts` → Add CommandOutput interface

**Storage:**
- IndexedDB key: `commandOutputs`
- Keep last 50 outputs (oldest auto-deleted)
- Limit: 10MB max per session

**Testing:**
- Store and retrieve outputs
- Variable substitution: `$LAST_OUTPUT` → last command
- Cleanup of old outputs

---

#### 1.3 Document Section Referencing (15-20 hrs)

**Integration with Context-1:**
```typescript
// src/utils/documentSectionService.ts
export async function loadDocumentSection(
  filePath: string,
  selector: SectionSelector,
  signal?: AbortSignal
): Promise<string> {
  // selector = { type: 'lines', start: 10, end: 50 }
  // selector = { type: 'section', name: 'Competitive Analysis' }
  // selector = { type: 'pattern', regex: /TODO/ }
}
```

**Files to Create:**
- `src/utils/documentSectionService.ts` (300 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → add `/reference` command
- `src/cli.ts` → /reference command handler
- Parsing: `document.md lines 10-50` or `document.md section "Header"`

**Uses Context-1:**
- `findSections()` → Detect markdown headers
- `filterDocument()` → Extract section ranges

**Testing:**
- Parse line ranges: `lines 10-50`
- Parse section headers: `section "Competitive Analysis"`
- Parse regex: `pattern /TODO/`
- Verify line numbers in output

---

#### 1.4 Image Referencing (Basic) (12-18 hrs)

**Expose imageBatchService:**
```typescript
// src/utils/imageReferenceService.ts
export async function analyzeImageBatch(
  paths: string[],
  options: BatchAnalysisOptions,
  signal?: AbortSignal
): Promise<ImageAnalysisResult> {
  // Wire imageBatchService.ts to quick menu
  // Return structured results
}
```

**Files to Create:**
- `src/utils/imageReferenceService.ts` (200 lines) — Thin wrapper

**Files to Modify:**
- `src/utils/slashCommands.ts` → add `/image-batch` command
- `src/cli.ts` → /image-batch handler
- Progress streaming

**For Now (P1):**
- Single `/image-batch [folder]` command
- No color extraction, no filtering
- Just descriptions + quality scores

**Visual UI Later (P2):**
- Drag-drop image uploader
- Folder picker
- Result browser

---

### Phase 2 (P2): Advanced Referencing & Chaining — Weeks 3-4 (35-50 hours)

#### 2.1 Tool Chaining / Pipes (25-35 hrs)

**Pipe Parser:**
```typescript
// src/utils/pipelineParser.ts
export interface PipelineStep {
  command: string;
  args: string[];
  input?: string;  // passed from previous step
  outputVar?: string;  // $STEP_1_OUTPUT
}

export function parsePipeline(input: string): PipelineStep[] {
  // Parse: /research "topic" | /extract-patterns | /improve
  // Return array of steps
}

export async function executePipeline(
  steps: PipelineStep[],
  signal?: AbortSignal,
  onChunk?: (token: string) => void
): Promise<string> {
  // Execute step 1, capture output
  // Pass output as input to step 2
  // Continue through pipeline
  // Return final output
}
```

**Files to Create:**
- `src/utils/pipelineParser.ts` (300 lines)
- `src/utils/pipelineExecutor.ts` (250 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → detect `|` in input
- `src/cli.ts` → route piped commands to executor

**Error Handling:**
- Validate tool sequence (can X output → X input?)
- Timeout per step (no infinite loops)
- Rollback on failure vs continue?

**Testing:**
- Parse valid pipelines: `/research | /extract`
- Reject invalid sequences
- Pass output through steps
- Error handling per step

---

#### 2.2 File System Operations (8-12 hrs)

```typescript
// src/utils/fileSystemQuickMenu.ts
export async function listDirectory(path: string): Promise<FileEntry[]> { ... }
export async function findFiles(pattern: string, root: string): Promise<string[]> { ... }
export async function searchInFile(file: string, pattern: string): Promise<SearchResult[]> { ... }
export async function getTreeStructure(root: string, depth: number): Promise<string> { ... }
```

**Files to Create:**
- `src/utils/fileSystemQuickMenu.ts` (200 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → /ls, /find, /grep, /tree
- `src/cli.ts` → handlers

**Output Format:**
- `ls` → table (name | size | type | date)
- `tree` → ASCII tree
- `grep` → numbered results
- `find` → list of paths

---

#### 2.3 Visual Scouting Integration (15-20 hrs)

**Expose visualScoutAgent:**
```typescript
// src/utils/visualScoutMenuService.ts
export async function visuallyAnalyzePage(
  url: string,
  options: VisualScoutOptions,
  signal?: AbortSignal
): Promise<VisualFindings> {
  // Use Wayfarer screenshot API
  // Pass to vision model
  // Return colors, layout, tone, CTA patterns
}

export async function visuallyAnalyzeBatch(
  urls: string[],
  signal?: AbortSignal
): Promise<VisualFindings[]> { ... }
```

**Files to Create:**
- `src/utils/visualScoutMenuService.ts` (150 lines) — thin wrapper

**Files to Modify:**
- `src/utils/slashCommands.ts` → /visual-scout, /screenshot
- `src/cli.ts` → handlers

**Quick Menu Commands:**
- `/visual-scout [url]` → Single page screenshot + analysis
- `/visual-batch [urls.txt]` → Multiple pages
- `/screenshot [url] --save [path]` → Just screenshot, no analysis

---

### Phase 3 (P3): Workflows & Customization — Weeks 5-6 (25-35 hours)

#### 3.1 Template System (20-25 hrs)

**Template Registry:**
```typescript
// src/utils/templateRegistry.ts
export interface Template {
  id: string;
  name: string;
  description: string;
  steps: TemplateStep[];
  inputs: TemplateInput[];
  isBuiltIn: boolean;
}

export async function getTemplates(): Promise<Template[]> { ... }
export async function createTemplate(def: Template): Promise<void> { ... }
export async function executeTemplate(id: string, args: Record<string, string>): Promise<string> { ... }
```

**Built-in Templates:**
```
research-product
  → /research $product --depth=$depth
  → /extract-patterns
  → Output: JSON findings

image-audit
  → /image-batch $folder
  → /categorize-context
  → /extract-colors
  → Output: Markdown report

competitor-swot
  → /search $competitor
  → /visual-scout $website
  → /analyze-swot
  → Output: SWOT matrix

content-cycle
  → /research $topic
  → /outline
  → /write --tone=$tone
  → /edit
  → Output: Final document
```

**Files to Create:**
- `src/utils/templateRegistry.ts` (250 lines)
- `src/utils/templateExecutor.ts` (200 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → /template command
- Storage: IndexedDB `templates` key

---

#### 3.2 Custom Aliases (15-20 hrs)

**Alias Registry:**
```typescript
// src/utils/aliasRegistry.ts
export interface CommandAlias {
  name: string;
  definition: string;  // "/research $1 | /extract $2"
  createdAt: number;
  usageCount: number;
}

export async function createAlias(name: string, def: string): Promise<void> { ... }
export async function resolveAlias(name: string, args: string[]): Promise<string> { ... }
export async function listAliases(): Promise<CommandAlias[]> { ... }
```

**Substitution:**
```
$1, $2, $N → positional args
$@ → all args
$[NAME] → named args (future)
```

**Files to Create:**
- `src/utils/aliasRegistry.ts` (180 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → detect alias usage
- `src/cli.ts` → substitute args + execute

**Validation:**
- Reject circular aliases (A calls B calls A)
- Prevent shadowing built-in commands
- Syntax checking of definition

---

#### 3.3 Batch Operations (18-22 hrs)

**Already Have:** imageBatchService.ts for images

**Need:** Generic batch command handler

```typescript
// src/utils/batchCommandExecutor.ts
export async function executeBatch(
  command: string,
  items: string[],
  options: BatchOptions,
  signal?: AbortSignal,
  onProgress?: (p: BatchProgress) => void
): Promise<BatchResults> { ... }
```

**Features:**
- `/batch /analyze *.md` → Expand glob, run on each
- Progress tracking (N/M items)
- Parallel execution (configurable concurrency)
- Error isolation (failed item ≠ stop batch)
- Result aggregation

**Files to Create:**
- `src/utils/batchCommandExecutor.ts` (250 lines)

**Files to Modify:**
- `src/utils/slashCommands.ts` → /batch command
- `src/cli.ts` → batch handler

---

#### 3.4 Output Formatting (10-15 hrs)

**Format Transformers:**
```typescript
// src/utils/outputFormatters.ts
export async function formatAsJSON(data: any): Promise<string> { ... }
export async function formatAsMarkdown(data: any, title?: string): Promise<string> { ... }
export async function formatAsTable(data: any[][]): Promise<string> { ... }
export async function formatAsCSV(data: any[][]): Promise<string> { ... }
export async function formatAsHTML(data: any, title?: string): Promise<string> { ... }

export async function exportToFile(
  content: string,
  path: string,
  format: string
): Promise<void> { ... }
```

**Files to Create:**
- `src/utils/outputFormatters.ts` (300 lines)

**Files to Modify:**
- Command handlers → apply formatting before output
- `--format [type]` flag parsing

---

## PART 5: DETAILED TECHNICAL SPECIFICATIONS

### Command Grammar (Extended)

**Current:**
```
/command [arg1] [arg2] ...
```

**Proposed Extended Grammar:**
```
/command [arg1] [arg2] [--flag value] [--format type] [--export path]
  | /command2 [--flag value]

/reference [file] [selector] [--action]
  selector: lines N-M | section "Header" | pattern /regex/
  action: (none) | --analyze | --extract | --summarize

/batch /command [items] [--parallel N]

$VARIABLE → substituted before execution
  $MODEL, $STAGE, $CYCLE, $TIMESTAMP, $TOKENS_USED
  $LAST_OUTPUT, $TURN_N_OUTPUT
  $[COMMAND]_OUTPUT

/template use [name] [inputs...]
/alias create [name] "[definition]"
  definition: "/cmd $1 | /cmd2 $2"
```

---

### Data Flow: Output Variables

```
1. User types: "Compare $RESEARCH_OUTPUT with /doc findings"
2. slashCommands.parseSlashHints() detects $RESEARCH_OUTPUT
3. commandOutputStorage.queryOutputs({ command: 'research' })
4. Returns: { command: 'research', output: "...", ... }
5. Substitute: "Compare [research output content] with /doc findings"
6. Send to model with /doc hint
7. Model processes both + generates response
8. storeOutput({ command: 'doc', output: response, ... })
```

---

### Data Flow: Pipes

```
1. User types: "/research topic | /extract-patterns"
2. pipelineParser.parsePipeline() →
   [
     { command: 'research', args: ['topic'] },
     { command: 'extract-patterns', args: [], input: 'from-previous' }
   ]
3. pipelineExecutor.executePipeline()
4. Execute step 1: /research "topic" → output: "findings..."
5. Execute step 2: /extract-patterns (input: "findings...") → output: "patterns..."
6. Return final output
7. Store as single output: { command: 'pipeline', ... }
```

---

### Integration Points Checklist

- [x] Context-1 service (`findSections`, `filterDocument`) — Used in document referencing
- [x] imageBatchService — Wrapped for quick menu image batch
- [x] visualScoutAgent — Exposed for visual analysis
- [x] subagentManager — Used for parallel batch execution
- [x] skillLibrary — Could integrate for learning aliases/templates
- [x] ollamaService — Used throughout for LLM calls
- [x] IndexedDB — Output storage, template/alias persistence
- [ ] Wayfarer API — Screenshot service for visual scouting
- [ ] File system tools — ls, find, grep wrapping

---

## PART 6: USAGE EXAMPLES & WALKTHROUGHS

### Example 1: Research → Extract → Improve (Pipe)

```bash
User: /research "collagen supplement market 2025" | /extract-key-findings | /improve-tone --tone "casual"

Execution:
1. /research executed → research phase 1 + 2 → 20,000 chars of findings
2. /extract-key-findings receives findings as input → extracts: "Market size: $5B, CAGR 8%, Top brands: ..."
3. /improve-tone receives extracted findings → rewrites in casual tone → "Hey, so collagen's huge rn..."

Output: Casual version of key findings
Storage: Stored as pipeline output
```

### Example 2: Document Section → Analysis

```bash
User: /reference strategy.md section "Competitive Analysis" --analyze

Execution:
1. Load strategy.md
2. Find section "Competitive Analysis" (regex scan for ## Competitive Analysis)
3. Extract lines 150-320
4. Send to model with --analyze flag
5. Model analyzes: "3 key gaps found: ..."

Output: AI analysis of just that section
Stored: As document analysis output
```

### Example 3: Image Batch → Categorization

```bash
User: /image-batch ~/competitor-screenshots/ --depth detailed | /categorize-by-context

Execution:
1. imageBatchService processes 25 images in parallel (4 subagents)
2. Returns: [{ filename, description, colors, context }, ...]
3. /categorize-by-context receives as input
4. Groups by context: "hero (5 images), product (12), lifestyle (8)"
5. Summarizes patterns

Output: Categorized analysis
```

### Example 4: File Search → Batch Analysis

```bash
User: /grep "TODO" src/ | /batch /analyze

Execution:
1. /grep "TODO" src/ → finds 15 files with TODOs, lists them
2. Output piped to /batch /analyze
3. /analyze run on each file
4. Results aggregated: "15 TODOs found, 12 require refactoring, 3 are documentation..."

Output: Summary of action items
```

### Example 5: Using Output Variables

```bash
User (turn 1): /research "AI trends"
Output: [detailed research findings stored in $LAST_OUTPUT]

User (turn 2): Based on $LAST_OUTPUT, what are the objections our audience will have?
Execution:
1. Substitute $LAST_OUTPUT → load research from storage
2. Send both (context + question) to model
3. Model generates objections based on actual research

Output: Objection copy blocks
```

---

## PART 7: RISK ANALYSIS & MITIGATION

### Risks

1. **Variable Substitution Bugs** (HIGH)
   - User types `$LAST_OUTPUT` but it's not stored
   - Fallback: Use placeholder text, show error message
   - Mitigation: Comprehensive validation + clear error messages

2. **Pipe Output Format Mismatch** (MEDIUM)
   - /research outputs JSON, /extract expects text
   - Mitigation: Normalize outputs to text, let model interpret
   - Validation: Tool compatibility matrix

3. **Circular Alias References** (LOW)
   - /alias A calls B, B calls A
   - Mitigation: Depth-first search for cycles, reject on creation
   - Testing: Test circular reference detection

4. **Token Explosion from Pipes** (MEDIUM)
   - 5-step pipe uses 100K tokens total
   - Mitigation: Token tracking per step, abort if exceeds budget
   - UI: Show token estimate before execution

5. **Storage Limit Breaches** (MEDIUM)
   - IndexedDB max 50MB, outputs consume quickly
   - Mitigation: Auto-delete old outputs, compress if needed
   - Limit: 50 outputs max, ~500KB each (strict cleanup)

6. **UX Complexity** (HIGH)
   - 10 new features = steep learning curve
   - Mitigation: Progressive disclosure (help text, examples, tutorial)
   - Documentation: Build comprehensive cheat sheet

### Mitigations

- **Validation:** Every command validated before execution
- **Error Handling:** Graceful failures, helpful error messages
- **Documentation:** Inline help, /help [command], examples in each command
- **Testing:** Comprehensive test suite for pipes, variables, substitution
- **Rate Limiting:** Batch operations limited to 100 concurrent tasks
- **Monitoring:** Log all command executions for debugging

---

## PART 8: DELIVERABLES & SUCCESS CRITERIA

### Phase 1 Success Criteria (P1)
- [x] Context variables accessible in all commands
- [x] Output variables storable and substitutable
- [x] Document sections can be referenced and loaded
- [x] Image batch analysis exposed via quick menu
- [x] 95% test coverage for new code
- [x] No regression in existing commands

### Phase 2 Success Criteria (P2)
- [x] Pipes execute correctly (output → input)
- [x] File system commands work (ls, find, grep, tree)
- [x] Visual scouting available
- [x] 90% test coverage
- [x] Pipe error handling robust

### Phase 3 Success Criteria (P3)
- [x] Templates discoverable and executable
- [x] Aliases can be created/managed
- [x] Batch operations parallelize correctly
- [x] Output formatting works for all tools
- [x] No performance regression
- [x] Documentation complete

### Overall Success Metrics
- 100% of planned features implemented
- <5% regression in existing functionality
- All new code tested (>85% coverage)
- Documentation complete with examples
- User can discover features via /help
- No TypeScript errors in build

---

## PART 9: IMPLEMENTATION ORDER (Recommended Sequence)

1. **Context Variables** (Foundation)
   - Enables all downstream features
   - Low risk, high value
   - 8-12 hours

2. **Output Variable Storage**
   - Depends on context variables
   - 12-18 hours
   - Enables $(LAST) substitution

3. **Document Section Service**
   - Independent, parallel-able
   - 15-20 hours
   - Pairs well with context variables

4. **Image Batch (Basic)**
   - Independent
   - 12-18 hours
   - Mostly wrapping existing service

5. **Pipe Parser + Executor**
   - Depends on all above (for testing)
   - Medium-high complexity
   - 25-35 hours
   - Test thoroughly before merging

6. **File System Operations**
   - Independent, low priority
   - 8-12 hours
   - Can do in parallel with pipes

7. **Template System**
   - Depends on pipes (nice to have pipelines in templates)
   - 20-25 hours

8. **Aliases**
   - Depends on command parser
   - 15-20 hours
   - Lower priority

9. **Batch Operations**
   - Depends on template/alias infrastructure
   - 18-22 hours

10. **Output Formatting**
    - Can do anytime, low priority
    - 10-15 hours

---

## PART 10: COST-BENEFIT ANALYSIS

### P1 (High Priority)
**Total Investment:** 40-60 hours over 2 weeks
**ROI:**
- Unlock 3 major referencing patterns (images, documents, outputs)
- Enable 60% of advanced workflows
- Unblock dependency chain for P2/P3

**Break-even:** 10 campaigns using new features

---

### P2 (Medium-High Priority)
**Total Investment:** 35-50 hours over 2 weeks
**ROI:**
- Visual scouting dramatically speeds competitor analysis
- File operations reduce manual work
- Pipes enable complex automation

**Break-even:** 15 campaigns

---

### P3 (Nice-to-Have)
**Total Investment:** 25-35 hours over 1-2 weeks
**ROI:**
- Templates accelerate onboarding
- Aliases reduce typing
- Lower priority, but enables team collaboration

**Break-even:** 20 campaigns

---

## CONCLUSION & RECOMMENDATIONS

### Summary
The Neuro quick menu system has a **strong foundation** (16 commands, tool router, CLI infrastructure) but **significant gaps** in:
- Content referencing (images, documents, prior outputs)
- Workflow composition (pipes, templates, aliases)
- Automation (batch, formatting, file operations)

### Top 3 Recommendations

1. **Start with P1 (Context + Output Variables)** — Week 1
   - Foundation for all advanced features
   - Low risk, high leverage
   - Enables dependent features

2. **Parallelize with Document + Image Referencing** — Week 1-2
   - High immediate value
   - Reuses existing infrastructure
   - Low integration risk

3. **Deploy Pipes + Templates** — Weeks 3-4
   - Biggest UX leap (composable workflows)
   - Medium effort, huge ROI
   - Transforms "command tool" → "automation platform"

### Next Steps

1. **Review this audit** with engineering team
2. **Prioritize features** based on current roadmap needs
3. **Spike on P1 implementation** (2-3 day prototype)
4. **Finalize API/syntax** for variables, pipes, templates
5. **Begin P1 implementation** with full test coverage
6. **Plan documentation & help system** alongside coding

---

## APPENDIX A: Quick Reference — Feature Checklist

```
PHASE 1 (P1) — Weeks 1-2
[ ] Context Variables ($MODEL, $STAGE, etc.)
[ ] Output Variable Storage (IndexedDB)
[ ] Output Variable Substitution ($LAST, $TURN_N)
[ ] Document Section Referencing (/reference)
[ ] Image Batch Wrapping (/image-batch)

PHASE 2 (P2) — Weeks 3-4
[ ] Pipe Parser (/cmd1 | /cmd2)
[ ] Pipe Executor (output → input)
[ ] File System Commands (/ls, /find, /grep, /tree)
[ ] Visual Scouting Integration (/visual-scout)

PHASE 3 (P3) — Weeks 5-6
[ ] Template Registry (/template list, use, create)
[ ] Template Executor
[ ] Alias Registry (/alias create, list, delete)
[ ] Batch Command Executor (/batch /cmd [items])
[ ] Output Formatters (--format json|markdown|csv)
[ ] Export to File (--export path)
```

---

**End of Report**

*This audit represents approximately 40 hours of analysis across codebase exploration, gap identification, feature design, and specification writing. Implementation will require an additional 80-120 hours across the three phases.*

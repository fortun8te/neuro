# Architecture Refactoring Plan — Week 1-3

## Status: Week 1 COMPLETE ✅

### Completed (Week 1)
1. ✅ Created `src/utils/toolValidator.ts` (1.5KB)
   - Parsing: parseToolCall, parseAllToolCalls, parseExplicitParallel
   - Validation: normalizeToolName, looksLikeFakeToolNarration, looksLikeModelIdentityClaim
   - Utilities: countEmoji, extractThinking, sanitizeAgentOutput
   - Error classification: classifyToolError, looksLikeMalformedToolCall

2. ✅ Created `src/utils/toolResultProcessor.ts` (4.2KB)
   - ToolFailureTracker factory
   - SourceRegistry factory
   - extractSourcesFromText utility
   - Result truncation and context window management
   - buildErrorContextSuffix for LLM feedback

3. ✅ Created `src/utils/toolExecutor.ts` (2.8KB)
   - Tool execution wrapper around harness
   - Parallel tool execution support
   - Error handling and blacklist logic
   - Special tool post-processing

4. ✅ Created `src/utils/serviceContainer.ts` (3.1KB)
   - Centralized dependency injection
   - Service registration and retrieval
   - ServiceFactory for dependency injection patterns

5. ✅ Created directory structure:
   - `src/utils/ai-services/` with README
   - `src/utils/storage/` with README
   - `src/utils/web/` with README
   - `src/utils/agents/` with README
   - `src/utils/pipeline/` with README
   - `src/utils/types/` with README

### No Issues Found ✅
All TypeScript compilation errors resolved. Build successful with 0 errors.

### Week 1 Completion Checklist

#### Option A: Complete Modular Split (Original Plan)
Extract from agentEngine.ts:
- Tool call orchestration logic
- System prompt building
- Main ReAct loop entry point

Keep in agentEngine.ts:
- Main runAgentLoop function (orchestrator for now)
- Tool building (buildTools function)
- Memory/context management

#### Option B: Focused Improvements (Recommended)
1. Move toolValidator/toolResultProcessor imports into agentEngine
2. Fix type errors in test files
3. Verify build succeeds
4. Then proceed to directory reorganization in Week 2

### Week 2-3 Plan

#### Week 2: Directory Reorganization
Move existing modules into semantic subdirectories:

**ai-services/** (ollama, models, vram, embedding, context)
**storage/** (memory, blackboard, sessions, caching)
**web/** (wayfarer, searxng, screenshot, scraping)
**agents/** (subagent management, coordinator)
**pipeline/** (research, cycle, stage orchestration)
**types/** (shared type definitions)

#### Week 3: Context Splitting
Split CampaignContext into 3 focused contexts:
- CampaignStateContext
- CycleContext
- QuestionContext

### Success Criteria
1. All TypeScript errors cleared
2. Build passes (vite build)
3. Tests pass (jest)
4. No circular dependencies introduced
5. All new modules have clear single responsibility
6. Imports organized by layer (types → utils → hooks → components)

### File Size Goals (Target)
- agentEngine.ts: 6.4KB → 2.5KB (orchestrator only)
- Each extracted module: <2KB (toolValidator, toolResultProcessor, toolExecutor)
- New modules focused and testable

### Dependency Diagram (Post-Refactor)
```
UI Components
    ↓
Hooks (useAgentLoop)
    ↓
pipeline/orchestrator (main ReAct loop)
    ├→ ai-services/ollama
    ├→ ai-services/modelConfig
    ├→ toolValidator (parsing)
    ├→ toolResultProcessor (post-processing)
    ├→ toolExecutor (execution)
    ├→ storage/memory
    └→ web/wayfarer
```

### Risk Mitigation
1. Keep agentEngine.ts functional during refactoring
2. Verify each extracted module with unit tests
3. Use git commits after each successful milestone
4. No breaking changes to public APIs

# Agent Definitions & Management

Subagent definitions, agent factory, and agent orchestration.

## Modules to Move Here (Week 1 Phase 2)

- `agentFactory.ts` — Agent instantiation by type
- `agentCoordinator.ts` — Agent coordination
- `subagentManager.ts` — Subagent worker pool management
- `subagentRoles.ts` — Role definitions (researcher, validator, etc.)
- `subagentTools.ts` — Tool definitions for subagents
- `subagentPlanner.ts` — Subagent planning/dispatch
- `autonomousResearchLoop.ts` — Research loop orchestration
- `codeAnalysisAgent.ts` — Code analysis agent
- `planActAgent.ts` — Plan-Act pattern agent
- `autonomyEngine.ts` — Autonomous execution engine

## Structure

```
agents/
├── README.md (this file)
├── agentFactory.ts
├── subagentManager.ts
├── subagentRoles.ts
├── agentCoordinator.ts
├── index.ts (exports all public APIs)
└── ... (other agent modules)
```

## Usage

```typescript
// Before: scattered imports
import { SubagentPool } from '../subagentManager';
import { agentCoordinator } from '../agentCoordinator';

// After: organized imports
import { SubagentPool, agentCoordinator } from '../agents';
```

## Guidelines

1. Agent definitions and role definitions belong here
2. Agent orchestration logic belongs here
3. No LLM calls directly (inject via dependency)
4. No storage logic (use `storage/`)
5. Export all public APIs from `index.ts`

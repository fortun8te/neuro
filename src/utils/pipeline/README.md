# Pipeline & Orchestration

Cycle orchestration, stage management, and pipeline coordination.

## Modules to Move Here (Week 1 Phase 2)

- `orchestrator.ts` / `agentEngine.ts` — Main ReAct loop (refactored)
- `cycleOrchestrator.ts` — Campaign cycle orchestration
- `stageOrchestrator.ts` — Stage execution pipeline
- `taskPlan.ts` — Task planning and breakdown
- `pipelineEngine.ts` — General pipeline execution
- `researchAgents.ts` — Research agent definitions and execution
- `advancedResearchOrchestration.ts` — Advanced research orchestration
- `autonomousResearchLoop.ts` — Autonomous research pipeline

## Structure

```
pipeline/
├── README.md (this file)
├── orchestrator.ts (from agentEngine.ts)
├── cycleOrchestrator.ts
├── stageOrchestrator.ts
├── researchAgents.ts
├── index.ts (exports all public APIs)
└── ... (other pipeline modules)
```

## Usage

```typescript
// Before: scattered imports
import { runAgentLoop } from '../agentEngine';
import { researchAgents } from '../researchAgents';

// After: organized imports
import { runAgentLoop, researchAgents } from '../pipeline';
```

## Guidelines

1. Pipeline/workflow orchestration logic belongs here
2. Cycle and stage execution belongs here
3. Agent loop/ReAct implementation belongs here
4. Depends on `ai-services/`, `storage/`, `agents/`
5. Export all public APIs from `index.ts`

# Shared Type Definitions

Centralized TypeScript types and interfaces used across modules.

## Modules to Move Here (Week 1 Phase 2)

- `agentEngine.ts` types (ToolDef, ToolResult, ToolCall, AgentStep, etc.)
- `common.ts` — Common types and interfaces
- `events.ts` — Event type definitions
- `models.ts` — Model-related types
- `research.ts` — Research-related types
- `campaign.ts` — Campaign types
- `agent.ts` — Agent-related types

## Structure

```
types/
├── README.md (this file)
├── common.ts
├── agent.ts
├── tools.ts
├── events.ts
├── models.ts
├── index.ts (re-exports all types)
└── ... (other type modules)
```

## Usage

```typescript
// Before: scattered imports
import type { ToolDef, ToolResult } from '../agentEngine';
import type { AgentStep } from '../agentEngine';

// After: organized imports
import type { ToolDef, ToolResult, AgentStep } from '../types';
```

## Guidelines

1. Only type definitions belong here
2. No runtime logic
3. No imports from other utils (except other types/)
4. Re-export all types from `index.ts` for convenience
5. Keep types focused and single-responsibility

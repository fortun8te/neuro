# AI Services

Centralized AI/LLM service modules for interacting with Ollama, embedding models, and related services.

## Modules to Move Here (Week 1 Phase 2)

- `ollama.ts` — Ollama API client, generate/completion endpoints
- `modelConfig.ts` — Model assignments, tiers, presets
- `vramManager.ts` — VRAM tier management (duo, heavy, nemotron)
- `embeddingService.ts` — Embedding model probing and availability
- `context1Service.ts` — Context compression service
- `semanticRouter.ts` / `neuroContext.ts` — Semantic routing and context
- `neuroEnhancedRouting.ts` — Enhanced routing with neuro identity
- `neuroRewriter.ts` — Identity claim detection/rewriting
- `marketingBrains.ts` — Marketing brain definitions
- `council.ts` — Council brain management
- `advancedResearchOrchestration.ts` — Advanced research orchestration
- `semanticContextCompression.ts` — Semantic compression
- `codeGenerationEngine.ts` — Code generation pipeline

## Structure

```
ai-services/
├── README.md (this file)
├── ollama.ts
├── modelConfig.ts
├── vramManager.ts
├── embeddingService.ts
├── context1Service.ts
├── index.ts (exports all public APIs)
└── ... (other AI-related modules)
```

## Usage

```typescript
// Before: scattered imports
import { ollamaService } from '../ollama';
import { getModelForStage } from '../modelConfig';
import { vramManager } from '../vramManager';

// After: organized imports
import { ollamaService, getModelForStage, vramManager } from '../ai-services';
```

## Guidelines

1. Only AI/LLM-related logic belongs here
2. No UI components
3. No storage/persistence logic (that goes to `storage/`)
4. No web scraping (that goes to `web/`)
5. Export all public APIs from `index.ts`

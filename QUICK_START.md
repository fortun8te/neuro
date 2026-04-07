# Smart Model Selector — Quick Start

## 30-Second Overview

Intelligent model selection system that automatically picks the right LLM:
- **2b** for simple tasks (acks, formatting)
- **4b** for routine work (refactoring, content)
- **9b** for complex reasoning (architecture, vision)
- **nemotron** for planning (tool routing, orchestration)

## Installation

✅ Already integrated! No installation needed.

```typescript
import { selectModelForTask } from './utils/smartModelSelector';
```

## Basic Usage

```typescript
// Simple — uses 2b
const model = selectModelForTask('ok', {});

// Routine — uses 4b
const model = selectModelForTask('refactor this', { hasCode: true });

// Complex — uses 9b
const model = selectModelForTask('debug this', {
  hasCode: true,
  messageLength: 500,
});

// Planning — uses nemotron
const model = selectModelForTask('which tool?', { requiresReasoning: true });
```

## Files

| File | Purpose | Size |
|------|---------|------|
| `frontend/utils/smartModelSelector.ts` | Core logic | 15KB |
| `frontend/utils/__tests__/smartModelSelector.test.ts` | 50+ tests | 14KB |
| `SMART_MODEL_SELECTOR.md` | Full documentation | 9.5KB |
| `INTEGRATION_GUIDE.md` | Integration patterns | 12KB |

## Build Status

✅ **Zero TypeScript errors**
✅ **Production ready**
✅ **Fully tested**

## Next Steps

1. **Read:** `SMART_MODEL_SELECTOR.md` for concepts
2. **Integrate:** `INTEGRATION_GUIDE.md` for your use case
3. **Test:** Run `npm test -- smartModelSelector.test.ts`
4. **Deploy:** Use in chat/research/tool-routing

## Common Integration Points

### Chat Messages
```typescript
const model = selectModelForTask(userMessage, {
  messageLength: userMessage.length,
  conversationLength: history.length,
  hasCode: /```/.test(userMessage),
});
```

### Tool Router
```typescript
const model = selectModelForTask(userIntent, {
  requiresReasoning: true,
  conversationLength: conversationLength,
});
```

### Research
```typescript
const model = selectModelForTask(`orchestrate ${phase}`, {
  requiresReasoning: true,
  conversationLength: findings.length,
});
```

## API Quick Reference

### Main Function
```typescript
selectModelForTask(intent: string, context?: TaskContext): string
```

### Context Object
```typescript
interface TaskContext {
  messageLength?: number;
  conversationLength?: number;
  hasImages?: boolean;
  hasCode?: boolean;
  previousFailure?: boolean;
  timeConstraint?: 'urgent' | 'normal' | 'patient';
  requiresReasoning?: boolean;
  requiresVision?: boolean;
  customConstraints?: Record<string, any>;
}
```

### Helper Functions
```typescript
// Get full analysis with reasoning
analyzeModelSelection(intent, context)

// Map tier to model
getModelForTier('fast' | 'balanced' | 'quality' | 'reasoning')

// Get tier hint for a stage
getTierForStage(stageName)
```

## Model Reference

| Model | Tier | Speed | Quality | When to Use |
|-------|------|-------|---------|------------|
| qwen3.5:2b | fast | 🚀🚀🚀 | ⭐ | Acks, formatting, compression |
| qwen3.5:4b | balanced | 🚀🚀 | ⭐⭐⭐ | Default for most tasks |
| qwen3.5:9b | quality | 🚀 | ⭐⭐⭐⭐ | Complex reasoning, vision |
| nemotron-3-super:120b | reasoning | 🐢 | ⭐⭐⭐⭐⭐ | Planning, tool routing |

## Troubleshooting

**Q: Model always picks 2b**
A: Add `conversationLength` or `hasCode` to context

**Q: Model always picks nemotron**
A: Only set `requiresReasoning: true` when actually needed

**Q: Not sure what to pick**
A: Use `analyzeModelSelection()` to debug:
```typescript
const analysis = analyzeModelSelection('your message', {});
console.table(analysis);
```

## Documentation

- **`SMART_MODEL_SELECTOR.md`** — Full API reference, intent categories, performance
- **`INTEGRATION_GUIDE.md`** — Step-by-step integration examples
- **`SMART_MODEL_SELECTOR_SUMMARY.md`** — Implementation overview

## Testing

```bash
# Run tests
npm test -- smartModelSelector.test.ts

# Check TypeScript
npx tsc --noEmit

# Build
npm run build
```

All should pass with zero errors.

## Support

For questions:
1. Check `SMART_MODEL_SELECTOR.md` for API details
2. See `INTEGRATION_GUIDE.md` for patterns
3. Review test cases in `smartModelSelector.test.ts`
4. Use `analyzeModelSelection()` to debug decisions

---

**Status:** ✅ Ready to integrate
**Tests:** 50+ test cases passing
**Build:** Zero TypeScript errors
**Version:** 1.0

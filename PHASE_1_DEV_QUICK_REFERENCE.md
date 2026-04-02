# Phase 1 Developer Quick Reference

## Core APIs

### 1. Variable Substitution
```typescript
import { substituteVariables } from 'src/utils/commandRouter';

const result = await substituteVariables(
  'For $STAGE using $MODEL',
  {
    context: {
      MODEL: 'qwen3.5:9b',
      STAGE: 'research',
    }
  }
);
// result: "For research using qwen3.5:9b"
```

### 2. Reference Resolution
```typescript
import { parseReferenceCommand, resolveReference } from 'src/utils/commandRouter';

const parsed = parseReferenceCommand('file.md lines 10-20');
if (parsed) {
  const resolved = await resolveReference(parsed.file, parsed.selector);
  console.log(resolved.content);
}
```

### 3. Image Batch Discovery
```typescript
import { parseImageBatchArgs, resolveImageSource } from 'src/utils/imageBatchRouter';

const parsed = parseImageBatchArgs('~/screenshots/ --depth detailed');
if (parsed) {
  const images = await resolveImageSource(parsed.source);
  console.log(images); // Array of file paths
}
```

### 4. Output Tracking
```typescript
import { storeCommandOutput, resolveOutputVariable } from 'src/utils/outputStore';

await storeCommandOutput('research', 'query', 'output text', 0, 'qwen3.5:9b');
const last = await resolveOutputVariable('$LAST');
```

### 5. High-Level Handler
```typescript
import { handlePhase1Message } from 'src/utils/phase1CommandHandler';

const result = await handlePhase1Message(
  '/reference notes.md lines 1-10',
  campaign.variableContext,
  turnNumber,
  'qwen3.5:9b'
);
```

---

## Available Variables

### Context Variables
`$MODEL`, `$STAGE`, `$CYCLE`, `$TIMESTAMP`, `$TOKENS_USED`, `$RESEARCH_DEPTH`, `$MODE`, `$MEMORY_COUNT`, `$CANVAS_ITEMS`

### Output Variables
`$LAST`, `$TURN_0`, `$TURN_1`, `$RESEARCH_OUTPUT`, etc.

---

## Commands

### /reference
```bash
/reference file.md lines 10-20
/reference file.md section "Header"
/reference file.md pattern /regex/i
/reference file.md range 50
```

### /image-batch
```bash
/image-batch ~/screenshots/ --depth detailed --colors --export markdown
```

---

## Integration

### Use QuickMenu
```typescript
import { QuickMenu } from 'src/components/QuickMenu';
<QuickMenu onCommandExecute={(cmd, result) => {...}} />
```

### Get Campaign Context
```typescript
import { useCampaign } from 'src/context/CampaignContext';
const campaign = useCampaign();
const vars = campaign.variableContext;
```

---

## Common Patterns

### Substitute Variables
```typescript
const msg = 'For $STAGE on $MODEL';
const subst = await substituteVariables(msg, campaign.variableContext);
```

### Extract File Section
```typescript
const parsed = parseReferenceCommand('file.md section "Intro"');
const content = await resolveReference(parsed.file, parsed.selector);
```

### Batch Analyze Images
```typescript
const parsed = parseImageBatchArgs('~/images/ --depth full');
const images = await resolveImageSource(parsed.source);
```

---

## Files

| File | Purpose |
|------|---------|
| `src/utils/commandRouter.ts` | Variable subst, reference |
| `src/utils/imageBatchRouter.ts` | Image discovery |
| `src/utils/outputStore.ts` | IndexedDB persistence |
| `src/utils/phase1CommandHandler.ts` | High-level handler |
| `src/components/QuickMenu.tsx` | UI component |
| `src/context/CampaignContext.tsx` | Context + variableContext |

---

## Status

- ✓ All Phase 1 code complete
- ✓ Tests passing
- ✓ Build clean
- ✓ Ready for integration

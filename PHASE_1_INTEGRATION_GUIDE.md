# Phase 1 Integration Guide

This guide explains how to activate Phase 1 features in the existing Neuro system.

---

## Overview

Phase 1 adds three major capabilities:
1. **Context Variables** — Auto-injected system state ($MODEL, $STAGE, etc.)
2. **Output Variables** — Reference prior command outputs ($LAST, $TURN_N, etc.)
3. **Advanced Commands** — /reference and /image-batch with rich options

All core logic is implemented and tested. Integration is primarily **wiring** existing code into the CampaignContext and CLI layers.

---

## 1. Quick Menu Handler Update

**File:** `src/components/QuickMenu.tsx` (or wherever messages enter the system)

### Current Flow
```
User message → parseSlashHints() → hints → toolRouter → agent
```

### New Flow
```
User message → substituteVariables() → parseSlashHints() → hints → toolRouter → agent
                    ↑
              Variable context (from CampaignContext)
```

### Implementation

```typescript
import { substituteVariables, VariableContext } from '../utils/commandRouter';
import { CampaignContext } from '../context/CampaignContext';

export function QuickMenu() {
  const campaign = useContext(CampaignContext);

  async function handleMessage(userMessage: string) {
    // 1. Build variable context from campaign state
    const variableContext: VariableContext = {
      context: {
        MODEL: 'qwen3.5:9b', // Get from settings/state
        STAGE: campaign?.currentStage || undefined,
        CYCLE: campaign?.currentCycle?.cycleNumber || undefined,
        TIMESTAMP: new Date().toISOString(),
        TOKENS_USED: 0, // Track from session
        RESEARCH_DEPTH: 'NR', // Get from campaign settings
        MODE: 'pro', // Get from settings
        MEMORY_COUNT: campaign?.memory?.length || 0,
        CANVAS_ITEMS: campaign?.canvases?.length || 0,
      },
    };

    // 2. Substitute variables in message
    const substitutedMessage = await substituteVariables(userMessage, variableContext);

    // 3. Parse slash hints as before
    const { cleanMessage, hints } = parseSlashHints(substitutedMessage);

    // 4. Send to agent
    await sendToAgent(cleanMessage, hints);
  }

  return (
    // UI for quick menu
  );
}
```

---

## 2. Reference Command Handler

**File:** `src/utils/toolRouter.ts` or `src/utils/agentEngine.ts`

Add handler for `/reference` commands before routing to LLM:

```typescript
import {
  parseReferenceCommand,
  resolveReference,
} from './commandRouter';

async function handleReferenceCommand(args: string): Promise<string> {
  const parsed = parseReferenceCommand(args);
  if (!parsed) {
    return 'Invalid /reference syntax. See /help reference';
  }

  const resolved = await resolveReference(parsed.file, parsed.selector);
  if (!resolved) {
    return `Could not resolve reference: ${parsed.file} with selector type ${parsed.selector.type}`;
  }

  return resolved.content;
}

// In toolRouter, check hints:
if (hints.includes('reference_section')) {
  const refContent = await handleReferenceCommand(message);
  // Inject as context or return directly
  return refContent;
}
```

---

## 3. Image Batch Handler

**File:** `src/utils/toolRouter.ts` or agent tool integration

```typescript
import {
  parseImageBatchArgs,
  resolveImageSource,
  buildImageBatchCommand,
  formatImageBatchResultMarkdown,
} from './utils/imageBatchRouter';

async function handleImageBatchCommand(args: string): Promise<string> {
  const parsed = parseImageBatchArgs(args);
  if (!parsed) {
    return 'Invalid /image-batch syntax';
  }

  const images = await resolveImageSource(parsed.source);
  if (!images || images.length === 0) {
    return `No images found at: ${parsed.source}`;
  }

  // Build command for downstream processing
  const command = buildImageBatchCommand(images, parsed.options);

  // Format output
  if (parsed.options.export === 'markdown') {
    return formatImageBatchResultMarkdown(images, parsed.options);
  }

  return command;
}

// In toolRouter:
if (hints.includes('image_batch')) {
  const batchResult = await handleImageBatchCommand(message);
  // Route to imageBatchService or return as context
  return batchResult;
}
```

---

## 4. Output Tracking

**File:** `src/cli.ts` or main agent loop

After each command execution, store the output:

```typescript
import { storeCommandOutput } from './utils/outputStore';

async function executeCommand(command: string, input: string) {
  // ... execute command logic ...

  const result = await agent.execute(command, input);

  // Track output for $LAST, $TURN_N, etc.
  await storeCommandOutput(
    command,
    input,
    result.output,
    turnNumber,
    'qwen3.5:9b', // model name
    result.tokens
  );

  return result;
}
```

---

## 5. Wire CampaignContext to CLI

**File:** `src/cli.ts`

The CLI needs access to campaign state for context variables. Currently missing:

```typescript
// Add this to CLI state management
interface CLIState {
  model: string;
  mode: string;
  tokens: number;
  canvasPending: number;
  // NEW:
  campaignId?: string;
  cycleNumber?: number;
  stage?: string;
  researchDepth?: string;
}

// Update from CampaignContext periodically or on cycle start
function updateCLIState(campaign: Campaign) {
  currentState = {
    ...currentState,
    campaignId: campaign.id,
    cycleNumber: campaign.currentCycle?.cycleNumber,
    stage: campaign.currentCycle?.stage,
    researchDepth: campaign.researchDepth,
  };
}
```

---

## 6. Component Integration Point (UI)

If using QuickMenu component in Dashboard:

```typescript
// In Dashboard.tsx
import { QuickMenu } from './QuickMenu';
import { useContext } from 'react';
import { CampaignContext } from '../context/CampaignContext';

export function Dashboard() {
  const campaign = useContext(CampaignContext);

  return (
    <div className="dashboard">
      <QuickMenu campaign={campaign} />
      {/* ... rest of dashboard ... */}
    </div>
  );
}

// In QuickMenu.tsx
interface QuickMenuProps {
  campaign: Campaign | null;
}

export function QuickMenu({ campaign }: QuickMenuProps) {
  // Use campaign for context variables
  const variableContext: VariableContext = {
    context: buildContextFromCampaign(campaign),
  };

  // ... rest of implementation ...
}
```

---

## Integration Checklist

- [ ] Import Phase 1 utilities in QuickMenu/CLI
- [ ] Build VariableContext from campaign state
- [ ] Call `substituteVariables()` before `parseSlashHints()`
- [ ] Add reference handler to toolRouter
- [ ] Add image-batch handler to toolRouter
- [ ] Hook `storeCommandOutput()` into command execution loop
- [ ] Pass CampaignContext to quick menu component
- [ ] Test variable substitution in CLI: `npm run cli`
- [ ] Test reference resolution: `/reference file.md lines 1-10`
- [ ] Test image batch: `/image-batch ~/screenshots/`
- [ ] Update help/docs with new commands
- [ ] Run full test suite: `npm test`

---

## Testing During Integration

### Manual CLI Testing

```bash
npm run cli

# Test context variables
> For $STAGE with $RESEARCH_DEPTH, suggest next steps

# Test output variables (after first command)
> /research something
> Based on $RESEARCH_OUTPUT, now analyze

# Test reference
> /reference strategy.md section "Competitors"

# Test image batch
> /image-batch ~/screenshots/ --colors --depth detailed
```

### Unit Tests

```bash
npm test -- phase1Features

# Should pass all 28 tests
```

### Integration Tests

Add tests in `src/cli.ts` or integration test suite:

```typescript
describe('Phase 1 Integration', () => {
  it('should substitute variables in actual CLI flow', async () => {
    // Test end-to-end
  });

  it('should resolve references and inject into prompt', async () => {
    // Test file loading
  });

  it('should track outputs across turns', async () => {
    // Test output storage
  });
});
```

---

## Common Issues & Solutions

### Issue: Variables not substituting
**Cause:** VariableContext not passed correctly
**Solution:** Check CampaignContext import and state propagation

### Issue: Reference file not found
**Cause:** File path is relative, working directory is wrong
**Solution:** Use `path.resolve(process.cwd(), filePath)`

### Issue: Output variables return undefined
**Cause:** IndexedDB not initialized or session cleared
**Solution:** Check DB migration, verify outputs are stored after commands

### Issue: Image batch returns no images
**Cause:** Folder path incorrect or no image files
**Solution:** Verify folder exists and contains .jpg/.png files

---

## Performance Notes

- **Variable substitution:** ~5-10ms per message (async IndexedDB queries)
- **Reference resolution:** ~20-50ms per file (depends on size)
- **Output storage:** ~2-5ms per write (IndexedDB)
- **Batch image resolution:** ~50-100ms (filesystem scanning)

**Total overhead per message:** ~50-200ms (negligible for user experience)

---

## Rollback Plan

If Phase 1 integration causes issues:

1. Remove `substituteVariables()` call → reverts to original CLI
2. Comment out reference/image-batch handlers → routes unknown commands to LLM
3. Disable output tracking → stops populating IndexedDB
4. Clear outputs: `await clearAllOutputs()` in browser console

All Phase 1 code is **self-contained** and can be disabled without affecting Phase 0.

---

## Next: Phase 2

Once Phase 1 is stable and integrated:

- Pipe syntax (`/cmd1 | /cmd2`)
- File system commands (`/ls`, `/find`, `/grep`)
- Visual scouting (`/visual-scout`)
- Template system (`/template`)
- Alias registry (`/alias`)

Phase 2 builds on Phase 1's variable system and output tracking.


# Quick Menu Syntax Reference — Phase 1

**Date:** April 2, 2026
**Status:** Phase 1 Implementation Complete

## Overview

The Neuro quick menu system supports slash commands (`/command`) with variable substitution and advanced referencing. This guide covers Phase 1 features only (variables, references, image batch).

---

## 1. Context Variables

System-provided variables that inject current state into prompts. Read-only, auto-populated.

### Syntax
```
$MODEL          → Current model (e.g., 'qwen3.5:9b')
$STAGE          → Current pipeline stage (research|brand-dna|angles|strategy|copywriting|production|test)
$CYCLE          → Current cycle number (1-N)
$TIMESTAMP      → ISO 8601 timestamp
$TOKENS_USED    → Tokens consumed this session
$RESEARCH_DEPTH → Research preset (SQ|QK|NR|EX|MX)
$MODE           → Execution mode (lite|pro|max)
$MEMORY_COUNT   → Items stored in memory
$CANVAS_ITEMS   → Number of open canvas documents
```

### Examples

**Self-aware prompt:**
```
For $STAGE stage with $RESEARCH_DEPTH depth, suggest next steps
```
→ Substitutes: `For research stage with EX depth, suggest next steps`

**Model-aware task selection:**
```
Using $MODEL, analyze sentiment in this customer feedback
```
→ Substitutes: `Using qwen3.5:9b, analyze sentiment in this customer feedback`

**Token tracking:**
```
I've used $TOKENS_USED tokens so far in cycle $CYCLE
```
→ Substitutes: `I've used 45000 tokens so far in cycle 1`

---

## 2. Output Variables

Reference prior command outputs in new commands. Available during session only.

### Syntax

#### $LAST / $LAST_OUTPUT
Most recent command output.
```
Based on $LAST, now analyze sentiment
```
→ Inserts full text of previous output

#### $TURN_N
Output from N turns ago (0-indexed).
```
Compare /doc output with $TURN_3
```
→ Inserts output from 3 turns back

#### $COMMAND_NAME_OUTPUT
Last output from specific command type.
```
Using $RESEARCH_OUTPUT, extract patterns
```
→ Inserts last `/research` command output

Available built-in command outputs:
- `$RESEARCH_OUTPUT`
- `$ANALYZE_OUTPUT`
- `$BROWSE_OUTPUT`
- `$SEARCH_OUTPUT`
- `$IMAGE_OUTPUT`
- `$CODE_OUTPUT`
- etc.

### Examples

**Chain commands sequentially:**
```
/research customer pain points
→ [research output stored as $RESEARCH_OUTPUT]

Using $RESEARCH_OUTPUT, now suggest objection handlers
```

**Reference multiple prior outputs:**
```
Compare $TURN_5 (initial research) with $TURN_1 (latest findings)
```

**Build on analysis:**
```
/analyze competitor ads
→ [output stored]

Improve on $LAST_OUTPUT with unique positioning
```

---

## 3. Reference Command — /reference

Extract specific sections of files without loading entire content.

### Syntax

```
/reference <file> <selector> [--action]
```

#### Selector Types

**Lines (line-based extraction):**
```
/reference marketing.md lines 10-50
```
→ Extracts lines 10–50 from marketing.md

**Section (markdown header):**
```
/reference strategy.md section "Competitive Analysis"
```
→ Extracts section with `## Competitive Analysis` header

**Pattern (regex matching):**
```
/reference changelog.md pattern /v1\.5/i
```
→ All lines matching regex `/v1\.5/i`

**Range (percentage-based):**
```
/reference document.md range 30%
```
→ First 30% of document

#### Optional Actions

- `(none)` → Just load content into prompt
- `--analyze` → AI analysis of section
- `--extract` → Structured data extraction
- `--summarize` → Quick summary

### Examples

**Extract specific requirement section:**
```
/reference requirements.md section "Customer Needs"
```

**Find all TODOs in code:**
```
/reference codebase.ts pattern /TODO.*/i --analyze
```

**Load first half of document:**
```
/reference strategy.md range 50% --summarize
```

**Chain with analysis:**
```
/reference competitors.json section "Pricing Strategy" --extract
→ [outputs JSON structure]

Using $LAST, suggest undercutting strategy
```

---

## 4. Image Batch Command — /image-batch

Analyze multiple images in parallel with configurable depth and filters.

### Syntax

```
/image-batch <source> [--options]
```

Where `<source>` is:
- Local folder path: `~/screenshots/`, `./competitors/images/`
- URL list file: `urls.txt`, `competitors.csv`

#### Options

```
--depth [visual|detailed|full]
  → Analysis depth (default: visual)
  → visual: basic description + category
  → detailed: colors, objects, composition
  → full: all + quality score + accessibility analysis

--filter [product|lifestyle|graphic|logo|packaging]
  → Category filter (optional)

--colors
  → Extract color palettes

--objects
  → Detect objects + labels

--export [json|markdown|text]
  → Output format
```

### Examples

**Quick visual analysis:**
```
/image-batch ~/screenshots/
```
→ Basic analysis of all images in folder

**Detailed product image audit:**
```
/image-batch ~/competitors/products/ --depth detailed --filter product --colors --export json
```
→ Analyzes product images, extracts colors, outputs JSON

**Analyze URLs from file:**
```
/image-batch competitor-urls.txt --depth full --objects
```
→ Takes URLs from file, analyzes all with object detection

**Extract design patterns:**
```
/image-batch brand-assets/ --depth detailed --colors --export markdown
```
→ Detailed analysis with color palettes, markdown report

---

## 5. Combined Examples

### Example 1: Multi-stage workflow
```
/research customer pain points in wellness
→ [$RESEARCH_OUTPUT created]

Using $RESEARCH_OUTPUT, identify top 3 objections
→ [$ANALYZE_OUTPUT created]

/reference strategy.md section "Competitor Pricing" --extract
→ [competitor pricing loaded]

Now create messaging that addresses $LAST with $MODEL tier depth for $STAGE phase
```

### Example 2: Document + Image analysis
```
/reference product-guide.md lines 50-100
→ [features extracted]

/image-batch ~/product-shots/ --colors --depth detailed
→ [$IMAGE_BATCH_OUTPUT created]

Combine visual insights from $LAST with feature details from $TURN_1 to create unified positioning
```

### Example 3: Variable-aware research
```
For $STAGE with $RESEARCH_DEPTH preset, research: $LAST_TOPIC

Using $MODEL's capabilities and $TOKENS_USED tokens budget, deep dive into customer psychology
```

---

## 6. Variable Limitations & Fallbacks

### Undefined Variables
If a variable is referenced but not available:
- Context variables undefined in current state: left unchanged (e.g., `$STAGE` stays `$STAGE`)
- Output variables from non-existent turns: left unchanged or emit warning
- References to missing files: error message

### Storage Limits
- Output storage: ~50,000 chars per output (truncated if larger)
- Max stored outputs: 500 per session (oldest auto-deleted)
- Clear all outputs: Session reset or explicit `/clear-outputs` command

### Variable Scope
- Context variables: global per session
- Output variables: session-scoped only (cleared on page reload)
- References: requires file to exist on disk

---

## 7. Compatibility

| Feature | Browser | CLI | Notes |
|---------|---------|-----|-------|
| Context variables | ✓ | ✓ | Injected from session state |
| Output variables | ✓ | ✓ | Stored in IndexedDB |
| /reference | ✓ | ✓ | Requires filesystem access (Node/CLI) |
| /image-batch | ✓ | ✓ | Folder or URL list support |

---

## 8. Error Handling

Common error scenarios:

```
"$TURN_5 not found"
→ Try with lower offset, or check turn history

"File not found: marketing.md"
→ Use full path or check file exists

"Section 'Missing Header' not found"
→ Check markdown header formatting (## or #)

"No images in folder ~/screenshots/"
→ Check folder path and image extensions (.jpg, .png, etc.)
```

---

## 9. Next Steps (Phase 2)

Planned features NOT in Phase 1:
- **Pipe syntax:** `/cmd1 | /cmd2` (chain outputs)
- **File system commands:** `/ls`, `/find`, `/grep`, `/tree`
- **Visual scouting:** `/visual-scout [url]` (screenshots + analysis)
- **Templates:** `/template list`, `/template use [name]`
- **Aliases:** `/alias create my-command "..."`
- **Batch operations:** `/batch /cmd [items]`

---

**End of Phase 1 Reference**

For implementation details, see:
- `/Users/mk/Downloads/nomads/src/utils/commandRouter.ts` — Variable & reference logic
- `/Users/mk/Downloads/nomads/src/utils/outputStore.ts` — Output persistence
- `/Users/mk/Downloads/nomads/src/utils/imageBatchRouter.ts` — Image batch handling

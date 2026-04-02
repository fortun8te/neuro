# Context-1 Document Analysis & Image Batch Processing

This document describes the Context-1 document analysis service and the image batch processing pipeline integrated with the ad agent.

## Table of Contents

1. [Overview](#overview)
2. [Context-1 Service](#context-1-service)
3. [Image Batch Service](#image-batch-service)
4. [Integration & Usage](#integration--usage)
5. [API Reference](#api-reference)
6. [Performance & Scalability](#performance--scalability)
7. [Testing](#testing)

---

## Overview

The system provides two complementary capabilities:

### Context-1 Document Analysis
- **Model**: `chromadb-context-1:latest` (20.9B, GPT-OSS MoE)
- **Strength**: Finding specific information in large documents, filtering, cross-referencing
- **Use cases**: Document section extraction, FAQ generation, research synthesis

### Image Batch Processing
- **Vision Model**: `qwen3.5:4b` (vision-capable)
- **Parallelism**: 4 concurrent sub-agents per batch
- **Throughput**: ~12 images per batch, 2–3 images per sub-agent
- **Output**: Structured metadata (colors, objects, quality, context)

---

## Context-1 Service

Location: `src/utils/context1Service.ts`

### Document Analysis Methods

#### `findSections(document, query, maxResults?, signal?)`

Find specific paragraphs/sections matching a query using Context-1's retrieval.

**Parameters:**
- `document` (string): Full document text
- `query` (string): Search query ("find paragraphs about X")
- `maxResults` (number, default: 10): Maximum sections to return
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<string[]>` — Array of matching text sections

**Example:**
```typescript
const doc = await fs.readFile('research.md', 'utf-8');
const sections = await findSections(doc, 'market challenges', 5);
console.log(sections); // ["Challenge 1: ...", "Challenge 2: ..."]
```

**Fallback Behavior:**
If Context-1 is unavailable, falls back to naive substring search.

---

#### `filterDocument(document, criteria, signal?)`

Filter document to keep only paragraphs matching criteria.

**Parameters:**
- `document` (string): Full document text
- `criteria` (string): Filter criteria ("keep only paragraphs about X")
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<string>` — Filtered document (matching sections joined with `\n\n`)

**Example:**
```typescript
const filtered = await filterDocument(doc, 'recommendations');
// Returns document with only recommendation sections
```

---

#### `analyzeDocumentStructure(document, signal?)`

Analyze document structure: find sections, key points, suggest improvements.

**Parameters:**
- `document` (string): Full document text
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<{sections, keyPoints, suggestedEdits}>`

**Example:**
```typescript
const analysis = await analyzeDocumentStructure(doc);
console.log(analysis.sections);      // ["Heading 1", "Heading 2"]
console.log(analysis.keyPoints);     // ["Key finding 1", "Key finding 2"]
console.log(analysis.suggestedEdits); // ["Improve clarity in section 3", ...]
```

---

#### `askAboutDocument(document, question, signal?)`

Answer questions about document content using Context-1 retrieval.

**Parameters:**
- `document` (string): Full document text
- `question` (string): Question to answer
- `signal` (AbortSignal, optional): Cancellation token

**Returns:** `Promise<string>` — Answer synthesized from relevant document sections

**Example:**
```typescript
const answer = await askAboutDocument(doc, 'What is the target market?');
console.log(answer); // "Based on the document: ..."
```

---

## Image Batch Service

Location: `src/utils/imageBatchService.ts`

### Architecture

```
Input: 500 images
    ↓
Split into batches (12 images per batch)
    ↓
For each batch:
  - Spawn 4 parallel sub-agents (vision model)
  - Each agent describes 2-3 images
  - Output: JSON metadata (colors, objects, quality)
    ↓
Aggregate descriptions
    ↓
Use Context-1 to filter/categorize results
    ↓
Output: Structured ImageAnalysisResult
```

### Data Types

#### `ImageDescription`

Structured metadata for a single image.

```typescript
interface ImageDescription {
  filename: string;
  path: string;
  description: string;         // 1–2 sentence description
  colors: string[];            // Hex codes (#FF0000, #00AA00)
  objects: string[];           // Key objects present
  quality: number;             // 1–10 scale
  context?: string;            // "product", "lifestyle", "hero", etc.
  width?: number;
  height?: number;
  sizeBytes?: number;
  error?: string;              // Error message if analysis failed
}
```

#### `ImageAnalysisResult`

Complete analysis result for a batch.

```typescript
interface ImageAnalysisResult {
  totalImages: number;
  processedImages: number;
  failedImages: number;
  descriptions: ImageDescription[];
  categories: Record<string, ImageDescription[]>;
  colorDistribution: Record<string, number>;
  durationMs: number;
  tokensUsed: number;
  modelsUsed: string[];
}
```

#### `BatchProgress`

Progress callback for long-running operations.

```typescript
interface BatchProgress {
  batchNum: number;
  totalBatches: number;
  imagesProcessed: number;
  totalImages: number;
  elapsedMs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

### Methods

#### `describeImageBatch(imagePaths, options?)`

Process images with parallel vision sub-agents.

**Parameters:**
- `imagePaths` (string[]): Array of image file paths
- `options` (optional):
  - `model` ('qwen3.5:4b' | 'qwen3.5:2b', default: '4b')
  - `onProgress` ((progress: BatchProgress) => void)
  - `onChunk` ((token: string) => void) — Stream vision model output
  - `signal` (AbortSignal) — Cancellation token

**Returns:** `Promise<ImageDescription[]>`

**Example:**
```typescript
const descriptions = await describeImageBatch(
  ['./product1.jpg', './product2.jpg'],
  {
    model: 'qwen3.5:4b',
    onProgress: (progress) => {
      console.log(`${progress.imagesProcessed}/${progress.totalImages}`);
    },
  }
);

console.log(descriptions[0]);
// {
//   filename: 'product1.jpg',
//   description: 'Red wireless headphones on white background',
//   colors: ['#FF0000', '#FFFFFF'],
//   objects: ['headphones', 'cable'],
//   quality: 8,
//   context: 'product'
// }
```

---

#### `analyzeImageBatch(imagePaths, options?)`

Full pipeline: describe images → categorize → analyze colors.

**Parameters:**
- `imagePaths` (string[]): Array of image paths
- `options` (optional): Same as `describeImageBatch`

**Returns:** `Promise<ImageAnalysisResult>`

**Example:**
```typescript
const result = await analyzeImageBatch(images);

console.log(`Total: ${result.totalImages}`);
console.log(`Failed: ${result.failedImages}`);
console.log(`Processing time: ${result.durationMs}ms`);

// Categorized by context
console.log(`Product images: ${result.categories.product.length}`);
console.log(`Lifestyle images: ${result.categories.lifestyle.length}`);

// Color distribution
console.log(`Most common colors:`, Object.entries(result.colorDistribution)
  .slice(0, 5)
  .map(([color, count]) => `${color} (${count}x)`)
);
```

---

#### `filterImages(descriptions, query, options?)`

Use Context-1 to filter descriptions by query.

**Parameters:**
- `descriptions` (ImageDescription[]): Results from `describeImageBatch`
- `query` (string): Filter criteria ("red images", "product shots", "high quality")
- `options` (optional):
  - `maxResults` (number): Max matching images to return
  - `signal` (AbortSignal)

**Returns:** `Promise<ImageDescription[]>` — Filtered descriptions

**Example:**
```typescript
// Filter all descriptions for "red color"
const redImages = await filterImages(descriptions, 'red color');
console.log(`Found ${redImages.length} red images`);

// Filter for "product shots"
const productShots = await filterImages(descriptions, 'product photography');
console.log(`Found ${productShots.length} product shots`);
```

---

#### `categorizeImages(descriptions)`

Categorize images by their context field.

**Parameters:**
- `descriptions` (ImageDescription[]): Image descriptions

**Returns:** `Record<string, ImageDescription[]>`

**Example:**
```typescript
const categories = categorizeImages(descriptions);
console.log(`Product: ${categories.product.length}`);
console.log(`Lifestyle: ${categories.lifestyle.length}`);
console.log(`Hero: ${categories.hero.length}`);
console.log(`Texture: ${categories.texture.length}`);
```

---

#### `analyzeColorDistribution(descriptions)`

Count color frequency across all images, sorted by prevalence.

**Parameters:**
- `descriptions` (ImageDescription[])

**Returns:** `Record<string, number>` — Hex color → count, sorted descending

**Example:**
```typescript
const colors = analyzeColorDistribution(descriptions);
Object.entries(colors).slice(0, 5).forEach(([color, count]) => {
  console.log(`${color}: appears in ${count} images`);
});
```

---

## Integration & Usage

### Basic Workflow

```typescript
import {
  describeImageBatch,
  filterImages,
  categorizeImages,
  analyzeColorDistribution,
} from '@/utils/imageBatchService';
import {
  findSections,
  filterDocument,
  analyzeDocumentStructure,
  askAboutDocument,
} from '@/utils/context1Service';

// Step 1: Describe images
const images = [
  '/images/product_01.jpg',
  '/images/product_02.jpg',
  '/images/lifestyle.jpg',
  // ... more images
];

const descriptions = await describeImageBatch(images, {
  onProgress: (progress) => {
    console.log(`Processing ${progress.imagesProcessed}/${progress.totalImages}`);
  },
});

// Step 2: Filter with Context-1
const redImages = await filterImages(descriptions, 'red color');
const productShots = await filterImages(descriptions, 'product photography');

// Step 3: Analyze color distribution
const colors = analyzeColorDistribution(descriptions);
console.log('Most common colors:', Object.keys(colors).slice(0, 5));

// Step 4: Document analysis
const doc = await fs.readFile('research.md', 'utf-8');
const challenges = await findSections(doc, 'challenges', 5);
const recommendations = await filterDocument(doc, 'recommendations');
const answer = await askAboutDocument(doc, 'What is the target market?');
```

### With Abort Signal

```typescript
const controller = new AbortController();

// Start long-running operation
const promise = describeImageBatch(images, {
  signal: controller.signal,
  onProgress: (p) => console.log(p.imagesProcessed),
});

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);

try {
  const result = await promise;
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Operation cancelled');
  }
}
```

### Progress Tracking

```typescript
const controller = new AbortController();

const task = describeImageBatch(imagePaths, {
  onProgress: (progress) => {
    // Emit to UI
    dispatch({
      type: 'SET_BATCH_PROGRESS',
      payload: {
        batchNum: progress.batchNum,
        totalBatches: progress.totalBatches,
        percentage: Math.round(
          (progress.imagesProcessed / progress.totalImages) * 100
        ),
        status: progress.status,
        elapsedMs: progress.elapsedMs,
      },
    });
  },
  signal: controller.signal,
});

// Allow cancellation
button.addEventListener('click', () => controller.abort());

const result = await task;
```

---

## API Reference

### Context-1 Service (`context1Service.ts`)

| Method | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `findSections` | `(doc, query, max?, signal?)` | `Promise<string[]>` | Falls back to substring search if Context-1 unavailable |
| `filterDocument` | `(doc, criteria, signal?)` | `Promise<string>` | Returns filtered doc as single string |
| `analyzeDocumentStructure` | `(doc, signal?)` | `Promise<{sections, keyPoints, suggestedEdits}>` | Structural analysis only |
| `askAboutDocument` | `(doc, question, signal?)` | `Promise<string>` | Synthesizes answer from sections |

### Image Batch Service (`imageBatchService.ts`)

| Method | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `describeImageBatch` | `(paths, opts?)` | `Promise<ImageDescription[]>` | Parallel vision model processing |
| `analyzeImageBatch` | `(paths, opts?)` | `Promise<ImageAnalysisResult>` | Full pipeline: describe + categorize + colors |
| `filterImages` | `(descriptions, query, opts?)` | `Promise<ImageDescription[]>` | Uses Context-1 for matching |
| `categorizeImages` | `(descriptions)` | `Record<string, ImageDescription[]>` | Synchronous, by context field |
| `analyzeColorDistribution` | `(descriptions)` | `Record<string, number>` | Synchronous, sorted by count |

---

## Performance & Scalability

### Throughput Estimates

**Image Processing:**
- Single batch (12 images): ~8–12 seconds with `qwen3.5:4b`
- 500 images: ~42 batches × 10s ≈ 7 minutes
- With parallelism: 4 agents × 3 images = ~5–6 minutes for 500 images

**Document Analysis:**
- Small doc (10KB): ~2–3 seconds
- Large doc (1MB): ~10–15 seconds (Context-1 manages context window)
- Query decomposition (complex queries): +2–3 seconds

### Memory & Resource Usage

**Image Batch:**
- Per sub-agent: ~50–100MB (vision model in memory)
- 4 concurrent agents: ~400MB overhead
- No persistent caching required

**Context-1:**
- Model: 20.9B parameters
- Per session: ~40GB VRAM (shared with main agent)
- Token budget: 32,768 tokens, auto-managed

### Bottlenecks

1. **Vision model inference** (~80% of batch time)
   - Solution: Use lighter model (`qwen3.5:2b`) for speed
   - Trade-off: Lower quality descriptions

2. **Context-1 retrieval** (for filtering)
   - Solution: Batch queries, use fallback search for small datasets
   - Trade-off: Simple substring search vs. semantic retrieval

---

## Testing

### Unit Tests

Location: `src/utils/__tests__/`

**Tests included:**
- `context1Service.test.ts`: Document analysis methods
- `imageBatchService.test.ts`: Image processing and filtering

**Running tests:**
```bash
npm run test -- context1Service.test.ts
npm run test -- imageBatchService.test.ts
npm run test # All tests
```

### Integration Tests

Test the full pipeline with mock images:

```typescript
import { describeImageBatch, filterImages } from '@/utils/imageBatchService';

it('should process batch and filter results', async () => {
  const images = ['./test-image-1.jpg', './test-image-2.jpg'];

  const descriptions = await describeImageBatch(images);
  expect(descriptions).toHaveLength(2);

  const filtered = await filterImages(descriptions, 'red');
  expect(filtered.length).toBeLessThanOrEqual(2);
});
```

### Performance Testing

```typescript
const startTime = Date.now();
const result = await analyzeImageBatch(largeImageList);
const duration = Date.now() - startTime;

console.log(`Processed ${result.totalImages} images in ${duration}ms`);
console.log(`Rate: ${result.totalImages / (duration / 1000)} images/sec`);
console.log(`Tokens used: ${result.tokensUsed}`);
```

---

## Troubleshooting

### Context-1 Not Available

**Symptom:** "chromadb-context-1 not found" error

**Solution:**
1. Verify Ollama is running: `ollama list | grep context-1`
2. Pull model: `ollama pull chromadb-context-1:latest`
3. Check INFRASTRUCTURE config in `src/config/infrastructure.ts`

### Image Processing Hangs

**Symptom:** `describeImageBatch` doesn't complete

**Solution:**
1. Check vision model is loaded: `ollama list | grep qwen3.5:4b`
2. Use abort signal with 2–3 minute timeout
3. Reduce batch size or use lighter model

### Memory Issues

**Symptom:** Out of memory when processing large batches

**Solution:**
1. Reduce concurrent sub-agents from 4 to 2–3
2. Use `qwen3.5:2b` instead of `4b`
3. Process in smaller batches manually

---

## Future Enhancements

1. **Caching**: Store image descriptions in IndexedDB for re-use
2. **Progressive Rendering**: Stream descriptions to UI as they complete
3. **Custom Models**: Support for domain-specific vision models
4. **Export Formats**: JSON, CSV, PDF reports
5. **Visual Clustering**: Group similar images by color/composition

---

**Last updated:** 2026-04-02

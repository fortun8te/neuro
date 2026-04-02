# Quick Start: Context-1 Document Analysis & Image Batch Processing

## 30-Second Overview

- **Context-1**: Search, filter, analyze documents using chromadb-context-1:latest
- **Image Batch**: Describe 100–500 images in parallel using qwen3.5:4b
- **Integration**: Use Context-1 to filter image descriptions by semantic query

---

## Minimal Example: Process 50 Images

```typescript
import { analyzeImageBatch, filterImages } from '@/utils/imageBatchService';

// Step 1: Process images
const result = await analyzeImageBatch([
  '/images/1.jpg',
  '/images/2.jpg',
  '/images/3.jpg',
  // ... up to 50
]);

// Step 2: Filter by color
const redImages = await filterImages(result.descriptions, 'red');

// Step 3: View results
console.log(`Found ${redImages.length} red images`);
console.log(redImages[0]);
// {
//   filename: '1.jpg',
//   description: 'Red product on white background',
//   colors: ['#FF0000', '#FFFFFF'],
//   objects: ['product'],
//   quality: 8,
//   context: 'product'
// }
```

---

## Minimal Example: Analyze Document

```typescript
import { askAboutDocument } from '@/utils/context1Service';

const doc = `# Marketing Strategy
Our target is millennials aged 25-34.
Main channels: Instagram, TikTok, email.
Budget: $50K/month.`;

const answer = await askAboutDocument(
  doc,
  'What is the budget?'
);
console.log(answer); // Answer synthesized from document
```

---

## API Cheat Sheet

### Image Processing

```typescript
import {
  describeImageBatch,      // Get descriptions
  analyzeImageBatch,       // Full pipeline
  filterImages,            // Filter by query (uses Context-1)
  categorizeImages,        // Group by context
  analyzeColorDistribution // Color frequency
} from '@/utils/imageBatchService';

// Quick: just descriptions
const descriptions = await describeImageBatch(imagePaths);

// Full: descriptions + categories + colors
const result = await analyzeImageBatch(imagePaths);

// Filter by query (red images, product shots, etc.)
const filtered = await filterImages(result.descriptions, 'red');

// Group by context (product, lifestyle, hero)
const byContext = categorizeImages(result.descriptions);

// Most common colors
const colors = analyzeColorDistribution(result.descriptions);
```

### Document Analysis

```typescript
import {
  findSections,            // Find paragraphs matching query
  filterDocument,          // Keep only matching sections
  analyzeDocumentStructure, // Get structure overview
  askAboutDocument         // Answer questions
} from '@/utils/context1Service';

// Find paragraphs about "challenges"
const sections = await findSections(doc, 'challenges', 5);

// Filter: keep only recommendations
const filtered = await filterDocument(doc, 'recommendations');

// Analyze: sections, key points, suggestions
const analysis = await analyzeDocumentStructure(doc);

// Ask: synthesize answer from document
const answer = await askAboutDocument(doc, 'Who is target market?');
```

---

## Progress Tracking

```typescript
const result = await analyzeImageBatch(imagePaths, {
  onProgress: (progress) => {
    console.log(
      `Batch ${progress.batchNum}/${progress.totalBatches}: ` +
      `${progress.imagesProcessed}/${progress.totalImages} images`
    );
  },
  onChunk: (token) => {
    // Stream vision model output in real-time
    process.stdout.write(token);
  },
});
```

---

## Cancellation with Abort Signal

```typescript
const controller = new AbortController();

// Start task
const task = analyzeImageBatch(imagePaths, {
  signal: controller.signal,
});

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30_000);

try {
  const result = await task;
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Cancelled');
  }
}
```

---

## Common Workflows

### Workflow 1: Analyze Brand Assets

```typescript
// Find all red product images
const redProducts = await filterImages(
  descriptions,
  'red color product photography'
);

// Most common colors in brand
const brandColors = analyzeColorDistribution(redProducts);

// Report
console.log(`Brand palette: ${Object.keys(brandColors).slice(0, 3).join(', ')}`);
```

### Workflow 2: Extract from Market Research

```typescript
// Find key points from research document
const keyPoints = await findSections(doc, 'market trends', 5);

// Get target audience
const target = await askAboutDocument(doc, 'Who is the target customer?');

// Get recommendations
const recs = await filterDocument(doc, 'recommendations');

// Use in campaign
const campaign = {
  insights: keyPoints,
  target,
  recommendations: recs
};
```

### Workflow 3: Process User Uploads

```typescript
// User uploads 200 product images
const uploaded = await analyzeImageBatch(userImages, {
  model: 'qwen3.5:2b', // faster, lighter
  onProgress: (p) => updateProgressBar(p.imagesProcessed, p.totalImages),
});

// Categorize by type
const categories = categorizeImages(uploaded.descriptions);

// Show summary
console.log(`
Products: ${categories.product.length}
Lifestyle: ${categories.lifestyle.length}
Quality issues: ${uploaded.failedImages}
`);
```

---

## Performance Tips

| Goal | Recommendation |
|------|-----------------|
| **Speed** | Use `qwen3.5:2b` instead of `4b` |
| **Quality** | Use `qwen3.5:4b` (default) |
| **500+ images** | Process in parallel batches, track progress |
| **Large documents** | Use `findSections` for targeted search |
| **Memory-constrained** | Reduce concurrent agents (default: 4) |

---

## Error Handling

```typescript
try {
  const result = await analyzeImageBatch(imagePaths);
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Operation cancelled');
  } else {
    console.log('Error:', err.message);
    // Continue with partial results if available
  }
}

// Check for failed images in result
result.descriptions.forEach((desc) => {
  if (desc.error) {
    console.warn(`Failed to analyze ${desc.filename}: ${desc.error}`);
  }
});
```

---

## Configuration

Models are configurable:

```typescript
// Use faster (lighter) model
await analyzeImageBatch(images, {
  model: 'qwen3.5:2b' // default: '4b'
});
```

Infrastructure URLs in `src/config/infrastructure.ts`:
```typescript
export const INFRASTRUCTURE = {
  ollamaUrl: process.env.VITE_OLLAMA_URL || 'http://100.74.135.83:11440',
  wayfarerUrl: process.env.VITE_WAYFARER_URL || 'http://localhost:8889',
  searxngUrl: process.env.VITE_SEARXNG_URL || 'http://localhost:8888',
};
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Context-1 not found | `ollama pull chromadb-context-1:latest` |
| Vision model timeout | Reduce batch size or use abort signal |
| Memory issues | Use `qwen3.5:2b` or reduce concurrent agents |
| Slow processing | Progress tracking shows expected time |

---

## Full Docs

See `docs/CONTEXT1_IMAGE_BATCH.md` for complete API reference, examples, and architecture details.

---

**Ready to use in**: Ad Agent, Canvas, CLI workflows
**Build status**: ✅ Passing (zero TypeScript errors)

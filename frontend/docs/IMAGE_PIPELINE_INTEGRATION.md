# Image Pipeline Integration Guide

Complete image pipeline for brand visual research in RACKS. Enables searching, downloading, analyzing, and comparing images across web, social media, and competitors.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Image Pipeline Integration                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. imageSearcher.ts                                             │
│     └─ Finds brand images across web, social, competitors        │
│     └─ Uses Wayfarer web scraping + SearXNG                      │
│     └─ Extracts image URLs from pages                            │
│                                                                   │
│  2. imageDownloader.ts                                           │
│     └─ Downloads images from URLs                                │
│     └─ Converts to base64 for vision models                      │
│     └─ Caches locally (memory + IndexedDB)                       │
│     └─ Handles failures gracefully                               │
│                                                                   │
│  3. imageAnalyzer.ts                                             │
│     └─ Analyzes images with vision model (gemma4:e2b)           │
│     └─ Extracts: colors, packaging, tone, design style          │
│     └─ Compares images, identifies patterns                      │
│     └─ Finds gaps vs competitors                                 │
│                                                                   │
│  4. imagePipelineIntegration.ts                                  │
│     └─ Orchestrates full workflow                                │
│     └─ Coordinates search → download → analyze → compare         │
│     └─ Generates insights & summaries                            │
│                                                                   │
│  5. visualBrandResearch.ts                                       │
│     └─ Integration with deepBrandResearch                        │
│     └─ Formats output for research findings                      │
│     └─ Provides stage definition                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
frontend/
├── services/
│   ├── imageSearcher.ts          ← Brand image search
│   ├── imageDownloader.ts        ← Image fetching + caching
│   └── imageAnalyzer.ts          ← Vision model analysis
├── utils/
│   ├── imagePipelineIntegration.ts ← Orchestration
│   ├── visualBrandResearch.ts      ← Deep research integration
│   └── deepBrandResearch.ts        ← (existing, to integrate with)
└── docs/
    └── IMAGE_PIPELINE_INTEGRATION.md ← This file
```

## Services

### 1. Image Searcher (`imageSearcher.ts`)

**Searches for brand images across web**

```typescript
import { searchBrandImages, searchCompetitorImages, searchSocialMediaImages } from '../services/imageSearcher';

// Search brand images
const brandImages = await searchBrandImages('BasedbodyWorks', [
  'BasedbodyWorks product photos',
  'BasedbodyWorks packaging design',
  'BasedbodyWorks website products',
]);

// Search competitor images
const compImages = await searchCompetitorImages('https://example-competitor.com');

// Search social media
const socialImages = await searchSocialMediaImages('BasedbodyWorks', ['instagram', 'tiktok']);
```

**Returns:**
- `ImageSearchResult[]` — URLs and metadata of found images
- `source`: 'web-search' | 'product-page' | 'social-media' | 'competitor'
- `url`: Direct image URL
- `domain`: Source domain

**How it works:**
1. Uses Wayfarer to fetch pages matching search queries
2. Extracts image URLs from page content using regex patterns
3. Filters out tracking pixels and invalid URLs
4. Deduplicates results
5. Returns up to 100 images per search

### 2. Image Downloader (`imageDownloader.ts`)

**Downloads images and caches locally**

```typescript
import { downloadImage, downloadImageBatch, getCacheStats } from '../services/imageDownloader';

// Download single image
const cached = await downloadImage('https://example.com/product.jpg');
console.log(cached.base64); // Ready for vision model

// Download batch with progress
const images = await downloadImageBatch(
  [
    { url: 'https://example.com/img1.jpg', label: 'product' },
    { url: 'https://example.com/img2.jpg', label: 'product' },
  ],
  {
    concurrency: 3,
    onProgress: ({ completed, total, url }) => {
      console.log(`Downloaded ${completed}/${total}`);
    },
  }
);

// Check cache efficiency
const stats = await getCacheStats();
console.log(`Memory cache: ${stats.memory.count} images`);
console.log(`Disk cache: ${stats.indexeddb.count} images`);
```

**Features:**
- **Multi-level caching:**
  - Memory cache (LRU, max 50 images)
  - IndexedDB persistence (survives page reload)
  - Avoids re-downloading same image
- **Concurrent downloads:** Configurable concurrency (default 3)
- **Size limits:** 5MB max per image
- **Timeout handling:** 30s timeout per download
- **Error resilience:** Gracefully handles failures

**Returns:**
- `CachedImage` object with:
  - `base64`: Image data for vision model
  - `mediaType`: 'image/jpeg' | 'image/png' | 'image/webp'
  - `bytes`: File size
  - `cache_key`: Unique identifier

### 3. Image Analyzer (`imageAnalyzer.ts`)

**Analyzes images with vision model**

```typescript
import { analyzeImageUrl, analyzeImageBatch, compareVisualPatterns } from '../services/imageAnalyzer';

// Analyze single image
const analysis = await analyzeImageUrl('https://example.com/product.jpg');
console.log(analysis.color_palette);      // Colors + psychology
console.log(analysis.packaging);          // Material, shape, premium score
console.log(analysis.tone);               // Brand personality
console.log(analysis.design_style);       // modern, luxury, minimal, etc
console.log(analysis.differentiation);    // Competitive advantages

// Analyze batch
const analyses = await analyzeImageBatch(
  [
    { url: 'https://example.com/img1.jpg', label: 'brand' },
    { url: 'https://example.com/img2.jpg', label: 'brand' },
  ],
  {
    concurrency: 2,
    onProgress: ({ completed, total }) => {
      console.log(`Analyzed ${completed}/${total}`);
    },
  }
);

// Compare images & extract patterns
const patterns = await compareVisualPatterns(analyses);
console.log(patterns.common_colors);    // Most frequent colors
console.log(patterns.common_styles);    // Design style consensus
console.log(patterns.common_tones);     // Personality across images
console.log(patterns.design_trends);    // Industry patterns
console.log(patterns.gaps);             // What competitors don't do
```

**Vision Model Analysis:**

Uses `gemma4:e2b` (vision-capable model) to extract:

1. **Colors:**
   - Hex + RGB values
   - Color psychology
   - Usage (dominant, accent, supporting)

2. **Packaging:**
   - Material (glass, plastic, cardboard, etc)
   - Shape description
   - Minimalism score (0-10)
   - Premium score (0-10)
   - Sustainability assessment
   - Unique features

3. **Tone:**
   - Adjectives (playful, luxury, natural, etc)
   - Personality summary
   - Confidence score

4. **Design Style:**
   - Primary style (modern, retro, natural, tech, luxury, minimal, playful, etc)
   - Secondary styles
   - Era feel (contemporary, timeless, vintage, futuristic)
   - Cultural elements

5. **Target Audience:**
   - Demographics
   - Psychographics
   - Emotions evoked

6. **Differentiation:**
   - Unique aspects
   - Competitive advantages
   - Improvement opportunities

**Returns:**
- `VisualFindings` object with structured analysis

### 4. Pipeline Integration (`imagePipelineIntegration.ts`)

**Orchestrates the complete workflow**

```typescript
import { runImagePipeline, extractVisualInsights } from '../utils/imagePipelineIntegration';

const results = await runImagePipeline({
  brandName: 'BasedbodyWorks',
  productCategories: ['shampoo', 'conditioner', 'treatments'],
  competitors: [
    'https://example-competitor1.com',
    'https://example-competitor2.com',
  ],
  searchPlatforms: ['instagram', 'tiktok'],
  maxImagesPerSource: 10,
  concurrency: 2,
  onProgress: (msg, progress) => {
    console.log(`[${Math.round(progress * 100)}%] ${msg}`);
  },
  onChunk: (text) => {
    console.log(text);  // Real-time updates
  },
});

// Extract insights for downstream stages
const insights = extractVisualInsights(results);
console.log(insights.color_strategy);
console.log(insights.design_direction);
console.log(insights.tone_guidance);
console.log(insights.differentiation_opportunities);
console.log(insights.social_media_strategy);
```

**Pipeline Stages:**

1. **Search (Step 1)** — Find images across web
2. **Download (Step 2)** — Fetch and cache images
3. **Analyze (Step 3)** — Vision model analysis
4. **Compete (Step 4)** — Analyze competitor images
5. **Social (Step 5)** — Analyze social media aesthetic
6. **Compare (Step 6)** — Extract patterns and gaps
7. **Synthesize (Step 7)** — Generate insights

**Returns:**
- `ImageResearchResults` with:
  - `brand_images`: VisualFindings[]
  - `competitor_images`: VisualFindings[]
  - `social_media_images`: VisualFindings[]
  - `pattern_analysis`: Common colors, styles, tones, trends, gaps
  - `total_analyzed`: Number of images
  - `elapsed_ms`: Time taken
  - `summary`: Markdown summary

## Integration with Deep Brand Research

### Using with `deepBrandResearch.ts`

```typescript
import { runVisualBrandResearch } from '../utils/visualBrandResearch';

// In your research orchestration:
const visualOutput = await runVisualBrandResearch(
  {
    brandName: 'BasedbodyWorks',
    productCategories: ['shampoo', 'conditioner'],
    competitors: ['competitor1.com', 'competitor2.com'],
  },
  (msg, progress) => console.log(`[${progress}] ${msg}`),
  (text) => console.log(text)
);

// Format for research findings
const findings = formatForDeepBrandResearch(visualOutput);
```

### Output Structure

```typescript
{
  stage_id: 'visual-brand-research',
  completed_at: 1712969400000,
  duration_ms: 45000,
  visual_findings: {
    brand_visual_profile: {
      primary_colors: ['#2E5C8A', '#E8B44A'],
      design_style: 'modern luxury',
      brand_tone: ['elegant', 'premium', 'natural'],
      packaging_assessment: {
        materials: ['glass', 'metal'],
        minimalism: 7,
        premium_feel: 8,
      },
      target_audience: 'Affluent, conscious consumers (35-65)',
    },
    competitor_insights: {
      count: 5,
      common_approaches: ['minimalist design', 'natural aesthetics'],
      visual_gaps: [
        'Opportunity for bold, expressive design',
        'Color differentiation potential',
      ],
    },
    social_media_aesthetic: {
      platform_strategies: {
        instagram: 'Luxury aesthetic with lifestyle content',
        tiktok: 'Educational product demonstrations',
      },
      visual_consistency: 'Highly consistent visual identity',
      engagement_drivers: ['Premium positioning', 'Educational content'],
    },
    strategic_recommendations: {
      color_strategy: 'Use blues and golds; blue conveys trust/stability',
      design_direction: 'Lean into modern luxury with minimalist elements',
      tone_guidance: 'Elegant, premium, natural personality',
      unique_positioning: [
        'Opportunity for bolder color palette',
        'Sustainability focus differentiation',
      ],
      production_considerations: [
        'Premium materials critical: glass bottles align with positioning',
        'Color matching essential: blues and golds must be consistent',
      ],
    },
  },
  raw_data: {
    total_images_analyzed: 35,
    images_by_source: {
      brand: 12,
      competitors: 15,
      social_media: 8,
    },
    analysis_time_ms: 45000,
    cache_efficiency: {
      memory_images: 35,
      disk_images: 28,
      cache_hit_rate: 0.85,
    },
  },
}
```

## Configuration

### Model Selection

Vision model can be configured in `imageAnalyzer.ts`:

```typescript
const VISION_MODEL = 'local:gemma4:e2b';    // Primary (local for speed)
const FALLBACK_MODEL = 'qwen3.5:9b';        // Fallback if vision unavailable
```

### Concurrency & Limits

Adjust in pipeline config:

```typescript
{
  concurrency: 2,              // Parallel downloads/analysis
  maxImagesPerSource: 10,      // Images per source cap
  maxBytes: 10 * 1024 * 1024,  // 10MB per image
  timeout: 45_000,             // 45s download timeout
}
```

### Cache Configuration

Configured in `imageDownloader.ts`:

```typescript
const MAX_MEMORY_CACHE = 50;           // LRU memory cache size
const DB_NAME = 'RACKS_ImageCache';    // IndexedDB database name
const STORE_NAME = 'images';           // IndexedDB object store
```

## Example: BasedbodyWorks Research

```typescript
import { runImagePipeline } from '../utils/imagePipelineIntegration';

const research = await runImagePipeline({
  brandName: 'BasedbodyWorks',
  productCategories: ['shampoo', 'conditioner', 'treatments', 'serums'],
  competitors: [
    'https://www.sephora.com',       // Retail site
    'https://theordinary.com',       // Competitor brand
    'https://aesop.com',             // Premium brand
  ],
  searchPlatforms: ['instagram', 'tiktok', 'pinterest'],
  maxImagesPerSource: 15,
  onProgress: (msg, progress) => {
    // Update UI progress bar
  },
  onChunk: (text) => {
    // Stream real-time updates to user
  },
});
```

**What it finds:**

1. **Brand Images (BasedbodyWorks)**
   - Product bottles (shampoo, conditioner, treatments)
   - Packaging design (colors, materials, labeling)
   - Website product photos
   - Unboxing/presentation
   - Brand lifestyle images

2. **Competitor Images**
   - Similar product categories
   - Packaging design approaches
   - Color strategies
   - Material choices
   - Premium vs accessible positioning

3. **Social Media**
   - Instagram aesthetic (feed colors, style, content theme)
   - TikTok product shots (tutorials, demos, lifestyle)
   - Pinterest boards (aesthetic inspiration)
   - User-generated content style

4. **Analysis Output**
   - Common colors across brand
   - Design style consensus (modern, luxury, natural, minimal, etc)
   - Brand tone (elegant, playful, premium, natural, etc)
   - Packaging assessment (materials, minimalism score, premium feel)
   - Competitor visual gaps
   - Unique positioning opportunities

## Advanced Usage

### Custom Vision Prompts

Modify the vision prompt in `imageAnalyzer.ts`:

```typescript
const prompt = `You are analyzing [BRAND] product images.

Focus on:
1. Color psychology and brand positioning
2. Packaging sustainability and materials
3. Design style and target audience alignment
4. Competitive differentiation
5. Production and photography considerations

Return JSON with structured analysis.`;
```

### Image Filtering

Pre-filter images before analysis:

```typescript
import { validateImageUrl, deduplicateImages } from '../services/imageSearcher';

const filtered = images
  .filter(img => validateImageUrl(img.url))
  .filter(img => !img.url.includes('competitor-logo'))
  .slice(0, 20);
```

### Cache Management

```typescript
import { getCacheStats, clearImageCache } from '../services/imageDownloader';

// Check cache size
const stats = await getCacheStats();
console.log(`Using ${stats.memory.bytes} bytes in memory`);

// Clear if needed
if (stats.memory.bytes > 100 * 1024 * 1024) {
  await clearImageCache();
}
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Images per second | 2-3 (search) |
| Download speed | 10-20/sec (with concurrency) |
| Vision analysis | 30-60s per image |
| Full pipeline | ~2-5 min for 30 images |
| Memory usage | ~50MB for 50 cached images |
| Cache hit rate | 85%+ on repeat runs |

## Error Handling

All services handle errors gracefully:

```typescript
try {
  const results = await runImagePipeline(config);
} catch (err) {
  // Returns detailed error message
  console.error(`Pipeline failed: ${err}`);
  // Partial results may be available
}
```

## Next Steps

1. **Integrate with deepBrandResearch** — Add as core research stage
2. **Add to UI flow** — Show progress, allow result browsing
3. **Export to PDF** — Include visual findings in research report
4. **A/B testing** — Compare visual strategies across campaigns
5. **Real-time updates** — Stream results as they arrive
6. **Competitor tracking** — Monitor competitor visual changes over time

## Troubleshooting

### Images not downloading?
- Check Wayfarer health: `await wayfayerService.healthCheck()`
- Verify URL accessibility manually
- Check firewall/CORS issues

### Vision analysis failing?
- Verify Ollama is running and healthy
- Check gemma4:e2b model is loaded
- Fallback to qwen3.5:9b if needed

### Low image quality?
- Adjust maxBytes in downloader config
- Increase timeout for slow connections
- Add proxy for blocked images

### Cache running out of space?
- Reduce MAX_MEMORY_CACHE
- Implement cache expiration
- Use IndexedDB for persistence

## API Reference

See individual service files for complete API documentation:
- `imageSearcher.ts` — Search functions
- `imageDownloader.ts` — Download & cache functions
- `imageAnalyzer.ts` — Analysis functions
- `imagePipelineIntegration.ts` — Orchestration
- `visualBrandResearch.ts` — Research stage integration

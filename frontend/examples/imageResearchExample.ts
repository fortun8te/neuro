/**
 * Image Research Pipeline — Example Usage
 *
 * Demonstrates complete workflow for brand visual research
 * Can be adapted for different brands and research configurations
 */

import { runImagePipeline, extractVisualInsights, formatImageResearchForPDF } from '../utils/imagePipelineIntegration';
import { runVisualBrandResearch, formatForDeepBrandResearch } from '../utils/visualBrandResearch';

/**
 * Example 1: Basic image research for a brand
 */
export async function example1_basicBrandResearch() {
  console.log('=== Example 1: Basic Brand Research ===\n');

  const results = await runImagePipeline({
    brandName: 'BasedbodyWorks',
    productCategories: ['shampoo', 'conditioner'],
    competitors: [
      'https://theordinary.com',
      'https://aesop.com',
    ],
    searchPlatforms: ['instagram'],
    maxImagesPerSource: 8,
    concurrency: 2,
    onProgress: (msg, progress) => {
      console.log(`[${Math.round(progress * 100)}%] ${msg}`);
    },
    onChunk: (text) => {
      process.stdout.write(text);
    },
  });

  console.log(`\n\nAnalyzed ${results.total_analyzed} images in ${results.elapsed_ms}ms\n`);
  console.log(results.summary);
}

/**
 * Example 2: Comprehensive research with insights extraction
 */
export async function example2_comprehensiveResearch() {
  console.log('\n=== Example 2: Comprehensive Research ===\n');

  const results = await runImagePipeline({
    brandName: 'BasedbodyWorks',
    productCategories: [
      'shampoo',
      'conditioner',
      'treatments',
      'serums',
      'masks',
    ],
    competitors: [
      'https://www.sephora.com',
      'https://theordinary.com',
      'https://aesop.com',
      'https://kerastase.com',
    ],
    searchPlatforms: ['instagram', 'tiktok', 'pinterest'],
    maxImagesPerSource: 15,
    concurrency: 3,
  });

  // Extract strategic insights
  const insights = extractVisualInsights(results);

  console.log('\n=== VISUAL RESEARCH INSIGHTS ===\n');
  console.log(`Color Strategy:\n${insights.color_strategy}\n`);
  console.log(`Design Direction:\n${insights.design_direction}\n`);
  console.log(`Tone Guidance:\n${insights.tone_guidance}\n`);
  console.log(`Social Media Strategy:\n${insights.social_media_strategy}\n`);

  console.log('Differentiation Opportunities:');
  insights.differentiation_opportunities.forEach((opp, i) => {
    console.log(`  ${i + 1}. ${opp}`);
  });

  // Format for PDF report
  const pdfContent = formatImageResearchForPDF(results);
  console.log('\n=== PDF REPORT CONTENT ===\n');
  console.log(JSON.stringify(pdfContent, null, 2));
}

/**
 * Example 3: Integration with Deep Brand Research
 */
export async function example3_deepBrandResearchIntegration() {
  console.log('\n=== Example 3: Deep Brand Research Integration ===\n');

  // Run visual research as part of larger research flow
  const visualOutput = await runVisualBrandResearch(
    {
      brandName: 'BasedbodyWorks',
      productCategories: ['shampoo', 'conditioner', 'treatments'],
      competitors: [
        'https://theordinary.com',
        'https://aesop.com',
      ],
      searchPlatforms: ['instagram', 'tiktok'],
      maxImagesPerSource: 10,
      concurrency: 2,
    },
    (msg, progress) => {
      console.log(`[${Math.round(progress * 100)}%] ${msg}`);
    },
    (text) => {
      process.stdout.write(text);
    }
  );

  // Format for integration with deepBrandResearch
  const deepResearchFormat = formatForDeepBrandResearch(visualOutput);

  console.log('\n=== FORMATTED FOR DEEP BRAND RESEARCH ===\n');
  console.log(JSON.stringify(deepResearchFormat, null, 2));

  // Extract specific insights for downstream stages
  const colorStrategy = visualOutput.visual_findings.strategic_recommendations.color_strategy;
  const designDirection = visualOutput.visual_findings.strategic_recommendations.design_direction;

  console.log('\n=== READY FOR DOWNSTREAM STAGES ===\n');
  console.log(`Color Strategy (for Taste stage): ${colorStrategy}`);
  console.log(`Design Direction (for Make stage): ${designDirection}`);
}

/**
 * Example 4: Custom competitor analysis
 */
export async function example4_competitorAnalysis() {
  console.log('\n=== Example 4: Competitor Visual Analysis ===\n');

  // Research only competitors, focused analysis
  const results = await runImagePipeline({
    brandName: 'CompetitorAnalysis',
    productCategories: [],
    competitors: [
      'https://theordinary.com',
      'https://aesop.com',
      'https://kerastase.com',
      'https://sephora.com',
    ],
    searchPlatforms: [],
    maxImagesPerSource: 20,
    concurrency: 2,
    onProgress: (msg) => console.log(`→ ${msg}`),
  });

  console.log(`\n=== COMPETITIVE VISUAL LANDSCAPE ===\n`);
  console.log(`Competitors Analyzed: ${results.competitor_images.length}`);
  console.log(`Common Design Approaches:`);
  results.pattern_analysis.design_trends.forEach((trend, i) => {
    console.log(`  ${i + 1}. ${trend}`);
  });

  console.log(`\nVisual Differentiation Opportunities:`);
  results.pattern_analysis.gaps.forEach((gap, i) => {
    console.log(`  ${i + 1}. ${gap}`);
  });

  // Color analysis across competitors
  console.log(`\nCommon Color Strategies:`);
  results.pattern_analysis.common_colors.forEach((color, i) => {
    console.log(`  ${i + 1}. ${color}`);
  });
}

/**
 * Example 5: Real-time streaming with abort signal
 */
export async function example5_streamingWithAbort() {
  console.log('\n=== Example 5: Streaming with Abort ===\n');

  const controller = new AbortController();

  // Set timeout to abort after 30 seconds
  const timeout = setTimeout(() => {
    console.log('\n\nAbort signal triggered after 30 seconds\n');
    controller.abort();
  }, 30000);

  try {
    const results = await runImagePipeline({
      brandName: 'BasedbodyWorks',
      productCategories: ['shampoo'],
      competitors: ['https://theordinary.com'],
      searchPlatforms: ['instagram'],
      maxImagesPerSource: 15,
      concurrency: 2,
      signal: controller.signal,
      onChunk: (text) => {
        process.stdout.write(text);
      },
    });

    console.log(`\nCompleted: ${results.total_analyzed} images analyzed`);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.log('\nResearch aborted by user');
    } else {
      console.error(`Error: ${err}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Example 6: Batch processing multiple brands
 */
export async function example6_multipleBrandsBatch() {
  console.log('\n=== Example 6: Batch Processing Multiple Brands ===\n');

  const brands = [
    { name: 'BasedbodyWorks', categories: ['shampoo', 'conditioner'] },
    { name: 'AnotherBrand', categories: ['skincare', 'serums'] },
    { name: 'ThirdBrand', categories: ['treatments'] },
  ];

  const results = [];

  for (const brand of brands) {
    console.log(`\nResearching ${brand.name}...`);

    try {
      const result = await runImagePipeline({
        brandName: brand.name,
        productCategories: brand.categories,
        competitors: [],
        maxImagesPerSource: 8,
        concurrency: 1,  // Reduced concurrency for batch
      });

      results.push({
        brand: brand.name,
        images_analyzed: result.total_analyzed,
        primary_color: result.pattern_analysis.common_colors[0],
        design_style: result.pattern_analysis.common_styles[0],
      });
    } catch (err) {
      console.log(`Failed to research ${brand.name}: ${err}`);
    }
  }

  console.log('\n=== BATCH RESULTS ===\n');
  results.forEach(r => {
    console.log(`${r.brand}: ${r.images_analyzed} images, ${r.design_style} style, ${r.primary_color} primary color`);
  });
}

/**
 * Example 7: Progressive cache building
 */
export async function example7_cacheBuilding() {
  console.log('\n=== Example 7: Cache Building & Statistics ===\n');

  import { getCacheStats, clearImageCache } from '../services/imageDownloader';

  // Clear any existing cache
  await clearImageCache();
  console.log('Cache cleared\n');

  // First run — cache builds
  console.log('First run (cache miss)...');
  await runImagePipeline({
    brandName: 'BasedbodyWorks',
    productCategories: ['shampoo'],
    competitors: [],
    searchPlatforms: [],
    maxImagesPerSource: 5,
  });

  let stats = await getCacheStats();
  console.log(`After first run:`);
  console.log(`  Memory: ${stats.memory.count} images, ${Math.round(stats.memory.bytes / 1024)} KB`);
  console.log(`  IndexedDB: ${stats.indexeddb.count} images, ${Math.round(stats.indexeddb.bytes / 1024)} KB`);

  // Second run — cache hits
  console.log('\nSecond run (cache hits)...');
  const start = Date.now();

  await runImagePipeline({
    brandName: 'BasedbodyWorks',
    productCategories: ['shampoo'],
    competitors: [],
    searchPlatforms: [],
    maxImagesPerSource: 5,
  });

  const elapsed = Date.now() - start;

  stats = await getCacheStats();
  console.log(`After second run (took ${elapsed}ms):`);
  console.log(`  Memory: ${stats.memory.count} images, ${Math.round(stats.memory.bytes / 1024)} KB`);
  console.log(`  Cache effectiveness: ~${Math.round((elapsed / 1000) * 10)}% faster`);
}

// Run examples (comment/uncomment as needed)
if (require.main === module) {
  (async () => {
    try {
      // Choose which example to run:
      // await example1_basicBrandResearch();
      // await example2_comprehensiveResearch();
      // await example3_deepBrandResearchIntegration();
      // await example4_competitorAnalysis();
      // await example5_streamingWithAbort();
      // await example6_multipleBrandsBatch();
      // await example7_cacheBuilding();

      console.log('Please uncomment the example you want to run in the if statement');
    } catch (err) {
      console.error('Example failed:', err);
      process.exit(1);
    }
  })();
}

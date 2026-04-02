/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CODE GENERATION ENGINE — USAGE EXAMPLES & INTEGRATION GUIDE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This file shows real-world usage patterns for the code generation engine.
 * Use this as a reference when integrating into Make stage or other workflows.
 */

import {
  generateCodeArtifact,
  generateContextAwareArtifacts,
  type GenerationSpec,
  type GeneratedArtifact,
  CodeQualityValidator,
  CodeOptimizer,
  ArtifactGenerator,
  ContextAwareGenerator,
} from './codeGenerationEngine';

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Generate a Single TypeScript Component
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleGenerateSingleComponent() {
  const spec: GenerationSpec = {
    language: 'typescript',
    artifactType: 'component',
    title: 'ProductCard',
    description: 'A reusable product card component displaying product image, name, price, and action buttons.',
    requirements: [
      'Display product image with fallback',
      'Show product name (bold, large)',
      'Display price with currency formatting',
      'Add "Add to Cart" button with hover state',
      'Support dark mode via Tailwind',
      'Include star rating component',
      'Responsive design (mobile-first)',
    ],
    constraints: {
      requireTypes: true,
      requireErrors: true,
      requireComments: true,
      maxTokens: 2000,
    },
  };

  const artifact = await generateCodeArtifact(spec);

  console.log('Generated Component:');
  console.log('─'.repeat(60));
  console.log(artifact.code);
  console.log('─'.repeat(60));
  console.log('Validation:', artifact.validation);
  console.log('Metrics:', artifact.metadata.metrics);
  console.log('Optimizations:', artifact.optimizations);

  return artifact;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Generate a Data Analysis Python Script
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleGeneratePythonAnalysis() {
  const spec: GenerationSpec = {
    language: 'python',
    artifactType: 'data-analysis',
    title: 'customer_segmentation_analysis',
    description: 'Analyze customer data to identify engagement patterns by cohort. Uses pandas/numpy for calculations.',
    requirements: [
      'Load CSV customer data',
      'Calculate engagement metrics (click rate, conversion rate, LTV)',
      'Segment customers into 5 cohorts by engagement level',
      'Generate summary statistics per cohort',
      'Create visualization of segment distribution',
      'Export results to CSV',
      'Handle missing values gracefully',
    ],
  };

  const artifact = await generateCodeArtifact(spec);

  // Validate the Python syntax
  const validation = await CodeQualityValidator.validatePython(artifact.code);
  console.log('Python Validation:', validation);

  // Optimize for token efficiency
  const optimized = CodeOptimizer.removeBoilerplate(artifact.code, 'python');
  console.log('Original tokens:', artifact.metadata.metrics.estimatedTokens);
  console.log('Optimized code length:', Math.ceil(optimized.length / 4), 'tokens');

  return artifact;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Generate SQL Queries for Analytics
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleGenerateSQLQueries() {
  const spec: GenerationSpec = {
    language: 'sql',
    artifactType: 'query',
    title: 'campaign_performance_dashboard',
    description: 'SQL queries for campaign performance dashboard. Includes impressions, clicks, conversions, and ROAS calculations.',
    requirements: [
      'SELECT campaigns with impression count, click count, conversion count',
      'Calculate CTR = clicks / impressions',
      'Calculate conversion rate = conversions / clicks',
      'Calculate ROAS = revenue / ad_spend',
      'GROUP BY campaign and date',
      'ORDER by ROAS descending',
      'Filter by date range with parameterized query',
      'Use indexes for performance',
    ],
  };

  const artifact = await generateCodeArtifact(spec);

  // Validate SQL safety (check for injection vulnerabilities, etc.)
  const validation = await CodeQualityValidator.validateSQL(artifact.code);
  console.log('SQL Validation:', validation);

  return artifact;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Multi-Artifact Generation with Context Awareness
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleContextAwareGeneration() {
  // Specs for a complete "ad analytics dashboard" solution
  const specs: GenerationSpec[] = [
    {
      language: 'typescript',
      artifactType: 'component',
      title: 'DashboardMetrics',
      description: 'Main dashboard displaying key metrics (impressions, CTR, ROAS)',
      requirements: [
        'Display metric cards with current value and trend',
        'Show sparkline graphs for each metric',
        'Real-time data updates via WebSocket',
      ],
    },
    {
      language: 'python',
      artifactType: 'data-analysis',
      title: 'metrics_calculator',
      description: 'Backend service to calculate dashboard metrics from raw data',
      requirements: [
        'Read from metrics table',
        'Aggregate by day and campaign',
        'Calculate trends (week-over-week growth)',
        'Cache results for performance',
      ],
    },
    {
      language: 'sql',
      artifactType: 'query',
      title: 'metrics_schema',
      description: 'Database schema and indexes for metrics table',
      requirements: [
        'Table: ads_metrics (campaign_id, date, impressions, clicks, conversions)',
        'Indexes on campaign_id and date',
        'Partitioning by date for performance',
      ],
    },
  ];

  // Generate all artifacts with codebase style awareness
  const artifacts = await generateContextAwareArtifacts(specs, '/Users/mk/Downloads/nomads');

  console.log(`Generated ${artifacts.length} artifacts:`);
  for (const artifact of artifacts) {
    console.log(`
  ► ${artifact.spec.title} (${artifact.metadata.language})
    - Lines: ${artifact.metadata.metrics.lineCount}
    - Valid: ${artifact.validation.isValid}
    - Estimate Tokens: ${artifact.metadata.metrics.estimatedTokens}
    - Quality Score: ${artifact.optimizations?.readabilityScore || 'N/A'}/100
    `);
  }

  return artifacts;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Quality Validation & Optimization Workflow
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleQualityWorkflow() {
  // Generate a component
  const spec: GenerationSpec = {
    language: 'typescript',
    artifactType: 'component',
    title: 'AnalyticsChart',
    description: 'Chart component for displaying time-series analytics data',
    requirements: [
      'Accept data array with timestamp and value',
      'Render using Canvas or SVG',
      'Support zooming and panning',
      'Show tooltip on hover',
    ],
  };

  const artifact = await generateCodeArtifact(spec);

  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║ QUALITY VALIDATION WORKFLOW                              ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  // Step 1: Validate
  console.log('\n1️⃣  VALIDATION');
  console.log('─'.repeat(60));
  console.log('Valid:', artifact.validation.isValid);
  console.log('Errors:', artifact.validation.errors.length);
  console.log('Warnings:', artifact.validation.warnings.length);
  if (artifact.validation.warnings.length > 0) {
    artifact.validation.warnings.forEach(w => console.log('  ⚠️  ' + w));
  }

  // Step 2: Analyze Metrics
  console.log('\n2️⃣  CODE METRICS');
  console.log('─'.repeat(60));
  console.log('Lines:', artifact.metadata.metrics.lineCount);
  console.log('Complexity:', artifact.metadata.metrics.complexity);
  console.log('Functions:', artifact.metadata.metrics.functions.length);
  console.log('Types:', artifact.metadata.metrics.types.length);
  console.log('Estimated Tokens:', artifact.metadata.metrics.estimatedTokens);

  // Step 3: Optimize
  console.log('\n3️⃣  OPTIMIZATION');
  console.log('─'.repeat(60));
  if (artifact.optimizations) {
    console.log('Original Tokens:', artifact.optimizations.originalTokens);
    console.log('Optimized Tokens:', artifact.optimizations.optimizedTokens);
    console.log('Savings:', `${artifact.optimizations.savings}%`);
    console.log('Readability Score:', `${artifact.optimizations.readabilityScore}/100`);

    if (artifact.optimizations.refactoringSuggestions.length > 0) {
      console.log('\nRefactoring Suggestions:');
      artifact.optimizations.refactoringSuggestions.forEach(s => console.log('  → ' + s));
    }
  }

  // Step 4: Integration Points
  console.log('\n4️⃣  INTEGRATION POINTS');
  console.log('─'.repeat(60));
  const analysis = await ContextAwareGenerator.analyzeCodebase('/Users/mk/Downloads/nomads');
  const integrationPoints = ContextAwareGenerator.suggestIntegrationPoints(spec, analysis);
  integrationPoints.forEach(point => {
    console.log(`  📍 ${point.filePath}`);
    console.log(`     ${point.reason}`);
    if (point.example) console.log(`     Example: ${point.example}`);
  });

  return artifact;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Make Stage Integration (Ad Concept Generation with Artifacts)
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleMakeStageIntegration() {
  /**
   * Instead of text concepts like:
   *   "Concept 1: A desire-driven ad about collagen with headline 'Look 10 Years Younger'..."
   *
   * We generate executable code artifacts:
   *   - React component: AdPreview component with exact layout, spacing, fonts
   *   - Python visualization: matplotlib showing engagement projections
   *   - CSV: audience segmentation data with engagement probability
   *   - SQL: database queries for performance analytics
   *   - Documentation: implementation guide with success metrics
   */

  const adConcept = {
    angle: 'desire' as const,
    headline: 'Look 10 Years Younger in 30 Days',
    body: 'Our marine collagen has helped over 100K women reduce fine lines and restore radiance...',
    cta: 'Get Your First Box at 50% Off',
  };

  // Generate 5 supporting artifacts for this single concept
  const artifactSpecs: GenerationSpec[] = [
    {
      language: 'typescript',
      artifactType: 'component',
      title: `AdPreview_Desire`,
      description: `Preview component for "${adConcept.headline}" ad. Shows exact layout, typography, CTA styling.`,
      requirements: [
        'Hero section with headline',
        'Body copy with social proof callout',
        'CTA button with urgency badge',
        'Responsive on mobile (375px)',
        'Dark mode support',
      ],
    },
    {
      language: 'python',
      artifactType: 'visualization',
      title: `EngagementMetrics_Desire`,
      description: 'Matplotlib visualization of expected engagement metrics for this ad angle',
      requirements: [
        'Plot 1: Predicted CTR by age group',
        'Plot 2: Conversion rate by device',
        'Plot 3: ROAS projection by spend',
      ],
    },
    {
      language: 'python',
      artifactType: 'csv-export',
      title: `AudienceSegments_Desire`,
      description: 'CSV with target audience segments for this desire-driven angle',
      requirements: [
        'Columns: age_group, interest, intent_signal, platform, expected_ctr',
        '10+ demographic segments',
        'Engagement probability scores',
      ],
    },
    {
      language: 'sql',
      artifactType: 'query',
      title: `ConceptAnalytics_Desire`,
      description: 'SQL to track performance of this specific ad concept',
      requirements: [
        'Track impressions, clicks, conversions',
        'Calculate CTR and ROAS',
        'Compare to other angles (objection, proof)',
      ],
    },
    {
      language: 'markdown',
      artifactType: 'document',
      title: `ConceptGuide_Desire`,
      description: 'Complete implementation guide for this ad concept',
      requirements: [
        'Creative rationale (why this angle works)',
        'Target audience persona',
        'Success metrics and benchmarks',
        'A/B testing recommendations',
      ],
    },
  ];

  console.log(`Generating ${artifactSpecs.length} artifacts for ad concept: "${adConcept.headline}"`);
  console.log('─'.repeat(60));

  const artifacts = await Promise.all(
    artifactSpecs.map(spec => generateCodeArtifact(spec))
  );

  console.log(`\n✅ Generated ${artifacts.filter(a => a.validation.isValid).length}/${artifacts.length} valid artifacts\n`);

  for (const artifact of artifacts) {
    console.log(`
📦 ${artifact.spec.title} (${artifact.metadata.language})
   ${artifact.validation.isValid ? '✅ Valid' : '❌ Invalid'}
   Lines: ${artifact.metadata.metrics.lineCount}
   Tokens: ${artifact.metadata.metrics.estimatedTokens}
   Quality: ${artifact.optimizations?.readabilityScore || 'N/A'}/100
    `);
  }

  return artifacts;
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Error Handling & Recovery
// ══════════════════════════════════════════════════════════════════════════════

export async function exampleErrorHandling() {
  try {
    // Try to generate with invalid requirements
    const invalidSpec: GenerationSpec = {
      language: 'typescript',
      artifactType: 'component',
      title: 'BadComponent',
      description: 'This will fail validation',
      requirements: [], // Empty requirements will cause issues
    };

    const artifact = await generateCodeArtifact(invalidSpec);

    if (!artifact.validation.isValid) {
      console.log('Artifact failed validation:');
      artifact.validation.errors.forEach(e => console.error('  ❌ ' + e));
      artifact.validation.warnings.forEach(w => console.warn('  ⚠️  ' + w));

      // Attempt fix: add error handling
      const fixedSpec: GenerationSpec = {
        ...invalidSpec,
        requirements: ['Handle errors gracefully', 'Add try/catch blocks'],
      };

      const fixed = await generateCodeArtifact(fixedSpec);
      console.log('Fixed artifact valid:', fixed.validation.isValid);
    }
  } catch (error) {
    console.error('Generation error:', error instanceof Error ? error.message : String(error));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION WITH MAKE STAGE (useCycleLoop)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * In useCycleLoop.ts, replace the text-only Make stage with code generation:
 *
 * BEFORE (text output):
 * ```
 * const makeOutput = await generateMakeOutput(researchFindings, copyBlocks);
 * // Output: "Concept 1: [text description]..."
 * ```
 *
 * AFTER (artifact-based output):
 * ```
 * import { generateMakeStageWithCodeGeneration } from './makeStageCodeGeneration';
 *
 * const makeOutput = await generateMakeStageWithCodeGeneration(
 *   {
 *     brand: campaign.brandName,
 *     campaign: campaign.name,
 *     desireContext: researchFindings.desires,
 *     objectionContext: researchFindings.objections,
 *     proofContext: researchFindings.proof,
 *     copyBlocks: researchFindings.copyBlocks,
 *     tone: researchFindings.tone,
 *     model: 'qwen3.5:9b',
 *   },
 *   signal,
 *   onChunk
 * );
 *
 * // Output: 3 concepts with 5 production-ready artifacts each
 * // Each artifact is validated, optimized, and executable
 * ```
 */

export async function exampleCycleLoopIntegration() {
  // This shows how to integrate with useCycleLoop

  const codeGenerationConfig = {
    // In the Make stage of the cycle, generate concepts with code artifacts
    artifactTypes: ['visualization', 'component', 'csv-export', 'query', 'document'] as const,

    // Validation happens automatically before output
    validateBeforeOutput: true,

    // Optimize code for token efficiency
    optimize: true,

    // Generate context-aware code (match codebase style)
    contextAware: true,

    // Score concepts based on artifact quality
    scoringCriteria: {
      validationWeight: 0.4, // 40% score from validation
      qualityWeight: 0.3, // 30% score from readability/complexity
      efficiencyWeight: 0.2, // 20% score from token savings
      businessAlignmentWeight: 0.1, // 10% score from business metrics
    },
  };

  console.log('Make Stage Code Generation Config:');
  console.log(JSON.stringify(codeGenerationConfig, null, 2));
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN ALL EXAMPLES (uncomment to test)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * To test all examples:
 *
 * import * as examples from './codeGenerationEngine.example';
 *
 * // Run a single example:
 * await examples.exampleGenerateSingleComponent();
 *
 * // Or run all:
 * const allExamples = [
 *   examples.exampleGenerateSingleComponent,
 *   examples.exampleGeneratePythonAnalysis,
 *   examples.exampleGenerateSQLQueries,
 *   examples.exampleContextAwareGeneration,
 *   examples.exampleQualityWorkflow,
 *   examples.exampleMakeStageIntegration,
 * ];
 *
 * for (const example of allExamples) {
 *   console.log(`\n${'═'.repeat(60)}`);
 *   console.log(`Running: ${example.name}`);
 *   console.log(`${'═'.repeat(60)}`);
 *   try {
 *     await example();
 *   } catch (e) {
 *     console.error(`Failed: ${e}`);
 *   }
 * }
 */

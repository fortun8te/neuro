/**
 * Smart Analysis Example
 *
 * Demonstrates the new dynamic reasoning + visual analysis system.
 * Instead of following presets, it THINKS about what to research.
 */

import { SubagentPool } from '../utils/subagentManager';
import { executeSmartAnalysis } from '../core/analyzers/smartAnalysisOrchestrator';

/**
 * Example 1: BasedbodyWorks analysis with dynamic reasoning
 */
export async function exampleBasedbodyworksSmartAnalysis() {
  console.log('🧠 Smart Analysis Example: BasedbodyWorks');
  console.log('=========================================\n');

  const pool = new SubagentPool(9);

  const result = await executeSmartAnalysis(
    {
      brandName: 'BasedbodyWorks',
      question:
        'What is BasedbodyWorks positioning and how can we create a unique creative strategy?',
      context:
        'Conducting comprehensive brand analysis for creative positioning and competitive differentiation',
      brandWebsite: 'https://basedbodyworks.com',
      competitorWebsites: [
        'https://prose.com',
        'https://functionofbeauty.com',
        'https://olaplex.com',
      ],
      timeLimit: 30 * 60 * 1000, // 30 minutes
      iterationLimit: 5,
      confidenceTarget: 80,
    },
    pool,
    (progress) => {
      console.log(`[${progress.completion}%] ${progress.step}`);
      if (progress.nextActions?.length) {
        console.log(
          `  → Next: ${progress.nextActions.slice(0, 2).join(', ')}`,
        );
      }
    },
  );

  console.log('\n✅ Analysis Complete');
  console.log(`⏱️  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`📊 Confidence: ${result.confidence}%`);
  console.log(`🔄 Iterations: ${result.iterations}`);

  console.log('\n🎨 Visual Analysis:');
  if (result.siteVisuals) {
    console.log(`  • Design Score: ${result.siteVisuals.overallQuality.designScore}`);
    console.log(`  • Tone: ${result.siteVisuals.visualTone.primary}`);
    console.log(`  • Colors: ${result.siteVisuals.colors.primary.hex}`);
  }

  console.log('\n📦 Product Analysis:');
  if (result.productAnalysis) {
    console.log(
      `  • Products: ${result.productAnalysis.products?.length || 0}`,
    );
    console.log(
      `  • Price Range: $${result.productAnalysis.priceRange?.min}-$${result.productAnalysis.priceRange?.max}`,
    );
  }

  console.log('\n📱 Social Presence:');
  if (result.socialAnalysis) {
    console.log(
      `  • Platforms: ${result.socialAnalysis.platforms?.length || 0}`,
    );
    result.socialAnalysis.platforms?.slice(0, 3).forEach((platform: any) => {
      console.log(
        `    - ${platform.name}: ${platform.followers?.toLocaleString()} followers`,
      );
    });
  }

  console.log('\n💰 Revenue Estimate:');
  if (result.revenueAnalysis) {
    console.log(
      `  • Annual Revenue: $${result.revenueAnalysis.estimate?.toLocaleString()}`,
    );
    console.log(`  • Confidence: ${result.revenueAnalysis.confidence}%`);
  }

  console.log('\n🎯 Audience:');
  if (result.audienceAnalysis) {
    const primary = result.audienceAnalysis.primaryPersona;
    console.log(`  • Primary: ${primary.ageRange} ${primary.gender}`);
    console.log(`  • Values: ${primary.values?.join(', ')}`);
  }

  console.log('\n🔍 Research Process:');
  console.log(`  • Dynamic reasoning iterations: ${result.researchPlans.length}`);
  result.researchPlans.forEach((plan, i) => {
    console.log(`    Iteration ${i + 1}: ${plan.gaps.length} gaps identified`);
    if (plan.gaps.length > 0) {
      console.log(
        `      Top gap: ${plan.gaps[0].aspect} (${plan.gaps[0].importance})`,
      );
    }
  });

  console.log('\n💡 Key Findings:');
  result.keyFindings.forEach((finding) => {
    console.log(`  • ${finding}`);
  });

  console.log('\n➡️  Next Steps:');
  result.nextSteps.forEach((step) => {
    console.log(`  1. ${step}`);
  });

  console.log('\n');
  return result;
}

/**
 * Example 2: Using dynamic reasoning without presets
 */
export async function exampleDynamicReasoningOnly() {
  console.log('🧠 Dynamic Reasoning Example (No Presets)');
  console.log('=========================================\n');

  const pool = new SubagentPool(9);

  const result = await executeSmartAnalysis(
    {
      brandName: 'Unknown Supplement Brand',
      question: 'What makes this brand unique in the supplement market?',
      context:
        'Generic question - system will figure out what to research based on gaps',
      // No brand website specified - tests reasoning in absence of data
      timeLimit: 15 * 60 * 1000, // 15 minutes
      iterationLimit: 3,
      confidenceTarget: 70,
    },
    pool,
    (progress) => {
      if (progress.dynamicPlan) {
        console.log(
          `\n[Iteration] Found ${progress.dynamicPlan.gaps.length} gaps:`,
        );
        progress.dynamicPlan.gaps.forEach((gap) => {
          console.log(`  • ${gap.aspect} (${gap.importance})`);
          console.log(`    Why: ${gap.whyMissing}`);
          console.log(`    Suggested: ${gap.suggestedQueries[0]}`);
        });
      }
    },
  );

  console.log('\n✅ Reasoning Complete');
  console.log(`📊 Confidence: ${result.confidence}%`);

  console.log('\nDynamic Research Plans Generated:');
  result.researchPlans.forEach((plan, i) => {
    console.log(`\nPlan ${i + 1}:`);
    console.log(`  Coverage: ${plan.currentCoverage}%`);
    console.log(`  Gaps: ${plan.gaps.length}`);
    console.log(`  Summary: ${plan.summary}`);
  });

  return result;
}

/**
 * Example 3: Site visual analysis only
 */
export async function exampleSiteVisualAnalysis() {
  console.log('🎨 Site Visual Analysis Example');
  console.log('===============================\n');

  const { analyzeSiteVisuals } = await import(
    '../services/siteVisualAnalyzer'
  );

  console.log('Analyzing brand website visuals...\n');

  const analysis = await analyzeSiteVisuals('https://basedbodyworks.com', {
    compareWith: [
      'https://prose.com',
      'https://functionofbeauty.com',
    ],
    focus: 'all',
    includeScreenshot: false,
  });

  console.log('🎨 Color Palette:');
  console.log(`  Primary: ${analysis.colors.primary.hex}`);
  console.log(`  Secondary: ${analysis.colors.secondary.hex}`);
  console.log(`  Accent: ${analysis.colors.accent.hex}`);

  console.log('\n📝 Typography:');
  console.log(`  Primary: ${analysis.typography.primaryFont}`);
  console.log(`  Heading Style: ${analysis.typography.headingStyle}`);
  console.log(`  Readability Score: ${analysis.typography.readability.score}/100`);

  console.log('\n🎯 Visual Tone:');
  console.log(`  Primary: ${analysis.visualTone.primary}`);
  console.log(`  Traits: ${analysis.visualTone.secondaryTraits.join(', ')}`);
  console.log(`  Personality: ${analysis.visualTone.brandPersonality}`);

  console.log('\n📊 Quality Assessment:');
  console.log(`  Design Score: ${analysis.overallQuality.designScore}/100`);
  console.log(`  Modernness: ${analysis.overallQuality.modernness}/100`);
  console.log(`  Consistency: ${analysis.overallQuality.consistency}/100`);

  console.log('\n💡 Insights:');
  analysis.insights.slice(0, 3).forEach((insight) => {
    console.log(`  • ${insight}`);
  });

  console.log('\n📋 Recommendations:');
  analysis.recommendations.slice(0, 3).forEach((rec) => {
    console.log(`  • ${rec}`);
  });

  if (analysis.positioning) {
    console.log('\n🆚 Competitive Positioning:');
    console.log(`  Compared to: ${analysis.positioning.comparedTo.join(', ')}`);
    console.log(`  Strengths: ${analysis.positioning.strengths.join(', ')}`);
    console.log(`  Weaknesses: ${analysis.positioning.weaknesses.join(', ')}`);
  }

  return analysis;
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    console.log('Running Smart Analysis Examples\n');

    // Example 1: Full smart analysis
    await exampleBasedbodyworksSmartAnalysis();

    // Example 2: Dynamic reasoning
    // await exampleDynamicReasoningOnly();

    // Example 3: Site visual analysis
    // await exampleSiteVisualAnalysis();

    console.log('✅ All examples completed successfully');
  } catch (error) {
    console.error(
      'Error running examples:',
      error instanceof Error ? error.message : error,
    );
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

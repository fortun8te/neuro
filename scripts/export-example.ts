#!/usr/bin/env node
/**
 * Export Example Script
 *
 * Demonstrates all PDF export formats and options
 * Usage:
 *   tsx scripts/export-example.ts [findings-json-path]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { exportHelper } from '../src/utils/exportHelper';
import { chartGenerator } from '../src/services';
import type { ResearchFindings } from '../src/frontend/types';

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const findingsPath = args[0] || './sample-findings.json';

  console.log(chalk.cyan('\n📄 PDF Export System — Example\n'));

  // Load sample findings
  let findings: ResearchFindings;
  try {
    const content = await fs.readFile(findingsPath, 'utf-8');
    findings = JSON.parse(content);
    console.log(chalk.green(`✓ Loaded findings from: ${findingsPath}`));
  } catch (error) {
    console.log(chalk.yellow(`⚠ Could not load findings. Creating minimal sample...`));
    findings = createSampleFindings();
  }

  console.log(chalk.cyan(`\nResearch Summary:`));
  console.log(`  Deep Desires: ${findings.deepDesires?.length || 0}`);
  console.log(`  Objections: ${findings.objections?.length || 0}`);
  console.log(`  Avatar Language Phrases: ${findings.avatarLanguage?.length || 0}`);
  console.log(`  Competitors Analyzed: ${findings.competitorAds?.competitors?.length || 0}`);
  console.log(`  Total Sources: ${findings.auditTrail?.totalSources || 0}`);
  console.log(`  Coverage: ${findings.auditTrail ? (findings.auditTrail.coverageAchieved * 100).toFixed(1) : 'N/A'}%`);

  // Example 1: Export polished PDF only
  console.log(chalk.cyan('\n--- Example 1: Polished PDF Only ---'));
  const result1 = await exportHelper.exportFindings(findings, {
    formats: ['pdf-polished'],
    filename: 'example-polished',
    companyName: 'Example Corp',
    reportTitle: 'Market Research Report',
    authorName: 'Research Team',
    includeVisuals: true,
    verbose: true,
  });
  exportHelper.printSummary(result1);

  // Example 2: Export raw PDF only
  console.log(chalk.cyan('\n--- Example 2: Raw PDF Only ---'));
  const result2 = await exportHelper.exportFindings(findings, {
    formats: ['pdf-raw'],
    filename: 'example-raw',
    verbose: true,
  });
  exportHelper.printSummary(result2);

  // Example 3: Export all formats
  console.log(chalk.cyan('\n--- Example 3: All Formats ---'));
  const result3 = await exportHelper.exportFindings(findings, {
    formats: ['pdf-raw', 'pdf-polished', 'markdown', 'html', 'json'],
    filename: 'example-complete',
    companyName: 'Example Corp',
    reportTitle: 'Complete Research Export',
    includeVisuals: true,
    verbose: true,
  });
  exportHelper.printSummary(result3);

  // Example 4: Generate charts
  if (findings.competitorAds?.competitors?.length) {
    console.log(chalk.cyan('\n--- Example 4: Generate Charts ---'));
    const posMatrix = chartGenerator.generatePositioningMatrix(
      findings.competitorAds.competitors,
      { width: 500, height: 400 },
    );
    console.log(`✓ Generated positioning matrix (${posMatrix.width}x${posMatrix.height})`);

    const coverage = chartGenerator.generateCoverageChart(findings);
    console.log(`✓ Generated coverage chart (${coverage.width}x${coverage.height})`);

    const gauge = chartGenerator.generateConfidenceGauge(findings);
    console.log(`✓ Generated confidence gauge (${gauge.width}x${gauge.height})`);
  }

  // Summary
  console.log(chalk.cyan('\n--- Summary ---'));
  const allResults = [result1, result2, result3].filter(r => r.success);
  const totalFiles = allResults.reduce((sum, r) => sum + r.files.length, 0);
  const outputDir = result3.outputDir;

  console.log(`\n✓ Export complete!`);
  console.log(`  Total files generated: ${totalFiles}`);
  console.log(`  Output directory: ${outputDir}`);
  console.log(`\nView the exports in your file system:${outputDir}`);
}

// ──────────────────────────────────────────────────────────────
// Sample Data Creator
// ──────────────────────────────────────────────────────────────

function createSampleFindings(): ResearchFindings {
  return {
    deepDesires: [
      {
        id: 'desire-1',
        surfaceProblem: 'Tired and sluggish during day',
        layers: [
          {
            level: 1,
            description: 'Need energy to get through the day',
            example: 'Can barely keep eyes open by 3pm',
          },
          {
            level: 2,
            description: 'Want to feel productive and capable',
            example: 'Frustrated with lack of focus',
          },
          {
            level: 3,
            description: 'Desire to feel like their best self',
            example: 'Imagine having unlimited energy',
          },
        ],
        deepestDesire: 'Feel alive, capable, and in control of their day',
        desireIntensity: 'high',
        turningPoint: 'One day felt amazing and realized what was possible',
        amplifiedDesireType: 'identity_status',
        targetSegment: 'Working professionals, ages 25-45',
      },
    ],
    objections: [
      {
        objection: 'Worried about energy crash later',
        frequency: 'common',
        impact: 'high',
        handlingApproach: 'Show testimonials of sustained energy, explain science',
        requiredProof: ['Customer testimonials', 'Scientific studies', 'Before/after energy logs'],
      },
      {
        objection: 'Too expensive compared to coffee',
        frequency: 'common',
        impact: 'medium',
        handlingApproach: 'Show cost per serving, calculate ROI on productivity',
        requiredProof: ['Pricing comparison chart', 'Productivity ROI calculation'],
      },
    ],
    avatarLanguage: [
      "I just need to get through the day",
      "Where's my coffee?",
      "I hit a wall around 2pm",
      "I want to be sharp at meetings",
      "By evening I'm completely drained",
      "I wish I had more focus",
    ],
    whereAudienceCongregates: [
      'LinkedIn (professionals sharing productivity hacks)',
      'Reddit (r/productivity, r/health)',
      'Health/wellness blogs',
      'Productivity podcasts',
      'Facebook groups for busy parents',
    ],
    whatTheyTriedBefore: [
      'Multiple cups of coffee (leads to jitters)',
      'Energy drinks (too much sugar)',
      'Power naps (impractical at work)',
      'Supplements (unclear what actually works)',
      'Nutrition changes (too complicated)',
    ],
    competitorWeaknesses: [
      'Competitor A: Tastes terrible, hard to use',
      'Competitor B: Very expensive, unclear benefits',
      'Competitor C: Marketing feels inauthentic to audience',
      'Competitor D: No social proof, new brand',
      'Coffee: Unreliable (varies by brew), causes crash',
    ],
    competitorAds: {
      competitors: [
        {
          brand: 'CompetitorA',
          positioning: 'Natural, science-backed energy',
          adExamples: [
            {
              adCopy: 'Feel naturally energized without the crash',
              headline: 'Real energy, no jitters',
              emotionalDriver: 'Desire for natural solutions',
              sourceUrl: 'https://example.com/ad1',
            },
          ],
          dominantAngles: ['Natural science', 'No crash promise'],
          estimatedActiveAds: 12,
        },
      ],
      industryPatterns: {
        dominantHooks: ['Natural energy', 'Sustained focus'],
        commonEmotionalDrivers: ['Control', 'Productivity'],
        unusedAngles: ['Sustainability', 'Community health'],
        dominantFormats: ['Educational content', 'Testimonials'],
        commonOffers: ['Free sample', 'Subscribe and save'],
      },
      visionAnalyzed: 5,
    },
    auditTrail: {
      totalSources: 47,
      sourcesByType: {
        web: 35,
        reddit: 7,
        academic: 5,
      },
      sourceList: [
        {
          url: 'https://example.com/energy-stats',
          query: 'energy supplement market trends',
          source: 'web',
          fetchedAt: Date.now() - 86400000,
        },
      ],
      modelsUsed: ['qwen3.5:4b', 'qwen3.5:2b'],
      totalTokensGenerated: 45000,
      tokensByModel: {
        'qwen3.5:4b': 28000,
        'qwen3.5:2b': 17000,
      },
      phaseTimes: {
        'web-research': 180000,
        'desire-analysis': 45000,
      },
      researchDuration: 225000,
      preset: 'NR',
      iterationsCompleted: 8,
      coverageAchieved: 0.82,
    },
  };
}

// Run
main().catch(error => {
  console.error(chalk.red('\nError:'), error.message);
  process.exit(1);
});

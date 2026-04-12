/**
 * Template System Usage Examples
 *
 * Demonstrates:
 * 1. Using each of the 6 templates
 * 2. Variable substitution
 * 3. Plan generation
 * 4. Integration with orchestrator
 * 5. Judge strategy
 */

import {
  getTemplate,
  parseTemplate,
  extractQueries,
  getCoreSections,
  getRelatedSections,
  formatPlanForCLI,
  type ResearchPlan,
} from './index';

// ─────────────────────────────────────────────────────────────
// Example 1: Creative Strategy Template
// ─────────────────────────────────────────────────────────────

export function example1_creativeStrategy(): void {
  console.log('Example 1: Creative Strategy\n');

  const template = getTemplate('creative-strategy');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    TOPIC: 'collagen supplements',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));
  console.log('\nSample queries:');

  const { queries } = extractQueries(plan);
  queries.slice(0, 5).forEach(q => console.log(`  - ${q}`));

  console.log(`\nCore sections (must reach 85% coverage):`);
  getCoreSections(plan).forEach(s => {
    console.log(`  - ${s.title}: ${s.queries.length} queries`);
  });

  console.log(`\nRelated sections (optional):`);
  getRelatedSections(plan).forEach(s => {
    console.log(`  - ${s.title}: ${s.queries.length} queries`);
  });
}

// ─────────────────────────────────────────────────────────────
// Example 2: Lead Generation Template
// ─────────────────────────────────────────────────────────────

export function example2_leadGeneration(): void {
  console.log('\n\nExample 2: Lead Generation\n');

  const template = getTemplate('lead-generation');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    COMPANY: 'SaaS API platforms',
    DECISION_MAKER: 'VP of Engineering',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));

  console.log('\nVariables substituted:');
  console.log(`  COMPANY: ${plan.variables.COMPANY}`);
  console.log(`  DECISION_MAKER: ${plan.variables.DECISION_MAKER}`);

  console.log('\nCore vs Related breakdown:');
  console.log(`  Core: ${getCoreSections(plan).length} sections`);
  console.log(`  Related: ${getRelatedSections(plan).length} sections`);
}

// ─────────────────────────────────────────────────────────────
// Example 3: General Research Template
// ─────────────────────────────────────────────────────────────

export function example3_generalResearch(): void {
  console.log('\n\nExample 3: General Research\n');

  const template = getTemplate('general-research');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    TOPIC: 'blockchain technology',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));

  const { queries, sectionIds } = extractQueries(plan);
  console.log(`\nTotal queries to execute: ${queries.length}`);
  console.log('Query examples:');
  queries.slice(0, 3).forEach(q => console.log(`  - ${q}`));
}

// ─────────────────────────────────────────────────────────────
// Example 4: GitHub Single Repository
// ─────────────────────────────────────────────────────────────

export function example4_githubSingle(): void {
  console.log('\n\nExample 4: GitHub Single Repository\n');

  const template = getTemplate('github-single');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    REPO_PATH: '/Users/mk/repos/myapp',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));

  console.log('\nCode analysis sections:');
  plan.sections.forEach(s => {
    if (s.codeAnalysisConfig) {
      console.log(`\n  ${s.title}:`);
      console.log(`    Paths: ${s.codeAnalysisConfig.paths.join(', ')}`);
      console.log(`    Analyze: ${s.codeAnalysisConfig.analyze.join(', ')}`);
      console.log(`    Depth: ${s.codeAnalysisConfig.depth}`);
    }
  });

  console.log('\nQueries for this section:');
  const queries = extractQueries(plan).queries;
  queries.slice(0, 3).forEach(q => console.log(`  - ${q}`));
}

// ─────────────────────────────────────────────────────────────
// Example 5: GitHub Multi-Repository Comparison
// ─────────────────────────────────────────────────────────────

export function example5_githubMulti(): void {
  console.log('\n\nExample 5: GitHub Multi-Repository Comparison\n');

  const template = getTemplate('github-multi');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    REPO_PATHS: '/path/to/repo1,/path/to/repo2,/path/to/repo3',
    COMPARISON_FOCUS: 'API design patterns',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));

  console.log('\nComparison focus:', plan.variables.COMPARISON_FOCUS);
  console.log('Repositories to analyze:');
  const paths = plan.variables.REPO_PATHS.split(',');
  paths.forEach(p => console.log(`  - ${p.trim()}`));

  console.log('\nComparison sections:');
  getCoreSections(plan).forEach(s => {
    console.log(`  - ${s.title} (${s.priority})`);
  });
}

// ─────────────────────────────────────────────────────────────
// Example 6: Problem Solution Template
// ─────────────────────────────────────────────────────────────

export function example6_problemSolution(): void {
  console.log('\n\nExample 6: Problem Solution\n');

  const template = getTemplate('problem-solution');
  if (!template) throw new Error('Template not found');

  const { plan, errors } = parseTemplate(template, {
    PROBLEM: 'Next.js hydration errors',
  });

  if (errors.length > 0) {
    console.error('Errors:', errors);
    return;
  }

  console.log(formatPlanForCLI(plan));

  console.log('\nQueries by source type:');
  plan.sections.forEach(s => {
    console.log(`\n  ${s.title}:`);
    console.log(`    Priority: ${s.priority}`);
    console.log(`    Scope: ${s.scope}`);
    console.log(`    Queries: ${s.queries.length}`);
    s.queries.slice(0, 2).forEach(q => console.log(`      - ${q}`));
  });
}

// ─────────────────────────────────────────────────────────────
// Example 7: Judge Strategy Integration
// ─────────────────────────────────────────────────────────────

export function example7_judgeStrategy(): void {
  console.log('\n\nExample 7: Judge Strategy Integration\n');

  const template = getTemplate('creative-strategy');
  if (!template) throw new Error('Template not found');

  const { plan } = parseTemplate(template, {
    TOPIC: 'collagen supplements',
  });

  console.log('Judge Strategy: core-focused');
  console.log(`Coverage Threshold: ${plan.coreThreshold}%\n`);

  const coreSections = getCoreSections(plan);
  const relatedSections = getRelatedSections(plan);

  console.log('Core sections (MUST reach 85%):');
  coreSections.forEach(s => {
    console.log(`  ✓ ${s.title} [${s.priority}]`);
    console.log(`    Scope: ${s.scope} | Queries: ${s.queries.length}`);
  });

  console.log('\nRelated sections (optional):');
  relatedSections.forEach(s => {
    console.log(`  ○ ${s.title} [${s.priority}]`);
    console.log(`    Scope: ${s.scope} | Queries: ${s.queries.length}`);
  });

  console.log('\nHow Judge uses this:');
  console.log('  1. Calculates coverage % from core sections only');
  console.log('  2. Compares against 85% threshold');
  console.log('  3. When core >= 85%, can terminate');
  console.log('  4. Related sections extend coverage if time allows');
}

// ─────────────────────────────────────────────────────────────
// Example 8: Variable Substitution Details
// ─────────────────────────────────────────────────────────────

export function example8_variableSubstitution(): void {
  console.log('\n\nExample 8: Variable Substitution Details\n');

  const template = getTemplate('lead-generation');
  if (!template) throw new Error('Template not found');

  console.log('Original template query:');
  console.log('  "who buys [COMPANY] type solutions"');
  console.log('  "how [COMPANY] customers select vendors"\n');

  const { plan } = parseTemplate(template, {
    COMPANY: 'B2B SaaS platforms',
    DECISION_MAKER: 'CTO',
  });

  console.log('After substitution with COMPANY="B2B SaaS platforms":');
  plan.sections[0].queries.slice(0, 2).forEach(q => {
    console.log(`  "${q}"`);
  });

  console.log('\nVariables available in plan:');
  Object.entries(plan.variables).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
}

// ─────────────────────────────────────────────────────────────
// Run All Examples
// ─────────────────────────────────────────────────────────────

export function runAllExamples(): void {
  try {
    example1_creativeStrategy();
    example2_leadGeneration();
    example3_generalResearch();
    example4_githubSingle();
    example5_githubMulti();
    example6_problemSolution();
    example7_judgeStrategy();
    example8_variableSubstitution();

    console.log('\n\n' + '─'.repeat(60));
    console.log('All examples completed successfully!');
    console.log('─'.repeat(60) + '\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

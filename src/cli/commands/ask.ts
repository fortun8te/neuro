#!/usr/bin/env node
/**
 * Ask Command — Interactive Research with Templates
 *
 * Usage:
 *   racks ask <question>
 *   racks ask --template creative-strategy --topic "collagen supplements"
 *   racks ask --template lead-generation --company "SaaS platforms"
 *   racks ask --template github-single --repo "/path/to/repo"
 *
 * Flags:
 *   --template <id>      Use a template (list: creative-strategy, lead-generation, etc.)
 *   --topic <string>     Topic for research (used with TOPIC variable)
 *   --company <string>   Company name (used with COMPANY variable)
 *   --problem <string>   Problem statement (used with PROBLEM variable)
 *   --repo <path>        Repository path (used with REPO_PATH variable)
 *   --repos <paths>      Multiple repos comma-separated (used with REPO_PATHS variable)
 *   --depth <preset>     Research depth: SQ, QK, NR, EX, MX (default: NR)
 *   --include-related    Include related sections (default: core only)
 *   --time-limit <ms>    Max research time in milliseconds (default: 300000)
 *   --dry-run            Show plan without executing
 *   --json               Output results as JSON
 */

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { program } from 'commander';
import Table from 'cli-table3';

// Template system
import {
  getTemplate,
  listTemplates,
  parseTemplate,
  formatPlanForCLI,
  extractQueries,
  getCoreSections,
  type ResearchPlan,
} from '../../core/templates/index';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AskOptions {
  template?: string;
  topic?: string;
  company?: string;
  problem?: string;
  repo?: string;
  repos?: string;
  depth?: 'SQ' | 'QK' | 'NR' | 'EX' | 'MX';
  includeRelated?: boolean;
  timeLimit?: number;
  dryRun?: boolean;
  json?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────

export function setupAskCommand(cli: typeof program): void {
  cli
    .command('ask [question]')
    .description('Research a question using templates or freeform query')
    .option('--template <id>', 'Use a research template')
    .option('--topic <string>', 'Topic for research')
    .option('--company <string>', 'Company or market')
    .option('--problem <string>', 'Problem to solve')
    .option('--repo <path>', 'Single repository path')
    .option('--repos <paths>', 'Multiple repo paths (comma-separated)')
    .option('--depth <preset>', 'Research depth (SQ/QK/NR/EX/MX)', 'NR')
    .option('--include-related', 'Include related sections in research')
    .option('--time-limit <ms>', 'Max research time (ms)', '300000')
    .option('--dry-run', 'Show plan without executing')
    .option('--json', 'Output as JSON')
    .option('--list-templates', 'Show available templates')
    .action(async (question: string | undefined, options: AskOptions) => {
      try {
        // Show templates list
        if (options.json === false && !options.template) {
          const hasQuestion = question && question.trim();
          if (!hasQuestion) {
            console.log(chalk.cyan('\nAvailable Templates:\n'));
            showTemplatesList();
            console.log('\nUsage: racks ask --template <id> --topic "your topic"');
            console.log('       racks ask <freeform question>\n');
            return;
          }
        }

        // Use template if specified
        if (options.template) {
          await handleTemplateResearch(options);
        } else if (question) {
          // Freeform question (can be implemented later)
          console.log(chalk.yellow('Freeform research not yet implemented'));
          console.log('Use --template flag with template-specific options');
        } else {
          showTemplatesList();
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

// ─────────────────────────────────────────────────────────────
// Template Research Handler
// ─────────────────────────────────────────────────────────────

async function handleTemplateResearch(options: AskOptions): Promise<void> {
  const templateId = options.template;
  if (!templateId) {
    console.error(chalk.red('Error: --template flag is required'));
    process.exit(1);
  }

  // Get template
  const template = getTemplate(templateId);
  if (!template) {
    console.error(chalk.red(`Error: Unknown template "${templateId}"`));
    console.log('Available templates:', listTemplates().map(t => t.id).join(', '));
    process.exit(1);
  }

  // Collect variables from options
  const variables = collectVariables(template.requiredInputs, options);

  // Validate variables
  const missing = template.requiredInputs.filter(v => !variables[v]);
  if (missing.length > 0) {
    console.error(chalk.red(`Error: Missing required inputs: ${missing.join(', ')}`));
    console.error(`\nFor template "${template.name}":`, template.requiredInputs.join(', '));
    process.exit(1);
  }

  // Parse template into research plan
  const { plan, errors } = parseTemplate(template, variables);

  if (errors.length > 0) {
    console.error(chalk.red('Errors parsing template:'));
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Display plan
  console.log(chalk.cyan('\n' + formatPlanForCLI(plan) + '\n'));

  // Show core vs related split
  showPlanAnalysis(plan, options.includeRelated || false);

  // Dry run: show plan and exit
  if (options.dryRun) {
    console.log(chalk.green('Dry run complete. No research executed.\n'));
    return;
  }

  // Execute research (placeholder for actual orchestrator integration)
  console.log(chalk.yellow('\nNote: Full orchestrator integration coming soon'));
  console.log('Next steps:');
  console.log('  1. Integrate with src/core/orchestrator.ts');
  console.log('  2. Pass ResearchPlan to orchestrator');
  console.log('  3. Stream results to CLI\n');
}

// ─────────────────────────────────────────────────────────────
// Variable Collection
// ─────────────────────────────────────────────────────────────

function collectVariables(requiredInputs: string[], options: AskOptions): Record<string, string> {
  const variables: Record<string, string> = {};

  const mapping: Record<string, string | undefined> = {
    TOPIC: options.topic,
    COMPANY: options.company,
    DECISION_MAKER: options.company || 'VP of Engineering', // Default fallback
    PROBLEM: options.problem,
    REPO_PATH: options.repo,
    REPO_PATHS: options.repos,
    COMPARISON_FOCUS: options.topic || options.company,
    CONTEXT: options.company,
  };

  for (const input of requiredInputs) {
    const value = mapping[input];
    if (value) {
      variables[input] = value;
    }
  }

  return variables;
}

// ─────────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────────

function showTemplatesList(): void {
  const templates = listTemplates();

  const table = new Table({
    head: [chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Goal'), chalk.bold('Inputs')],
    style: { head: [], border: ['cyan'] },
    wordWrap: true,
  });

  for (const template of templates) {
    table.push([
      chalk.cyan(template.id),
      template.name,
      template.primaryGoal,
      template.requiredInputs.join(', '),
    ]);
  }

  console.log(table.toString());
}

function showPlanAnalysis(plan: ResearchPlan, includeRelated: boolean): void {
  const coreSections = plan.sections.filter(s => s.scope === 'core');
  const relatedSections = plan.sections.filter(s => s.scope === 'related');

  const { queries } = extractQueries(plan);

  console.log(chalk.bold('Research Composition:'));
  console.log(
    `  Core sections: ${coreSections.length} (${coreSections.reduce((sum, s) => sum + s.queries.length, 0)} queries)`,
  );
  console.log(
    `  Related sections: ${relatedSections.length} (${relatedSections.reduce((sum, s) => sum + s.queries.length, 0)} queries)`,
  );
  console.log(`  Total queries: ${queries.length}`);
  console.log(
    `  Coverage threshold: ${plan.coreThreshold}% (core sections only)${includeRelated ? ' + related sections if time allows' : ''}\n`,
  );
}

// ─────────────────────────────────────────────────────────────
// Export for CLI setup
// ─────────────────────────────────────────────────────────────

export default setupAskCommand;

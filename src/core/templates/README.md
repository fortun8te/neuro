# Research Templates System

A comprehensive system for defining, managing, and executing reusable research workflows in RACKS.

## Quick Start

### List Available Templates

```bash
racks ask
```

### Run a Template

```bash
# Creative Strategy
racks ask --template creative-strategy --topic "collagen supplements"

# Lead Generation
racks ask --template lead-generation --company "B2B SaaS" --decision-maker "CTO"

# General Research
racks ask --template general-research --topic "blockchain"

# GitHub Single Repo
racks ask --template github-single --repo "/Users/mk/repos/myapp"

# GitHub Multi Repos
racks ask --template github-multi --repos "/path/1,/path/2" --comparison-focus "API design"

# Problem Solution
racks ask --template problem-solution --problem "Next.js hydration errors"
```

### Dry Run (Show Plan Without Executing)

```bash
racks ask --template creative-strategy --topic "collagen" --dry-run
```

### Output as JSON

```bash
racks ask --template github-single --repo "/path" --json
```

## The 6 Templates

| Template | Purpose | Duration | Variables |
|----------|---------|----------|-----------|
| **creative-strategy** | Position product creatively, find emotional angles | 90 min | `[TOPIC]` |
| **lead-generation** | Find companies to pitch/partner, understand buyers | 60 min | `[COMPANY]`, `[DECISION_MAKER]` |
| **general-research** | Comprehensive topic overview, fundamentals to trends | 120 min | `[TOPIC]` |
| **github-single** | Deep repository analysis, architecture & quality | 60 min | `[REPO_PATH]` |
| **github-multi** | Compare multiple repos, identify best practices | 90 min | `[REPO_PATHS]`, `[COMPARISON_FOCUS]` |
| **problem-solution** | Multi-source problem solving (video, Q&A, forums) | 60 min | `[PROBLEM]` |

## Architecture

### Core Components

```
src/core/templates/
├── templateRegistry.ts      # Interface definitions (ResearchTemplate, TemplateSection)
├── templateFactory.ts       # Variable substitution & plan generation
├── creativeStrategy.ts      # Template 1
├── leadGeneration.ts        # Template 2
├── generalResearch.ts       # Template 3
├── githubSingle.ts          # Template 4
├── githubMulti.ts           # Template 5
├── problemSolution.ts       # Template 6
├── index.ts                 # Registry & exports
├── example.ts               # Usage examples
├── INTEGRATION_GUIDE.md     # Integration instructions
└── __tests__/
    └── templates.test.ts    # Comprehensive test suite
```

### Type System

Everything is fully typed with no `any`:

```typescript
// Template definition
interface ResearchTemplate {
  id: string;
  name: string;
  description: string;
  primaryGoal: string;
  sections: TemplateSection[];
  judgeStrategy: 'core-focused';
  estimatedDuration: number;
  requiredInputs: string[];
  outputs: string[];
  version: string;
}

// Section definition
interface TemplateSection {
  id: string;
  title: string;
  description: string;
  researchQueries: string[];
  relatedQueries?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  scope: 'core' | 'related';
  outputType?: 'list' | 'comparison' | 'analysis' | 'strategic' | 'technical';
  codeAnalysis?: CodeAnalysisConfig;
}

// Generated research plan
interface ResearchPlan {
  templateId: string;
  templateName: string;
  primaryGoal: string;
  sections: ResearchSection[];
  variables: Record<string, string>;
  coreThreshold: number; // 85% for core-focused
  estimatedDuration: number;
  judgeStrategy: 'core-focused';
}
```

## Variable Substitution

All templates use `[VARIABLE]` syntax:

```
"what is [TOPIC]" → "what is collagen"
"who buys [COMPANY]" → "who buys SaaS platforms"
"solve [PROBLEM]" → "solve hydration errors"
```

### Available Variables

- `[TOPIC]` — Main topic/subject (creative-strategy, general-research, problem-solution)
- `[COMPANY]` — Company/market type (lead-generation)
- `[DECISION_MAKER]` — Role/persona (lead-generation)
- `[PROBLEM]` — Problem statement (problem-solution)
- `[REPO_PATH]` — Single repository path (github-single)
- `[REPO_PATHS]` — Multiple repos comma-separated (github-multi)
- `[COMPARISON_FOCUS]` — What to compare (github-multi)
- `[CONTEXT]` — Additional context (problem-solution)

## Core vs Related Sections

Templates distinguish between **core** and **related** research:

### Core Sections
- **Required** for meaningful research
- Must reach **85% coverage** for termination
- Always executed first
- Example: "Emotional desires" and "Competitor positioning" in creative-strategy

### Related Sections
- **Optional** extensions
- Only researched if `--include-related` or after core is complete
- Add depth and nuance
- Example: "Market trends" in creative-strategy

The Vulnerability Judge uses this to decide when research is "done":
1. Calculate coverage of core sections only
2. If core coverage >= 85%, can terminate
3. Related sections extend coverage if time allows

## Integration with Orchestrator

### 1. Load a Template

```typescript
import { getTemplate, parseTemplate } from './core/templates';

const template = getTemplate('creative-strategy');
const { plan, errors } = parseTemplate(template, {
  TOPIC: 'collagen supplements'
});
```

### 2. Extract Queries

```typescript
import { extractQueries } from './core/templates';

const { queries, sectionIds } = extractQueries(plan);
// queries: ['what is [TOPIC]', ...] with substitution
// sectionIds: ['customer-desires', 'customer-desires', ...]
```

### 3. Pass to Orchestrator

```typescript
import { orchestrateResearchCycle } from './core/orchestrator';

const context: ResearchContext = {
  originalQuestion: plan.primaryGoal,
  section: plan.sections[0].id,
  findings: {},
  ...
};

const decision = await orchestrateResearchCycle(context, subagentPool);
// Judge uses plan.coreThreshold (85%) to decide
```

### 4. Judge Respects Scope

The Vulnerability Judge automatically:
1. Identifies core sections from the plan
2. Calculates coverage percentage from **core sections only**
3. Compares against `plan.coreThreshold` (85%)
4. Stops when core is adequately covered

```typescript
// In vulnerabilityJudge.ts
const coreSections = plan.sections.filter(s => s.scope === 'core');
const coreTopicCoverage = calculateCoverage(findings, coreSections);
const isCoreCovered = coreTopicCoverage >= plan.coreThreshold;
```

## Code Analysis (GitHub Templates)

GitHub templates can define automated code analysis:

```typescript
createSection(
  'architecture',
  'Repository Architecture',
  'High-level structure and organization',
  ['[REPO_PATH] directory structure', ...],
  'core',
  'critical',
  {
    codeAnalysis: {
      path: '[REPO_PATH]',  // or repos: ['[REPO_PATHS]']
      analyze: ['structure', 'complexity', 'patterns'],
      depth: 'deep',
    }
  }
);
```

After parsing with variables, becomes:

```typescript
section.codeAnalysisConfig = {
  paths: ['/Users/mk/repos/myapp'],  // Resolved
  analyze: ['structure', 'complexity', 'patterns'],
  depth: 'deep',
};
```

The orchestrator can then:
1. Clone/analyze repositories
2. Extract code metrics, patterns, structure
3. Return findings for synthesis into research

## Creating Custom Templates

```typescript
import { createTemplate, createSection } from './core/templates';

export const myTemplate = createTemplate(
  'my-template',           // kebab-case ID
  'My Template',           // Display name
  'What it does',          // Description
  'Primary research goal', // Goal
  [
    createSection(
      'section-1',
      'Section Title',
      'What this explores',
      ['query 1', 'query 2', '[VARIABLE] queries'],
      'core',                           // scope
      'critical',                       // priority
      {
        relatedQueries: ['optional query 1'],
        outputType: 'analysis',
        // codeAnalysis: { ... }  // optional
      }
    ),
    // More sections...
  ],
  ['VARIABLE'],            // Required inputs
  ['Output 1', 'Output 2'], // Outputs
  {
    estimatedDuration: 120 * 60 * 1000,
    optionalInputs: ['OPTIONAL_VAR'],
    version: '1.0.0',
  }
);
```

Then add to `index.ts`:

```typescript
import { myTemplate } from './myTemplate';

export const templateRegistry = createTemplateRegistry([
  // ... existing
  myTemplate,
]);
```

Use it:

```bash
racks ask --template my-template --variable "value"
```

## Testing

Comprehensive test suite included:

```bash
npm test -- src/core/templates/__tests__/templates.test.ts
```

Tests cover:
- Template validation
- Variable extraction & substitution
- All 6 concrete templates
- Plan generation
- Core/related section separation
- Query extraction
- Integration scenarios

## Examples

Run all usage examples:

```typescript
import { runAllExamples } from './src/core/templates/example';
runAllExamples();
```

Examples demonstrate:
1. Using each of the 6 templates
2. Variable substitution in practice
3. Plan generation and inspection
4. Judge strategy integration
5. Code analysis configuration
6. Core vs related section handling

## Next Steps

1. **Wire orchestrator** to accept `ResearchPlan`
2. **Implement code analysis** hook for GitHub templates
3. **Add depth parameter** (`--depth SQ/QK/NR/EX/MX`)
4. **Create template editor** UI
5. **Add template versioning** and compatibility
6. **Export/import** templates as YAML

## Files Reference

| File | Purpose |
|------|---------|
| `templateRegistry.ts` | Interfaces, validation, helpers |
| `templateFactory.ts` | Variable substitution, plan generation |
| `index.ts` | Registry instance, exports |
| `creativeStrategy.ts` | Template 1: Creative positioning |
| `leadGeneration.ts` | Template 2: Lead generation |
| `generalResearch.ts` | Template 3: General topic research |
| `githubSingle.ts` | Template 4: Single repo analysis |
| `githubMulti.ts` | Template 5: Multi-repo comparison |
| `problemSolution.ts` | Template 6: Problem solving |
| `example.ts` | Usage examples |
| `INTEGRATION_GUIDE.md` | Detailed integration instructions |
| `__tests__/templates.test.ts` | Test suite (40+ tests) |

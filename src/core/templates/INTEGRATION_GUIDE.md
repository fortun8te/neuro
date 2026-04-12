# Research Templates System — Integration Guide

## Overview

The Research Templates system provides 6 concrete, reusable research workflows for RACKS. Each template defines:
- **Core sections** (required) that must reach 85% coverage
- **Related sections** (optional) researched if time allows
- **Query structures** with variable substitution ([TOPIC], [COMPANY], etc.)
- **Judge strategy** telling the Vulnerability Judge which sections matter
- **Code analysis configs** for GitHub templates

## Architecture

```
src/core/templates/
├── templateRegistry.ts      # Core interfaces (ResearchTemplate, TemplateSection)
├── templateFactory.ts       # Variable substitution & plan generation
├── creativeStrategy.ts      # Template 1: Creative positioning
├── leadGeneration.ts        # Template 2: Lead generation
├── generalResearch.ts       # Template 3: General topic research
├── githubSingle.ts          # Template 4: Single repo analysis
├── githubMulti.ts           # Template 5: Multi-repo comparison
├── problemSolution.ts       # Template 6: Problem solving
└── index.ts                 # Registry & exports
```

## The 6 Templates

### 1. Creative Strategy (`creative-strategy`)
**Purpose:** Position a product/brand creatively in market
**Sections:**
- Core: Customer desires, competitor positioning, creative angles, proof points
- Related: Market trends
**Variables:** `[TOPIC]`
**Duration:** 90 minutes

**Example:**
```bash
racks ask --template creative-strategy --topic "collagen supplements"
```

### 2. Lead Generation (`lead-generation`)
**Purpose:** Find companies to pitch/partner with
**Sections:**
- Core: Direct competitors, adjacent markets, decision-makers, qualification criteria
- Related: Contact strategies, market dynamics
**Variables:** `[COMPANY]`, `[DECISION_MAKER]`
**Duration:** 60 minutes

**Example:**
```bash
racks ask --template lead-generation --company "SaaS platforms" --decision-maker "CTO"
```

### 3. General Research (`general-research`)
**Purpose:** Comprehensive topic overview
**Sections:**
- Core: Fundamentals, current state, applications, challenges
- Related: Related angles, expert opinions
**Variables:** `[TOPIC]`
**Duration:** 120 minutes

**Example:**
```bash
racks ask --template general-research --topic "blockchain"
```

### 4. GitHub Single (`github-single`)
**Purpose:** Deep dive into one repository
**Sections:**
- Core: Architecture, code quality, tech stack, performance
- Related: Security/compliance, documentation
**Variables:** `[REPO_PATH]`
**Features:** Automated code analysis via `codeAnalysisConfig`
**Duration:** 60 minutes

**Example:**
```bash
racks ask --template github-single --repo "/Users/mk/repos/myapp"
```

### 5. GitHub Multi (`github-multi`)
**Purpose:** Compare multiple repositories
**Sections:**
- Core: Architecture comparison, quality comparison, tech choices, best practices
- Related: Performance comparison, feature completeness
**Variables:** `[REPO_PATHS]`, `[COMPARISON_FOCUS]`
**Features:** Multi-repo code analysis
**Duration:** 90 minutes

**Example:**
```bash
racks ask --template github-multi --repos "/path/1,/path/2" --comparison-focus "API design"
```

### 6. Problem Solution (`problem-solution`)
**Purpose:** Multi-source problem solving
**Sections:**
- Core: Video solutions, community advice, technical Q&A, best practices
- Related: Root cause analysis, alternative solutions
**Variables:** `[PROBLEM]`
**Duration:** 60 minutes

**Example:**
```bash
racks ask --template problem-solution --problem "Next.js hydration errors"
```

## Integration with Orchestrator

### 1. Create ResearchPlan from Template

```typescript
import { parseTemplate, getTemplate } from './core/templates';

const template = getTemplate('creative-strategy');
const { plan, errors } = parseTemplate(template, {
  TOPIC: 'collagen supplements'
});

// plan: ResearchPlan
// - plan.sections: ResearchSection[]
// - plan.coreThreshold: 85
// - plan.judgeStrategy: 'core-focused'
```

### 2. Pass Plan to Orchestrator

```typescript
import { orchestrateResearchCycle } from './core/orchestrator';
import { SubagentPool } from './utils/subagentManager';

const pool = new SubagentPool();

const context: ResearchContext = {
  originalQuestion: plan.primaryGoal,
  sessionId: uuid(),
  findings: {},
  section: plan.sections[0].id,
  timeLimit: 300000,
  iterationLimit: 30,
  startTime: Date.now(),
};

// Execute cycles
for (let i = 0; i < plan.sections.length; i++) {
  const section = plan.sections[i];
  context.section = section.id;
  
  // Research this section's queries
  const findings = await researchSection(section);
  context.findings = findings;
  
  // Judge progress
  const decision = await orchestrateResearchCycle(context, pool);
  
  if (!decision.continueResearch) {
    break;
  }
}
```

### 3. Judge Respects Scope

The Vulnerability Judge receives:
- `coreTopicCoverage`: % of **core sections** covered
- `isCoreCovered`: boolean (core coverage >= threshold)
- Stops when core is 85% covered (regardless of related sections)

```typescript
// In vulnerabilityJudge.ts
const coreSections = plan.sections.filter(s => s.scope === 'core');
const coreTopicCoverage = calculateCoverage(findings, coreSections);
const isCoreCovered = coreTopicCoverage >= 85;
```

## CLI Integration

The `ask` command is set up to:

1. **List templates** (no args)
   ```bash
   racks ask
   ```

2. **Show template help**
   ```bash
   racks ask --template creative-strategy
   ```

3. **Execute template research**
   ```bash
   racks ask --template creative-strategy --topic "collagen"
   ```

4. **Dry run** (show plan, no execution)
   ```bash
   racks ask --template creative-strategy --topic "collagen" --dry-run
   ```

5. **Output as JSON**
   ```bash
   racks ask --template github-single --repo "/path" --json
   ```

## Variable Substitution

All templates use `[VARIABLE]` syntax. The factory automatically substitutes:

```typescript
// Input
const template = getTemplate('creative-strategy');
const { plan } = parseTemplate(template, { TOPIC: 'collagen' });

// "what is [TOPIC]" becomes "what is collagen"
// "[TOPIC] benefits" becomes "collagen benefits"
```

### Variable Mapping

- `TOPIC` → `--topic` flag
- `COMPANY` → `--company` flag
- `PROBLEM` → `--problem` flag
- `REPO_PATH` → `--repo` flag (single)
- `REPO_PATHS` → `--repos` flag (comma-separated)
- `COMPARISON_FOCUS` → derived from `--topic` or `--company`

## Adding a New Template

1. **Create template file** (e.g., `marketResearch.ts`)
   ```typescript
   import { createTemplate, createSection } from './templateRegistry';
   
   export const marketResearchTemplate = createTemplate(
     'market-research',
     'Market Research',
     'Research a market segment',
     'Understand market dynamics and opportunities',
     [
       createSection(
         'market-size',
         'Market Size',
         'Total addressable market',
         ['what is the size of [MARKET]', ...],
         'core',
         'critical'
       ),
       // More sections...
     ],
     ['MARKET'],
     ['Market overview', 'Growth projections'],
     { estimatedDuration: 90 * 60 * 1000 }
   );
   ```

2. **Add to registry** (in `index.ts`)
   ```typescript
   import { marketResearchTemplate } from './marketResearch';
   
   export const templateRegistry = createTemplateRegistry([
     // ... existing templates
     marketResearchTemplate,
   ]);
   ```

3. **Use it**
   ```bash
   racks ask --template market-research --market "SaaS"
   ```

## Code Analysis Configuration

GitHub templates can define code analysis:

```typescript
createSection(
  'architecture',
  'Architecture',
  'Code structure',
  ['queries...'],
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

When parsed, this becomes:
```typescript
// After parseTemplate()
section.codeAnalysisConfig = {
  paths: ['/Users/mk/repos/myapp'],  // Resolved
  analyze: ['structure', 'complexity', 'patterns'],
  depth: 'deep',
};
```

The Wayfarer integration can then:
1. Clone/analyze the repository
2. Extract structure, code metrics, patterns
3. Return findings for synthesis

## Type Safety

Everything is fully typed:

```typescript
import {
  ResearchTemplate,
  TemplateSection,
  ResearchPlan,
  ResearchSection,
  CodeAnalysisConfig,
} from './core/templates';

const template: ResearchTemplate = {
  id: 'my-template',
  name: 'My Template',
  // ... required fields
};
```

## Testing

```typescript
import { validateTemplate, parseTemplate, getTemplate } from './core/templates';

// Validate a template
const errors = validateTemplate(creativeStrategyTemplate);
expect(errors).toHaveLength(0);

// Parse with variables
const { plan, errors } = parseTemplate(creativeStrategyTemplate, {
  TOPIC: 'collagen'
});
expect(plan.sections).toHaveLength(5);
expect(errors).toHaveLength(0);

// Extract core sections
const coreSections = getCoreSections(plan);
expect(coreSections.length).toBeGreaterThan(0);
```

## Next Steps

1. **Wire orchestrator** to accept `ResearchPlan` instead of inline sections
2. **Test template parsing** with all 6 templates
3. **Implement code analysis** hook for GitHub templates
4. **Add `--depth` parameter** to control iterations/parallelism per template
5. **Create template editor UI** for custom template creation
6. **Add template versioning** and compatibility checking

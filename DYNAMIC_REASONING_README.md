# Dynamic Research Reasoning + Site Visual Analysis

## Overview

RACKS v2 now includes two new core capabilities:

1. **Dynamic Research Reasoner** — Instead of following presets, the system _thinks_ about what to research next based on actual gaps identified
2. **Site Visual Analyzer** — Takes full-page screenshots and analyzes visual design, colors, typography, layout with Gemma 4 vision model

## Features

### 1. Dynamic Research Reasoner (`src/core/dynamicReasoner.ts`)

**Problem Solved:** Old system followed rigid presets. New system reasons: "Based on what I've found, I need to research X because Y"

**How It Works:**
1. Analyzes current findings quality and completeness
2. Identifies specific gaps (not generic ones)
3. Reasons about WHAT to research next and WHY
4. Generates dynamic search queries prioritized by importance
5. Continues until confidence target reached or time limit hit

**Key Types:**
```typescript
interface ResearchGap {
  aspect: string;           // "Supply chain strategy"
  importance: 'critical' | 'high' | 'medium';
  whyMissing: string;       // "We don't understand pricing power"
  impactIfMissing: string;  // "Cannot assess margin structure"
  suggestedQueries: string[];
  estimatedDuration: string;
}

interface DynamicResearchPlan {
  currentCoverage: number;  // 0-100%
  gaps: ResearchGap[];
  recommendations: ResearchRecommendation[];
  summary: string;
}
```

**API:**
```typescript
import { reasonAboutNextResearch, generateNextQueries } from './core/dynamicReasoner';

const plan = await reasonAboutNextResearch(
  findings,           // Current analysis results
  originalQuestion,   // "How to peel an apple?"
  context,            // "Cooking tutorial research"
  pool                // SubagentPool
);

// Get top 5 queries based on reasoning
const nextQueries = generateNextQueries(plan.recommendations, 5);
// → ["Peeling techniques for different apple varieties", "Tools for apple peeling", ...]
```

### 2. Site Visual Analyzer (`src/services/siteVisualAnalyzer.ts`)

**Problem Solved:** Old system only scraped text. New system analyzes actual visual design via screenshots + Gemma vision model

**Capabilities:**
- Full-page website screenshots (via Wayfarer)
- Color palette extraction (primary, secondary, accent, background)
- Typography analysis (fonts, hierarchy, readability)
- Layout structure analysis (hero, sections, navigation, CTAs)
- Visual tone detection (premium, playful, corporate, minimalist, etc.)
- UX patterns (buttons, forms, micro-interactions)
- Accessibility assessment (contrast, spacing, readability)
- Competitive positioning (compare 3-5 competitor sites)

**Key Types:**
```typescript
interface SiteVisualAnalysis {
  url: string;
  screenshotUrl?: string;

  // Visual breakdown
  colors: SiteColorPalette;        // Primary, secondary, accent colors
  typography: TypographyAnalysis;  // Fonts, hierarchy, readability
  layout: LayoutStructure;         // Sections, navigation, CTAs
  uxPatterns: UXPatterns;          // Buttons, forms, interactions
  accessibility: AccessibilityAssessment;

  // Holistic assessments
  visualTone: {
    primary: string;              // "Premium"
    secondaryTraits: string[];     // ["Modern", "Minimalist"]
    brandPersonality: string;
  };

  overallQuality: {
    designScore: number;           // 0-100
    modernness: number;            // 0-100
    consistency: number;           // 0-100
    brandCohesion: number;         // 0-100
    issues: string[];
    strengths: string[];
  };

  // Competitive analysis
  positioning?: {
    comparedTo: string[];
    strengths: string[];
    weaknesses: string[];
    differentiation: string;
  };

  insights: string[];
  recommendations: string[];
}
```

**API:**
```typescript
import { analyzeSiteVisuals } from './services/siteVisualAnalyzer';

// Analyze single site
const analysis = await analyzeSiteVisuals('https://basedbodyworks.com');

// Analyze with competitor comparison
const analysis = await analyzeSiteVisuals('https://basedbodyworks.com', {
  compareWith: [
    'https://prose.com',
    'https://functionofbeauty.com'
  ],
  focus: 'colors', // or 'typography', 'layout', 'all'
  includeScreenshot: false // Don't store base64 to save space
});

// Extract color palette for brand guidelines
const colors = extractColorPalette(analysis);
// → ["#C4927E", "#A8D5BA", "#F4E4C1", ...]

// Get design recommendations
const recs = generateVisualRecommendations(analysis);
// → ["Improve contrast for accessibility", "Optimize mobile layout", ...]
```

### 3. Smart Analysis Orchestrator (`src/core/analyzers/smartAnalysisOrchestrator.ts`)

**Combines dynamic reasoning + site visuals + all analyzers**

Executes smart analysis that:
1. Runs all analyzers in parallel (product, image, social, audience, revenue, competitor)
2. Takes site screenshots and analyzes visuals with Gemma
3. Uses dynamic reasoning to identify gaps
4. Iterates research until confidence target reached
5. Returns comprehensive analysis with reasoning process visible

**API:**
```typescript
import { executeSmartAnalysis } from './core/analyzers/smartAnalysisOrchestrator';

const result = await executeSmartAnalysis(
  {
    brandName: 'BasedbodyWorks',
    question: 'What makes this brand unique?',
    context: 'Creative positioning research',
    brandWebsite: 'https://basedbodyworks.com',
    competitorWebsites: [
      'https://prose.com',
      'https://functionofbeauty.com'
    ],
    timeLimit: 30 * 60 * 1000,      // 30 minutes
    iterationLimit: 5,               // Max 5 reasoning iterations
    confidenceTarget: 85             // Stop at 85% confidence
  },
  pool,
  (progress) => {
    console.log(`[${progress.completion}%] ${progress.step}`);
    if (progress.dynamicPlan) {
      console.log(`  Gaps found: ${progress.dynamicPlan.gaps.length}`);
    }
  }
);

// Result includes:
result.productAnalysis;      // Products, pricing, portfolio
result.imageAnalysis;        // 50+ images analyzed
result.siteVisuals;          // Full-page screenshot analysis
result.competitorVisuals;    // Competitor site analysis
result.socialAnalysis;       // 9 platforms analyzed
result.audienceAnalysis;     // Demographics, psychographics
result.revenueAnalysis;      // Revenue estimate + confidence
result.competitorAnalysis;   // Competitor niche analysis

// Research reasoning visible
result.researchPlans;        // Dynamic plans from each iteration
result.researchIterations;   // What was researched each iteration

// Summary
result.keyFindings;          // Top insights
result.nextSteps;            // Recommended follow-ups
result.confidence;           // 0-100, when to stop
```

## Key Differences from Presets

### Old System (Preset-Based):
```
"Marketing Strategy" template
├── Research customer desires (preset queries)
├── Research competitors (preset queries)
├── Research audience (preset queries)
└── Done (follows template rigidly)
```

### New System (Dynamic Reasoning):
```
Start with all analyzers in parallel
├── Run product, image, visual, social, audience, revenue analysis
├── Reason: "We have images but no supply chain insights"
├── Identify gap: "Missing inventory/fulfillment strategy info"
├── Generate query: "How does supply chain affect pricing power?"
├── Execute research
├── Confidence now 65%
├── Reason again: "We're missing competitive pricing strategy"
├── Generate query: "Price comparison with competitors"
├── Execute research
├── Confidence now 85%
└── Done (targets reached, not template reached)
```

## Implementation Details

### Dynamic Reasoning Process

1. **Gap Identification Subagent** — Uses `reasoner` role to identify specific gaps
   - Input: Current findings, original question
   - Output: List of gaps with importance + suggested queries
   - Stays focused on original question (doesn't suggest tangents)

2. **Priority Calculation**
   - Critical gaps = priority 10
   - High gaps = priority 7
   - Medium gaps = priority 4
   - Adjusted by order (earlier gaps ranked higher)

3. **Coverage Calculation** (0-100%)
   - Images (0-20 points): <5 = 10 points, >5 = 20 points
   - Products (0-20 points)
   - Audience analysis (0-20 points): yes/no
   - Social presence (0-20 points)
   - Revenue estimate (0-20 points)
   - Competitors (0-20 points)

### Visual Analysis with Gemma 4

Vision model receives:
1. Full-page screenshot (JPEG, quality 60-70)
2. Detailed analysis prompt requesting JSON output
3. Returns structured analysis of:
   - Colors (hex, RGB, usage context)
   - Typography (fonts, sizes, hierarchy)
   - Layout (sections, structure, CTAs)
   - UX patterns (buttons, forms, interactions)
   - Accessibility metrics
   - Overall quality score (0-100)

## Usage Examples

### Example 1: Full Smart Analysis
```typescript
// See src/examples/smartAnalysisExample.ts
import { exampleBasedbodyworksSmartAnalysis } from './examples/smartAnalysisExample';

await exampleBasedbodyworksSmartAnalysis();
// Output: Complete analysis with reasoning process visible
```

### Example 2: Just Visual Analysis
```typescript
import { analyzeSiteVisuals } from './services/siteVisualAnalyzer';

const visuals = await analyzeSiteVisuals('https://site.com', {
  compareWith: ['https://competitor1.com', 'https://competitor2.com']
});

console.log(`Design Score: ${visuals.overallQuality.designScore}`);
console.log(`Color Palette: ${visuals.colors.primary.hex}`);
console.log(`Tone: ${visuals.visualTone.primary}`);
```

### Example 3: Just Dynamic Reasoning
```typescript
import { reasonAboutNextResearch, generateNextQueries } from './core/dynamicReasoner';

const plan = await reasonAboutNextResearch(
  findings,
  "How to market sustainable fashion?",
  "Brand strategy research",
  pool
);

console.log(`Coverage: ${plan.currentCoverage}%`);
console.log(`Gaps: ${plan.gaps.length}`);
plan.gaps.forEach(gap => {
  console.log(`  • ${gap.aspect}: ${gap.whyMissing}`);
});

const nextQueries = generateNextQueries(plan.recommendations, 5);
console.log(`Next to research: ${nextQueries.join(', ')}`);
```

## Subagent Roles

### `reasoner`
- **Task:** Identify gaps in research findings
- **Input:** Current findings, original question
- **Output:** JSON with gaps[], importance[], suggestedQueries[]
- **Model:** qwen3.5:4b
- **Max Steps:** 4

## Integration Points

### With Orchestrator
```typescript
// New decision logic based on dynamic reasoning
if (confidence < confidenceTarget && time < timeLimit) {
  const plan = await reasonAboutNextResearch(...);
  const nextQueries = generateNextQueries(plan.recommendations);
  // Execute research with next queries
  // Loop until confidence or time limit
}
```

### With CLI
```bash
# New flag for smart analysis
racks analyze --brand "BasedbodyWorks" --question "..." --confidence 85

# Or use existing ask command with auto-detection
racks ask --brand "BasedbodyWorks" --smart
```

## Performance Notes

- **Dynamic Reasoning:** 2-4 seconds per iteration (LLM reasoning)
- **Site Visual Analysis:** 5-10 seconds per site (screenshot + vision model)
- **Parallel Execution:** All 7 analyzers run simultaneously (~30-45 seconds total)
- **Typical Flow:** Initial analysis (30-45s) → Reasoning (2-4s) → Web research (varies) → Loop

## Files Changed

**NEW:**
- `src/core/dynamicReasoner.ts` — Dynamic reasoning engine
- `src/services/siteVisualAnalyzer.ts` — Full-page screenshot analysis
- `src/core/analyzers/smartAnalysisOrchestrator.ts` — Orchestrates smart analysis
- `src/examples/smartAnalysisExample.ts` — Usage examples

**MODIFIED:**
- `src/core/orchestrator.ts` — Can now use dynamic reasoning instead of presets
- `src/services/index.ts` — Export new services

## Next Steps

1. ✅ Dynamic reasoning implemented
2. ✅ Site visual analysis implemented
3. ✅ Smart orchestrator combining both
4. ⏳ Wire into CLI (new `racks analyze` command)
5. ⏳ Real-time dashboard showing reasoning process
6. ⏳ Confidence scoring refinement based on data completeness

## Testing

Run examples:
```bash
npx ts-node src/examples/smartAnalysisExample.ts
```

This will:
1. Analyze BasedbodyWorks with full smart analysis
2. Show dynamic reasoning at each iteration
3. Display visual analysis results
4. Output comprehensive brand positioning analysis

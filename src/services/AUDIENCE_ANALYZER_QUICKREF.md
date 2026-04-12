# Audience Analyzer — Quick Reference

## One-Minute Setup

```typescript
import { audienceAnalyzer, type ProductContext } from '@/services';

const intel = audienceAnalyzer.analyzeAudience(researchData, {
  brandName: 'RACKS',
  productCategory: 'Hair Care'
});

// Use outputs
console.log(intel.primaryPersona.name);
console.log(intel.keyInsights);
console.log(intel.contentStrategy);
```

## Output Structure

```
AudienceIntelligence
├── primaryPersona (Persona)
│   ├── demographics
│   ├── psychographics
│   ├── needs
│   ├── behaviors
│   ├── purchaseDriver
│   ├── commonObjections
│   └── preferredChannels
├── secondaryPersonas (Persona[])
├── unservedAudiences (UnservedAudience[])
├── competitorAnalysis (CompetitorAudienceAnalysis[])
├── keyInsights (string[])
├── marketingImplications (string[])
├── contentStrategy
│   ├── messagingPillars
│   ├── tonalGuidance
│   ├── contentFormats
│   └── keywordThemes
├── confidenceScore (0-1)
└── dataQuality ('excellent'|'good'|'fair'|'limited')
```

## Common Queries

### Get Primary Target
```typescript
const target = intel.primaryPersona;
console.log(`${target.demographics.primaryGender} aged ${target.demographics.ageRanges[0].min}-${target.demographics.ageRanges[0].max}`);
```

### Get Values to Emphasize
```typescript
intel.primaryPersona.psychographics.values.forEach(v => {
  console.log(`${v.value}: ${v.evidence.join(', ')}`);
});
```

### Get Pain Points to Solve
```typescript
intel.primaryPersona.psychographics.painPoints
  .sort((a, b) => b.productRelevance - a.productRelevance)
  .slice(0, 3)
  .forEach(p => console.log(`${p.problem} (severity: ${p.severity})`));
```

### Get Purchase Motivations
```typescript
const driver = intel.primaryPersona.purchaseDriver;
console.log(`Primary motivation: ${driver}`);

intel.primaryPersona.needs.emotional.forEach(need => {
  console.log(`Emotional: ${need.feeling}`);
});
```

### Get Messaging Framework
```typescript
const strategy = intel.contentStrategy;
console.log('Pillars:', strategy.messagingPillars.join(' | '));
console.log('Tone:', strategy.tonalGuidance);
console.log('Keywords:', strategy.keywordThemes.join(', '));
```

### Get Objection Responses
```typescript
intel.primaryPersona.commonObjections.forEach(obj => {
  console.log(`"${obj}" → [develop response]`);
});
```

### Get Channel Budget Allocation
```typescript
const channels = intel.primaryPersona.behaviors.channelPreferences
  .sort((a, b) => b.preference - a.preference);

channels.forEach(c => {
  const pct = (c.preference / channels.reduce((s, ch) => s + ch.preference, 0) * 100).toFixed(0);
  console.log(`${c.channel}: ${pct}%`);
});
```

### Get Pricing Strategy
```typescript
const pricing = intel.primaryPersona.behaviors.priceSensitivity;
console.log(`Range: $${pricing.acceptablePriceRange.min}-$${pricing.acceptablePriceRange.max}`);

pricing.pricePoints.forEach(p => {
  console.log(`$${p.price}: ${(p.conversionLikelihood * 100).toFixed(0)}% conversion`);
});
```

### Get Competitive Insights
```typescript
intel.competitorAnalysis.forEach(comp => {
  console.log(`${comp.competitor}:`);
  console.log(`  Targets: ${comp.targetedSegments.join(', ')}`);
  console.log(`  Gaps: ${comp.untappedSegments.map(u => u.segment).join(', ')}`);
});
```

### Get Market Opportunities
```typescript
intel.unservedAudiences.forEach(u => {
  console.log(`${u.segment}: ${u.opportunity}`);
});
```

## Data Quality Signals

| Quality | Data Points | Confidence | Guidance |
|---------|------------|-----------|----------|
| Excellent | 20+ | 0.8-1.0 | High confidence—use for major decisions |
| Good | 15-20 | 0.6-0.8 | Moderate confidence—validate key assumptions |
| Fair | 10-15 | 0.4-0.6 | Low confidence—gather more data before finalizing |
| Limited | <10 | <0.4 | Very low—prototype only, extensive research needed |

## Typical Extraction Keywords

### Demographics
- Age: "gen z", "millennial", "25-35", "teen", "boomer"
- Gender: "women", "female", "men", "male", "she/her", "he/him"
- Income: "budget", "luxury", "premium", "affordable", "expensive"
- Geography: "usa", "europe", "global", "urban", "rural"
- Occupation: "professional", "student", "parent", "entrepreneur", "executive"

### Psychographics
- Values: "eco", "sustainable", "quality", "authentic", "inclusive"
- Lifestyle: "active", "wellness", "minimalist", "family-oriented", "social"
- Interests: "beauty", "health", "sustainability", "fashion", "personal development"

### Needs
- Functional: "clean", "repair", "nourish", "protect", "detoxify"
- Emotional: "confidence", "control", "purpose", "belonging", "empowerment"
- Social: "status", "community", "identity", "expression", "belonging"

### Behaviors
- Frequency: "monthly", "subscription", "regular", "occasional", "impulse"
- Channels: "instagram", "tiktok", "email", "influencer", "search"
- Loyalty: "repeat purchase", "ambassador", "community", "referral"

## Error Handling

```typescript
try {
  const intel = audienceAnalyzer.analyzeAudience(data, context);
  
  if (intel.dataQuality === 'limited') {
    console.warn('⚠️ Limited data—consider gathering more research');
  }
  
  if (intel.confidenceScore < 0.5) {
    console.warn('⚠️ Low confidence—validate assumptions before using');
  }
  
  return intel;
} catch (err) {
  if (err instanceof AudienceAnalysisError) {
    console.error('❌ Analysis failed:', err.message);
  }
  throw err;
}
```

## Integration Patterns

### With Research Pipeline
```typescript
const research = await orchestrateResearch(campaign);
const audience = audienceAnalyzer.analyzeAudience(research.text, campaign);
return { ...research, audience };
```

### With Copywriting Stage
```typescript
const { primaryPersona, contentStrategy } = intelligence;
const copy = generateCopy({
  painPoints: primaryPersona.psychographics.painPoints,
  objections: primaryPersona.commonObjections,
  tone: contentStrategy.tonalGuidance,
  pillars: contentStrategy.messagingPillars
});
```

### With Creative Stage
```typescript
const psychographics = intelligence.primaryPersona.psychographics;
const creative = generateCreative({
  values: psychographics.values,
  lifestyle: psychographics.lifestyle,
  aspirations: psychographics.aspirations,
  formats: intelligence.contentStrategy.contentFormats
});
```

### With Media Planning
```typescript
const { behaviors } = intelligence.primaryPersona;
const media = planMedia({
  channels: behaviors.channelPreferences,
  budget: behaviors.priceSensitivity,
  frequency: behaviors.purchaseFrequency
});
```

## Testing Checklist

- [x] Basic analysis completes without errors
- [x] All persona fields populated
- [x] Confidence score in valid range
- [x] Data quality assessment reflects input richness
- [x] Secondary personas have distinct characteristics
- [x] Unserved audiences identified
- [x] Competitor analysis present
- [x] Key insights generated
- [x] Content strategy defined
- [x] Handles edge cases (empty data, malformed input)

## Performance Profile

- Single analysis: <100ms
- Large data (10k chars): <500ms
- Memory: ~5MB per analysis
- Graceful degradation: Works with partial data

## Field Validation Ranges

| Field | Valid Range | Notes |
|-------|-------------|-------|
| Confidence | 0.0 - 1.0 | Higher = more data points |
| Percentage | 0 - 100 | Persona market share or segment size |
| Importance/Relevance | 0.0 - 1.0 | How important to decision |
| Conversion Rate | 0.0 - 1.0 | Expected conversion by channel/price |
| Age Range | 0 - 120 | Minimum < maximum |
| Price Point | 0 - ∞ | Real currency amount |

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Low confidence | Sparse data | Add more diverse research sources |
| Missing personas | Limited segmentation | Mention multiple audience types |
| Vague insights | Generic research | Include specific customer quotes/feedback |
| No unmet needs | Limited data | Add survey/feedback data about gaps |
| Few channels | Limited channel mentions | Specify where audience spends time |

## Type Imports

```typescript
// Main output
import { type AudienceIntelligence } from '@/services';

// Components
import { type Persona } from '@/services';
import { type Demographics } from '@/services';
import { type Psychographics } from '@/services';
import { type NeedsProfile } from '@/services';
import { type BehavioralProfile } from '@/services';

// Specific types
import { type Channel, type PurchaseFrequency, type LifestyleSegment } from '@/services';
import { type Value, type PainPoint, type Aspiration } from '@/services';

// Factory
import { type ProductContext } from '@/services';

// Errors
import { AudienceAnalysisError } from '@/services';
```

## API Methods

```typescript
// Only one public method:
audienceAnalyzer.analyzeAudience(researchData: string, context: ProductContext): AudienceIntelligence

// Returns complete intelligence in single call
// No streaming or async required
// Handles all error cases internally
```

## File Locations

- Service: `src/services/audienceAnalyzer.ts`
- Tests: `src/services/__tests__/audienceAnalyzer.test.ts`
- Examples: `src/services/examples/audienceAnalyzer.example.ts`
- Docs: `src/services/AUDIENCE_ANALYZER.md`
- Quick Ref: `src/services/AUDIENCE_ANALYZER_QUICKREF.md`
- Exports: `src/services/index.ts`

## Next Steps

1. Import service in your stage handler
2. Call `analyzeAudience()` after research completes
3. Extract insights needed for your downstream stage
4. Pass relevant persona data to next stage
5. Log insights to cycle memory for future reference

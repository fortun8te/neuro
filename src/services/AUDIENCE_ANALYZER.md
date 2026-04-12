# Audience Analyzer Service

A comprehensive audience intelligence service for the RACKS/NEURO Ad Agent. Extracts, analyzes, and synthesizes customer profiles from research data.

## Overview

The Audience Analyzer transforms raw research data into actionable audience intelligence by extracting six dimensions of customer understanding:

1. **Demographics** — Age, gender, income, geography, occupation
2. **Psychographics** — Values, interests, pain points, aspirations, lifestyle
3. **Needs Analysis** — Functional, emotional, social, and unmet needs
4. **Behavioral Patterns** — Purchase frequency, loyalty, price sensitivity, channels, decision factors
5. **Segmentation** — Primary and secondary personas, unserved audiences
6. **Competitive Context** — Competitor audience overlap and differentiation opportunities

## Installation

```typescript
import { audienceAnalyzer, type AudienceIntelligence, type ProductContext } from '@/services';
```

## Basic Usage

```typescript
const intelligence = audienceAnalyzer.analyzeAudience(researchData, {
  brandName: 'RACKS',
  productCategory: 'Hair Care',
  productName: 'Hair Serum',
  targetMarket: 'Health-conscious women'
});

console.log(intelligence.primaryPersona.name);
console.log(intelligence.keyInsights);
console.log(intelligence.contentStrategy);
```

## API Reference

### `analyzeAudience(researchData: string, productContext: ProductContext): AudienceIntelligence`

Main analysis method. Transforms research text into comprehensive audience intelligence.

**Parameters:**
- `researchData` (string): Raw research data, reviews, social media analysis, surveys, etc.
- `productContext` (ProductContext): Brand and product information

**Returns:** Complete audience intelligence with personas, insights, and strategy

**Error Handling:**
- Throws `AudienceAnalysisError` on critical failures
- Gracefully degrades with partial or missing data
- Returns `dataQuality: 'limited'` for sparse input

### Data Structures

#### ProductContext
```typescript
interface ProductContext {
  brandName: string;
  productCategory: string;
  productName?: string;
  targetMarket?: string;
}
```

#### AudienceIntelligence (Main Output)
```typescript
interface AudienceIntelligence {
  brand: string;
  analysisDate: string;
  primaryPersona: Persona;
  secondaryPersonas: Persona[];
  unservedAudiences: UnservedAudience[];
  competitorAnalysis: CompetitorAudienceAnalysis[];
  keyInsights: string[];
  marketingImplications: string[];
  contentStrategy: ContentStrategy;
  confidenceScore: number;  // 0-1
  dataQuality: 'excellent' | 'good' | 'fair' | 'limited';
}
```

#### Persona (Customer Profile)
```typescript
interface Persona {
  id: string;
  name: string;
  description: string;
  demographics: Demographics;
  psychographics: Psychographics;
  needs: NeedsProfile;
  behaviors: BehavioralProfile;
  estimatedPercentage: number;
  purchaseDriver: string;
  commonObjections: string[];
  preferredChannels: Channel[];
}
```

#### Demographics
```typescript
interface Demographics {
  ageRanges: AgeRange[];
  primaryGender: 'male' | 'female' | 'non-binary' | 'all';
  secondaryGender?: 'male' | 'female' | 'non-binary';
  incomeLevel: 'budget' | 'mass-market' | 'premium' | 'luxury' | 'mixed';
  geographies: Geography[];
  occupations: string[];
  lifestyleClues: string[];
}
```

#### Psychographics
```typescript
interface Psychographics {
  values: Value[];        // Core beliefs and principles
  interests: Interest[];  // Hobbies, topics, preferences
  painPoints: PainPoint[]; // Problems they face
  aspirations: Aspiration[]; // Goals and dreams
  lifestyle: LifestyleSegment; // Overall lifestyle classification
}
```

#### NeedsProfile
```typescript
interface NeedsProfile {
  functional: FunctionalNeed[]; // Problem-solving needs
  emotional: EmotionalNeed[];   // Feeling and self-expression
  social: SocialNeed[];         // Community and identity
  unmet: UnmetNeed[];           // Gaps in market
}
```

#### BehavioralProfile
```typescript
interface BehavioralProfile {
  purchaseFrequency: 'one-time' | 'occasional' | 'regular' | 'subscription' | 'impulse';
  loyaltyIndicators: LoyaltyIndicator[];
  priceSensitivity: PriceSensitivity;
  channelPreferences: ChannelPreference[];
  decisionFactors: DecisionFactor[];
  brandSwitchTriggers: string[];
}
```

#### ContentStrategy
```typescript
interface ContentStrategy {
  messagingPillars: string[];      // Core message themes
  tonalGuidance: string;           // Voice and tone recommendation
  contentFormats: ContentFormat[]; // Which formats work best
  keywordThemes: string[];         // SEO and copywriting themes
}
```

## Features

### 1. Demographics Extraction
- **Age Range Detection**: Identifies primary and secondary age groups with confidence scores
- **Gender Analysis**: Determines primary and secondary target gender with nuance
- **Income Classification**: Budget, mass-market, premium, or luxury positioning
- **Geographic Mapping**: Identifies regional and urban/rural distribution
- **Occupation Inference**: Extracts professional and lifestyle indicators

### 2. Psychographics Deep Dive
- **Value Extraction**: Identifies core customer values with evidence from text
- **Interest Mapping**: Categorizes interests with relevance scoring
- **Pain Point Analysis**: Severity classification and product relevance scoring
- **Aspiration Identification**: Time-framed goals with emotional drivers
- **Lifestyle Classification**: 10 lifestyle segments (wellness-conscious, sustainability-focused, etc.)

### 3. Needs Analysis
- **Functional Needs**: Must-have, should-have, nice-to-have criticality levels
- **Emotional Needs**: Confidence, control, purpose, belonging
- **Social Needs**: Identity, community, status, expression
- **Unmet Needs**: Market gaps with opportunity assessment

### 4. Behavioral Intelligence
- **Purchase Patterns**: From one-time to subscription models
- **Loyalty Signals**: Reviews, social, referral, community engagement
- **Price Sensitivity**: Precise pricing psychology and acceptable ranges
- **Channel Mapping**: Effectiveness and preference ranking for 8 channels
- **Decision Factors**: Ranked importance of purchase influencers
- **Switch Triggers**: Why they'd leave for competitors

### 5. Multi-Persona Segmentation
- **Primary Persona**: 45% estimated market share, main target
- **Secondary Personas**: Alternative segments (25-20% each)
- **Unserved Audiences**: Market opportunities not currently addressed
- **Persona Hierarchy**: Ranked by estimated size and convertibility

### 6. Competitive Context
- **Competitor Audience Analysis**: Who competitors serve and why
- **Loyalty vs. Switching**: Why customers switch brands
- **Untapped Segments**: Audience gaps in competitor offerings
- **Differentiation Strategy**: How to stand out

## Extraction Methodology

### Data Quality Assessment
The service evaluates input richness:
- **Excellent**: 20+ data points extracted
- **Good**: 15-20 data points
- **Fair**: 10-15 data points
- **Limited**: <10 data points

### Confidence Scoring
- Each extracted element has a confidence score (0-1)
- Overall confidenceScore reflects data completeness and consistency
- Higher confidence enables more assertive marketing strategies

### Keyword-Based Extraction
The analyzer uses semantic keywords to identify:
- Demographics via age/gender/income/occupation patterns
- Psychographics via value, interest, and lifestyle keywords
- Needs via functional, emotional, and social markers
- Behaviors via channel, frequency, and loyalty signals

## Usage Examples

### Basic Analysis
```typescript
const research = `
  Target: Women 25-45, professionals, health-conscious.
  Income: Premium segment, $60k+.
  Pain points: Damaged hair, scalp issues, environmental concerns.
  Purchase: Monthly subscription, high loyalty.
  Channels: Instagram, TikTok, email.
  Values: Sustainability, quality, transparency.
`;

const intel = audienceAnalyzer.analyzeAudience(research, {
  brandName: 'RACKS',
  productCategory: 'Hair Care',
  productName: 'Serum',
  targetMarket: 'Health-conscious women'
});
```

### Extract Primary Driver
```typescript
console.log(intel.primaryPersona.purchaseDriver);
// → "Eco-friendly sourcing" or "Product efficacy" or "Brand reputation"
```

### Get Marketing Angles
```typescript
intel.marketingImplications.forEach(implication => {
  console.log(implication);
  // → "Messaging should emphasize quality and sustainability"
  // → "Allocate 40% of budget to social-media channel"
  // → "Build influencer partnerships aligned with audience values"
});
```

### Identify Content Gaps
```typescript
intel.unservedAudiences.forEach(segment => {
  console.log(`${segment.segment}: ${segment.opportunity}`);
  // → "Budget-conscious buyers: Expanding reach to budget segment"
  // → "Male audience: Develop messaging specific to male audience"
});
```

### Channel Strategy
```typescript
const topChannels = intel.primaryPersona.preferredChannels.slice(0, 3);
// → ['social-media', 'influencer', 'email']

const channelRanks = intel.primaryPersona.behaviors.channelPreferences
  .sort((a, b) => b.preference - a.preference)
  .slice(0, 5);
```

### Objection Handling
```typescript
intel.primaryPersona.commonObjections.forEach(objection => {
  console.log(`Common objection: ${objection}`);
  // → "Does it really work as advertised?"
  // → "Is it worth the price point?"
  // → "Is it truly sustainable?"
});
```

## Performance Characteristics

- **Speed**: Single analysis completes in <100ms (typical research data)
- **Scalability**: Efficiently handles 10,000+ character research inputs
- **Memory**: Minimal footprint, ~5MB per analysis
- **Error Tolerance**: Degrades gracefully with partial/corrupted data

## Error Handling

The service uses a resilience-first approach:

```typescript
try {
  const intel = audienceAnalyzer.analyzeAudience(data, context);
  if (intel.dataQuality === 'limited') {
    console.warn('Consider gathering more research data');
  }
} catch (err) {
  if (err instanceof AudienceAnalysisError) {
    console.error('Analysis failed:', err.message);
  }
}
```

## Common Patterns

### Pattern 1: Extract Key Insights
```typescript
const keyInsights = intel.keyInsights.slice(0, 3);
// → Top 3 strategic insights for presentation
```

### Pattern 2: Identify Messaging
```typescript
const pillars = intel.contentStrategy.messagingPillars;
// → ["Sustainability", "Efficacy", "Community"]
const tone = intel.contentStrategy.tonalGuidance;
// → "Authoritative, educational, empowering"
```

### Pattern 3: Price Strategy
```typescript
const pricing = intel.primaryPersona.behaviors.priceSensitivity;
console.log(`Min: $${pricing.acceptablePriceRange.min}`);
console.log(`Max: $${pricing.acceptablePriceRange.max}`);
console.log(`Best: $${pricing.pricePoints[1].price}`);
```

### Pattern 4: Competitive Positioning
```typescript
intel.competitorAnalysis.forEach(comp => {
  console.log(`${comp.competitor}: ${comp.differentiation}`);
});
```

## Integration

### With Research Pipeline
```typescript
async function processResearch(campaign: Campaign) {
  const researchData = await orchestrateResearch(campaign);
  const audience = audienceAnalyzer.analyzeAudience(
    researchData.findings,
    campaign.productContext
  );
  return audience;
}
```

### With Downstream Stages
```typescript
// Pass to copywriting stage
const objectionHandling = primaryPersona.commonObjections;
const toneGuide = intel.contentStrategy.tonalGuidance;

// Pass to creative stage
const colorPsycho = primaryPersona.psychographics.values;
const contentFormats = intel.contentStrategy.contentFormats;

// Pass to media planning
const channels = primaryPersona.preferredChannels;
const budget = intel.primaryPersona.behaviors.priceSensitivity;
```

## Testing

Run comprehensive test suite:
```bash
npm test src/services/__tests__/audienceAnalyzer.test.ts
```

Tests cover:
- Basic analysis completeness
- Demographic extraction accuracy
- Psychographic depth
- Needs analysis completeness
- Behavioral profiling
- Persona generation
- Competitive analysis
- Error handling
- Performance benchmarks

## Limitations

1. **Text-Only Input**: Analyzes text; doesn't process images/videos directly
2. **Language**: Optimized for English; other languages may have reduced accuracy
3. **Domain-Specific Keywords**: Works best with beauty/wellness/hair care data; customize keywords for other domains
4. **Confidence Variability**: Confidence depends heavily on input richness
5. **Unmet Needs**: Partially inferred; consider supplementing with surveys

## Future Enhancements

1. **Vision Integration**: Analyze competitor product photos for psychographic signals
2. **Survey Integration**: Direct input from customer survey data
3. **Historical Trend**: Track persona evolution across campaign cycles
4. **Sentiment Analysis**: Extract emotional tone from reviews
5. **Geographic Specificity**: Country-specific psychographic modifiers
6. **Language Support**: Multi-language analysis with cultural nuances

## Troubleshooting

### Issue: Low confidence score
**Solution**: Provide more diverse research data (social media, reviews, surveys, market reports)

### Issue: Missing secondary personas
**Solution**: Add more audience segment mentions in research data

### Issue: Vague pain points
**Solution**: Include customer feedback, reviews, and survey responses

### Issue: Incomplete channel preferences
**Solution**: Add details about where target audience spends time online

## License

Part of NEURO Ad Agent. See main project license.

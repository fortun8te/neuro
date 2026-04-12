# Competitor & Niche Analyzer — Quick Reference

## Import
```typescript
import {
  CompetitorNicheAnalyzer,
  createAnalyzer,
  CompetitorType,
  MarketPositioning,
  type CompetitorNicheReport,
} from '@/services';
```

## Create Analyzer
```typescript
const analyzer = new CompetitorNicheAnalyzer('Product Name', 'Category');
// OR
const analyzer = createAnalyzer('Product Name', 'Category');
```

## Add Competitors
```typescript
// Single competitor
analyzer.addCompetitor({
  id: 'comp-1',
  name: 'Competitor Name',
  type: CompetitorType.DIRECT,
  positioning: MarketPositioning.PREMIUM_NATURAL,
  priceRange: { min: 20, max: 60, currency: 'USD', typical: 40 },
  productRange: { breadth: 'broad', depth: 'moderate', categories: [], keyProducts: [] },
  distribution: { channels: ['online'], geographies: ['USA'], omnichannel: true },
  brandStrength: { followers: 1000000, averageRating: 4.5 },
  strengths: ['Brand loyalty'],
  weaknesses: ['Limited reach'],
  marketShareEstimate: 8.5,
  growthRate: 15,
  targetAudience: ['Women 25-45'],
  uniqueValueProposition: 'Premium quality',
});

// Batch add
analyzer.addCompetitors([comp1, comp2, comp3]);
```

## Set Market Context (Optional)
```typescript
analyzer.setNicheAnalysis({
  categoryName: 'Premium Natural Skincare',
  marketSize: {
    tam: '$60B global market',
    sam: '$18B premium natural',
  },
  marketGrowth: { cagr: 7.8, period: '2023-2028', confidence: 'high' },
  maturity: MarketMaturity.GROWTH,
  keyTrends: [
    { trend: 'Clean beauty', strength: 'growing' },
  ],
  willingness: { assessment: 'High willingness for premium' },
  distributionChannels: [
    { channel: 'DTC', prominence: 9, effectiveness: 'mature' },
  ],
  barriers: [
    { type: 'Brand building', height: 'high', description: '...' },
  ],
});
```

## Run Analyses
```typescript
// Landscape (fragmentation, leaders, trends)
const landscape = analyzer.analyzeCompetitiveLandscape();
console.log(landscape.fragmentationLevel); // 'fragmented' | 'moderate' | 'consolidated'
console.log(landscape.marketLeaders);      // Top 3+
console.log(landscape.barrierToEntry);     // 'low' | 'medium' | 'high'

// Positioning gaps
const positioningGaps = analyzer.analyzePositioningGaps();
positioningGaps.forEach(gap => {
  console.log(`${gap.positioning}: ${gap.filled ? 'TAKEN' : 'EMPTY'}`);
  if (!gap.filled) {
    console.log(`  Opportunity: ${gap.opportunity?.estimatedMarketSize}`);
  }
});

// Audience gaps
const audienceGaps = analyzer.analyzeAudienceGaps();
audienceGaps.forEach(gap => {
  console.log(`${gap.segment}: ${gap.servedWell ? 'WELL SERVED' : 'UNDERSERVED'}`);
  console.log(`  Willingness: ${gap.willingness?.toPay}`);
});

// Supply/demand mismatches
const mismatches = analyzer.analyzeSupplyDemandMismatches();
mismatches.forEach(m => {
  console.log(`${m.category}: ${m.gap.type}`);
  console.log(`  Market Opportunity: ${m.gap.marketOpportunity}`);
});
```

## Generate Full Report
```typescript
const report = analyzer.generateReport();

// Access all sections
console.log(report.competitors.total);                    // Number of competitors
console.log(report.landscape.fragmentationLevel);         // Market structure
console.log(report.niche.marketGrowth.cagr);            // Growth rate
console.log(report.positioningGaps);                      // Empty/taken positions
console.log(report.audienceSummary.underserved);         // Underserved segments
console.log(report.supplyDemandMismatches);              // All gaps
console.log(report.opportunities.highPriority);          // Top opportunities

// Data quality
console.log(report.confidence.overall);                   // 0-1 score
console.log(report.dataQuality.completeness);            // 0-1 score
console.log(report.limitations);                          // Known issues
```

## Export Results
```typescript
// Markdown (for presentations, docs)
const markdown = analyzer.exportMarkdown();
// Can feed to docGenerator or pdfExporter

// JSON (for programmatic processing)
const json = analyzer.exportJSON();

// Direct access
const report = analyzer.getReport();
if (report) {
  // Use report object directly
}
```

## Positioning Angles
```typescript
MarketPositioning.PREMIUM_NATURAL       // Clean, natural ingredients
MarketPositioning.AFFORDABLE_ACCESSIBLE // Value with quality
MarketPositioning.LUXURY_PREMIUM        // Exclusive, luxury
MarketPositioning.INNOVATIVE_TECH       // Technology-driven
MarketPositioning.CLINICAL_SCIENCE      // Efficacy backed science
MarketPositioning.SUSTAINABLE_ECO       // Environmental focus
MarketPositioning.PERSONALIZED_CUSTOM   // Individual customization
MarketPositioning.VALUE_MASS            // Mass market value
```

## Competitor Types
```typescript
CompetitorType.DIRECT       // Same product, same audience
CompetitorType.INDIRECT     // Same problem, different solution
CompetitorType.ADJACENT     // Related categories
CompetitorType.EMERGING     // Funded startups
CompetitorType.LEGACY       // Traditional established brands
```

## Common Patterns

### Quick Market Check
```typescript
const analyzer = new CompetitorNicheAnalyzer('MyBrand', 'Category');
analyzer.addCompetitors(competitors);
const report = analyzer.generateReport();
console.log(`Opportunity count: ${report.opportunities.highPriority.length}`);
```

### Detailed Analysis with Export
```typescript
const analyzer = createAnalyzer('Product', 'Category');
analyzer.addCompetitors(allCompetitors);
analyzer.setNicheAnalysis(marketData);

const report = analyzer.generateReport();
const markdown = analyzer.exportMarkdown();

// Export to doc
const docReport = await docGenerator.generateMarkdownReport({
  question: `Market analysis for ${report.product}`,
  sections: [{ title: 'Competitive Landscape', content: markdown }],
  generated_at: new Date().toISOString(),
});
```

### Finding Unserved Positioning
```typescript
const analyzer = new CompetitorNicheAnalyzer('MyBrand', 'Category');
analyzer.addCompetitors(competitors);

const gaps = analyzer.analyzePositioningGaps();
const unservedPositions = gaps.filter(g => !g.filled);

console.log(`${unservedPositions.length} empty positioning angles:`);
unservedPositions.forEach(g => {
  console.log(`- ${g.positioning}: ${g.opportunity?.estimatedMarketSize}`);
});
```

### Identifying Underserved Audiences
```typescript
const audienceGaps = analyzer.analyzeAudienceGaps();
const underserved = audienceGaps.filter(a => !a.servedWell);

console.log('Underserved segments:');
underserved.forEach(a => {
  console.log(`- ${a.segment} (willing to pay: ${a.willingness?.toPay})`);
  console.log(`  Unmet needs: ${a.unmetNeeds?.join(', ')}`);
});
```

## Confidence Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 0.8+ | High confidence | Use for decisions |
| 0.5-0.79 | Medium confidence | Validate with research |
| < 0.5 | Low confidence | Needs more data |

**Improve confidence by:**
- Adding 5+ competitors
- Including market share data
- Adding growth rates
- Setting market sizing context

## Data Quality Checklist

For optimal analysis, include per competitor:
- ✅ ID and name
- ✅ Type (direct/indirect/etc)
- ✅ Positioning angle
- ✅ Price range (min, max, typical)
- ✅ Product breadth & depth
- ✅ Distribution channels
- ✅ Market share estimate
- ✅ Growth rate
- ✅ Brand metrics (followers, reviews)
- ✅ Strengths and weaknesses

## Troubleshooting

**Low confidence scores?**
- Add more competitors (minimum 5)
- Include market share percentages
- Add growth rate data
- Set niche analysis with TAM/SAM

**Missing positioning gaps?**
- Check which 8 positioning angles are filled
- Empty spots = opportunities
- Review `report.positioningStrategy`

**No underserved audiences?**
- May mean market is well-served
- Check for geographic gaps
- Look for lifecycle stage gaps (age, income)
- Review competitor target audience overlap

**Integration questions?**
- See `docs/COMPETITOR_NICHE_ANALYZER.md`
- Review `src/examples/competitorNicheAnalyzerExample.ts`
- Check type definitions for expected structures

## See Also
- Full documentation: `docs/COMPETITOR_NICHE_ANALYZER.md`
- Complete example: `src/examples/competitorNicheAnalyzerExample.ts`
- Type reference: `src/services/competitorNicheAnalyzer.ts`
- Delivery details: `COMPETITOR_NICHE_ANALYZER_DELIVERY.md`

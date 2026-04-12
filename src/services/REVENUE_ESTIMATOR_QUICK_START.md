# Revenue Estimator Quick Start

## Installation
Already included in `/src/services/` — just import and use.

## Basic Usage (1 minute)

```typescript
import { revenueEstimator } from './services';

// Minimal: Just one data point
const result = await revenueEstimator.estimateRevenue({
  tiktokFollowers: 500000,
  instagramFollowers: 200000,
});

// Print human-readable summary
console.log(revenueEstimator.formatSummary(result));
```

Output:
```
Revenue Estimate: $9,360,000/year ($780,000/month)
Net Profit: $1,404,000/year (margin: 15.0%)
Estimated Valuation: $32,760,000 (3.5x revenue)
Range: $6,552,000 (conservative) to $13,104,000 (optimistic)
Confidence: 65%
Primary Method: Social Media (Followers × Buyer %)
```

## Full Example (5 minutes)

```typescript
import { revenueEstimator, RevenueInput } from './services';

const input: RevenueInput = {
  // Website metrics
  monthlyWebsiteTraffic: 100000,
  conversionRatePercentage: 3.5,
  averageOrderValue: 72,
  repeatPurchaseRatePerYear: 2.8,

  // Social metrics
  tiktokFollowers: 800000,
  instagramFollowers: 600000,
  estimatedBuyerPercentageOfFollowers: 2.5,

  // Brand metrics
  foundingYear: 2021,
  disclosedFunding: 10000000,
  yearOverYearGrowthRate: 1.4,

  // Market signals
  hasRetailPartners: true,
  productCount: 45,
  hasInfluencerProgram: true,
};

const estimate = await revenueEstimator.estimateRevenue(input);

// Access structured data
console.log('Annual Revenue:', estimate.estimatedAnnualRevenue);
console.log('Net Profit:', estimate.estimatedNetProfit);
console.log('Confidence:', estimate.confidenceScore, '%');
console.log('Methods used:', estimate.estimationMethods.length);

// Or use formatted summary
console.log(revenueEstimator.formatSummary(estimate));

// Inspect individual methods
estimate.estimationMethods.forEach(method => {
  console.log(`${method.name}: $${method.estimatedRevenue.toLocaleString()}`);
});

// Check growth signals
if (estimate.growthSignals.length > 0) {
  console.log('Growth Signals:');
  estimate.growthSignals.forEach(signal => {
    console.log(`  - ${signal.signal} (${signal.strength})`);
  });
}
```

## Input Data Guide

### Minimal Required
At least ONE of:
- `monthlyWebsiteTraffic` — Website visitors/month
- `tiktokFollowers` / `instagramFollowers` — Social followers
- `disclosedAnnualRevenue` — Actual revenue (if known)
- `disclosedFunding` — Capital raised ($100k+)

### Optional But Helpful
- `conversionRatePercentage` — % of traffic that buys (default: 3%)
- `averageOrderValue` — $ per order (default: $65)
- `repeatPurchaseRatePerYear` — How often customers rebuy (default: 2.5x)
- `yearOverYearGrowthRate` — Growth multiplier, e.g., 1.5 = 50% growth
- `productCount` — Number of SKUs in product line
- `hasRetailPartners` — Sold in physical stores? (true/false)
- `hasInfluencerProgram` — Has influencer partnerships? (true/false)

### Advanced Options
- `estimatedGrossMarginPercentage` — Custom gross margin (default: 0.60 = 60%)
- `estimatedOperatingCostsPercentage` — Custom operating costs as % of revenue (default: 0.35 = 35%)
- `knownRevenueRange` — If revenue is somewhere in a range: `{ min: 5000000, max: 15000000 }`

## Output Breakdown

```typescript
interface RevenueEstimate {
  // PRIMARY NUMBERS (what you usually want)
  estimatedAnnualRevenue: number;      // Main estimate
  estimatedMonthlyRevenue: number;     // Annual / 12
  estimatedGrossProfit: number;        // Revenue × gross margin %
  estimatedNetProfit: number;          // Revenue × net margin %

  // RANGES (pessimistic to optimistic)
  revenueRange: { conservative: number; optimistic: number };
  profitRange: { conservative: number; optimistic: number };

  // VALUATION
  estimatedValuation: number;           // Business worth
  valuationMultiple: number;            // Revenue multiple used

  // QUALITY METRICS
  confidenceScore: number;              // 0-100, higher is better
  estimationMethods: EstimationMethod[]; // All 4 methods tried
  primaryMethod: string;                // Which method was primary

  // MARGINS (percentages)
  grossMarginPercentage: number;        // Typically 60%
  operatingCostsPercentage: number;     // Typically 35%
  netMarginPercentage: number;          // gross - operating = ~15%

  // GROWTH FACTORS
  growthSignals: GrowthSignal[];        // e.g., ["funding", "retail"]
}
```

## Common Scenarios

### Scenario 1: Early-Stage Brand
```typescript
const earlyStage = {
  tiktokFollowers: 150000,
  instagramFollowers: 80000,
  disclosedFunding: 500000,
  yearOverYearGrowthRate: 1.8,
  foundingYear: 2024,
};

// Expected: $500k - $2M revenue, 55-65% confidence
```

### Scenario 2: Growing Established Brand
```typescript
const growing = {
  monthlyWebsiteTraffic: 150000,
  conversionRatePercentage: 3,
  averageOrderValue: 70,
  tiktokFollowers: 1000000,
  instagramFollowers: 800000,
  disclosedFunding: 15000000,
  yearOverYearGrowthRate: 1.3,
  hasRetailPartners: true,
  productCount: 60,
};

// Expected: $30M - $60M revenue, 80%+ confidence
```

### Scenario 3: Known Revenue
```typescript
const known = {
  disclosedAnnualRevenue: 100000000,
  yearOverYearGrowthRate: 1.2,
  hasRetailPartners: true,
};

// Expected: $100M (confirmed), 95% confidence
// No estimation needed — uses actual
```

## Common Output Patterns

### Print Summary to Console
```typescript
const estimate = await revenueEstimator.estimateRevenue(input);
console.log(revenueEstimator.formatSummary(estimate));
```

### Add to Research Report
```typescript
const revenueSection = {
  title: 'Revenue & Valuation',
  content: revenueEstimator.formatSummary(estimate),
  confidence: estimate.confidenceScore,
};

// Use with docGenerator
```

### Export as JSON
```typescript
const json = JSON.stringify(estimate, null, 2);
// For API responses, databases, or config storage
```

### Use in Dashboard
```typescript
const widget = {
  revenue: estimate.estimatedAnnualRevenue,
  valuation: estimate.estimatedValuation,
  confidence: estimate.confidenceScore,
  signals: estimate.growthSignals,
};
// Render in React component
```

### Compare Multiple Brands
```typescript
const brands = await Promise.all([
  revenueEstimator.estimateRevenue(brand1Input),
  revenueEstimator.estimateRevenue(brand2Input),
  revenueEstimator.estimateRevenue(brand3Input),
]);

// Display as table
brands.forEach(b => {
  console.log(`${b.estimatedAnnualRevenue} | ${b.confidenceScore}%`);
});
```

## Confidence Interpretation

| Confidence | What It Means | Trust Level |
|------------|--------------|-------------|
| 95%+ | Disclosed or near-disclosed data | Use as fact |
| 80-95% | Multiple methods converge | High confidence |
| 70-80% | Good data on most variables | Solid estimate |
| 60-70% | Some data available | Reasonable range |
| 50-60% | Limited data, single method | Rough order of magnitude |
| <50% | Minimal data | Speculative |

## Defaults Reference

| Parameter | Default | When Used |
|-----------|---------|-----------|
| Conversion Rate | 3% | Not provided |
| AOV | $65 | Not provided |
| Repeat Rate | 2.5x/year | Not provided |
| Buyer % (social) | 2% | Not provided |
| Gross Margin | 60% | Not provided |
| Operating Costs | 35% | Not provided |
| Valuation Multiple | 3.5x | DTC beauty baseline |

**All customizable** via input parameters.

## Error Cases

### Will Throw
```typescript
// No viable data
await revenueEstimator.estimateRevenue({});
// Error: "Insufficient data for revenue estimation"
```

### Will Warn (but still run)
```typescript
// Unusual margin
await revenueEstimator.estimateRevenue({
  monthlyWebsiteTraffic: 50000,
  estimatedGrossMarginPercentage: 0.95, // Very high
});
// Warning logged: "Unusual gross margin"
```

### Will Pass Through
```typescript
// Negative numbers (edge case)
await revenueEstimator.estimateRevenue({
  monthlyWebsiteTraffic: -5000, // User responsibility
});
// Still returns estimate (may be negative)
```

## Tips & Tricks

1. **Start Simple** — Just provide followers for quick estimate
2. **Add Precision** — Add traffic/conversion for higher confidence
3. **Use Ranges** — If you know revenue is $10-30M, use `knownRevenueRange`
4. **Trust Convergence** — If all 4 methods agree, confidence is high
5. **Check Signals** — More growth signals = higher valuation multiple
6. **Custom Margins** — For unusual business models, override defaults
7. **Repeat Analysis** — Estimate monthly to track progress

## File Locations

| File | Purpose |
|------|---------|
| `src/services/revenueEstimator.ts` | Main service code |
| `src/services/revenueEstimator.test.ts` | Unit tests (40+) |
| `src/services/REVENUE_ESTIMATOR_GUIDE.md` | Detailed reference |
| `src/services/REVENUE_ESTIMATOR_INTEGRATION_EXAMPLE.ts` | 7 real-world examples |
| `REVENUE_ESTIMATOR_SUMMARY.md` | Implementation overview |

## Next Steps

1. **Import:** `import { revenueEstimator } from './services';`
2. **Try:** Estimate revenue for your test brand
3. **Integrate:** Add to dashboard, exports, or reports
4. **Customize:** Adjust margins for your category
5. **Monitor:** Track confidence scores on real campaigns

## Support

- **Examples:** See `REVENUE_ESTIMATOR_INTEGRATION_EXAMPLE.ts`
- **Tests:** See `revenueEstimator.test.ts` for all patterns
- **Guide:** See `REVENUE_ESTIMATOR_GUIDE.md` for deep dive
- **Code:** Comments throughout `revenueEstimator.ts`

---

**That's it! You're ready to estimate DTC brand revenue.**

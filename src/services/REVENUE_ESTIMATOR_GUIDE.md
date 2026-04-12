# Revenue Estimator Service

Production-ready financial projection service for DTC brands using multi-method estimation, confidence scoring, and growth signal analysis.

## Quick Start

```typescript
import { revenueEstimator } from './services';

const estimate = await revenueEstimator.estimateRevenue({
  monthlyWebsiteTraffic: 50000,
  conversionRatePercentage: 3,
  averageOrderValue: 65,
  tiktokFollowers: 500000,
  instagramFollowers: 200000,
  disclosedFunding: 2000000,
  yearOverYearGrowthRate: 1.5,
});

console.log(revenueEstimator.formatSummary(estimate));
```

## Overview

The Revenue Estimator uses **four complementary estimation methods** to calculate annual revenue, net profit, and business valuation for DTC beauty brands:

### Method A: Customer Base Approach
**Formula:** Website Traffic × Conversion Rate × AOV × Repeat Purchase Rate

**Best for:** Brands with known traffic and conversion metrics
**Confidence:** 80% (with full data)

**Input:**
- `monthlyWebsiteTraffic` — Monthly unique visitors
- `conversionRatePercentage` — % of visitors who purchase (default: 3%)
- `averageOrderValue` — Average transaction amount (default: $65)
- `repeatPurchaseRatePerYear` — Annual repurchase frequency (default: 2.5x)

**Example:**
```typescript
const method_a = {
  monthlyWebsiteTraffic: 50000,
  conversionRatePercentage: 3,
  averageOrderValue: 65,
  repeatPurchaseRatePerYear: 2.5,
};

// 50k * 3% * $65 = ~$97.5k/month
// ~$1.17M/year after repeat purchase factor
```

---

### Method B: Social Media Approach
**Formula:** (TikTok Followers + Instagram Followers) × Buyer % × AOV × Repeat Rate

**Best for:** Influencer-led or social-first brands
**Confidence:** 50-70% (depending on follower count)

**Input:**
- `tiktokFollowers` — TikTok follower count
- `instagramFollowers` — Instagram follower count
- `estimatedBuyerPercentageOfFollowers` — % likely to purchase (default: 2%)
- `averageOrderValue` — (default: $65)
- `repeatPurchaseRatePerYear` — (default: 2.5x)

**Example:**
```typescript
const method_b = {
  tiktokFollowers: 500000,
  instagramFollowers: 200000,
  estimatedBuyerPercentageOfFollowers: 2,
  averageOrderValue: 65,
};

// (500k + 200k) * 2% = 14k potential buyers
// Spread over year with 2.5x repeat = ~$2.7M/year
```

---

### Method C: Funding & Growth Signals
**Formula:** Inferred revenue from burn rate, growth trajectory, and time-in-market

**Best for:** Early-stage brands with disclosed funding
**Confidence:** 45% (inherent burn-rate uncertainty)

**Input:**
- `disclosedFunding` — Total capital raised
- `foundingYear` — Year founded (to calculate runway)
- `yearOverYearGrowthRate` — Expected YoY growth multiplier (e.g., 1.5 = 50% growth)

**Example:**
```typescript
const method_c = {
  disclosedFunding: 5000000,
  foundingYear: 2022,
  yearOverYearGrowthRate: 1.5,
};

// Infers monthly burn, projects revenue growth over 2-3 years
// ~$3-5M/year range depending on growth rate
```

---

### Method D: Comparable Brand Analysis
**Formula:** Scale comparable brands by follower count and product portfolio

**Best for:** Brands with significant social following
**Confidence:** 40-65% depending on comparable similarity

**Comparables Used:**
- Glossier: 3.6M followers, ~$250M revenue
- The Ordinary: 2.2M followers, ~$150M revenue
- Charlotte Tilbury: 5.8M followers, ~$120M revenue
- Fenty Beauty: 7.3M followers, ~$550M revenue

**Input:**
- `tiktokFollowers` / `instagramFollowers` — For matching to comparables
- `productCount` — Portfolio size (scaling factor)

**Example:**
```typescript
const method_d = {
  tiktokFollowers: 2000000,
  instagramFollowers: 1500000,
  productCount: 45,
};

// Matches to Glossier (similar follower count)
// Adjusts for product portfolio differences
// ~$50-150M/year range
```

---

## Input Data Types

### RevenueInput

All fields are optional. The service detects which methods are viable based on available data:

```typescript
interface RevenueInput {
  // Traffic & Conversion (for Method A)
  monthlyWebsiteTraffic?: number;
  conversionRatePercentage?: number;
  averageOrderValue?: number;
  repeatPurchaseRatePerYear?: number;

  // Social Media (for Method B)
  tiktokFollowers?: number;
  instagramFollowers?: number;
  estimatedBuyerPercentageOfFollowers?: number;

  // Brand Metrics (for all methods)
  foundingYear?: number;
  disclosedAnnualRevenue?: number;  // Override all with actual
  disclosedFunding?: number;
  knownRevenueRange?: { min: number; max: number };  // If range known

  // Growth Signals (modifiers)
  yearOverYearGrowthRate?: number;
  productCount?: number;
  hasRetailPartners?: boolean;
  hasInfluencerProgram?: boolean;

  // Margin Assumptions (defaults to 60% gross, 35% operating costs)
  estimatedGrossMarginPercentage?: number;
  estimatedOperatingCostsPercentage?: number;
}
```

---

## Output: RevenueEstimate

```typescript
interface RevenueEstimate {
  // Primary Estimates
  estimatedAnnualRevenue: number;           // Best estimate
  estimatedMonthlyRevenue: number;          // Annualized / 12
  estimatedGrossProfit: number;
  estimatedNetProfit: number;

  // Conservative/Optimistic Ranges
  revenueRange: {
    conservative: number;  // -30% (pessimistic case)
    optimistic: number;    // +40% (upside case)
  };
  profitRange: {
    conservative: number;
    optimistic: number;
  };

  // Valuation (default 3.5x revenue for DTC beauty)
  estimatedValuation: number;
  valuationRange: {
    conservative: number;
    optimistic: number;
  };
  valuationMultiple: number;  // Adjusted by growth signals

  // Quality Metrics
  confidenceScore: number;  // 0-100
  estimationMethods: EstimationMethod[];
  primaryMethod: string;

  // Margins
  grossMarginPercentage: number;
  netMarginPercentage: number;
  operatingCostsPercentage: number;

  // Detected Growth Signals
  growthSignals: GrowthSignal[];

  // Raw Calculations
  calculations: DetailedCalculations;
}
```

---

## Usage Examples

### Early-Stage Brand (2023, pre-revenue)

```typescript
const early_stage = {
  foundingYear: 2023,
  tiktokFollowers: 150000,
  instagramFollowers: 80000,
  disclosedFunding: 500000,
  yearOverYearGrowthRate: 1.8,
};

const result = await revenueEstimator.estimateRevenue(early_stage);
// Result:
// - Revenue: ~$500k - $2M/year
// - Valuation: ~$2M - $8M
// - Confidence: 55-65%
// - Growth signals: Funding, High YoY growth
```

### Growing Brand (2022, disclosed traffic)

```typescript
const growing = {
  monthlyWebsiteTraffic: 100000,
  conversionRatePercentage: 3,
  averageOrderValue: 72,
  repeatPurchaseRatePerYear: 2.8,
  tiktokFollowers: 800000,
  instagramFollowers: 600000,
  disclosedFunding: 10000000,
  foundingYear: 2021,
  yearOverYearGrowthRate: 1.4,
};

const result = await revenueEstimator.estimateRevenue(growing);
// Result:
// - Revenue: ~$25M - $40M/year
// - Valuation: ~$100M - $180M
// - Confidence: 80%+
// - Methods: 4/4 available
```

### Established Brand (known revenue)

```typescript
const established = {
  disclosedAnnualRevenue: 100000000,
  yearOverYearGrowthRate: 1.3,
  hasRetailPartners: true,
  productCount: 75,
};

const result = await revenueEstimator.estimateRevenue(established);
// Result:
// - Revenue: $100M (confirmed)
// - Valuation: ~$350M - $500M
// - Confidence: 95%
// - Net margin: ~16-20%
```

---

## Growth Signals

The service detects and applies multipliers for:

| Signal | Impact | Condition |
|--------|--------|-----------|
| Major funding ($5M+) | +25% revenue | `disclosedFunding > 5000000` |
| Series A ($1M-5M) | +15% revenue | `disclosedFunding > 1000000` |
| Hypergrowth (>100% YoY) | +20% valuation, +2x multiplier | `yearOverYearGrowthRate > 2` |
| Strong growth (30-100% YoY) | +10% revenue, +1x multiplier | `yearOverYearGrowthRate > 1.3` |
| Retail expansion | +15% revenue, +0.5x multiplier | `hasRetailPartners: true` |
| Influencer program | +5% revenue | `hasInfluencerProgram: true` |
| Diverse portfolio (20+ SKUs) | +10% revenue | `productCount > 20` |

---

## Confidence Scoring

Score ranges 0-100 based on:

- **Data completeness** — More inputs = higher confidence
- **Method agreement** — Do all 4 methods converge? (+15 if yes)
- **Data quality** — Website traffic (+10), Funding (+5), Disclosed revenue (+40)
- **Final boost** — Disclosed revenue/range pushes to 85-95%

Examples:
- Single social metric: 40-50%
- Traffic + social: 60-70%
- All 4 methods converging: 75-85%
- Disclosed revenue: 95%

---

## Margin Assumptions (DTC Beauty Defaults)

| Metric | Default | Typical Range |
|--------|---------|---------------|
| Gross Margin | 60% | 50-75% |
| Operating Costs | 35% of revenue | 25-45% |
| Net Margin | ~15% | 10-30% |
| COGS | 40% | 25-50% |
| Marketing | 15% of revenue | 10-25% |
| Personnel | 12% of revenue | 8-18% |
| Fulfillment | 5% of revenue | 3-8% |

**Customization:**
```typescript
const custom_margins = {
  monthlyWebsiteTraffic: 50000,
  estimatedGrossMarginPercentage: 0.70,     // 70% (custom)
  estimatedOperatingCostsPercentage: 0.30,  // 30% of revenue (custom)
};

const result = await revenueEstimator.estimateRevenue(custom_margins);
// Net margin will be: 70% - 30% = 40%
```

---

## Valuation Multiples

DTC beauty companies typically trade at **2-7x revenue**, adjusted by:

| Factor | Adjustment |
|--------|------------|
| Base DTC beauty | 3.5x |
| Hypergrowth (>100% YoY) | +2x |
| Strong growth (30-100%) | +1x |
| Slow growth (<10%) | -1x |
| Major funding ($10M+) | +1.5x |
| Retail expansion | +0.5x |
| **Range** | **1.5x - 7x** |

---

## Error Handling

### Insufficient Data
```typescript
try {
  const result = await revenueEstimator.estimateRevenue({});
} catch (error) {
  // "Insufficient data for revenue estimation"
}
```

The service requires **at least one of:**
- Monthly website traffic
- Social followers (50k+)
- Disclosed revenue/range
- Funding round ($100k+)

### Validation
- Negative revenue/traffic: Passed through (edge case)
- Gross margin > 95%: Warning logged (unusual)
- No methods viable: Error thrown

---

## Use in RACKS Context

### Dashboard Integration
```typescript
// In campaign context
const racksMetrics: RevenueInput = {
  // Populate from RACKS data
  tiktokFollowers: campaign.socialMetrics?.tiktok,
  instagramFollowers: campaign.socialMetrics?.instagram,
  monthlyWebsiteTraffic: campaign.trafficMetrics?.monthly,
  conversionRatePercentage: campaign.metrics?.conversion,
  // ... other fields
};

const estimate = await revenueEstimator.estimateRevenue(racksMetrics);

// Display in export
const summary = revenueEstimator.formatSummary(estimate);
```

### PDF Export Integration
```typescript
// In docGenerator or pdfExporter
const revenueSection = {
  title: 'Revenue & Valuation',
  content: revenueEstimator.formatSummary(estimate),
  findings: estimate.estimationMethods.map(m => ({
    fact: `${m.name}: $${m.estimatedRevenue.toLocaleString()}`,
    sources: m.dataPointsUsed,
  })),
  confidence: estimate.confidenceScore,
};
```

---

## Performance Notes

- All calculations are synchronous (no API calls)
- Typical execution: <5ms
- No external dependencies beyond logger
- Safe for request handlers (no I/O blocking)

---

## Testing

Run full test suite:
```bash
npm test -- src/services/revenueEstimator.test.ts
```

Coverage includes:
- All 4 estimation methods
- Growth signal detection
- Confidence scoring
- Margin calculations
- Valuation multiples
- Error cases
- Realistic scenarios (early/growth/established)

---

## Future Enhancements

- [ ] International market adjustments
- [ ] Subscription vs one-time revenue models
- [ ] Seasonal adjustment factors
- [ ] Competitor sentiment analysis integration
- [ ] Historical accuracy tracking (compare estimates to disclosed)
- [ ] Monte Carlo simulation for range projections

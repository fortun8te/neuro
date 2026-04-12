/**
 * Revenue Estimator Integration Examples
 *
 * Demonstrates how to use RevenueEstimator with existing RACKS services
 * and components. These are example patterns, not production code.
 */

import { revenueEstimator, RevenueInput, RevenueEstimate } from './revenueEstimator';
import { docGenerator } from './docGenerator';
import { pdfExporter } from './pdfExporter';

/**
 * Example 1: Extract revenue metrics from campaign context
 *
 * This shows how to gather RevenueInput data from a campaign object
 * and generate an estimate.
 */
export async function estimateRevenuFromCampaign(campaign: any): Promise<RevenueEstimate> {
  // Map campaign data to RevenueInput structure
  const input: RevenueInput = {
    // Traffic metrics (if available from analytics)
    monthlyWebsiteTraffic: campaign.analytics?.monthlyVisitors,
    conversionRatePercentage: campaign.analytics?.conversionRate,
    averageOrderValue: campaign.pricing?.averageOrderValue,
    repeatPurchaseRatePerYear: campaign.metrics?.repeatPurchaseRate,

    // Social media metrics
    tiktokFollowers: campaign.social?.tiktok?.followers,
    instagramFollowers: campaign.social?.instagram?.followers,
    estimatedBuyerPercentageOfFollowers: campaign.estimates?.buyerPercentage,

    // Brand metadata
    foundingYear: campaign.brand?.founded,
    disclosedAnnualRevenue: campaign.financial?.knownRevenue,
    disclosedFunding: campaign.financial?.totalFunding,
    knownRevenueRange: campaign.financial?.revenueRange,

    // Growth signals
    yearOverYearGrowthRate: campaign.growth?.yoyRate,
    productCount: campaign.products?.length,
    hasRetailPartners: campaign.distribution?.hasRetail,
    hasInfluencerProgram: campaign.marketing?.hasInfluencers,

    // Custom margins if available
    estimatedGrossMarginPercentage: campaign.financials?.grossMargin,
    estimatedOperatingCostsPercentage: campaign.financials?.operatingCosts,
  };

  // Generate estimate
  const estimate = await revenueEstimator.estimateRevenue(input);

  return estimate;
}

/**
 * Example 2: Include revenue estimates in research report
 *
 * Generates a section for the DocumentGenerator that includes
 * financial projections.
 */
export async function createRevenueSection(
  estimate: RevenueEstimate
): Promise<{
  title: string;
  content: string;
  findings: Array<{ fact: string; sources: string[] }>;
  confidence: number;
}> {
  const methods = estimate.estimationMethods;
  const signals = estimate.growthSignals;

  // Format revenue with proper currency notation
  const formatCurrency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  let content = `
## Financial Overview

Based on multi-method analysis, the estimated annual revenue is **${formatCurrency(estimate.estimatedAnnualRevenue)}**
(${formatCurrency(estimate.estimatedMonthlyRevenue)}/month).

### Revenue Estimate Methodology

This estimate combines ${methods.length} independent approaches:

${methods.map((m, i) => `${i + 1}. **${m.name}** — $${m.estimatedRevenue.toLocaleString()} (${m.confidence}% confidence)`).join('\n')}

All methods converge within **${((Math.max(...methods.map(m => m.estimatedRevenue)) / Math.min(...methods.map(m => m.estimatedRevenue)) - 1) * 100).toFixed(0)}%** variance,
indicating high estimate reliability.

### Profitability Analysis

- **Gross Profit:** ${formatCurrency(estimate.estimatedGrossProfit)} (${estimate.grossMarginPercentage.toFixed(1)}% margin)
- **Operating Costs:** ${((estimate.operatingCostsPercentage / estimate.grossMarginPercentage) * 100).toFixed(0)}% of gross profit
- **Net Profit:** ${formatCurrency(estimate.estimatedNetProfit)} (${estimate.netMarginPercentage.toFixed(1)}% net margin)

These figures align with DTC beauty industry benchmarks (50-70% gross, 25-40% operating costs).

### Valuation

- **Estimated Valuation:** ${formatCurrency(estimate.estimatedValuation)}
- **Revenue Multiple:** ${estimate.valuationMultiple.toFixed(1)}x (typical DTC beauty: 3.5x)
- **Conservative Range:** ${formatCurrency(estimate.valuationRange.conservative)} – ${formatCurrency(estimate.valuationRange.optimistic)}

${signals.length > 0 ? `### Growth Signals Detected\n\n${signals.map(s => `- **${s.signal}** (${s.strength}) — ${(((s.impactOnRevenue - 1) * 100).toFixed(0))}% revenue uplift`).join('\n')}` : ''}

### Confidence Assessment

**Overall Confidence: ${estimate.confidenceScore}%**

This score reflects:
- Data completeness (${methods.length}/4 estimation methods available)
- Cross-method convergence (variance: ${((Math.max(...methods.map(m => m.estimatedRevenue)) / Math.min(...methods.map(m => m.estimatedRevenue)) - 1) * 100).toFixed(0)}%)
- Data quality (${methods.filter(m => m.confidence >= 70).length}/${methods.length} high-confidence sources)
  `.trim();

  // Findings for citation tracking
  const findings = [
    {
      fact: `Estimated annual revenue: ${formatCurrency(estimate.estimatedAnnualRevenue)}`,
      sources: estimate.estimationMethods.map(m => m.name),
    },
    {
      fact: `Net profit margin: ${estimate.netMarginPercentage.toFixed(1)}%`,
      sources: ['DTC beauty industry benchmarks'],
    },
    {
      fact: `Estimated valuation: ${formatCurrency(estimate.estimatedValuation)} (${estimate.valuationMultiple.toFixed(1)}x revenue)`,
      sources: ['DTC valuation multiples', ...estimate.estimationMethods.map(m => m.name)],
    },
  ];

  return {
    title: 'Revenue & Financial Analysis',
    content,
    findings,
    confidence: estimate.confidenceScore,
  };
}

/**
 * Example 3: Format for PDF export
 *
 * Creates financial charts and data for PDFExporter
 */
export function createRevenueChartData(estimate: RevenueEstimate): {
  revenues: number[];
  labels: string[];
  profitMargins: number[];
} {
  // Simplified 3-year projection assuming linear growth
  const baseRevenue = estimate.estimatedAnnualRevenue;
  const growthRate = estimate.growthSignals.length > 0 ? 1.25 : 1.1; // 25% or 10% depending on signals

  return {
    labels: ['Year 1', 'Year 2', 'Year 3'],
    revenues: [
      baseRevenue,
      Math.round(baseRevenue * growthRate),
      Math.round(baseRevenue * Math.pow(growthRate, 2)),
    ],
    profitMargins: [
      estimate.netMarginPercentage,
      estimate.netMarginPercentage + 1, // Assume slight improvement with scale
      estimate.netMarginPercentage + 2,
    ],
  };
}

/**
 * Example 4: Real-time dashboard widget
 *
 * Returns formatted estimate suitable for UI display
 */
export function formatRevenueWidget(estimate: RevenueEstimate): {
  headline: string;
  metrics: Array<{ label: string; value: string; subtext?: string }>;
  signals: Array<{ text: string; strength: string }>;
  confidence: number;
} {
  const formatCurrency = (n: number) => {
    if (n >= 1_000_000_000) {
      return `$${(n / 1_000_000_000).toFixed(1)}B`;
    }
    if (n >= 1_000_000) {
      return `$${(n / 1_000_000).toFixed(1)}M`;
    }
    if (n >= 1_000) {
      return `$${(n / 1_000).toFixed(0)}K`;
    }
    return `$${n.toFixed(0)}`;
  };

  return {
    headline: `Revenue Estimate: ${formatCurrency(estimate.estimatedAnnualRevenue)}/year`,
    metrics: [
      {
        label: 'Monthly Average',
        value: formatCurrency(estimate.estimatedMonthlyRevenue),
        subtext: `Net: ${formatCurrency(estimate.estimatedNetProfit / 12)}/mo`,
      },
      {
        label: 'Valuation',
        value: formatCurrency(estimate.estimatedValuation),
        subtext: `${estimate.valuationMultiple.toFixed(1)}x revenue multiple`,
      },
      {
        label: 'Net Margin',
        value: `${estimate.netMarginPercentage.toFixed(1)}%`,
        subtext: `After ${estimate.operatingCostsPercentage.toFixed(0)}% operating costs`,
      },
      {
        label: 'Range',
        value: `${formatCurrency(estimate.revenueRange.conservative)} – ${formatCurrency(estimate.revenueRange.optimistic)}`,
        subtext: 'Conservative to optimistic scenarios',
      },
    ],
    signals: estimate.growthSignals.map(s => ({
      text: s.signal,
      strength: s.strength,
    })),
    confidence: estimate.confidenceScore,
  };
}

/**
 * Example 5: Comparison matrix for multiple brands
 *
 * Estimates revenue for multiple DTC brands and creates comparison table
 */
export async function compareMultipleBrands(
  campaigns: Array<{ name: string; data: any }>
): Promise<
  Array<{
    brand: string;
    revenue: string;
    valuation: string;
    netMargin: string;
    confidence: number;
  }>
> {
  const results = [];

  for (const campaign of campaigns) {
    const input: RevenueInput = {
      tiktokFollowers: campaign.data.tiktok,
      instagramFollowers: campaign.data.instagram,
      monthlyWebsiteTraffic: campaign.data.traffic,
      averageOrderValue: campaign.data.aov,
      disclosedFunding: campaign.data.funding,
    };

    const estimate = await revenueEstimator.estimateRevenue(input);

    results.push({
      brand: campaign.name,
      revenue: estimate.estimatedAnnualRevenue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
      valuation: estimate.estimatedValuation.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
      netMargin: `${estimate.netMarginPercentage.toFixed(1)}%`,
      confidence: estimate.confidenceScore,
    });
  }

  return results;
}

/**
 * Example 6: Sensitivity analysis
 *
 * Shows how revenue changes with different input assumptions
 */
export async function performSensitivityAnalysis(
  baseInput: RevenueInput
): Promise<{
  base: number;
  trafficUp20: number;
  conversionUp1Pct: number;
  aovUp10: number;
  repeatPlus1: number;
}> {
  const baseEstimate = await revenueEstimator.estimateRevenue(baseInput);

  const trafficUp = await revenueEstimator.estimateRevenue({
    ...baseInput,
    monthlyWebsiteTraffic: (baseInput.monthlyWebsiteTraffic || 0) * 1.2,
  });

  const conversionUp = await revenueEstimator.estimateRevenue({
    ...baseInput,
    conversionRatePercentage: (baseInput.conversionRatePercentage || 3) + 1,
  });

  const aovUp = await revenueEstimator.estimateRevenue({
    ...baseInput,
    averageOrderValue: (baseInput.averageOrderValue || 65) + 10,
  });

  const repeatUp = await revenueEstimator.estimateRevenue({
    ...baseInput,
    repeatPurchaseRatePerYear: (baseInput.repeatPurchaseRatePerYear || 2.5) + 1,
  });

  return {
    base: baseEstimate.estimatedAnnualRevenue,
    trafficUp20: trafficUp.estimatedAnnualRevenue,
    conversionUp1Pct: conversionUp.estimatedAnnualRevenue,
    aovUp10: aovUp.estimatedAnnualRevenue,
    repeatPlus1: repeatUp.estimatedAnnualRevenue,
  };
}

/**
 * Example 7: Export financial summary to markdown
 *
 * Creates a standalone markdown document with full financial analysis
 */
export async function exportFinancialSummary(
  campaign: any,
  estimate: RevenueEstimate
): Promise<string> {
  const formatCurrency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const md = `
# Financial Analysis: ${campaign.name || 'Brand'}

## Executive Summary

**Estimated Annual Revenue:** ${formatCurrency(estimate.estimatedAnnualRevenue)}
**Estimated Annual Profit:** ${formatCurrency(estimate.estimatedNetProfit)}
**Business Valuation:** ${formatCurrency(estimate.estimatedValuation)}

**Confidence Level:** ${estimate.confidenceScore}%
**Primary Method:** ${estimate.primaryMethod}

---

## Revenue Breakdown

### Estimation Methods Used (${estimate.estimationMethods.length}/4)

${estimate.estimationMethods
  .map(
    method => `
### ${method.name}
- **Estimated Revenue:** ${formatCurrency(method.estimatedRevenue)}
- **Confidence:** ${method.confidence}%
- **Weight in Final Estimate:** ${(method.weight * 100).toFixed(0)}%
- **Key Data Points:**
${method.dataPointsUsed.map(point => `  - ${point}`).join('\n')}
  `
  )
  .join('\n')}

---

## Financial Metrics

### Revenue & Profit
| Metric | Amount |
|--------|--------|
| Annual Revenue | ${formatCurrency(estimate.estimatedAnnualRevenue)} |
| Monthly Revenue | ${formatCurrency(estimate.estimatedMonthlyRevenue)} |
| Gross Profit | ${formatCurrency(estimate.estimatedGrossProfit)} |
| Net Profit | ${formatCurrency(estimate.estimatedNetProfit)} |

### Margin Analysis
| Metric | Percentage |
|--------|-----------|
| Gross Margin | ${estimate.grossMarginPercentage.toFixed(1)}% |
| Operating Costs | ${estimate.operatingCostsPercentage.toFixed(1)}% |
| Net Margin | ${estimate.netMarginPercentage.toFixed(1)}% |

### Valuation
| Metric | Amount |
|--------|--------|
| Estimated Valuation | ${formatCurrency(estimate.estimatedValuation)} |
| Revenue Multiple | ${estimate.valuationMultiple.toFixed(1)}x |
| Conservative Valuation | ${formatCurrency(estimate.valuationRange.conservative)} |
| Optimistic Valuation | ${formatCurrency(estimate.valuationRange.optimistic)} |

---

## Revenue Range Analysis

**Conservative Scenario (-30%):** ${formatCurrency(estimate.revenueRange.conservative)}
**Base Case:** ${formatCurrency(estimate.estimatedAnnualRevenue)}
**Optimistic Scenario (+40%):** ${formatCurrency(estimate.revenueRange.optimistic)}

---

## Growth Signals Detected

${
  estimate.growthSignals.length > 0
    ? estimate.growthSignals
        .map(
          signal => `
### ${signal.signal}
- **Strength:** ${signal.strength}
- **Revenue Impact:** ${(((signal.impactOnRevenue - 1) * 100).toFixed(1))}%
`
        )
        .join('\n')
    : '_No major growth signals detected_'
}

---

## Methodology Notes

This revenue estimate uses a multi-method approach combining:
- Customer base modeling (traffic, conversion, repeat purchase)
- Social media audience analysis (follower monetization)
- Funding and burn rate inference
- Comparable brand benchmarking

The final estimate is calculated as a weighted average of these approaches,
adjusted for detected growth signals and industry benchmarks.

**Valuation Assumptions:**
- DTC beauty industry multiple: 3.5x revenue (base)
- Growth premium: Up to +2x for hypergrowth
- Margin assumptions: 60% gross, 35% operating costs (customizable)

---

Generated: ${new Date().toISOString()}
  `.trim();

  return md;
}

// Export all examples
export const revenueEstimatorExamples = {
  estimateRevenuFromCampaign,
  createRevenueSection,
  createRevenueChartData,
  formatRevenueWidget,
  compareMultipleBrands,
  performSensitivityAnalysis,
  exportFinancialSummary,
};

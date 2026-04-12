/**
 * Revenue Estimator — Multi-method financial projections for DTC brands
 *
 * Provides revenue, profit, and valuation estimates using:
 * - Customer base approach (traffic × conversion × AOV × repeat)
 * - Social media approach (followers × buyer% × AOV × repeat)
 * - Funding & growth signals
 * - Comparable brand analysis
 * - Confidence scoring with range estimates
 */

import { createLogger } from '../utils/logger';

const log = createLogger('revenue-estimator');

/**
 * Input data for revenue estimation
 */
export interface RevenueInput {
  // Traffic & Conversion
  monthlyWebsiteTraffic?: number;
  conversionRatePercentage?: number;
  averageOrderValue?: number;
  repeatPurchaseRatePerYear?: number;

  // Social Media
  tiktokFollowers?: number;
  instagramFollowers?: number;
  estimatedBuyerPercentageOfFollowers?: number;

  // Brand Metrics
  foundingYear?: number;
  disclosedAnnualRevenue?: number;
  disclosedFunding?: number;
  knownRevenueRange?: { min: number; max: number };

  // Growth Signals
  yearOverYearGrowthRate?: number;
  productCount?: number;
  hasRetailPartners?: boolean;
  hasInfluencerProgram?: boolean;

  // Margin Assumptions
  estimatedGrossMarginPercentage?: number;
  estimatedOperatingCostsPercentage?: number;
}

/**
 * Estimated financial metrics for a brand
 */
export interface RevenueEstimate {
  // Primary estimates
  estimatedAnnualRevenue: number;
  estimatedMonthlyRevenue: number;
  estimatedGrossProfit: number;
  estimatedNetProfit: number;

  // Ranges (conservative to optimistic)
  revenueRange: { conservative: number; optimistic: number };
  profitRange: { conservative: number; optimistic: number };

  // Valuations
  estimatedValuation: number;
  valuationRange: { conservative: number; optimistic: number };
  valuationMultiple: number;

  // Confidence & methodology
  confidenceScore: number; // 0-100
  estimationMethods: EstimationMethod[];
  primaryMethod: string;

  // Breakdown
  grossMarginPercentage: number;
  netMarginPercentage: number;
  operatingCostsPercentage: number;

  // Growth signals detected
  growthSignals: GrowthSignal[];

  // Detailed calculations
  calculations: DetailedCalculations;
}

/**
 * Individual estimation method result
 */
export interface EstimationMethod {
  name: string;
  estimatedRevenue: number;
  weight: number; // 0-1, how much this method contributes to final estimate
  confidence: number; // 0-100
  dataPointsUsed: string[];
}

/**
 * Growth signal identified from input data
 */
export interface GrowthSignal {
  signal: string;
  strength: 'low' | 'medium' | 'high';
  impactOnRevenue: number; // multiplier like 1.1x or 1.3x
}

/**
 * Detailed breakdown of calculations
 */
export interface DetailedCalculations {
  // Method A: Customer Base
  methodA?: {
    monthlyTraffic: number;
    monthlyConversions: number;
    monthlyRevenue: number;
    annualRevenue: number;
    repeatedPurchases: number;
  };

  // Method B: Social Media
  methodB?: {
    tiktokBuyers: number;
    instagramBuyers: number;
    totalSocialBuyers: number;
    monthlyRevenue: number;
    annualRevenue: number;
  };

  // Method C: Funding
  methodC?: {
    fundingAmount: number;
    projectedBurnMonths: number;
    impliedRevenueNeeded: number;
    annualRevenue: number;
  };

  // Method D: Comparable
  methodD?: {
    comparableBrandRevenue: number;
    followerRatioAdjustment: number;
    productCountAdjustment: number;
    annualRevenue: number;
  };

  // Selected method for final estimate
  selectedMethod: string;
  finalRevenue: number;
}

/**
 * Revenue Estimator service
 */
export class RevenueEstimator {
  // DTC beauty industry benchmarks
  private readonly DEFAULT_CONVERSION_RATE = 0.03; // 3%
  private readonly DEFAULT_AOV = 65; // $65 average order value
  private readonly DEFAULT_REPEAT_RATE = 2.5; // 2.5 purchases/year
  private readonly DEFAULT_GROSS_MARGIN = 0.60; // 60%
  private readonly DEFAULT_OPERATING_COSTS = 0.35; // 35% of revenue
  private readonly DEFAULT_SOCIAL_BUYER_RATE = 0.02; // 2% of followers become buyers
  private readonly DTC_BEAUTY_VALUATION_MULTIPLE = 3.5; // 3.5x revenue typical

  // Comparable DTC beauty brands for reference
  private readonly COMPARABLE_BRANDS = [
    { name: 'Glossier', estimatedAnnualRevenue: 250_000_000, followers: 3_600_000 },
    { name: 'The Ordinary', estimatedAnnualRevenue: 150_000_000, followers: 2_200_000 },
    { name: 'Charlotte Tilbury', estimatedAnnualRevenue: 120_000_000, followers: 5_800_000 },
    { name: 'Fenty Beauty', estimatedAnnualRevenue: 550_000_000, followers: 7_300_000 },
  ];

  /**
   * Main estimation method — uses all available data
   */
  async estimateRevenue(input: RevenueInput): Promise<RevenueEstimate> {
    try {
      // If actual revenue is known, return with high confidence
      if (input.disclosedAnnualRevenue) {
        return this.buildConfirmedEstimate(input);
      }

      if (input.knownRevenueRange) {
        return this.buildRangeEstimate(input);
      }

      // Run all estimation methods
      const methodA = this.methodCustomerBase(input);
      const methodB = this.methodSocialMedia(input);
      const methodC = this.methodFundingGrowth(input);
      const methodD = this.methodComparable(input);

      // Collect all methods with valid results
      const methods: EstimationMethod[] = [];
      if (methodA) methods.push(methodA);
      if (methodB) methods.push(methodB);
      if (methodC) methods.push(methodC);
      if (methodD) methods.push(methodD);

      if (methods.length === 0) {
        throw new Error('Insufficient data for revenue estimation');
      }

      // Calculate weighted average
      const weights = methods.map(m => m.weight);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const normalizedWeights = weights.map(w => w / totalWeight);

      const weightedRevenue = methods.reduce((sum, method, idx) => {
        return sum + method.estimatedRevenue * normalizedWeights[idx];
      }, 0);

      // Detect growth signals
      const growthSignals = this.detectGrowthSignals(input);
      const growthMultiplier = growthSignals.reduce((mult, signal) => {
        return mult * signal.impactOnRevenue;
      }, 1);

      const finalRevenue = Math.round(weightedRevenue * growthMultiplier);

      // Calculate margins
      const margins = this.calculateMargins(input);

      // Calculate profits
      const grossProfit = Math.round(finalRevenue * (margins.grossMargin / 100));
      const netProfit = Math.round(
        finalRevenue * ((margins.grossMargin - margins.operatingCosts) / 100)
      );

      // Build confidence score
      const confidenceScore = this.calculateConfidence(methods, input);

      // Calculate valuation
      const valuationMultiple = this.calculateValuationMultiple(input, growthSignals);
      const estimatedValuation = Math.round(finalRevenue * valuationMultiple);

      // Build ranges (conservative: -30%, optimistic: +40%)
      const revenueRange = {
        conservative: Math.round(finalRevenue * 0.7),
        optimistic: Math.round(finalRevenue * 1.4),
      };

      const profitRange = {
        conservative: Math.round(
          revenueRange.conservative * ((margins.grossMargin - margins.operatingCosts) / 100)
        ),
        optimistic: Math.round(
          revenueRange.optimistic * ((margins.grossMargin - margins.operatingCosts) / 100)
        ),
      };

      const valuationRange = {
        conservative: Math.round(revenueRange.conservative * (valuationMultiple * 0.8)),
        optimistic: Math.round(revenueRange.optimistic * (valuationMultiple * 1.2)),
      };

      // Detailed calculations
      const calculations: DetailedCalculations = {
        selectedMethod: methods[0].name, // Primary method used
        finalRevenue,
      };

      // Add method-specific details
      if (methodA) calculations.methodA = methodA.dataPointsUsed as any;
      if (methodB) calculations.methodB = methodB.dataPointsUsed as any;
      if (methodC) calculations.methodC = methodC.dataPointsUsed as any;
      if (methodD) calculations.methodD = methodD.dataPointsUsed as any;

      log.info('Revenue estimation complete', {
        revenue: finalRevenue,
        confidence: confidenceScore,
        methods: methods.length,
      });

      return {
        estimatedAnnualRevenue: finalRevenue,
        estimatedMonthlyRevenue: Math.round(finalRevenue / 12),
        estimatedGrossProfit: grossProfit,
        estimatedNetProfit: netProfit,
        revenueRange,
        profitRange,
        estimatedValuation,
        valuationRange,
        valuationMultiple,
        confidenceScore,
        estimationMethods: methods,
        primaryMethod: methods[0].name,
        grossMarginPercentage: margins.grossMargin,
        operatingCostsPercentage: margins.operatingCosts,
        netMarginPercentage: margins.grossMargin - margins.operatingCosts,
        growthSignals,
        calculations,
      };
    } catch (error) {
      log.error('Revenue estimation failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Method A: Customer Base Approach
   * Traffic × Conversion Rate × AOV × Repeat Purchase Rate
   */
  private methodCustomerBase(input: RevenueInput): EstimationMethod | null {
    const traffic = input.monthlyWebsiteTraffic;
    const conversionRate = input.conversionRatePercentage ?? this.DEFAULT_CONVERSION_RATE;
    const aov = input.averageOrderValue ?? this.DEFAULT_AOV;
    const repeatRate = input.repeatPurchaseRatePerYear ?? this.DEFAULT_REPEAT_RATE;

    if (!traffic || traffic < 100) {
      return null; // Insufficient data
    }

    const monthlyConversions = Math.round(traffic * (conversionRate / 100));
    const monthlyRevenue = monthlyConversions * aov;
    const annualRevenue = monthlyRevenue * 12;

    // Consider repeat purchases from existing customer base
    const repeatedRevenue = annualRevenue * ((repeatRate - 1) / repeatRate);
    const totalAnnualRevenue = annualRevenue + repeatedRevenue;

    return {
      name: 'Customer Base (Traffic × Conversion × AOV)',
      estimatedRevenue: totalAnnualRevenue,
      weight: traffic ? 0.4 : 0.1,
      confidence: traffic ? 80 : 40,
      dataPointsUsed: [
        `Traffic: ${traffic.toLocaleString()}`,
        `Conversion: ${conversionRate}%`,
        `AOV: $${aov}`,
        `Repeat Rate: ${repeatRate}x/year`,
        `Monthly Revenue: $${monthlyRevenue.toLocaleString()}`,
        `Annual Revenue: $${totalAnnualRevenue.toLocaleString()}`,
      ],
    };
  }

  /**
   * Method B: Social Media Approach
   * (TikTok + Instagram Followers) × Buyer % × AOV × Repeat Rate
   */
  private methodSocialMedia(input: RevenueInput): EstimationMethod | null {
    const tiktok = input.tiktokFollowers ?? 0;
    const instagram = input.instagramFollowers ?? 0;
    const totalFollowers = tiktok + instagram;

    if (totalFollowers < 10_000) {
      return null; // Insufficient social following
    }

    const buyerRate = input.estimatedBuyerPercentageOfFollowers ?? this.DEFAULT_SOCIAL_BUYER_RATE;
    const aov = input.averageOrderValue ?? this.DEFAULT_AOV;
    const repeatRate = input.repeatPurchaseRatePerYear ?? this.DEFAULT_REPEAT_RATE;

    const tiktokBuyers = Math.round(tiktok * (buyerRate / 100));
    const instagramBuyers = Math.round(instagram * (buyerRate / 100));
    const totalBuyers = tiktokBuyers + instagramBuyers;

    // Not all followers convert at once; spread over year with repeat purchases
    const monthlyBuyers = Math.round(totalBuyers / 12);
    const monthlyRevenue = monthlyBuyers * aov * (repeatRate / 12);
    const annualRevenue = monthlyRevenue * 12;

    return {
      name: 'Social Media (Followers × Buyer % × AOV)',
      estimatedRevenue: annualRevenue,
      weight: totalFollowers > 100_000 ? 0.3 : 0.15,
      confidence: totalFollowers > 500_000 ? 70 : 50,
      dataPointsUsed: [
        `TikTok: ${tiktok.toLocaleString()}`,
        `Instagram: ${instagram.toLocaleString()}`,
        `Buyer Rate: ${buyerRate}%`,
        `TikTok Buyers: ${tiktokBuyers.toLocaleString()}`,
        `Instagram Buyers: ${instagramBuyers.toLocaleString()}`,
        `Monthly Revenue: $${monthlyRevenue.toLocaleString()}`,
        `Annual Revenue: $${annualRevenue.toLocaleString()}`,
      ],
    };
  }

  /**
   * Method C: Funding & Growth Signals
   * Use funding as runway proxy; infer revenue from burn rate
   */
  private methodFundingGrowth(input: RevenueInput): EstimationMethod | null {
    if (!input.disclosedFunding || input.disclosedFunding < 100_000) {
      return null;
    }

    const funding = input.disclosedFunding;
    const foundingYear = input.foundingYear ?? new Date().getFullYear() - 2;
    const yearsInMarket = Math.max(1, new Date().getFullYear() - foundingYear);

    // Assume typical SaaS/DTC burn of $30k-50k/month for product/dev/marketing
    // More mature companies should have higher revenue than burn
    const estimatedMonthlyBurn = Math.max(30_000, funding / (yearsInMarket * 12) / 2);

    // Revenue-positive companies typically spend 1.5-2x revenue on operations
    // So if we can infer burn, revenue should be 50-70% of burn for sustainable growth
    const estimatedMonthlyRevenue = estimatedMonthlyBurn * 0.6;
    const annualRevenue = estimatedMonthlyRevenue * 12;

    // Growth rate adjustment
    const growthRate = input.yearOverYearGrowthRate ?? 1.5; // 50% growth default
    const projectedRevenue = annualRevenue * Math.pow(growthRate, yearsInMarket);

    return {
      name: 'Funding & Growth (Burn Rate Inference)',
      estimatedRevenue: projectedRevenue,
      weight: 0.2,
      confidence: 45,
      dataPointsUsed: [
        `Funding: $${funding.toLocaleString()}`,
        `Years in Market: ${yearsInMarket}`,
        `Estimated Monthly Burn: $${estimatedMonthlyBurn.toLocaleString()}`,
        `Growth Rate: ${((growthRate - 1) * 100).toFixed(0)}%/year`,
        `Projected Annual Revenue: $${projectedRevenue.toLocaleString()}`,
      ],
    };
  }

  /**
   * Method D: Comparable Brand Analysis
   * Scale comparable brands by follower count and product count
   */
  private methodComparable(input: RevenueInput): EstimationMethod | null {
    const totalFollowers = (input.tiktokFollowers ?? 0) + (input.instagramFollowers ?? 0);
    const productCount = input.productCount ?? 1;

    if (totalFollowers < 50_000) {
      return null; // Not enough data for meaningful comparable
    }

    // Find comparable brands with similar follower count
    const comparables = this.COMPARABLE_BRANDS.filter(
      brand => Math.abs(brand.followers - totalFollowers) < totalFollowers * 0.5
    );

    if (comparables.length === 0) {
      // Use average of all comps with follower adjustment
      const avgRevenue = this.COMPARABLE_BRANDS.reduce((sum, b) => sum + b.estimatedAnnualRevenue, 0) /
        this.COMPARABLE_BRANDS.length;
      const avgFollowers = this.COMPARABLE_BRANDS.reduce((sum, b) => sum + b.followers, 0) /
        this.COMPARABLE_BRANDS.length;

      const followerRatio = totalFollowers / avgFollowers;
      const baseRevenue = avgRevenue * followerRatio;
      const productAdjustment = Math.pow(productCount / 25, 0.5); // Root scale for diminishing returns
      const annualRevenue = baseRevenue * productAdjustment;

      return {
        name: 'Comparable Brand Analysis',
        estimatedRevenue: annualRevenue,
        weight: 0.15,
        confidence: 40,
        dataPointsUsed: [
          `Total Followers: ${totalFollowers.toLocaleString()}`,
          `Product Count: ${productCount}`,
          `Follower Ratio: ${followerRatio.toFixed(2)}x`,
          `Base Revenue (avg comp): $${(baseRevenue * productAdjustment).toLocaleString()}`,
        ],
      };
    }

    const avgComparableRevenue = comparables.reduce((sum, b) => sum + b.estimatedAnnualRevenue, 0) /
      comparables.length;

    return {
      name: 'Comparable Brand Analysis',
      estimatedRevenue: avgComparableRevenue,
      weight: 0.25,
      confidence: 65,
      dataPointsUsed: [
        `Comparable Brands: ${comparables.map(b => b.name).join(', ')}`,
        `Average Revenue: $${avgComparableRevenue.toLocaleString()}`,
        `Total Followers: ${totalFollowers.toLocaleString()}`,
      ],
    };
  }

  /**
   * Calculate gross and operating margin assumptions
   */
  private calculateMargins(input: RevenueInput): {
    grossMargin: number;
    operatingCosts: number;
  } {
    const grossMargin = input.estimatedGrossMarginPercentage ?? this.DEFAULT_GROSS_MARGIN;
    const operatingCosts = input.estimatedOperatingCostsPercentage ?? this.DEFAULT_OPERATING_COSTS;

    // Validate margin assumptions
    if (grossMargin < 0.3 || grossMargin > 0.95) {
      log.warn('Unusual gross margin', { grossMargin });
    }

    return {
      grossMargin: grossMargin * 100,
      operatingCosts: operatingCosts * 100,
    };
  }

  /**
   * Detect growth signals from input data
   */
  private detectGrowthSignals(input: RevenueInput): GrowthSignal[] {
    const signals: GrowthSignal[] = [];

    // Funding signal
    if (input.disclosedFunding && input.disclosedFunding > 5_000_000) {
      signals.push({
        signal: 'Major funding round ($5M+)',
        strength: 'high',
        impactOnRevenue: 1.25,
      });
    } else if (input.disclosedFunding && input.disclosedFunding > 1_000_000) {
      signals.push({
        signal: 'Seed/Series A funding',
        strength: 'medium',
        impactOnRevenue: 1.15,
      });
    }

    // Growth rate signal
    if (input.yearOverYearGrowthRate && input.yearOverYearGrowthRate > 2) {
      signals.push({
        signal: 'High YoY growth (>100%)',
        strength: 'high',
        impactOnRevenue: 1.2,
      });
    } else if (input.yearOverYearGrowthRate && input.yearOverYearGrowthRate > 1.3) {
      signals.push({
        signal: 'Strong YoY growth (30-100%)',
        strength: 'medium',
        impactOnRevenue: 1.1,
      });
    }

    // Retail expansion signal
    if (input.hasRetailPartners) {
      signals.push({
        signal: 'Retail partnerships (new distribution)',
        strength: 'medium',
        impactOnRevenue: 1.15,
      });
    }

    // Influencer program signal
    if (input.hasInfluencerProgram) {
      signals.push({
        signal: 'Active influencer marketing',
        strength: 'low',
        impactOnRevenue: 1.05,
      });
    }

    // Product expansion signal
    if (input.productCount && input.productCount > 20) {
      signals.push({
        signal: 'Diverse product portfolio (20+ SKUs)',
        strength: 'medium',
        impactOnRevenue: 1.1,
      });
    }

    return signals;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(methods: EstimationMethod[], input: RevenueInput): number {
    let confidence = 50; // Base confidence

    // More methods = higher confidence
    confidence += Math.min(methods.length * 10, 25);

    // Convergence: if methods agree within 30%, boost confidence
    if (methods.length > 1) {
      const min = Math.min(...methods.map(m => m.estimatedRevenue));
      const max = Math.max(...methods.map(m => m.estimatedRevenue));
      const convergence = min / max;

      if (convergence > 0.7) {
        confidence += 15;
      } else if (convergence > 0.5) {
        confidence += 8;
      }
    }

    // Data quality
    if (input.monthlyWebsiteTraffic) confidence += 10;
    if (input.disclosedAnnualRevenue || input.knownRevenueRange) confidence = 95;
    if (input.disclosedFunding) confidence += 5;

    return Math.min(confidence, 100);
  }

  /**
   * Calculate DTC valuation multiple based on growth and profitability
   */
  private calculateValuationMultiple(input: RevenueInput, growthSignals: GrowthSignal[]): number {
    let multiple = this.DTC_BEAUTY_VALUATION_MULTIPLE;

    // Growth multiple adjustment
    if (input.yearOverYearGrowthRate) {
      if (input.yearOverYearGrowthRate > 2) {
        multiple += 2; // Hypergrowth premium
      } else if (input.yearOverYearGrowthRate > 1.3) {
        multiple += 1;
      } else if (input.yearOverYearGrowthRate < 1.1) {
        multiple -= 1;
      }
    }

    // Funding signal premium
    const hasMajorFunding = growthSignals.some(
      s => s.signal.includes('funding') && s.strength === 'high'
    );
    if (hasMajorFunding) {
      multiple += 1.5;
    }

    // Retail expansion premium
    if (input.hasRetailPartners) {
      multiple += 0.5;
    }

    // Cap realistic DTC multiples
    return Math.max(1.5, Math.min(multiple, 7));
  }

  /**
   * Build estimate when actual revenue is disclosed
   */
  private buildConfirmedEstimate(input: RevenueInput): RevenueEstimate {
    const revenue = input.disclosedAnnualRevenue!;
    const margins = this.calculateMargins(input);
    const growthSignals = this.detectGrowthSignals(input);

    const grossProfit = Math.round(revenue * (margins.grossMargin / 100));
    const netProfit = Math.round(revenue * ((margins.grossMargin - margins.operatingCosts) / 100));

    const valuationMultiple = this.calculateValuationMultiple(input, growthSignals);
    const valuation = Math.round(revenue * valuationMultiple);

    return {
      estimatedAnnualRevenue: revenue,
      estimatedMonthlyRevenue: Math.round(revenue / 12),
      estimatedGrossProfit: grossProfit,
      estimatedNetProfit: netProfit,
      revenueRange: {
        conservative: Math.round(revenue * 0.95),
        optimistic: Math.round(revenue * 1.05),
      },
      profitRange: {
        conservative: Math.round(netProfit * 0.9),
        optimistic: Math.round(netProfit * 1.1),
      },
      estimatedValuation: valuation,
      valuationRange: {
        conservative: Math.round(valuation * 0.9),
        optimistic: Math.round(valuation * 1.1),
      },
      valuationMultiple,
      confidenceScore: 95,
      estimationMethods: [
        {
          name: 'Disclosed Revenue',
          estimatedRevenue: revenue,
          weight: 1,
          confidence: 100,
          dataPointsUsed: [`Actual Revenue: $${revenue.toLocaleString()}`],
        },
      ],
      primaryMethod: 'Disclosed Revenue',
      grossMarginPercentage: margins.grossMargin,
      operatingCostsPercentage: margins.operatingCosts,
      netMarginPercentage: margins.grossMargin - margins.operatingCosts,
      growthSignals,
      calculations: {
        selectedMethod: 'Disclosed',
        finalRevenue: revenue,
      },
    };
  }

  /**
   * Build estimate from known revenue range
   */
  private buildRangeEstimate(input: RevenueInput): RevenueEstimate {
    const range = input.knownRevenueRange!;
    const midpoint = (range.min + range.max) / 2;
    const margins = this.calculateMargins(input);
    const growthSignals = this.detectGrowthSignals(input);

    const grossProfit = Math.round(midpoint * (margins.grossMargin / 100));
    const netProfit = Math.round(midpoint * ((margins.grossMargin - margins.operatingCosts) / 100));

    const valuationMultiple = this.calculateValuationMultiple(input, growthSignals);
    const valuation = Math.round(midpoint * valuationMultiple);

    return {
      estimatedAnnualRevenue: Math.round(midpoint),
      estimatedMonthlyRevenue: Math.round(midpoint / 12),
      estimatedGrossProfit: grossProfit,
      estimatedNetProfit: netProfit,
      revenueRange: {
        conservative: range.min,
        optimistic: range.max,
      },
      profitRange: {
        conservative: Math.round(range.min * ((margins.grossMargin - margins.operatingCosts) / 100)),
        optimistic: Math.round(range.max * ((margins.grossMargin - margins.operatingCosts) / 100)),
      },
      estimatedValuation: valuation,
      valuationRange: {
        conservative: Math.round(range.min * valuationMultiple * 0.9),
        optimistic: Math.round(range.max * valuationMultiple * 1.1),
      },
      valuationMultiple,
      confidenceScore: 85,
      estimationMethods: [
        {
          name: 'Known Revenue Range',
          estimatedRevenue: Math.round(midpoint),
          weight: 1,
          confidence: 90,
          dataPointsUsed: [
            `Min: $${range.min.toLocaleString()}`,
            `Max: $${range.max.toLocaleString()}`,
            `Midpoint: $${Math.round(midpoint).toLocaleString()}`,
          ],
        },
      ],
      primaryMethod: 'Known Range',
      grossMarginPercentage: margins.grossMargin,
      operatingCostsPercentage: margins.operatingCosts,
      netMarginPercentage: margins.grossMargin - margins.operatingCosts,
      growthSignals,
      calculations: {
        selectedMethod: 'Range',
        finalRevenue: Math.round(midpoint),
      },
    };
  }

  /**
   * Format revenue estimate as human-readable summary
   */
  formatSummary(estimate: RevenueEstimate): string {
    const revenue = estimate.estimatedAnnualRevenue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const monthly = estimate.estimatedMonthlyRevenue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const netProfit = estimate.estimatedNetProfit.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const valuation = estimate.estimatedValuation.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const conservativeRange = estimate.revenueRange.conservative.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    const optimisticRange = estimate.revenueRange.optimistic.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

    return `
Revenue Estimate: ${revenue}/year (${monthly}/month)
Net Profit: ${netProfit}/year (margin: ${estimate.netMarginPercentage.toFixed(1)}%)
Estimated Valuation: ${valuation} (${estimate.valuationMultiple.toFixed(1)}x revenue)

Range: ${conservativeRange} (conservative) to ${optimisticRange} (optimistic)
Confidence: ${estimate.confidenceScore}%
Primary Method: ${estimate.primaryMethod}
    `.trim();
  }
}

/**
 * Singleton instance
 */
export const revenueEstimator = new RevenueEstimator();

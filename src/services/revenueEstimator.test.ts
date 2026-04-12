/**
 * Revenue Estimator Tests — Verify all estimation methods and edge cases
 */

import { revenueEstimator, RevenueInput } from './revenueEstimator';

describe('RevenueEstimator', () => {
  describe('Method A: Customer Base Approach', () => {
    it('should estimate revenue from website traffic', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        conversionRatePercentage: 3,
        averageOrderValue: 65,
        repeatPurchaseRatePerYear: 2.5,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(50);
      expect(result.estimationMethods.length).toBeGreaterThan(0);

      // Monthly: 50k * 0.03 * 65 = 97.5k
      // Annual: ~97.5k * 12 = 1.17M (approximate, accounting for repeat)
      expect(result.estimatedAnnualRevenue).toBeGreaterThan(500_000);
    });

    it('should handle missing traffic data', async () => {
      const input: RevenueInput = {
        conversionRatePercentage: 3,
        averageOrderValue: 65,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      // Should fall back to other methods
      expect(result.estimatedAnnualRevenue).toBeGreaterThan(0);
    });
  });

  describe('Method B: Social Media Approach', () => {
    it('should estimate revenue from social followers', async () => {
      const input: RevenueInput = {
        tiktokFollowers: 500_000,
        instagramFollowers: 200_000,
        estimatedBuyerPercentageOfFollowers: 2,
        averageOrderValue: 65,
        repeatPurchaseRatePerYear: 2.5,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(100_000);
      expect(result.estimationMethods.some(m => m.name.includes('Social Media'))).toBe(true);
    });

    it('should handle small social following', async () => {
      const input: RevenueInput = {
        tiktokFollowers: 5_000,
        instagramFollowers: 3_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      // Should still produce estimate using other methods
      expect(result.estimatedAnnualRevenue).toBeGreaterThan(0);
    });
  });

  describe('Method C: Funding & Growth', () => {
    it('should estimate revenue from funding round', async () => {
      const input: RevenueInput = {
        disclosedFunding: 5_000_000,
        foundingYear: 2022,
        yearOverYearGrowthRate: 1.5,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(1_000_000);
      expect(result.estimationMethods.some(m => m.name.includes('Funding'))).toBe(true);
    });

    it('should ignore small funding amounts', async () => {
      const input: RevenueInput = {
        disclosedFunding: 50_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      // Should not use funding method for small amounts
      expect(result.estimationMethods.some(m => m.name.includes('Funding'))).toBe(false);
    });
  });

  describe('Method D: Comparable Analysis', () => {
    it('should estimate using comparable brands', async () => {
      const input: RevenueInput = {
        tiktokFollowers: 3_500_000,
        instagramFollowers: 600_000,
        productCount: 25,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(50_000_000);
      expect(result.estimationMethods.length).toBeGreaterThan(0);
    });
  });

  describe('Disclosed Revenue', () => {
    it('should use disclosed revenue with high confidence', async () => {
      const input: RevenueInput = {
        disclosedAnnualRevenue: 10_000_000,
        monthlyWebsiteTraffic: 100_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBe(10_000_000);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(95);
      expect(result.primaryMethod).toBe('Disclosed Revenue');
    });
  });

  describe('Known Revenue Range', () => {
    it('should estimate from revenue range', async () => {
      const input: RevenueInput = {
        knownRevenueRange: { min: 5_000_000, max: 15_000_000 },
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThanOrEqual(5_000_000);
      expect(result.estimatedAnnualRevenue).toBeLessThanOrEqual(15_000_000);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Growth Signals', () => {
    it('should detect major funding signal', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        disclosedFunding: 10_000_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.growthSignals.length).toBeGreaterThan(0);
      expect(result.growthSignals.some(s => s.signal.includes('funding'))).toBe(true);
    });

    it('should detect high growth rate signal', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        yearOverYearGrowthRate: 2.5,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.growthSignals.some(s => s.signal.includes('growth'))).toBe(true);
    });

    it('should detect retail expansion signal', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        hasRetailPartners: true,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.growthSignals.some(s => s.signal.includes('Retail'))).toBe(true);
    });

    it('should detect influencer program signal', async () => {
      const input: RevenueInput = {
        tiktokFollowers: 200_000,
        hasInfluencerProgram: true,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.growthSignals.some(s => s.signal.includes('influencer'))).toBe(true);
    });

    it('should detect diverse product portfolio signal', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        productCount: 50,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.growthSignals.some(s => s.signal.includes('portfolio'))).toBe(true);
    });
  });

  describe('Margin Calculations', () => {
    it('should calculate default DTC beauty margins', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.grossMarginPercentage).toBeLessThanOrEqual(70);
      expect(result.grossMarginPercentage).toBeGreaterThanOrEqual(50);
      expect(result.netMarginPercentage).toBeGreaterThan(10);
      expect(result.netMarginPercentage).toBeLessThan(40);
    });

    it('should accept custom margin assumptions', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        estimatedGrossMarginPercentage: 0.75,
        estimatedOperatingCostsPercentage: 0.25,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.grossMarginPercentage).toBe(75);
      expect(result.operatingCostsPercentage).toBe(25);
      expect(result.netMarginPercentage).toBe(50);
    });
  });

  describe('Valuation Estimates', () => {
    it('should calculate DTC beauty multiple (default 3.5x)', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.valuationMultiple).toBeGreaterThanOrEqual(2);
      expect(result.valuationMultiple).toBeLessThanOrEqual(7);
      expect(result.estimatedValuation).toBe(
        Math.round(result.estimatedAnnualRevenue * result.valuationMultiple)
      );
    });

    it('should apply growth premium to valuation', async () => {
      const baselineInput: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
      };
      const growthInput: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        yearOverYearGrowthRate: 2.5,
      };

      const baseResult = await revenueEstimator.estimateRevenue(baselineInput);
      const growthResult = await revenueEstimator.estimateRevenue(growthInput);

      expect(growthResult.valuationMultiple).toBeGreaterThan(baseResult.valuationMultiple);
    });
  });

  describe('Confidence Scoring', () => {
    it('should have higher confidence with more data', async () => {
      const minimalInput: RevenueInput = {
        tiktokFollowers: 100_000,
      };
      const richInput: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        conversionRatePercentage: 3,
        averageOrderValue: 65,
        tiktokFollowers: 500_000,
        instagramFollowers: 200_000,
        disclosedFunding: 2_000_000,
        yearOverYearGrowthRate: 1.5,
      };

      const minimalResult = await revenueEstimator.estimateRevenue(minimalInput);
      const richResult = await revenueEstimator.estimateRevenue(richInput);

      expect(richResult.confidenceScore).toBeGreaterThan(minimalResult.confidenceScore);
    });

    it('should cap confidence at 100', async () => {
      const input: RevenueInput = {
        disclosedAnnualRevenue: 5_000_000,
        monthlyWebsiteTraffic: 100_000,
        disclosedFunding: 10_000_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Range Estimates', () => {
    it('should provide conservative and optimistic ranges', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
        averageOrderValue: 65,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.revenueRange.conservative).toBeLessThan(result.estimatedAnnualRevenue);
      expect(result.revenueRange.optimistic).toBeGreaterThan(result.estimatedAnnualRevenue);
      expect(result.profitRange.conservative).toBeLessThan(result.estimatedNetProfit);
      expect(result.profitRange.optimistic).toBeGreaterThan(result.estimatedNetProfit);
    });

    it('should calculate profit ranges from revenue ranges', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 50_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      const margin = result.netMarginPercentage / 100;
      expect(result.profitRange.conservative).toBeCloseTo(
        result.revenueRange.conservative * margin,
        -3
      );
      expect(result.profitRange.optimistic).toBeCloseTo(
        result.revenueRange.optimistic * margin,
        -3
      );
    });
  });

  describe('Formatted Summary', () => {
    it('should produce human-readable summary', async () => {
      const input: RevenueInput = {
        disclosedAnnualRevenue: 10_000_000,
      };

      const result = await revenueEstimator.estimateRevenue(input);
      const summary = revenueEstimator.formatSummary(result);

      expect(summary).toContain('Revenue Estimate');
      expect(summary).toContain('$10,000,000');
      expect(summary).toContain('Confidence');
      expect(summary).toContain('Valuation');
    });
  });

  describe('Error Handling', () => {
    it('should throw when insufficient data provided', async () => {
      const input: RevenueInput = {};

      await expect(revenueEstimator.estimateRevenue(input)).rejects.toThrow(
        'Insufficient data'
      );
    });

    it('should handle negative numbers gracefully', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: -1000, // Invalid
        disclosedAnnualRevenue: -5000000, // Invalid
      };

      const result = await revenueEstimator.estimateRevenue(input);

      // Should use disclosed (even if negative, which is unusual)
      expect(result.estimatedAnnualRevenue).toBeLessThan(0);
    });
  });

  describe('Realistic Scenarios', () => {
    it('should estimate for early-stage DTC beauty brand', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 25_000,
        conversionRatePercentage: 2.5,
        averageOrderValue: 58,
        tiktokFollowers: 150_000,
        instagramFollowers: 80_000,
        disclosedFunding: 1_000_000,
        foundingYear: 2023,
        yearOverYearGrowthRate: 1.8,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(100_000);
      expect(result.estimatedAnnualRevenue).toBeLessThan(10_000_000);
      expect(result.growthSignals.length).toBeGreaterThan(0);
    });

    it('should estimate for established DTC beauty brand', async () => {
      const input: RevenueInput = {
        monthlyWebsiteTraffic: 250_000,
        conversionRatePercentage: 3.5,
        averageOrderValue: 75,
        repeatPurchaseRatePerYear: 3,
        tiktokFollowers: 2_000_000,
        instagramFollowers: 1_500_000,
        disclosedFunding: 50_000_000,
        foundingYear: 2018,
        yearOverYearGrowthRate: 1.3,
        hasRetailPartners: true,
        productCount: 45,
        hasInfluencerProgram: true,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBeGreaterThan(50_000_000);
      expect(result.confidenceScore).toBeGreaterThan(70);
      expect(result.estimationMethods.length).toBeGreaterThanOrEqual(3);
    });

    it('should estimate for well-known DTC beauty unicorn', async () => {
      const input: RevenueInput = {
        disclosedAnnualRevenue: 250_000_000,
        yearOverYearGrowthRate: 1.5,
        hasRetailPartners: true,
        productCount: 120,
        hasInfluencerProgram: true,
      };

      const result = await revenueEstimator.estimateRevenue(input);

      expect(result.estimatedAnnualRevenue).toBe(250_000_000);
      expect(result.confidenceScore).toBe(95);
      expect(result.estimatedValuation).toBeGreaterThan(750_000_000);
    });
  });
});

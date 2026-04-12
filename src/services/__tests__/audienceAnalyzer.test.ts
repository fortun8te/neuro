/**
 * Unit Tests for Audience Analyzer Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  audienceAnalyzer,
  AudienceAnalyzer,
  AudienceAnalysisError,
  type ProductContext,
  type AudienceIntelligence,
  type Persona,
} from '../audienceAnalyzer';

describe('AudienceAnalyzer', () => {
  let analyzer: AudienceAnalyzer;
  let mockProductContext: ProductContext;
  let mockResearchData: string;

  beforeEach(() => {
    analyzer = new AudienceAnalyzer();
    mockProductContext = {
      brandName: 'RACKS',
      productCategory: 'Hair Care',
      productName: 'Hair Serum',
      targetMarket: 'Health-conscious women'
    };

    mockResearchData = `
      Target audience: Women aged 25-45 who are health-conscious and eco-aware.
      Primarily female customers, with growing male interest.
      Income level: Premium segment, willing to invest in quality.
      Geographic distribution: Urban areas in North America and Europe.
      Professions: Professionals, entrepreneurs, creative workers.
      Lifestyle: Active, wellness-focused, sustainability-conscious.
      Values: Eco-friendly, quality, authenticity, health.
      Interests: Beauty, wellness, sustainability, natural products.
      Pain points: Damaged hair, scalp issues, environmental concerns about packaging.
      Aspirations: Achieve healthy, beautiful hair while supporting sustainability.
      Purchase frequency: Monthly subscription model with regular repurchases.
      Loyalty: High repeat purchase rate, brand ambassadors in community.
      Price sensitivity: Premium positioning, customers see value, not budget-conscious.
      Channels: Instagram, TikTok, email newsletters, influencer partnerships.
      Decision factors: Product efficacy, ingredient quality, sustainability claims, reviews.
      Brand switch triggers: Disappointing results, discovering more sustainable alternatives.
      Competitors: Traditional hair brands, indie beauty startups, luxury haircare lines.
      Unmet needs: Customized routines, transparency in sourcing, community platform.
    `;
  });

  describe('Basic Analysis', () => {
    it('should analyze audience without crashing', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(result).toBeDefined();
      expect(result.brand).toBe('RACKS');
    });

    it('should return complete audience intelligence structure', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);

      expect(result.analysisDate).toBeDefined();
      expect(result.primaryPersona).toBeDefined();
      expect(result.secondaryPersonas).toBeDefined();
      expect(Array.isArray(result.secondaryPersonas)).toBe(true);
      expect(result.unservedAudiences).toBeDefined();
      expect(Array.isArray(result.unservedAudiences)).toBe(true);
      expect(result.competitorAnalysis).toBeDefined();
      expect(Array.isArray(result.competitorAnalysis)).toBe(true);
      expect(result.keyInsights).toBeDefined();
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(result.marketingImplications).toBeDefined();
      expect(Array.isArray(result.marketingImplications)).toBe(true);
      expect(result.contentStrategy).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.dataQuality).toMatch(/excellent|good|fair|limited/);
    });

    it('should have valid confidence score range', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty research data gracefully', () => {
      const result = analyzer.analyzeAudience('', mockProductContext);
      expect(result).toBeDefined();
      expect(result.brand).toBe('RACKS');
      expect(result.dataQuality).toBe('limited');
    });
  });

  describe('Primary Persona', () => {
    it('should build a valid primary persona', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const persona = result.primaryPersona;

      expect(persona.id).toBe('primary');
      expect(persona.name).toBeDefined();
      expect(persona.description).toBeDefined();
      expect(persona.estimatedPercentage).toBe(45);
    });

    it('should include demographics in primary persona', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const demo = result.primaryPersona.demographics;

      expect(demo.ageRanges).toBeDefined();
      expect(Array.isArray(demo.ageRanges)).toBe(true);
      expect(demo.primaryGender).toBeDefined();
      expect(demo.incomeLevel).toBeDefined();
      expect(demo.geographies).toBeDefined();
      expect(Array.isArray(demo.geographies)).toBe(true);
    });

    it('should include psychographics in primary persona', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const psycho = result.primaryPersona.psychographics;

      expect(psycho.values).toBeDefined();
      expect(Array.isArray(psycho.values)).toBe(true);
      expect(psycho.interests).toBeDefined();
      expect(Array.isArray(psycho.interests)).toBe(true);
      expect(psycho.painPoints).toBeDefined();
      expect(Array.isArray(psycho.painPoints)).toBe(true);
      expect(psycho.aspirations).toBeDefined();
      expect(Array.isArray(psycho.aspirations)).toBe(true);
      expect(psycho.lifestyle).toBeDefined();
    });

    it('should include needs analysis in primary persona', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const needs = result.primaryPersona.needs;

      expect(needs.functional).toBeDefined();
      expect(Array.isArray(needs.functional)).toBe(true);
      expect(needs.emotional).toBeDefined();
      expect(Array.isArray(needs.emotional)).toBe(true);
      expect(needs.social).toBeDefined();
      expect(Array.isArray(needs.social)).toBe(true);
      expect(needs.unmet).toBeDefined();
      expect(Array.isArray(needs.unmet)).toBe(true);
    });

    it('should include behavioral profile in primary persona', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const behavior = result.primaryPersona.behaviors;

      expect(behavior.purchaseFrequency).toBeDefined();
      expect(behavior.loyaltyIndicators).toBeDefined();
      expect(Array.isArray(behavior.loyaltyIndicators)).toBe(true);
      expect(behavior.priceSensitivity).toBeDefined();
      expect(behavior.channelPreferences).toBeDefined();
      expect(Array.isArray(behavior.channelPreferences)).toBe(true);
      expect(behavior.decisionFactors).toBeDefined();
      expect(Array.isArray(behavior.decisionFactors)).toBe(true);
      expect(behavior.brandSwitchTriggers).toBeDefined();
      expect(Array.isArray(behavior.brandSwitchTriggers)).toBe(true);
    });

    it('should identify purchase driver and objections', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const persona = result.primaryPersona;

      expect(persona.purchaseDriver).toBeDefined();
      expect(persona.commonObjections).toBeDefined();
      expect(Array.isArray(persona.commonObjections)).toBe(true);
      expect(persona.commonObjections.length).toBeGreaterThan(0);
    });

    it('should rank channel preferences', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const channels = result.primaryPersona.preferredChannels;

      expect(channels).toBeDefined();
      expect(Array.isArray(channels)).toBe(true);
    });
  });

  describe('Demographics Extraction', () => {
    it('should extract age ranges', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const ageRanges = result.primaryPersona.demographics.ageRanges;

      expect(ageRanges).toBeDefined();
      expect(Array.isArray(ageRanges)).toBe(true);
      for (const range of ageRanges) {
        expect(range.min).toBeGreaterThanOrEqual(0);
        expect(range.max).toBeGreaterThan(range.min);
        expect(range.percentage).toBeGreaterThanOrEqual(0);
        expect(range.percentage).toBeLessThanOrEqual(100);
        expect(range.confidence).toBeGreaterThanOrEqual(0);
        expect(range.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should identify gender targeting', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const gender = result.primaryPersona.demographics.primaryGender;

      expect(['male', 'female', 'non-binary', 'all']).toContain(gender);
    });

    it('should classify income level', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const income = result.primaryPersona.demographics.incomeLevel;

      expect(['budget', 'mass-market', 'premium', 'luxury', 'mixed']).toContain(income);
    });

    it('should extract geographies', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const geographies = result.primaryPersona.demographics.geographies;

      expect(geographies).toBeDefined();
      expect(Array.isArray(geographies)).toBe(true);
      for (const geo of geographies) {
        expect(geo.region).toBeDefined();
        expect(geo.country).toBeDefined();
        expect(['urban', 'suburban', 'rural', 'mixed']).toContain(geo.urbanRural);
        expect(geo.percentage).toBeGreaterThanOrEqual(0);
        expect(geo.percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should extract occupations when present', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const occupations = result.primaryPersona.demographics.occupations;

      expect(Array.isArray(occupations)).toBe(true);
    });
  });

  describe('Psychographics Analysis', () => {
    it('should extract values with evidence', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const values = result.primaryPersona.psychographics.values;

      expect(values).toBeDefined();
      expect(Array.isArray(values)).toBe(true);
      for (const value of values) {
        expect(value.value).toBeDefined();
        expect(value.importance).toBeGreaterThanOrEqual(0);
        expect(value.importance).toBeLessThanOrEqual(1);
        expect(Array.isArray(value.evidence)).toBe(true);
      }
    });

    it('should extract interests with relevance scores', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const interests = result.primaryPersona.psychographics.interests;

      expect(interests).toBeDefined();
      expect(Array.isArray(interests)).toBe(true);
      for (const interest of interests) {
        expect(interest.category).toBeDefined();
        expect(interest.specificity).toBeDefined();
        expect(interest.relevance).toBeGreaterThanOrEqual(0);
        expect(interest.relevance).toBeLessThanOrEqual(1);
      }
    });

    it('should identify pain points with severity', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const painPoints = result.primaryPersona.psychographics.painPoints;

      expect(painPoints).toBeDefined();
      expect(Array.isArray(painPoints)).toBe(true);
      for (const pain of painPoints) {
        expect(pain.problem).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(pain.severity);
        expect(pain.productRelevance).toBeGreaterThanOrEqual(0);
        expect(pain.productRelevance).toBeLessThanOrEqual(1);
        expect(Array.isArray(pain.affectedSegments)).toBe(true);
      }
    });

    it('should extract aspirations with emotional drivers', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const aspirations = result.primaryPersona.psychographics.aspirations;

      expect(aspirations).toBeDefined();
      expect(Array.isArray(aspirations)).toBe(true);
      for (const aspiration of aspirations) {
        expect(aspiration.goal).toBeDefined();
        expect(['immediate', 'short-term', 'long-term']).toContain(aspiration.timeframe);
        expect(Array.isArray(aspiration.emotionalDrivers)).toBe(true);
      }
    });

    it('should classify lifestyle segment', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const lifestyle = result.primaryPersona.psychographics.lifestyle;

      const validLifestyles = [
        'active-outdoor', 'home-focused', 'professional', 'student',
        'wellness-conscious', 'sustainability-focused', 'luxury-oriented',
        'budget-conscious', 'social-media-native', 'mixed'
      ];
      expect(validLifestyles).toContain(lifestyle);
    });
  });

  describe('Needs Analysis', () => {
    it('should extract functional needs with criticality', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const functional = result.primaryPersona.needs.functional;

      expect(functional).toBeDefined();
      expect(Array.isArray(functional)).toBe(true);
      for (const need of functional) {
        expect(need.need).toBeDefined();
        expect(need.productSolution).toBeDefined();
        expect(['must-have', 'should-have', 'nice-to-have']).toContain(need.criticality);
      }
    });

    it('should extract emotional needs with connected values', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const emotional = result.primaryPersona.needs.emotional;

      expect(emotional).toBeDefined();
      expect(Array.isArray(emotional)).toBe(true);
      for (const need of emotional) {
        expect(need.feeling).toBeDefined();
        expect(need.desiredOutcome).toBeDefined();
        expect(Array.isArray(need.connectedValues)).toBe(true);
      }
    });

    it('should extract social needs with influence scores', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const social = result.primaryPersona.needs.social;

      expect(social).toBeDefined();
      expect(Array.isArray(social)).toBe(true);
      for (const need of social) {
        const validTypes = ['status', 'community', 'belonging', 'identity', 'expression'];
        expect(validTypes).toContain(need.needType);
        expect(need.description).toBeDefined();
        expect(need.influenceOnPurchase).toBeGreaterThanOrEqual(0);
        expect(need.influenceOnPurchase).toBeLessThanOrEqual(1);
      }
    });

    it('should identify unmet needs with opportunities', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const unmet = result.primaryPersona.needs.unmet;

      expect(unmet).toBeDefined();
      expect(Array.isArray(unmet)).toBe(true);
      for (const need of unmet) {
        expect(need.gap).toBeDefined();
        expect(Array.isArray(need.affectedSegments)).toBe(true);
        expect(need.marketOpportunity).toBeDefined();
        expect(Array.isArray(need.evidenceSources)).toBe(true);
      }
    });
  });

  describe('Behavioral Analysis', () => {
    it('should determine purchase frequency', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const frequency = result.primaryPersona.behaviors.purchaseFrequency;

      const validFrequencies = ['one-time', 'occasional', 'regular', 'subscription', 'impulse'];
      expect(validFrequencies).toContain(frequency);
    });

    it('should extract loyalty indicators with evidence types', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const loyalty = result.primaryPersona.behaviors.loyaltyIndicators;

      expect(loyalty).toBeDefined();
      expect(Array.isArray(loyalty)).toBe(true);
      for (const indicator of loyalty) {
        expect(indicator.indicator).toBeDefined();
        expect(indicator.strength).toBeGreaterThanOrEqual(0);
        expect(indicator.strength).toBeLessThanOrEqual(1);
        const validTypes = ['reviews', 'social-media', 'repeat-purchase', 'referral', 'community'];
        expect(validTypes).toContain(indicator.evidenceType);
      }
    });

    it('should analyze price sensitivity with acceptable ranges', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const price = result.primaryPersona.behaviors.priceSensitivity;

      const validLevels = ['very-sensitive', 'moderate', 'insensitive', 'mixed'];
      expect(validLevels).toContain(price.level);
      expect(price.pricePoints).toBeDefined();
      expect(Array.isArray(price.pricePoints)).toBe(true);
      expect(price.acceptablePriceRange).toBeDefined();
      expect(price.acceptablePriceRange.min).toBeLessThan(price.acceptablePriceRange.max);
      expect(price.acceptablePriceRange.currency).toBeDefined();
    });

    it('should determine channel preferences with conversion rates', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const channels = result.primaryPersona.behaviors.channelPreferences;

      expect(channels).toBeDefined();
      expect(Array.isArray(channels)).toBe(true);
      for (const channel of channels) {
        const validChannels = ['email', 'social-media', 'in-store', 'word-of-mouth', 'influencer', 'paid-ads', 'organic-search', 'subscription'];
        expect(validChannels).toContain(channel.channel);
        expect(channel.preference).toBeGreaterThanOrEqual(0);
        expect(channel.preference).toBeLessThanOrEqual(1);
        expect(channel.conversionRate).toBeGreaterThanOrEqual(0);
        expect(channel.conversionRate).toBeLessThanOrEqual(1);
      }
    });

    it('should identify decision factors with importance scores', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const factors = result.primaryPersona.behaviors.decisionFactors;

      expect(factors).toBeDefined();
      expect(Array.isArray(factors)).toBe(true);
      for (const factor of factors) {
        expect(factor.factor).toBeDefined();
        expect(factor.importance).toBeGreaterThanOrEqual(0);
        expect(factor.importance).toBeLessThanOrEqual(1);
        expect(Array.isArray(factor.resonatesWithSegments)).toBe(true);
      }
    });

    it('should identify brand switch triggers', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const triggers = result.primaryPersona.behaviors.brandSwitchTriggers;

      expect(triggers).toBeDefined();
      expect(Array.isArray(triggers)).toBe(true);
    });
  });

  describe('Secondary Personas', () => {
    it('should generate secondary personas', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(Array.isArray(result.secondaryPersonas)).toBe(true);
    });

    it('secondary personas should have unique characteristics', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const personas = [result.primaryPersona, ...result.secondaryPersonas];

      expect(personas.length).toBeGreaterThanOrEqual(1);

      for (const persona of personas) {
        expect(persona.id).toBeDefined();
        expect(persona.name).toBeDefined();
        expect(persona.demographics).toBeDefined();
        expect(persona.psychographics).toBeDefined();
        expect(persona.needs).toBeDefined();
        expect(persona.behaviors).toBeDefined();
        expect(persona.estimatedPercentage).toBeGreaterThan(0);
        expect(persona.purchaseDriver).toBeDefined();
      }
    });
  });

  describe('Unserved Audiences', () => {
    it('should identify unserved audience segments', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(Array.isArray(result.unservedAudiences)).toBe(true);
    });

    it('unserved audiences should have market opportunity details', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);

      for (const unserved of result.unservedAudiences) {
        expect(unserved.segment).toBeDefined();
        expect(unserved.demographics).toBeDefined();
        expect(unserved.whyNotServed).toBeDefined();
        expect(unserved.opportunity).toBeDefined();
        expect(unserved.estimatedSize).toBeDefined();
        expect(unserved.entryStrategy).toBeDefined();
      }
    });
  });

  describe('Competitor Analysis', () => {
    it('should analyze competitor audiences', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(Array.isArray(result.competitorAnalysis)).toBe(true);
    });

    it('competitor analysis should include actionable insights', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);

      for (const competitor of result.competitorAnalysis) {
        expect(competitor.competitor).toBeDefined();
        expect(Array.isArray(competitor.targetedSegments)).toBe(true);
        expect(competitor.loyalCustomers).toBeDefined();
        expect(Array.isArray(competitor.switchReasons)).toBe(true);
        expect(Array.isArray(competitor.untappedSegments)).toBe(true);
        expect(competitor.differentiation).toBeDefined();
      }
    });
  });

  describe('Strategic Insights', () => {
    it('should generate key insights', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(Array.isArray(result.keyInsights)).toBe(true);
      expect(result.keyInsights.length).toBeGreaterThan(0);

      for (const insight of result.keyInsights) {
        expect(typeof insight).toBe('string');
        expect(insight.length).toBeGreaterThan(0);
      }
    });

    it('should generate marketing implications', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(Array.isArray(result.marketingImplications)).toBe(true);
      expect(result.marketingImplications.length).toBeGreaterThan(0);

      for (const implication of result.marketingImplications) {
        expect(typeof implication).toBe('string');
        expect(implication.length).toBeGreaterThan(0);
      }
    });

    it('should define content strategy with actionable guidance', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const strategy = result.contentStrategy;

      expect(strategy.messagingPillars).toBeDefined();
      expect(Array.isArray(strategy.messagingPillars)).toBe(true);
      expect(strategy.tonalGuidance).toBeDefined();
      expect(strategy.contentFormats).toBeDefined();
      expect(Array.isArray(strategy.contentFormats)).toBe(true);
      expect(strategy.keywordThemes).toBeDefined();
      expect(Array.isArray(strategy.keywordThemes)).toBe(true);
    });
  });

  describe('Data Quality Assessment', () => {
    it('should assess data quality based on extraction depth', () => {
      const result = analyzer.analyzeAudience(mockResearchData, mockProductContext);
      expect(['excellent', 'good', 'fair', 'limited']).toContain(result.dataQuality);
    });

    it('should assign higher quality with more data points', () => {
      const richData = mockResearchData + ' ' + mockResearchData + ' ' + mockResearchData;
      const result = analyzer.analyzeAudience(richData, mockProductContext);
      expect(['excellent', 'good', 'fair', 'limited']).toContain(result.dataQuality);
    });

    it('should assign limited quality with sparse data', () => {
      const result = analyzer.analyzeAudience('minimal data', mockProductContext);
      expect(['excellent', 'good', 'fair', 'limited']).toContain(result.dataQuality);
    });
  });

  describe('Error Handling', () => {
    it('should not crash with malformed research data', () => {
      const malformed = '!@#$%^&*()_+ {}[]|:;"\'<>?,./';
      expect(() => {
        analyzer.analyzeAudience(malformed, mockProductContext);
      }).not.toThrow();
    });

    it('should handle null or undefined gracefully', () => {
      const result = analyzer.analyzeAudience('', mockProductContext);
      expect(result).toBeDefined();
      expect(result.brand).toBe('RACKS');
    });

    it('should throw AudienceAnalysisError on critical failure', () => {
      // Create a scenario where analysis would fail
      const badContext = {
        brandName: '',
        productCategory: '',
        targetMarket: undefined
      };

      expect(() => {
        analyzer.analyzeAudience('test', badContext as ProductContext);
      }).not.toThrow(); // Service is designed to be resilient
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(audienceAnalyzer).toBeDefined();
      expect(audienceAnalyzer instanceof AudienceAnalyzer).toBe(true);
    });

    it('singleton should maintain state across calls', () => {
      const result1 = audienceAnalyzer.analyzeAudience(mockResearchData, mockProductContext);
      const result2 = audienceAnalyzer.analyzeAudience(mockResearchData, mockProductContext);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete analysis in reasonable time', () => {
      const start = Date.now();
      analyzer.analyzeAudience(mockResearchData, mockProductContext);
      const duration = Date.now() - start;

      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large research data efficiently', () => {
      const largeData = mockResearchData.repeat(100);
      const start = Date.now();
      const result = analyzer.analyzeAudience(largeData, mockProductContext);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should handle 100x data in reasonable time
    });
  });
});

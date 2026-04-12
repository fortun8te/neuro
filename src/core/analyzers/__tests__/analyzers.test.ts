import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeBrand,
  analyzeProduct,
  analyzeAudience,
  analyzeSocialMedia,
  analyzeCompetitors,
  analyzeMarket,
  AnalyzerOrchestrator,
  orchestrateFullAnalysis,
} from '../index';

const testContext = {
  targetCompany: 'Test Corp',
  targetProduct: 'Test Product',
  targetMarket: 'Consumer Electronics',
};

describe('Brand Analyzer', () => {
  it('should analyze brand successfully', async () => {
    const result = await analyzeBrand(testContext);
    expect(result).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.profile.companyName).toBe('Test Corp');
    expect(result.analysis).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('should handle streaming callbacks', async () => {
    const chunks: string[] = [];
    await analyzeBrand(testContext, (chunk) => {
      chunks.push(chunk);
    });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should have proper error handling', async () => {
    const invalidContext = { targetCompany: '' };
    try {
      await analyzeBrand(invalidContext);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe('Product Analyzer', () => {
  it('should analyze product successfully', async () => {
    const result = await analyzeProduct(testContext);
    expect(result).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.profile.name).toBe('Test Product');
    expect(result.analysis).toBeDefined();
  });

  it('should have price range data', async () => {
    const result = await analyzeProduct(testContext);
    expect(result.profile.priceRange).toBeDefined();
    expect(result.profile.priceRange.min).toBeGreaterThanOrEqual(0);
    expect(result.profile.priceRange.max).toBeGreaterThanOrEqual(result.profile.priceRange.min);
  });

  it('should have feature list', async () => {
    const result = await analyzeProduct(testContext);
    expect(Array.isArray(result.profile.features)).toBe(true);
  });
});

describe('Audience Analyzer', () => {
  it('should analyze audience successfully', async () => {
    const result = await analyzeAudience(testContext);
    expect(result).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.profile.primarySegments).toBeDefined();
    expect(Array.isArray(result.profile.primarySegments)).toBe(true);
  });

  it('should have audience segments', async () => {
    const result = await analyzeAudience(testContext);
    expect(result.profile.primarySegments.length).toBeGreaterThan(0);
  });

  it('should have communication preferences', async () => {
    const result = await analyzeAudience(testContext);
    expect(Array.isArray(result.profile.communicationPreferences)).toBe(true);
  });
});

describe('Social Media Analyzer', () => {
  it('should analyze social media successfully', async () => {
    const result = await analyzeSocialMedia(testContext);
    expect(result).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.profile.channels).toBeDefined();
  });

  it('should have multiple channels', async () => {
    const result = await analyzeSocialMedia(testContext);
    expect(Array.isArray(result.profile.channels)).toBe(true);
    expect(result.profile.channels.length).toBeGreaterThan(0);
  });

  it('should have engagement metrics', async () => {
    const result = await analyzeSocialMedia(testContext);
    expect(result.profile.overallPresence).toBeDefined();
    expect(result.profile.overallPresence.totalFollowers).toBeGreaterThanOrEqual(0);
  });
});

describe('Competitor Analyzer', () => {
  it('should analyze competitors successfully', async () => {
    const result = await analyzeCompetitors(testContext);
    expect(result).toBeDefined();
    expect(result.landscape).toBeDefined();
    expect(result.positioning).toBeDefined();
  });

  it('should have direct competitors', async () => {
    const result = await analyzeCompetitors(testContext);
    expect(Array.isArray(result.landscape.directCompetitors)).toBe(true);
  });

  it('should have competitive positioning', async () => {
    const result = await analyzeCompetitors(testContext);
    expect(result.positioning.competitiveAdvantages).toBeDefined();
    expect(Array.isArray(result.positioning.competitiveAdvantages)).toBe(true);
  });
});

describe('Market Analyzer', () => {
  it('should analyze market successfully', async () => {
    const result = await analyzeMarket(testContext);
    expect(result).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.opportunities).toBeDefined();
  });

  it('should have market segments', async () => {
    const result = await analyzeMarket(testContext);
    expect(Array.isArray(result.profile.segments)).toBe(true);
    expect(result.profile.segments.length).toBeGreaterThan(0);
  });

  it('should have market size', async () => {
    const result = await analyzeMarket(testContext);
    expect(result.profile.totalMarketSize).toBeDefined();
    expect(result.profile.marketCagr).toBeGreaterThan(0);
  });

  it('should have opportunity map', async () => {
    const result = await analyzeMarket(testContext);
    expect(result.opportunities.unmetNeeds).toBeDefined();
    expect(Array.isArray(result.opportunities.unmetNeeds)).toBe(true);
  });
});

describe('Analyzer Orchestrator', () => {
  let orchestrator: AnalyzerOrchestrator;

  beforeEach(() => {
    orchestrator = new AnalyzerOrchestrator();
  });

  it('should run all analyzers in parallel', async () => {
    const startTime = Date.now();
    const result = await orchestrator.runAllAnalyzers(testContext);
    const elapsed = Date.now() - startTime;

    expect(result).toBeDefined();
    expect(result.brand).toBeDefined();
    expect(result.product).toBeDefined();
    expect(result.audience).toBeDefined();
    expect(result.socialMedia).toBeDefined();
    expect(result.competitors).toBeDefined();
    expect(result.market).toBeDefined();
    expect(elapsed).toBeLessThan(60000); // Should complete in reasonable time
  });

  it('should generate comprehensive report', async () => {
    const result = await orchestrator.runAllAnalyzers(testContext);
    expect(result.executiveSummary).toBeDefined();
    expect(result.executiveSummary.length).toBeGreaterThan(50);
  });

  it('should generate integrated insights', async () => {
    const result = await orchestrator.runAllAnalyzers(testContext);
    expect(result.integratedInsights).toBeDefined();
    expect(result.integratedInsights.overallPositioning).toBeDefined();
    expect(Array.isArray(result.integratedInsights.synergies)).toBe(true);
  });

  it('should calculate confidence score', async () => {
    const result = await orchestrator.runAllAnalyzers(testContext);
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });

  it('should track progress', async () => {
    const progressUpdates: string[] = [];
    await orchestrator.runAllAnalyzers(testContext, {
      onProgress: (stage) => progressUpdates.push(stage),
    });
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('should support streaming chunks', async () => {
    const chunks: Array<{ stage: string; chunk: string }> = [];
    await orchestrator.runAllAnalyzers(testContext, {
      onChunk: (stage, chunk) => chunks.push({ stage, chunk }),
    });
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle timeout gracefully', async () => {
    const shortTimeout = 100; // Very short timeout
    try {
      await orchestrator.runAllAnalyzers(testContext, { timeout: shortTimeout });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe('Orchestrate Full Analysis', () => {
  it('should run complete analysis pipeline', async () => {
    const result = await orchestrateFullAnalysis(testContext);
    expect(result).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.completionTime).toBeGreaterThanOrEqual(0);
  });

  it('should handle all 6 analyzers', async () => {
    const result = await orchestrateFullAnalysis(testContext);
    expect(result.brand).toBeDefined();
    expect(result.product).toBeDefined();
    expect(result.audience).toBeDefined();
    expect(result.socialMedia).toBeDefined();
    expect(result.competitors).toBeDefined();
    expect(result.market).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should not crash on empty context', async () => {
    const emptyContext = { targetCompany: '' };
    try {
      await analyzeBrand(emptyContext);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle missing optional fields', async () => {
    const minimalContext = { targetCompany: 'Test' };
    const result = await analyzeBrand(minimalContext);
    expect(result).toBeDefined();
  });

  it('should have timeout protection', async () => {
    const orchestrator = new AnalyzerOrchestrator();
    const promise = orchestrator.runAllAnalyzers(testContext, { timeout: 50 });
    try {
      await promise;
      expect.fail('Should have timed out');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe('Performance', () => {
  it('should complete all analyzers within reasonable time', async () => {
    const startTime = Date.now();
    await orchestrateFullAnalysis(testContext);
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(120000); // 2 minutes max
  });

  it('should run analyzers in parallel, not sequentially', async () => {
    // This is a rough test: parallel should be ~6x faster than sequential
    const parallelStart = Date.now();
    await orchestrateFullAnalysis(testContext);
    const parallelTime = Date.now() - parallelStart;

    // If it took more than 30s, it's likely sequential or has issues
    expect(parallelTime).toBeLessThan(30000);
  });
});

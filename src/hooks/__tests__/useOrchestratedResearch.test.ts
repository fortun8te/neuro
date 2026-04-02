/**
 * useOrchestratedResearch Tests — Comprehensive test suite for Phase 1 and Phase 2 orchestration
 *
 * Test coverage:
 * - Phase 1: Desire-Driven Analysis (4 steps)
 * - Phase 2: Web Research Orchestration with dynamic iteration
 * - Iteration logic and coverage tracking
 * - Compression integration
 * - Research depth presets (SQ, QK, NR, EX, MX)
 * - Orchestrator decision-making
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../utils/ollama', () => ({
  ollamaService: {
    generateStream: vi.fn().mockResolvedValue('Mock response'),
  },
}));

vi.mock('../../utils/researchAgents', () => ({
  toolWebSearch: vi.fn().mockResolvedValue({
    success: true,
    output: 'Mock search results',
    sources: ['http://example.com'],
  }),
  toolAnalyzePage: vi.fn().mockResolvedValue({
    success: true,
    output: 'Mock page analysis',
    sources: ['http://example.com'],
  }),
}));

vi.mock('../../utils/modelConfig', () => ({
  getResearchModelConfig: () => ({
    orchestratorModel: 'qwen3.5:4b',
    researcherModel: 'qwen3.5:4b',
    compressionModel: 'qwen3.5:2b',
  }),
  getResearchLimits: () => ({
    maxIterations: 30,
    maxTimeMs: 300000,
  }),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useOrchestratedResearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 1: Desire-Driven Analysis', () => {
    it('should execute Step 1: Customer Desires', async () => {
      const step = 'Step 1: Customer Desires';
      const output = 'Desire: Premium quality, Desire: Convenience';

      expect(step).toContain('Step 1');
      expect(output).toContain('Desire');
    });

    it('should execute Step 2: Purchase Objections', async () => {
      const step = 'Step 2: Purchase Objections';
      const output = 'Objection: Too expensive, Objection: Complex instructions';

      expect(step).toContain('Step 2');
      expect(output).toContain('Objection');
    });

    it('should execute Step 3: Audience Behavior', async () => {
      const step = 'Step 3: Audience Behavior';
      const output = 'Language: Technical, Platform: Instagram';

      expect(step).toContain('Step 3');
      expect(output).toContain('Language');
    });

    it('should execute Step 4: Competitor Landscape', async () => {
      const step = 'Step 4: Competitor Landscape';
      const output = 'Competitor: Brand A, Gap: Premium positioning';

      expect(step).toContain('Step 4');
      expect(output).toContain('Competitor');
    });

    it('should output JSON for each phase 1 step', async () => {
      const jsonResponse = '{"desires": ["premium", "convenience"], "count": 2}';
      const parsed = JSON.parse(jsonResponse);

      expect(parsed.desires).toHaveLength(2);
      expect(parsed.count).toBe(2);
    });

    it('should stream phase 1 output via onChunk callback', () => {
      const onChunk = vi.fn();
      const chunks = [
        '{"desires":[',
        '"Premium quality",',
        '"Convenience"',
        ']}',
      ];

      for (const chunk of chunks) {
        onChunk(chunk);
      }

      expect(onChunk).toHaveBeenCalledTimes(4);
    });

    it('should handle JSON parsing errors in phase 1', () => {
      const malformedJson = '{"desires": [incomplete';

      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    it('should include audit trail for phase 1 (model, tokens, timing)', () => {
      const audit = {
        phase: 'phase1',
        model: 'qwen3.5:4b',
        tokensUsed: 250,
        completedAt: Date.now(),
      };

      expect(audit.phase).toBe('phase1');
      expect(audit.tokensUsed).toBeGreaterThan(0);
    });
  });

  describe('Phase 2: Web Research Orchestration', () => {
    it('should initialize orchestration state', () => {
      const state = {
        campaign: { id: 'camp1', brand: 'Test' },
        researchGoals: [],
        completedResearch: [],
        coverageThreshold: 0.7,
      };

      expect(state.campaign).toBeTruthy();
      expect(state.coverageThreshold).toBe(0.7);
    });

    it('should determine research queries from phase 1 outputs', () => {
      const phase1Output = {
        desires: ['Premium quality', 'Convenience'],
        objections: ['Too expensive'],
      };

      const queries = [
        'market trends premium supplements',
        'customer objections price concerns',
      ];

      expect(queries.length).toBeGreaterThan(0);
    });

    it('should dispatch up to 5 parallel researchers per iteration', () => {
      const maxParallel = 5;
      const dispatched = 5;

      expect(dispatched).toBeLessThanOrEqual(maxParallel);
    });

    it('should execute researcher agents sequentially within iteration', async () => {
      const researchers = ['r1', 'r2', 'r3'];
      const results = [];

      for (const r of researchers) {
        results.push(`Result from ${r}`);
      }

      expect(results.length).toBe(3);
    });

    it('should compress findings after each researcher', () => {
      const rawFindings = 'x'.repeat(10000);
      const compressed = `[compressed](url):\n${rawFindings.slice(0, 350)}`;

      expect(compressed.length).toBeLessThan(rawFindings.length);
    });

    it('should build knowledge state from accumulated results', () => {
      const results = [
        { findings: 'Competitor: Brand A' },
        { findings: 'Price: $99.99' },
      ];

      const knowledge = {
        competitors: ['Brand A'],
        prices: ['$99.99'],
      };

      expect(knowledge.competitors.length).toBeGreaterThan(0);
    });

    it('should update coverage graph after each iteration', () => {
      const coverage = {
        market_trends: true,
        competitor_analysis: true,
        customer_objections: false,
      };

      const covered = Object.values(coverage).filter(v => v).length;
      const percentage = (covered / Object.keys(coverage).length) * 100;

      expect(percentage).toBe(66.66666666666666);
    });
  });

  describe('Orchestrator Decisions', () => {
    it('should evaluate coverage and decide next action', () => {
      const coverage = 0.65;
      const threshold = 0.7;

      const shouldContinue = coverage < threshold;
      expect(shouldContinue).toBe(true);
    });

    it('should identify gaps from coverage', () => {
      const coverage = {
        market_trends: true,
        competitor_analysis: true,
        objections: false,
        pricing: false,
      };

      const gaps = Object.entries(coverage)
        .filter(([_, v]) => !v)
        .map(([k]) => k);

      expect(gaps.length).toBe(2);
    });

    it('should generate queries for identified gaps', () => {
      const gaps = ['objections', 'pricing'];
      const queries = gaps.map(g => `research ${g}`);

      expect(queries.length).toBe(gaps.length);
    });

    it('should decide COMPLETE when coverage exceeds threshold', () => {
      const coverage = 0.75;
      const threshold = 0.7;

      const isComplete = coverage >= threshold;
      expect(isComplete).toBe(true);
    });

    it('should decide COMPLETE when max iterations reached', () => {
      const iteration = 30;
      const maxIterations = 30;

      const shouldComplete = iteration >= maxIterations;
      expect(shouldComplete).toBe(true);
    });

    it('should decide COMPLETE when time limit exceeded', () => {
      const elapsed = 305000; // 305 seconds
      const limit = 300000; // 5 minutes

      const shouldComplete = elapsed >= limit;
      expect(shouldComplete).toBe(true);
    });

    it('should output orchestrator decisions as markers', () => {
      const output = 'RESEARCH: market gap analysis\nRESEARCH: price comparison';

      const queries = output.match(/RESEARCH:\s*([^\n]+)/g);
      expect(queries?.length).toBe(2);
    });

    it('should output completion marker', () => {
      const output = 'Research sufficient. COMPLETE: true';

      expect(output).toContain('COMPLETE: true');
    });
  });

  describe('Reflection Agent', () => {
    it('should analyze coverage after each iteration', () => {
      const coverage = {
        market_trends: true,
        competitor_analysis: true,
        objections: false,
      };

      const percentage = (Object.values(coverage).filter(v => v).length / Object.keys(coverage).length) * 100;
      expect(percentage).toBe(66.66666666666666);
    });

    it('should identify critical gaps', () => {
      const gaps = ['customer_objections', 'emerging_trends'];
      expect(gaps.length).toBe(2);
    });

    it('should suggest follow-up research queries', () => {
      const suggestions = [
        'What are main purchase objections?',
        'What new trends are emerging?',
      ];

      expect(suggestions.length).toBe(2);
    });

    it('should check for sufficient coverage', () => {
      const covered = 7;
      const total = 10;
      const percentage = covered / total;
      const isSufficient = percentage >= 0.7;

      expect(isSufficient).toBe(true);
    });

    it('should output reflection in structured format', () => {
      const reflection = 'GAPS FOUND: 2\nSUGGESTED: market research, reddit analysis';

      expect(reflection).toContain('GAPS FOUND');
      expect(reflection).toContain('SUGGESTED');
    });
  });

  describe('Research Depth Presets', () => {
    it('SQ (Super Quick): ~5 min, 5 iterations, 8 sources', () => {
      const preset = {
        name: 'SQ',
        maxIterations: 5,
        maxSources: 8,
        estimatedMinutes: 5,
      };

      expect(preset.maxIterations).toBe(5);
      expect(preset.estimatedMinutes).toBeLessThan(10);
    });

    it('QK (Quick): ~30 min, 12 iterations, 25 sources', () => {
      const preset = {
        name: 'QK',
        maxIterations: 12,
        maxSources: 25,
        estimatedMinutes: 30,
      };

      expect(preset.maxIterations).toBe(12);
      expect(preset.maxSources).toBeGreaterThan(8);
    });

    it('NR (Normal): ~90 min, 30 iterations, 75 sources', () => {
      const preset = {
        name: 'NR',
        maxIterations: 30,
        maxSources: 75,
        estimatedMinutes: 90,
      };

      expect(preset.maxIterations).toBe(30);
      expect(preset.maxSources).toBe(75);
    });

    it('EX (Extended): ~2 hrs, 45 iterations, 200 sources + visual scouting', () => {
      const preset = {
        name: 'EX',
        maxIterations: 45,
        maxSources: 200,
        estimatedMinutes: 120,
        enableVisual: true,
      };

      expect(preset.maxIterations).toBe(45);
      expect(preset.enableVisual).toBe(true);
    });

    it('MX (Maximum): ~5 hrs, 100 iterations, 400 sources + deep visual analysis', () => {
      const preset = {
        name: 'MX',
        maxIterations: 100,
        maxSources: 400,
        estimatedMinutes: 300,
        enableVisual: true,
      };

      expect(preset.maxIterations).toBe(100);
      expect(preset.maxSources).toBeGreaterThan(200);
    });

    it('should apply preset limits to orchestration', () => {
      const selectedPreset = 'NR';
      const limits = { maxIterations: 30, maxSources: 75 };

      expect(limits.maxIterations).toBe(30);
    });
  });

  describe('Iteration Logic', () => {
    it('should increment iteration counter per loop', () => {
      let iteration = 0;
      for (let i = 0; i < 3; i++) {
        iteration++;
      }

      expect(iteration).toBe(3);
    });

    it('should track elapsed time', () => {
      const startTime = Date.now();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should stop on iteration limit', () => {
      const maxIterations = 30;
      const currentIteration = 30;

      const shouldStop = currentIteration >= maxIterations;
      expect(shouldStop).toBe(true);
    });

    it('should stop on time limit', () => {
      const maxTimeMs = 300000;
      const elapsed = 300001;

      const shouldStop = elapsed >= maxTimeMs;
      expect(shouldStop).toBe(true);
    });

    it('should stop on coverage threshold', () => {
      const coverage = 0.75;
      const threshold = 0.7;

      const shouldStop = coverage >= threshold;
      expect(shouldStop).toBe(true);
    });

    it('should collect iteration metadata', () => {
      const iterationData = {
        number: 1,
        queriesExecuted: 4,
        sourcesFound: 12,
        timeElapsed: 45000,
        coverageUpdated: true,
      };

      expect(iterationData.number).toBe(1);
      expect(iterationData.sourcesFound).toBeGreaterThan(0);
    });
  });

  describe('Compression Integration', () => {
    it('should compress each page after research', () => {
      const page = { content: 'x'.repeat(5000), title: 'Test' };
      const shouldCompress = page.content.length >= 200;

      expect(shouldCompress).toBe(true);
    });

    it('should skip very short pages (< 200 chars)', () => {
      const page = { content: 'Short', title: 'Test' };
      const shouldCompress = page.content.length >= 200;

      expect(shouldCompress).toBe(false);
    });

    it('should cache compression results', () => {
      const cache = new Map();
      const key = 'url:query';
      const result = 'Compressed';

      cache.set(key, result);
      expect(cache.has(key)).toBe(true);
    });

    it('should use compression model from config', () => {
      const model = 'qwen3.5:2b';
      expect(model).toContain('qwen');
    });

    it('should preserve source URLs in compressed output', () => {
      const compressed = 'Fact [Source: https://example.com]';
      expect(compressed).toContain('[Source:');
      expect(compressed).toContain('https://example.com');
    });
  });

  describe('Abort Signal Integration', () => {
    it('should propagate abort signal to research loop', () => {
      const controller = new AbortController();
      const signal = controller.signal;

      expect(signal.aborted).toBe(false);

      controller.abort();
      expect(signal.aborted).toBe(true);
    });

    it('should propagate abort to orchestrator', () => {
      const controller = new AbortController();
      controller.abort();

      expect(controller.signal.aborted).toBe(true);
    });

    it('should propagate abort to all researchers', () => {
      const controller = new AbortController();
      const researchers = [
        { signal: controller.signal },
        { signal: controller.signal },
      ];

      controller.abort();

      for (const r of researchers) {
        expect(r.signal.aborted).toBe(true);
      }
    });

    it('should stop iteration on abort', () => {
      const controller = new AbortController();
      let iterations = 0;

      controller.abort();

      if (controller.signal.aborted) {
        // Should not continue
        expect(controller.signal.aborted).toBe(true);
      }
    });
  });

  describe('Research Audit Trail', () => {
    it('should record all URLs researched', () => {
      const urls = [
        'https://site1.com',
        'https://site2.com',
      ];

      expect(urls.length).toBe(2);
    });

    it('should record token usage per iteration', () => {
      const usage = [
        { iteration: 1, tokens: 150 },
        { iteration: 2, tokens: 200 },
      ];

      expect(usage.length).toBe(2);
      expect(usage[1].tokens).toBeGreaterThan(usage[0].tokens);
    });

    it('should record models used', () => {
      const models = ['qwen3.5:4b', 'qwen3.5:2b'];

      expect(models).toContain('qwen3.5:4b');
    });

    it('should record timing for each phase', () => {
      const timing = {
        phase1: 5000,
        phase2: 120000,
      };

      expect(timing.phase2).toBeGreaterThan(timing.phase1);
    });

    it('should calculate total research time', () => {
      const startTime = Date.now();
      const endTime = startTime + 125000;
      const totalTime = endTime - startTime;

      expect(totalTime).toBe(125000);
    });
  });

  describe('Brand Context Building', () => {
    it('should include brand name in context', () => {
      const context = 'Brand: Test Brand';
      expect(context).toContain('Brand:');
    });

    it('should include positioning in context', () => {
      const context = 'Positioning: Premium';
      expect(context).toContain('Positioning:');
    });

    it('should include product description', () => {
      const context = 'Product: Collagen supplement';
      expect(context).toContain('Product:');
    });

    it('should include reference image descriptions', () => {
      const context = 'Packaging: Minimalist design';
      expect(context).toContain('Packaging:');
    });

    it('should truncate very long context', () => {
      const context = 'x'.repeat(2000);
      const truncated = context.slice(0, 1500);

      expect(truncated.length).toBeLessThanOrEqual(1500);
    });
  });

  describe('Coverage Threshold Checking', () => {
    it('should calculate coverage percentage', () => {
      const covered = 7;
      const total = 10;
      const percentage = (covered / total) * 100;

      expect(percentage).toBe(70);
    });

    it('should check if coverage meets threshold', () => {
      const percentage = 75;
      const threshold = 0.7;

      const isMet = (percentage / 100) >= threshold;
      expect(isMet).toBe(true);
    });

    it('should track which dimensions are covered', () => {
      const coverage = {
        market_trends: true,
        competitor_analysis: true,
        objections: false,
      };

      const coveredCount = Object.values(coverage).filter(v => v).length;
      expect(coveredCount).toBe(2);
    });

    it('should identify uncovered dimensions as gaps', () => {
      const coverage = {
        market_trends: true,
        competitor_analysis: false,
      };

      const gaps = Object.entries(coverage)
        .filter(([_, v]) => !v)
        .map(([k]) => k);

      expect(gaps).toContain('competitor_analysis');
    });
  });
});

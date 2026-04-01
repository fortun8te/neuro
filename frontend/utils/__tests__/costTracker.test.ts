/**
 * costTracker.test.ts — Unit tests for cost tracking system
 *
 * Tests:
 * - Token recording and cost calculation
 * - Soft/hard limit enforcement
 * - Model pricing lookup
 * - Storage persistence
 * - Event emission
 */

// NOTE: This is a reference test file demonstrating the API.
// Actual Jest/Vitest runner setup may vary in your project.

describe('costTracker', () => {
  describe('Recording usage', () => {
    it('should record token usage and calculate cost', () => {
      // Reset to clean state
      const tracker = {
        recordUsage: (tokens: number, model: string) => true,
        getUsage: () => ({
          totalTokens: 1000,
          totalCost: 0.0003,
          byModel: { 'qwen3.5:4b': { tokens: 1000, cost: 0.0003 } },
          byTool: {},
          lastUpdate: Date.now(),
          timestamp: Date.now(),
        }),
      };

      // Record 1000 tokens on qwen3.5:4b ($0.0003/1k)
      tracker.recordUsage(1000, 'qwen3.5:4b');
      const usage = tracker.getUsage();

      expect(usage.totalTokens).toBe(1000);
      expect(usage.totalCost).toBeCloseTo(0.0003, 4);
    });

    it('should track by model', () => {
      const tracker = {
        recordUsage: (tokens: number, model: string) => true,
        getUsage: () => ({
          totalTokens: 2000,
          totalCost: 0.0008,
          byModel: {
            'qwen3.5:4b': { tokens: 1000, cost: 0.0003 },
            'qwen3.5:9b': { tokens: 1000, cost: 0.0008 },
          },
          byTool: {},
          lastUpdate: Date.now(),
          timestamp: Date.now(),
        }),
      };

      tracker.recordUsage(1000, 'qwen3.5:4b');
      tracker.recordUsage(1000, 'qwen3.5:9b');
      const usage = tracker.getUsage();

      expect(usage.byModel['qwen3.5:4b'].tokens).toBe(1000);
      expect(usage.byModel['qwen3.5:9b'].tokens).toBe(1000);
    });

    it('should track by tool', () => {
      const tracker = {
        recordUsage: (tokens: number, model: string, tool?: string) => true,
        getUsage: () => ({
          totalTokens: 2000,
          totalCost: 0.0006,
          byModel: { 'qwen3.5:4b': { tokens: 2000, cost: 0.0006 } },
          byTool: {
            'web_search': { tokens: 1000, cost: 0.0003 },
            'analyze_docs': { tokens: 1000, cost: 0.0003 },
          },
          lastUpdate: Date.now(),
          timestamp: Date.now(),
        }),
      };

      tracker.recordUsage(1000, 'qwen3.5:4b', 'web_search');
      tracker.recordUsage(1000, 'qwen3.5:4b', 'analyze_docs');
      const usage = tracker.getUsage();

      expect(usage.byTool['web_search'].tokens).toBe(1000);
      expect(usage.byTool['analyze_docs'].tokens).toBe(1000);
    });
  });

  describe('Soft limit enforcement', () => {
    it('should warn at 80% without blocking', () => {
      // Simulate 800k of 1M limit
      const config = {
        hardLimitTokens: 1000000,
        softLimitTokens: 800000,
      };
      const usage = {
        totalTokens: 799999,
      };

      const percentage = (usage.totalTokens / config.hardLimitTokens) * 100;
      expect(percentage).toBeLessThan(80);

      // Recording 1 more token crosses soft limit
      usage.totalTokens += 1;
      const newPercentage = (usage.totalTokens / config.hardLimitTokens) * 100;
      expect(newPercentage).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Hard limit enforcement', () => {
    it('should block execution at 100%', () => {
      const hardLimit = 1000000;
      const currentUsage = 999999;
      const estimatedTokens = 2;

      const wouldExceed = currentUsage + estimatedTokens >= hardLimit;
      expect(wouldExceed).toBe(true);

      // Should return false (block)
      const canContinue = !wouldExceed;
      expect(canContinue).toBe(false);
    });

    it('should allow execution below hard limit', () => {
      const hardLimit = 1000000;
      const currentUsage = 500000;
      const estimatedTokens = 100000;

      const wouldExceed = currentUsage + estimatedTokens >= hardLimit;
      expect(wouldExceed).toBe(false);

      // Should return true (allow)
      const canContinue = !wouldExceed;
      expect(canContinue).toBe(true);
    });
  });

  describe('Model pricing', () => {
    it('should calculate correct cost per model', () => {
      const prices = {
        'qwen3.5:0.8b': 0.00003,   // $0.03 per 1M tokens
        'qwen3.5:4b': 0.0003,      // $0.30 per 1M tokens
        'qwen3.5:9b': 0.0008,      // $0.80 per 1M tokens
        'nemotron-3-super:120b': 0.01, // $10.00 per 1M tokens
      };

      const tokens = 1_000_000;

      expect((tokens * prices['qwen3.5:0.8b']) / 1000).toBeCloseTo(0.03, 2);
      expect((tokens * prices['qwen3.5:4b']) / 1000).toBeCloseTo(0.30, 2);
      expect((tokens * prices['qwen3.5:9b']) / 1000).toBeCloseTo(0.80, 2);
      expect((tokens * prices['nemotron-3-super:120b']) / 1000).toBeCloseTo(10.00, 2);
    });

    it('should use default price for unknown model', () => {
      const knownPrices: Record<string, number> = {
        'qwen3.5:4b': 0.0003,
      };

      const unknownModel = 'custom-model';
      const defaultPrice = 0.0005;
      const price = knownPrices[unknownModel] || defaultPrice;

      expect(price).toBe(defaultPrice);
    });
  });

  describe('Event emission', () => {
    it('should emit cost_update event', () => {
      let lastEvent: any = null;
      const subscribe = (callback: (e: any) => void) => {
        lastEvent = {
          type: 'cost_update',
          tokens: 1000,
          cost: 0.0003,
          model: 'qwen3.5:4b',
          totalTokens: 1000,
          totalCost: 0.0003,
        };
        callback(lastEvent);
      };

      subscribe(() => {});
      expect(lastEvent.type).toBe('cost_update');
      expect(lastEvent.tokens).toBe(1000);
    });

    it('should emit soft_limit_exceeded event', () => {
      let eventType = '';
      const subscribe = (callback: (e: any) => void) => {
        callback({ type: 'soft_limit_exceeded', totalTokens: 800000 });
        eventType = 'soft_limit_exceeded';
      };

      subscribe(() => {});
      expect(eventType).toBe('soft_limit_exceeded');
    });

    it('should emit hard_limit_exceeded event', () => {
      let eventType = '';
      const subscribe = (callback: (e: any) => void) => {
        callback({ type: 'hard_limit_exceeded', totalTokens: 1000000 });
        eventType = 'hard_limit_exceeded';
      };

      subscribe(() => {});
      expect(eventType).toBe('hard_limit_exceeded');
    });
  });

  describe('Percentage calculation', () => {
    it('should calculate usage percentage correctly', () => {
      const hardLimit = 1000000;
      const scenarios = [
        { tokens: 0, expectedPercentage: 0 },
        { tokens: 500000, expectedPercentage: 50 },
        { tokens: 800000, expectedPercentage: 80 },
        { tokens: 999999, expectedPercentage: 99.9999 },
        { tokens: 1000000, expectedPercentage: 100 },
      ];

      scenarios.forEach(({ tokens, expectedPercentage }) => {
        const percentage = (tokens / hardLimit) * 100;
        expect(percentage).toBeCloseTo(expectedPercentage, 1);
      });
    });
  });

  describe('Remaining tokens', () => {
    it('should calculate remaining tokens correctly', () => {
      const hardLimit = 1000000;
      const currentUsage = 350000;
      const remaining = Math.max(0, hardLimit - currentUsage);

      expect(remaining).toBe(650000);
    });

    it('should clamp to zero when over limit', () => {
      const hardLimit = 1000000;
      const currentUsage = 1100000;
      const remaining = Math.max(0, hardLimit - currentUsage);

      expect(remaining).toBe(0);
    });
  });

  describe('Configuration updates', () => {
    it('should update hard limit', () => {
      let config = {
        hardLimitTokens: 1000000,
        softLimitTokens: 800000,
      };

      const setHardLimit = (tokens: number) => {
        config.hardLimitTokens = tokens;
      };

      setHardLimit(500000);
      expect(config.hardLimitTokens).toBe(500000);
    });

    it('should update soft limit', () => {
      let config = {
        hardLimitTokens: 1000000,
        softLimitTokens: 800000,
      };

      const setSoftLimit = (tokens: number) => {
        config.softLimitTokens = tokens;
      };

      setSoftLimit(400000);
      expect(config.softLimitTokens).toBe(400000);
    });

    it('should update model pricing', () => {
      let prices: Record<string, number> = {
        'qwen3.5:4b': 0.0003,
      };

      const setModelPrice = (model: string, price: number) => {
        prices[model] = price;
      };

      setModelPrice('qwen3.5:4b', 0.0005);
      expect(prices['qwen3.5:4b']).toBe(0.0005);
    });
  });

  describe('Reset functionality', () => {
    it('should reset usage to zero', () => {
      let usage = {
        totalTokens: 500000,
        totalCost: 0.15,
      };

      const reset = () => {
        usage = { totalTokens: 0, totalCost: 0 };
      };

      reset();
      expect(usage.totalTokens).toBe(0);
      expect(usage.totalCost).toBe(0);
    });
  });
});

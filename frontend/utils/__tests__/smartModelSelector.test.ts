/**
 * Smart Model Selector Test Cases
 *
 * Run with: npm test -- smartModelSelector.test.ts
 * or simply: npm test
 */

import {
  selectModelForTask,
  analyzeModelSelection,
  getModelForTier,
  getTierForStage,
  type TaskContext,
} from '../smartModelSelector';
import { getModelForSmartTier } from '../modelConfig';

describe('Smart Model Selector', () => {
  // ─────────────────────────────────────────────────────────────
  // SIMPLE (2b) — Ultra-fast tasks
  // ─────────────────────────────────────────────────────────────
  describe('SIMPLE (2b) — One-word acks and quick checks', () => {
    test('single-word ack: ok', () => {
      const model = selectModelForTask('ok', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('single-word ack: yes', () => {
      const model = selectModelForTask('yes', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('single-word ack: got it', () => {
      const model = selectModelForTask('got it', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('status check: what time is it?', () => {
      const model = selectModelForTask('what time is it?', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('status check: is X done?', () => {
      const model = selectModelForTask('is the test done?', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('very short message', () => {
      const model = selectModelForTask('test', { messageLength: 4 });
      expect(model).toBe('qwen3.5:2b');
    });

    test('copy operation', () => {
      const model = selectModelForTask('copy this text', {});
      expect(model).toBe('qwen3.5:2b');
    });

    test('simple CLI', () => {
      const model = selectModelForTask('run npm test', {});
      expect(model).toBe('qwen3.5:2b');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ROUTINE (4b) — Balanced, most common tasks
  // ─────────────────────────────────────────────────────────────
  describe('ROUTINE (4b) — Code refactoring and content', () => {
    test('refactor function', () => {
      const model = selectModelForTask('refactor this function', {
        hasCode: true,
      });
      expect(model).toBe('qwen3.5:4b');
    });

    test('rename variables', () => {
      const model = selectModelForTask('rename vars for clarity', {
        hasCode: true,
      });
      expect(model).toBe('qwen3.5:4b');
    });

    test('read file', () => {
      const model = selectModelForTask('read the file', {});
      expect(model).toBe('qwen3.5:4b');
    });

    test('write blog post (short)', () => {
      const model = selectModelForTask(
        'write a blog post about REST APIs',
        { messageLength: 50 }
      );
      expect(model).toBe('qwen3.5:4b');
    });

    test('extract data', () => {
      const model = selectModelForTask('parse this JSON and extract users', {});
      expect(model).toBe('qwen3.5:4b');
    });

    test('research query', () => {
      const model = selectModelForTask('what is GraphQL?', {
        messageLength: 30,
      });
      expect(model).toBe('qwen3.5:4b');
    });

    test('medium-length message', () => {
      const model = selectModelForTask(
        'can you help me understand this code pattern? I have a function that does X and Y',
        { messageLength: 100 }
      );
      expect(model).toBe('qwen3.5:4b');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // COMPLEX (9b) — High quality reasoning
  // ─────────────────────────────────────────────────────────────
  describe('COMPLEX (9b) — Architecture and deep analysis', () => {
    test('architecture decision', () => {
      const model = selectModelForTask('architecture decision', {});
      expect(model).toBe('qwen3.5:9b');
    });

    test('system design', () => {
      const model = selectModelForTask('system design for a social network', {});
      expect(model).toBe('qwen3.5:9b');
    });

    test('deep code analysis with large context', () => {
      const model = selectModelForTask('what is wrong with this code?', {
        hasCode: true,
        messageLength: 500,
      });
      expect(model).toBe('qwen3.5:9b');
    });

    test('complex bug investigation', () => {
      const model = selectModelForTask('debug this issue', {
        hasCode: true,
        messageLength: 400,
      });
      expect(model).toBe('qwen3.5:9b');
    });

    test('creative content generation', () => {
      const model = selectModelForTask('create an ad campaign for a SaaS product', {});
      expect(model).toBe('qwen3.5:9b');
    });

    test('long-form writing', () => {
      const model = selectModelForTask('write a comprehensive guide on microservices', {
        messageLength: 250,
      });
      expect(model).toBe('qwen3.5:9b');
    });

    test('image/vision task forces 9b minimum', () => {
      const model = selectModelForTask('ok', { requiresVision: true });
      expect(model).toBe('qwen3.5:9b');
    });

    test('long message defaults to complex', () => {
      const model = selectModelForTask('I need to...', { messageLength: 1200 });
      expect(model).toBe('qwen3.5:9b');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PLANNING (nemotron 120b) — Best reasoning for routing
  // ─────────────────────────────────────────────────────────────
  describe('PLANNING (nemotron) — Tool selection and orchestration', () => {
    test('tool selection', () => {
      const model = selectModelForTask('which tool should I use?', {});
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('function routing', () => {
      const model = selectModelForTask('which function to call?', {});
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('orchestration', () => {
      const model = selectModelForTask('plan the workflow', {});
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('decision under constraints', () => {
      const model = selectModelForTask('should I refactor this?', {
        conversationLength: 2000,
      });
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('reasoning task with large history', () => {
      const model = selectModelForTask('what should we do?', {
        conversationLength: 3000,
      });
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('explicit reasoning requirement', () => {
      const model = selectModelForTask('ok', { requiresReasoning: true });
      expect(model).toBe('nemotron-3-super:120b');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SPECIAL CASES — Constraint handling
  // ─────────────────────────────────────────────────────────────
  describe('Special cases — Constraints and recovery', () => {
    test('escalate on previous failure', () => {
      const model = selectModelForTask('ok', { previousFailure: true });
      expect(model).toBe('qwen3.5:4b');  // 2b → 4b
    });

    test('escalate complex task on failure', () => {
      const model = selectModelForTask('refactor this', {
        hasCode: true,
        previousFailure: true,
      });
      expect(model).toBe('qwen3.5:9b');  // 4b → 9b
    });

    test('urgent time constraint prioritizes speed', () => {
      const model = selectModelForTask('ok', { timeConstraint: 'urgent' });
      expect(model).toBe('qwen3.5:2b');  // Stay fast
    });

    test('urgent routine task uses 4b for minimum quality', () => {
      const model = selectModelForTask('refactor this', {
        hasCode: true,
        timeConstraint: 'urgent',
      });
      expect(model).toBe('qwen3.5:4b');  // Don't escalate under pressure
    });

    test('patient time constraint allows reasoning', () => {
      const model = selectModelForTask('ok', {
        timeConstraint: 'patient',
        requiresReasoning: true,
      });
      expect(model).toBe('nemotron-3-super:120b');  // Can use slow model
    });

    test('vision requirement forces 9b minimum', () => {
      const model = selectModelForTask('simple task', {
        requiresVision: true,
      });
      expect(model).toBe('qwen3.5:9b');
    });

    test('vision + complex escalates but stays within bounds', () => {
      const model = selectModelForTask('analyze this image', {
        hasImages: true,
        messageLength: 50,
      });
      expect(model).toBe('qwen3.5:9b');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TIER FUNCTIONS
  // ─────────────────────────────────────────────────────────────
  describe('Tier mapping functions', () => {
    test('getModelForTier(fast)', () => {
      const model = getModelForTier('fast');
      expect(model).toBe('qwen3.5:2b');
    });

    test('getModelForTier(balanced)', () => {
      const model = getModelForTier('balanced');
      expect(model).toBe('qwen3.5:4b');
    });

    test('getModelForTier(quality)', () => {
      const model = getModelForTier('quality');
      expect(model).toBe('qwen3.5:9b');
    });

    test('getModelForTier(reasoning)', () => {
      const model = getModelForTier('reasoning');
      expect(model).toBe('nemotron-3-super:120b');
    });

    test('getTierForStage(router)', () => {
      const tier = getTierForStage('router');
      expect(tier).toBe('balanced');
    });

    test('getTierForStage(orchestrator)', () => {
      const tier = getTierForStage('orchestrator');
      expect(tier).toBe('quality');
    });

    test('getTierForStage(unknown) defaults to balanced', () => {
      const tier = getTierForStage('unknown-stage-xyz');
      expect(tier).toBe('balanced');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DEBUGGING & ANALYSIS
  // ─────────────────────────────────────────────────────────────
  describe('Debugging utilities', () => {
    test('analyzeModelSelection returns full context', () => {
      const analysis = analyzeModelSelection('refactor this', {
        hasCode: true,
      });

      expect(analysis).toHaveProperty('intent');
      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('selectedTier');
      expect(analysis).toHaveProperty('selectedModel');
      expect(analysis).toHaveProperty('context');

      expect(analysis.selectedModel).toBe('qwen3.5:4b');
      expect(analysis.selectedTier).toBe('balanced');
      expect(analysis.analysis.category).toBe('routine');
    });

    test('analyzeModelSelection includes confidence', () => {
      const analysis = analyzeModelSelection('ok', {});
      expect(analysis.analysis.confidence).toBeGreaterThan(0);
      expect(analysis.analysis.confidence).toBeLessThanOrEqual(1);
      expect(analysis.analysis.reasoning).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Integration scenarios', () => {
    test('typical user chat flow: greeting → query → complex task', () => {
      // Greeting
      expect(selectModelForTask('hi', {})).toBe('qwen3.5:2b');

      // Question
      expect(
        selectModelForTask('how do I...?', { messageLength: 50 })
      ).toBe('qwen3.5:4b');

      // Complex task
      expect(
        selectModelForTask('refactor the entire module', {
          hasCode: true,
          messageLength: 300,
        })
      ).toBe('qwen3.5:9b');
    });

    test('research flow: simple query → analysis', () => {
      // Quick search
      expect(selectModelForTask('find X', {})).toBe('qwen3.5:4b');

      // Deep analysis
      expect(
        selectModelForTask('analyze these results', {
          messageLength: 500,
          conversationLength: 1000,
        })
      ).toBe('qwen3.5:9b');
    });

    test('debug flow: error → complex investigation → fix', () => {
      // Report error (simple)
      expect(
        selectModelForTask('there is an error', { hasCode: true, messageLength: 50 })
      ).toBe('qwen3.5:4b');

      // Deep investigation
      expect(
        selectModelForTask('why is this happening?', {
          hasCode: true,
          messageLength: 500,
          conversationLength: 2000,
        })
      ).toBe('qwen3.5:9b');

      // Fix attempt
      expect(
        selectModelForTask('apply the fix', { hasCode: true })
      ).toBe('qwen3.5:4b');
    });
  });
});

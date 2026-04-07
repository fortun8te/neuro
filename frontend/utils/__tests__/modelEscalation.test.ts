/**
 * Model Escalation System — Unit Tests
 *
 * Tests the detection, escalation, and retry logic for upgrading
 * to better models when output quality is poor.
 */

import {
  detectAndEscalate,
  nextTier,
  tryParseTypeScript,
  isValidJSON,
  semanticSimilarity,
  EscalationTracker,
  escalationTracker,
} from '../modelEscalation';

describe('modelEscalation', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // nextTier() — Model hierarchy
  // ─────────────────────────────────────────────────────────────────────────

  describe('nextTier()', () => {
    it('should escalate 2b to 4b', () => {
      expect(nextTier('qwen3.5:2b')).toBe('qwen3.5:4b');
    });

    it('should escalate 4b to 9b', () => {
      expect(nextTier('qwen3.5:4b')).toBe('qwen3.5:9b');
    });

    it('should escalate 9b to 27b', () => {
      expect(nextTier('qwen3.5:9b')).toBe('qwen3.5:27b');
    });

    it('should escalate 27b to nemotron', () => {
      expect(nextTier('qwen3.5:27b')).toBe('nemotron-3-super:120b');
    });

    it('should stay at 120b (max)', () => {
      expect(nextTier('nemotron-3-super:120b')).toBe('nemotron-3-super:120b');
    });

    it('should handle aliases (2b → qwen3.5:2b)', () => {
      expect(nextTier('2b')).toBe('qwen3.5:4b');
    });

    it('should handle nemotron alias', () => {
      expect(nextTier('nemotron')).toBe('nemotron-3-super:120b');
    });

    it('should default unknown models to 9b', () => {
      expect(nextTier('unknown-model:xyz')).toBe('qwen3.5:9b');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // tryParseTypeScript() — Syntax error detection
  // ─────────────────────────────────────────────────────────────────────────

  describe('tryParseTypeScript()', () => {
    it('should detect mismatched braces', () => {
      const errors = tryParseTypeScript('function foo() { return 1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('brace');
    });

    it('should detect mismatched parentheses', () => {
      const errors = tryParseTypeScript('const x = Math.max(1, 2');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('parenthes');
    });

    it('should detect mismatched brackets', () => {
      const errors = tryParseTypeScript('const arr = [1, 2, 3');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('bracket');
    });

    it('should detect unfinished strings', () => {
      const errors = tryParseTypeScript("const str = 'hello");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('string');
    });

    it('should accept valid code', () => {
      const errors = tryParseTypeScript('function foo() { return 1; }');
      expect(errors.length).toBe(0);
    });

    it('should accept valid object literal', () => {
      const errors = tryParseTypeScript('const obj = { a: 1, b: 2 };');
      expect(errors.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isValidJSON() — JSON validation
  // ─────────────────────────────────────────────────────────────────────────

  describe('isValidJSON()', () => {
    it('should accept valid JSON object', () => {
      expect(isValidJSON('{"name": "test", "value": 123}')).toBe(true);
    });

    it('should accept valid JSON array', () => {
      expect(isValidJSON('[1, 2, 3, 4]')).toBe(true);
    });

    it('should accept valid JSON with whitespace', () => {
      expect(isValidJSON('  {"test": true}  ')).toBe(true);
    });

    it('should reject invalid JSON with missing quotes', () => {
      expect(isValidJSON('{name: test}')).toBe(false);
    });

    it('should reject incomplete JSON object', () => {
      expect(isValidJSON('{"name": "test"')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidJSON('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidJSON(null as any)).toBe(false);
      expect(isValidJSON(undefined as any)).toBe(false);
    });

    it('should reject trailing comma', () => {
      expect(isValidJSON('{"a": 1,}')).toBe(false);
    });

    it('should accept JSON null/true/false', () => {
      expect(isValidJSON('null')).toBe(true);
      expect(isValidJSON('true')).toBe(true);
      expect(isValidJSON('false')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // semanticSimilarity() — Relevance checking
  // ─────────────────────────────────────────────────────────────────────────

  describe('semanticSimilarity()', () => {
    it('should return high similarity for direct match', () => {
      const sim = semanticSimilarity('what is the capital of France', 'The capital of France is Paris');
      expect(sim).toBeGreaterThan(0.5);
    });

    it('should return low similarity for completely unrelated text', () => {
      const sim = semanticSimilarity('what is the capital of France', 'The weather is sunny today');
      expect(sim).toBeLessThan(0.3);
    });

    it('should return 0 for empty query', () => {
      expect(semanticSimilarity('', 'response')).toBe(0);
    });

    it('should return 0.5 for empty response when query has words', () => {
      expect(semanticSimilarity('hello world', '')).toBe(0);
    });

    it('should handle stop words correctly', () => {
      const sim1 = semanticSimilarity('the cat', 'a cat in the house');
      const sim2 = semanticSimilarity('cat', 'a cat in the house');
      // Both should have reasonable similarity, similar values
      expect(sim1).toBeGreaterThan(0.2);
      expect(sim2).toBeGreaterThan(0.2);
    });

    it('should be case-insensitive', () => {
      const sim1 = semanticSimilarity('PYTHON', 'Python programming');
      const sim2 = semanticSimilarity('python', 'Python programming');
      expect(sim1).toBe(sim2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // detectAndEscalate() — Main escalation logic
  // ─────────────────────────────────────────────────────────────────────────

  describe('detectAndEscalate()', () => {
    it('should escalate on hard failure', () => {
      const decision = detectAndEscalate(
        { success: false, output: 'Tool failed' },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('tool_execution_failed');
      expect(decision.nextModel).toBe('qwen3.5:4b');
      expect(decision.retryable).toBe(true);
    });

    it('should escalate on empty output', () => {
      const decision = detectAndEscalate(
        { success: true, output: '' },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('empty_output');
      expect(decision.nextModel).toBe('qwen3.5:4b');
    });

    it('should escalate on whitespace-only output', () => {
      const decision = detectAndEscalate(
        { success: true, output: '   \n  \t  ' },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
    });

    it('should escalate on syntax errors in code', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'function foo() { return 1',
          data: { type: 'code' },
        },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('syntax_errors');
    });

    it('should escalate on invalid JSON', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: '{invalid json}',
          data: { type: 'json' },
        },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('invalid_json');
    });

    it('should escalate on low semantic similarity with small models', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'The weather is sunny today',
        },
        {
          currentModel: 'qwen3.5:2b',
          userQuery: 'What is the capital of France?',
        }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('low_relevance');
    });

    it('should not escalate on low similarity with large models', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'The weather is sunny today',
        },
        {
          currentModel: 'qwen3.5:9b',
          userQuery: 'What is the capital of France?',
        }
      );
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should escalate on high uncertainty (multiple phrases)', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output:
            'I might think this could be correct, but I am uncertain. Perhaps this could work, and I might not be sure about it.',
        },
        {
          currentModel: 'qwen3.5:2b',
        }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('high_uncertainty');
    });

    it('should not escalate on single uncertainty phrase', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'The answer might be yes, based on the evidence.',
        },
        {
          currentModel: 'qwen3.5:2b',
        }
      );
      // Single phrase might not trigger escalation
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should escalate on tool result mismatch', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'Success',
          toolSuccess: true,
          semanticSuccess: false,
        },
        { currentModel: 'qwen3.5:4b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('semantic_failure');
    });

    it('should not escalate on successful output', () => {
      const decision = detectAndEscalate(
        { success: true, output: 'This is a valid response' },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(false);
    });

    it('should respect max escalation attempts', () => {
      const decision = detectAndEscalate(
        { success: false, output: 'Failed' },
        { currentModel: 'qwen3.5:2b', attemptNumber: 3 }
      );
      expect(decision.shouldEscalate).toBe(false);
      expect(decision.reason).toBe('max_escalations_reached');
    });

    it('should allow escalation within attempt limits', () => {
      const decision = detectAndEscalate(
        { success: false, output: 'Failed' },
        { currentModel: 'qwen3.5:2b', attemptNumber: 2 }
      );
      expect(decision.shouldEscalate).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EscalationTracker — Session state management
  // ─────────────────────────────────────────────────────────────────────────

  describe('EscalationTracker', () => {
    let tracker: EscalationTracker;

    beforeEach(() => {
      tracker = new EscalationTracker();
    });

    it('should record escalations', () => {
      const result = tracker.recordEscalation(
        'task-1',
        'qwen3.5:2b',
        'qwen3.5:4b',
        'empty_output'
      );
      expect(result).toBe(true);
      const history = tracker.getHistory('task-1');
      expect(history).toBeDefined();
      expect(history?.count).toBe(1);
      expect(history?.lastModel).toBe('qwen3.5:4b');
      expect(history?.reason).toBe('empty_output');
    });

    it('should allow up to 3 escalations per task', () => {
      const task = 'task-multiple';
      expect(tracker.recordEscalation(task, '2b', '4b', 'fail')).toBe(true);
      expect(tracker.recordEscalation(task, '4b', '9b', 'fail')).toBe(true);
      expect(tracker.recordEscalation(task, '9b', '27b', 'fail')).toBe(true);
      expect(tracker.recordEscalation(task, '27b', '120b', 'fail')).toBe(false);
    });

    it('should track separate escalations per task', () => {
      tracker.recordEscalation('task-1', '2b', '4b', 'fail');
      tracker.recordEscalation('task-2', '2b', '4b', 'fail');

      const h1 = tracker.getHistory('task-1');
      const h2 = tracker.getHistory('task-2');

      expect(h1?.count).toBe(1);
      expect(h2?.count).toBe(1);
    });

    it('should clear history for a task', () => {
      tracker.recordEscalation('task-1', '2b', '4b', 'fail');
      expect(tracker.getHistory('task-1')).toBeDefined();

      tracker.clearHistory('task-1');
      expect(tracker.getHistory('task-1')).toBeUndefined();
    });

    it('should clear all history', () => {
      tracker.recordEscalation('task-1', '2b', '4b', 'fail');
      tracker.recordEscalation('task-2', '2b', '4b', 'fail');

      tracker.clearAll();
      expect(tracker.getHistory('task-1')).toBeUndefined();
      expect(tracker.getHistory('task-2')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration scenarios
  // ─────────────────────────────────────────────────────────────────────────

  describe('Integration scenarios', () => {
    it('should handle escalation chain: 2b → 4b → 9b on repeated failures', () => {
      let decision = detectAndEscalate(
        { success: false, output: 'Error' },
        { currentModel: 'qwen3.5:2b', attemptNumber: 0 }
      );
      expect(decision.nextModel).toBe('qwen3.5:4b');

      decision = detectAndEscalate(
        { success: false, output: 'Error' },
        { currentModel: 'qwen3.5:4b', attemptNumber: 1 }
      );
      expect(decision.nextModel).toBe('qwen3.5:9b');

      decision = detectAndEscalate(
        { success: false, output: 'Error' },
        { currentModel: 'qwen3.5:9b', attemptNumber: 2 }
      );
      expect(decision.nextModel).toBe('qwen3.5:27b');
    });

    it('should stop escalating after max attempts', () => {
      let decision;
      for (let i = 0; i < 5; i++) {
        decision = detectAndEscalate(
          { success: false, output: 'Error' },
          { currentModel: 'qwen3.5:2b', attemptNumber: i }
        );
        if (i < 3) {
          expect(decision.shouldEscalate).toBe(true);
        } else {
          expect(decision.shouldEscalate).toBe(false);
          expect(decision.reason).toBe('max_escalations_reached');
        }
      }
    });

    it('should detect and escalate JSON parsing error', () => {
      const badJson = '{"incomplete": ';
      const decision = detectAndEscalate(
        { success: true, output: badJson, data: { type: 'json' } },
        { currentModel: 'qwen3.5:2b' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('invalid_json');
    });

    it('should handle semantic failure with tool success context', () => {
      const decision = detectAndEscalate(
        {
          success: true,
          output: 'Tool executed successfully',
          toolSuccess: true,
          semanticSuccess: false,
        },
        { currentModel: 'qwen3.5:4b', intent: 'calculate_revenue' }
      );
      expect(decision.shouldEscalate).toBe(true);
      expect(decision.reason).toBe('semantic_failure');
    });
  });
});

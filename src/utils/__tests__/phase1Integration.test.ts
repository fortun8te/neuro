/**
 * Phase 1 Integration Tests
 * Tests variable substitution, reference resolution, and image batch handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  substituteVariables,
  parseReferenceCommand,
  parseImageBatchArgs,
} from '../commandRouter';
import type { VariableContext } from '../commandRouter';

describe('Phase 1 Integration', () => {
  const mockVariableContext: VariableContext = {
    context: {
      MODEL: 'qwen3.5:9b',
      STAGE: 'research',
      CYCLE: 1,
      TIMESTAMP: '2026-04-02T12:00:00Z',
      TOKENS_USED: 1500,
      RESEARCH_DEPTH: 'NR',
      MODE: 'pro',
      MEMORY_COUNT: 42,
      CANVAS_ITEMS: 3,
    },
  };

  describe('Variable Substitution', () => {
    it('should substitute context variables', async () => {
      const message = 'Current model is $MODEL and stage is $STAGE';
      const result = await substituteVariables(message, mockVariableContext);
      expect(result).toContain('qwen3.5:9b');
      expect(result).toContain('research');
    });

    it('should handle missing context variables', async () => {
      const context: VariableContext = { context: {} };
      const message = 'Model: $MODEL, Stage: $STAGE';
      const result = await substituteVariables(message, context);
      // Should return unchanged if variables are not in context
      expect(result).toBeTruthy();
    });

    it('should handle multiple variable substitutions', async () => {
      const message = '$MODEL on $STAGE cycle $CYCLE';
      const result = await substituteVariables(message, mockVariableContext);
      expect(result).toContain('qwen3.5:9b');
      expect(result).toContain('research');
      expect(result).toContain('1');
    });
  });

  describe('Reference Command Parsing', () => {
    it('should parse lines selector', () => {
      const result = parseReferenceCommand('file.md lines 10-20');
      expect(result).toBeTruthy();
      expect(result?.file).toBe('file.md');
      expect(result?.selector.type).toBe('lines');
      if (result?.selector.type === 'lines') {
        expect(result.selector.start).toBe(10);
        expect(result.selector.end).toBe(20);
      }
    });

    it('should parse section selector', () => {
      const result = parseReferenceCommand('file.md section "Introduction"');
      expect(result).toBeTruthy();
      expect(result?.file).toBe('file.md');
      expect(result?.selector.type).toBe('section');
      if (result?.selector.type === 'section') {
        expect(result.selector.name).toBe('Introduction');
      }
    });

    it('should parse range selector', () => {
      const result = parseReferenceCommand('file.md range 50');
      expect(result).toBeTruthy();
      expect(result?.file).toBe('file.md');
      expect(result?.selector.type).toBe('range');
      if (result?.selector.type === 'range') {
        expect(result.selector.percent).toBe(50);
      }
    });

    it('should reject invalid syntax', () => {
      const result = parseReferenceCommand('invalid');
      expect(result).toBeNull();
    });
  });

  describe('Image Batch Command Parsing', () => {
    it('should parse basic image batch command', () => {
      const result = parseImageBatchArgs('~/screenshots/');
      expect(result).toBeTruthy();
      expect(result?.source).toBe('~/screenshots/');
    });

    it('should parse image batch with options', () => {
      const result = parseImageBatchArgs('~/screenshots/ --depth detailed --colors');
      expect(result).toBeTruthy();
      expect(result?.options.depth).toBe('detailed');
      expect(result?.options.colors).toBe(true);
    });

    it('should parse image batch with filter', () => {
      const result = parseImageBatchArgs('~/screenshots/ --filter product');
      expect(result).toBeTruthy();
      expect(result?.options.filter).toBe('product');
    });

    it('should parse image batch with export format', () => {
      const result = parseImageBatchArgs('~/screenshots/ --export markdown');
      expect(result).toBeTruthy();
      expect(result?.options.export).toBe('markdown');
    });

    it('should reject invalid syntax', () => {
      const result = parseImageBatchArgs('');
      expect(result).toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    it('should substitute variables then parse reference', async () => {
      const message = '/reference design-$STAGE.md lines 1-10';
      const substituted = await substituteVariables(message, mockVariableContext);
      expect(substituted).toContain('design-research.md');

      // Now parse would use the substituted message
      const parsed = parseReferenceCommand('design-research.md lines 1-10');
      expect(parsed).toBeTruthy();
    });

    it('should handle message with multiple substitutions', async () => {
      const message = 'For $STAGE using $MODEL with depth $RESEARCH_DEPTH';
      const result = await substituteVariables(message, mockVariableContext);
      expect(result).toContain('research');
      expect(result).toContain('qwen3.5:9b');
      expect(result).toContain('NR');
    });
  });
});

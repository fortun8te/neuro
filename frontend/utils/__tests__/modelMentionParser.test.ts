/**
 * Test suite for @model mention parser
 */

import { parseModelMention, isKnownModel, getAvailableModelMentions } from '../modelMentionParser';

describe('modelMentionParser', () => {
  describe('parseModelMention', () => {
    test('should parse @nemotron mention', () => {
      const result = parseModelMention('analyze this code @nemotron');
      expect(result.mentionedModel).toBe('nemotron-3-super:120b');
      expect(result.displayName).toBe('Nemotron');
      expect(result.cleanedMessage).toBe('analyze this code');
    });

    test('should parse @qwen3.5:4b mention', () => {
      const result = parseModelMention('quick search @qwen3.5:4b please');
      expect(result.mentionedModel).toBe('qwen3.5:4b');
      expect(result.displayName).toBe('Qwen 4b');
      expect(result.cleanedMessage).toBe('quick search please');
    });

    test('should parse @qwen3.5:9b mention', () => {
      const result = parseModelMention('@qwen3.5:9b detailed analysis');
      expect(result.mentionedModel).toBe('qwen3.5:9b');
      expect(result.displayName).toBe('Qwen 9b');
      expect(result.cleanedMessage).toBe('detailed analysis');
    });

    test('should parse @gpt-oss-20b mention', () => {
      const result = parseModelMention('run this @gpt-oss-20b');
      expect(result.mentionedModel).toBe('gpt-oss-20b');
      expect(result.displayName).toBe('GPT-OSS 20b');
      expect(result.cleanedMessage).toBe('run this');
    });

    test('should parse @neuro mention', () => {
      const result = parseModelMention('who are you @neuro');
      expect(result.mentionedModel).toBe('NEURO-1-B2-4B');
      expect(result.displayName).toBe('Neuro');
      expect(result.cleanedMessage).toBe('who are you');
    });

    test('should parse alias mentions', () => {
      const fastResult = parseModelMention('quick task @fast');
      expect(fastResult.mentionedModel).toBe('qwen3.5:2b');
      expect(fastResult.displayName).toBe('Qwen 2b (fast)');

      const bestResult = parseModelMention('best quality @best');
      expect(bestResult.mentionedModel).toBe('nemotron-3-super:120b');
      expect(bestResult.displayName).toBe('Nemotron');
    });

    test('should be case-insensitive', () => {
      const upperResult = parseModelMention('code @NEMOTRON');
      expect(upperResult.mentionedModel).toBe('nemotron-3-super:120b');

      const mixedResult = parseModelMention('task @Qwen3.5:4B');
      expect(mixedResult.mentionedModel).toBe('qwen3.5:4b');
    });

    test('should return null for unknown models', () => {
      const result = parseModelMention('test @invalidmodel');
      expect(result.mentionedModel).toBeNull();
      expect(result.displayName).toBeNull();
      expect(result.cleanedMessage).toBe('test @invalidmodel');
    });

    test('should handle no mention', () => {
      const result = parseModelMention('just a regular message');
      expect(result.mentionedModel).toBeNull();
      expect(result.displayName).toBeNull();
      expect(result.cleanedMessage).toBe('just a regular message');
    });

    test('should use first mention if multiple are present', () => {
      const result = parseModelMention('test @nemotron and @qwen3.5:4b');
      expect(result.mentionedModel).toBe('nemotron-3-super:120b');
      expect(result.displayName).toBe('Nemotron');
    });

    test('should clean up whitespace after mention removal', () => {
      const result = parseModelMention('analyze   @nemotron   code');
      expect(result.cleanedMessage).toBe('analyze   code');
    });

    test('should handle mention at start', () => {
      const result = parseModelMention('@qwen3.5:9b analyze this');
      expect(result.mentionedModel).toBe('qwen3.5:9b');
      expect(result.cleanedMessage).toBe('analyze this');
    });

    test('should handle mention at end', () => {
      const result = parseModelMention('analyze this code @nemotron');
      expect(result.mentionedModel).toBe('nemotron-3-super:120b');
      expect(result.cleanedMessage).toBe('analyze this code');
    });
  });

  describe('isKnownModel', () => {
    test('should recognize known models', () => {
      expect(isKnownModel('nemotron')).toBe(true);
      expect(isKnownModel('qwen3.5:4b')).toBe(true);
      expect(isKnownModel('gpt-oss-20b')).toBe(true);
      expect(isKnownModel('neuro')).toBe(true);
    });

    test('should reject unknown models', () => {
      expect(isKnownModel('unknown-model')).toBe(false);
      expect(isKnownModel('fake-model:50b')).toBe(false);
    });

    test('should be case-insensitive', () => {
      expect(isKnownModel('NEMOTRON')).toBe(true);
      expect(isKnownModel('QWEN3.5:4B')).toBe(true);
    });
  });

  describe('getAvailableModelMentions', () => {
    test('should return array of available models', () => {
      const models = getAvailableModelMentions();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length > 0).toBe(true);
    });

    test('should have required fields', () => {
      const models = getAvailableModelMentions();
      models.forEach(m => {
        expect(m).toHaveProperty('mention');
        expect(m).toHaveProperty('model');
        expect(m).toHaveProperty('display');
      });
    });

    test('should not have duplicates', () => {
      const models = getAvailableModelMentions();
      const modelNames = models.map(m => m.model);
      expect(new Set(modelNames).size).toBe(modelNames.length);
    });

    test('should include nemotron', () => {
      const models = getAvailableModelMentions();
      const nemotron = models.find(m => m.model === 'nemotron-3-super:120b');
      expect(nemotron).toBeDefined();
    });

    test('should include qwen models', () => {
      const models = getAvailableModelMentions();
      const qwenModels = models.filter(m => m.model.startsWith('qwen3.5'));
      expect(qwenModels.length).toBeGreaterThan(0);
    });
  });
});

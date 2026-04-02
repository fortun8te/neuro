import { describe, test, expect } from 'vitest';
import { IntelligentTruncator } from '../intelligentTruncator';

describe('IntelligentTruncator', () => {
  const truncator = new IntelligentTruncator();

  test('does not truncate short text', () => {
    const text = 'This is a short text';
    const result = truncator.truncate(text, 500);
    expect(result).toBe(text);
  });

  test('preserves named entities in truncated text', () => {
    const text = `
      Introduction to research by Dr. Smith.
      ${' '.repeat(10000)}
      Key finding: 34% improvement discovered.
      Conclusion by Dr. Jones.
    `;
    const truncated = truncator.truncate(text, 500);

    expect(truncated).toContain('Smith');
    expect(truncated).toContain('Jones');
    expect(truncated).toContain('34%');
  });

  test('preserves quoted content', () => {
    const text = `
      Background information.
      ${' '.repeat(10000)}
      "This is a critical quote" said the researcher.
      More text.
    `;
    const truncated = truncator.truncate(text, 500);

    expect(truncated).toContain('critical quote');
  });

  test('preserves code blocks', () => {
    const text = `
      Introduction.
      ${' '.repeat(10000)}
      \`\`\`python
      def important_function():
          return 42
      \`\`\`
      Conclusion.
    `;
    const truncated = truncator.truncate(text, 800);

    expect(truncated).toContain('important_function');
  });

  test('truncated output is within maxChars', () => {
    const text = 'a'.repeat(50000);
    const truncated = truncator.truncate(text, 5000);
    expect(truncated.length).toBeLessThanOrEqual(5500); // Allow some overhead
  });

  test('includes preserved entities section when truncating', () => {
    const text = `
      Start: Initial research by Smith.
      ${' '.repeat(10000)}
      Important middle: Dr. Johnson found that 75% of users prefer Apple products and Android devices.
      ${' '.repeat(10000)}
      End section.
    `;
    const truncated = truncator.truncate(text, 500);

    // Entities from the middle should be preserved
    const hasPreservedSection = truncated.includes('PRESERVED ENTITIES');
    const hasManyElided = truncated.includes('characters omitted');
    expect(hasPreservedSection && hasManyElided).toBe(true);
  });

  test('includes elision indicator', () => {
    const text = 'a'.repeat(50000);
    const truncated = truncator.truncate(text, 5000);
    expect(truncated).toContain('characters omitted');
  });

  test('extracts numbers with high importance', () => {
    const text = 'The study found that 95% of participants agreed.';
    const entities = truncator.extractEntities(text);
    const percentEntity = entities.find(e => e.text === '95%');
    expect(percentEntity).toBeDefined();
    expect(percentEntity?.importance).toBe(0.9); // percentages are 0.9
  });

  test('extracts dates', () => {
    const text = 'The report was published on 01/15/2025.';
    const entities = truncator.extractEntities(text);
    const dateEntity = entities.find(e => e.type === 'date');
    expect(dateEntity).toBeDefined();
  });

  test('preserves head and tail of truncated text', () => {
    const text = `Start with important info.
    ${'filler '.repeat(5000)}
    End with important info.`;
    const truncated = truncator.truncate(text, 500);

    expect(truncated).toContain('Start with important');
    expect(truncated).toContain('End with important');
  });

  test('handles text with multiple entity types', () => {
    const text = `
      Dr. Smith reported that 87% of the data matched expectations on 12/25/2024.
      "This is significant," he said.
      \`\`\`
      result = calculate(0.87)
      \`\`\`
      ${' '.repeat(10000)}
      Final conclusion by Prof. Johnson.
    `;
    const entities = truncator.extractEntities(text);

    expect(entities.some(e => e.type === 'named_entity')).toBe(true);
    expect(entities.some(e => e.type === 'number')).toBe(true);
    expect(entities.some(e => e.type === 'date')).toBe(true);
  });
});

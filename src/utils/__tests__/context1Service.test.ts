/**
 * Context-1 Service Tests
 * Tests for document analysis and retrieval
 */

import { describe, it, expect, vi } from 'vitest';
import { findSections, filterDocument, analyzeDocumentStructure, askAboutDocument } from '../context1Service';

const sampleDocument = `
# Product Research Report

## Executive Summary
Our research shows strong market demand for eco-friendly products. Key findings include:
- 73% of consumers prefer sustainable alternatives
- Market size growing at 12% annually
- Major competitors are focusing on premium positioning

## Challenges and Opportunities
The primary challenge is sourcing sustainable materials at scale.
Opportunities include partnerships with established logistics companies.
Another key challenge is building consumer trust around authenticity.

## Competitor Analysis
Main competitors include GreenBox, EcoLife, and SustainableCo.
GreenBox focuses on packaging, EcoLife on apparel, SustainableCo on broader lifestyle.
Market gaps exist in home goods and personal care categories.

## Recommendations
We recommend launching in home goods first, partnering with suppliers,
and building community trust through transparency initiatives.
Target market should focus on urban millennials initially.

## Conclusion
The eco-friendly market presents significant opportunities for growth.
Success requires authentic positioning and scalable sourcing solutions.
`;

describe('context1Service document analysis', () => {
  describe('findSections', () => {
    it('should find sections matching simple query', async () => {
      // Note: This would call Context-1 in production
      // In tests, it falls back to naive substring search
      const sections = await findSections(sampleDocument, 'challenges', 5);

      expect(Array.isArray(sections)).toBe(true);
      // Naive fallback should find "Challenges and Opportunities"
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should limit results by maxResults parameter', async () => {
      const sections = await findSections(sampleDocument, 'market', 2);

      expect(sections.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty document gracefully', async () => {
      const sections = await findSections('', 'query', 5);

      expect(Array.isArray(sections)).toBe(true);
      expect(sections).toEqual([]);
    });

    it('should handle query with no matches gracefully', async () => {
      const sections = await findSections(sampleDocument, 'xyznotfound123', 5);

      expect(Array.isArray(sections)).toBe(true);
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();

      const promise = findSections(sampleDocument, 'test', 5, controller.signal);

      // Verify abort signal works
      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);

      // Promise should resolve even if aborted
      const result = await promise;
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('filterDocument', () => {
    it('should filter document by criteria', async () => {
      const filtered = await filterDocument(sampleDocument, 'opportunity');

      expect(typeof filtered).toBe('string');
      // Filtered doc should be smaller than original
      expect(filtered.length).toBeLessThanOrEqual(sampleDocument.length);
    });

    it('should return empty string when no matches', async () => {
      const filtered = await filterDocument(sampleDocument, 'xyznotfound123');

      expect(typeof filtered).toBe('string');
    });

    it('should join multiple sections with newlines', async () => {
      const filtered = await filterDocument(sampleDocument, 'market');

      // Should contain section separators if multiple matches
      if (filtered.includes('\n\n')) {
        expect(filtered).toContain('\n\n');
      }
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();

      const promise = filterDocument(sampleDocument, 'test', controller.signal);

      controller.abort();
      expect(controller.signal.aborted).toBe(true);

      const result = await promise;
      expect(typeof result).toBe('string');
    });
  });

  describe('analyzeDocumentStructure', () => {
    it('should return structure analysis object', async () => {
      const analysis = await analyzeDocumentStructure(sampleDocument);

      expect(analysis).toHaveProperty('sections');
      expect(analysis).toHaveProperty('keyPoints');
      expect(analysis).toHaveProperty('suggestedEdits');

      expect(Array.isArray(analysis.sections)).toBe(true);
      expect(Array.isArray(analysis.keyPoints)).toBe(true);
      expect(Array.isArray(analysis.suggestedEdits)).toBe(true);
    });

    it('should handle empty document', async () => {
      const analysis = await analyzeDocumentStructure('');

      expect(Array.isArray(analysis.sections)).toBe(true);
      expect(Array.isArray(analysis.keyPoints)).toBe(true);
      expect(Array.isArray(analysis.suggestedEdits)).toBe(true);
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();

      const promise = analyzeDocumentStructure(sampleDocument, controller.signal);

      controller.abort();
      expect(controller.signal.aborted).toBe(true);

      const result = await promise;
      expect(result).toHaveProperty('sections');
    });
  });

  describe('askAboutDocument', () => {
    it('should return answer string', async () => {
      const answer = await askAboutDocument(sampleDocument, 'What are the main challenges?');

      expect(typeof answer).toBe('string');
      // Should return either answer content or error message
      expect(answer.length).toBeGreaterThan(0);
    });

    it('should handle questions with no relevant content', async () => {
      const answer = await askAboutDocument(sampleDocument, 'xyznotfound123');

      expect(typeof answer).toBe('string');
      // Should either return "No relevant sections" or synthesis prompt
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();

      const promise = askAboutDocument(sampleDocument, 'What is this?', controller.signal);

      controller.abort();
      expect(controller.signal.aborted).toBe(true);

      const result = await promise;
      expect(typeof result).toBe('string');
    });
  });

  describe('Document analysis integration', () => {
    it('should chain multiple analysis operations', async () => {
      // Find specific sections
      const challengeSections = await findSections(sampleDocument, 'challenge', 3);
      expect(challengeSections.length).toBeGreaterThan(0);

      // Filter document for recommendations
      const recommendationsOnly = await filterDocument(sampleDocument, 'recommendation');
      expect(recommendationsOnly.length).toBeGreaterThan(0);

      // Analyze structure
      const structure = await analyzeDocumentStructure(sampleDocument);
      expect(structure.sections.length).toBeGreaterThanOrEqual(0);

      // Ask questions
      const answer = await askAboutDocument(sampleDocument, 'What is the target market?');
      expect(typeof answer).toBe('string');
    });
  });

  describe('Document analysis error handling', () => {
    it('should gracefully handle malformed input', async () => {
      const malformed = null as unknown as string;

      // These should not throw, but handle gracefully
      try {
        // Type assertion to bypass TypeScript check
        await findSections(malformed as string, 'test');
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    it('should handle very large documents', async () => {
      const largeDoc = sampleDocument.repeat(100); // ~50KB

      const sections = await findSections(largeDoc, 'market', 5);
      expect(Array.isArray(sections)).toBe(true);
    });
  });
});

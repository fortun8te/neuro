/**
 * Citation Service — Link facts to sources with proper attribution
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('citation-service');

export interface Citation {
  sourceUrl: string,
  pageNum?: number,
  quoteContext?: string,
  extractionConfidence: number,
  timestamp: number
}

export interface FormattedCitation {
  format: 'markdown' | 'apa' | 'chicago',
  text: string
}

export class CitationService {
  private citations: Map<string, Citation[]> = new Map();

  createCitation(
    factId: string,
    sourceUrl: string,
    quoteContext?: string,
    pageNum?: number,
    confidence: number = 0.8
  ): void {
    try {
      if (!this.citations.has(factId)) {
        this.citations.set(factId, []);
      }

      this.citations.get(factId)!.push({
        sourceUrl,
        pageNum,
        quoteContext: quoteContext?.slice(0, 200),
        extractionConfidence: confidence,
        timestamp: Date.now()
      });

      log.debug(`Created citation for fact ${factId} → ${sourceUrl}`);
    } catch (err) {
      log.error('createCitation failed:', err);
    }
  }

  formatCitations(factId: string, format: 'markdown' | 'apa' | 'chicago' = 'markdown'): string[] {
    try {
      const cites = this.citations.get(factId) || [];

      return cites.map(cite => {
        const domain = new URL(cite.sourceUrl).hostname || cite.sourceUrl;

        switch (format) {
          case 'apa':
            // Simplified APA format
            return `${domain}. Retrieved from ${cite.sourceUrl}${cite.pageNum ? ` (p. ${cite.pageNum})` : ''}`;

          case 'chicago':
            // Simplified Chicago format
            return `${domain}, "${cite.sourceUrl}"${cite.pageNum ? `, page ${cite.pageNum}` : ''}`;

          case 'markdown':
          default:
            // Markdown with inline link
            return `[${domain}](${cite.sourceUrl})${cite.pageNum ? ` (p. ${cite.pageNum})` : ''}`;
        }
      });
    } catch (err) {
      log.error('formatCitations failed:', err);
      return [];
    }
  }

  getCitationScore(factId: string): number {
    try {
      const cites = this.citations.get(factId);
      if (!cites || cites.length === 0) return 0;

      // Average confidence of all citations for this fact
      const avgConfidence = cites.reduce((sum, c) => sum + c.extractionConfidence, 0) / cites.length;
      const sourceCount = new Set(cites.map(c => c.sourceUrl)).size;

      // Score = average confidence × coverage (multiple sources = higher score)
      return Math.min(avgConfidence * (1 + Math.log(sourceCount)), 1.0);
    } catch (err) {
      log.error('getCitationScore failed:', err);
      return 0;
    }
  }

  getCitations(factId: string): Citation[] {
    return this.citations.get(factId) || [];
  }

  getAllCitations(): Map<string, Citation[]> {
    return new Map(this.citations);
  }

  clear(): void {
    this.citations.clear();
  }
}

export const citationService = new CitationService();

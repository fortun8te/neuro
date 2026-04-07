/**
 * inlineCitations.ts — Utilities for rendering inline citation badges in text
 *
 * Provides:
 * - Citation injection into text
 * - Superscript number generation
 * - Citation index mapping
 */

import type { Source } from './sourceExtractor';

/**
 * Citation metadata for a specific citation in text
 */
export interface InlineCitation {
  id: string; // unique ID for React keys
  index: number; // citation number (1-based)
  start: number; // position in text where citation starts
  end: number; // position in text where citation ends
  sourceUrl: string; // URL being cited
  sourceTitle?: string;
  sourceDomain?: string;
}

/**
 * Parsed text with embedded citations
 */
export interface TextWithCitations {
  text: string;
  citations: InlineCitation[];
}

/**
 * Extract citation patterns from text
 * Looks for: [1], [2], etc. or @citation-key patterns
 */
export function extractCitationMarkers(text: string): InlineCitation[] {
  const citations: InlineCitation[] = [];
  const citationPattern = /\[(\d+)\]/g;

  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    const index = parseInt(match[1], 10);
    citations.push({
      id: `cite-${match.index}-${index}`,
      index,
      start: match.index,
      end: match.index + match[0].length,
      sourceUrl: '', // Will be filled in by caller
      sourceTitle: undefined,
      sourceDomain: undefined,
    });
  }

  return citations;
}

/**
 * Map citation indices to sources
 */
export function mapCitationsToSources(
  citations: InlineCitation[],
  sources: Source[]
): InlineCitation[] {
  return citations.map(citation => {
    const source = sources[citation.index - 1]; // Convert 1-based index to 0-based array index
    return {
      ...citation,
      sourceUrl: source?.url || '',
      sourceTitle: source?.title,
      sourceDomain: source?.domain,
    };
  });
}

/**
 * Generate inline citation markup
 * Returns HTML with superscript citation numbers and links
 */
export function generateInlineCitationHTML(
  text: string,
  citations: InlineCitation[],
  linked: boolean = false
): string {
  if (citations.length === 0) {
    return text;
  }

  // Sort citations by position in reverse to avoid offset issues
  const sorted = [...citations].sort((a, b) => b.start - a.start);

  let result = text;
  for (const citation of sorted) {
    const citationMarkup = linked
      ? `<a href="${citation.sourceUrl}" target="_blank" rel="noopener noreferrer" class="citation-link">[${citation.index}]</a>`
      : `<sup class="citation-number">${citation.index}</sup>`;

    // Replace [N] pattern with citation markup
    result =
      result.slice(0, citation.start) +
      citationMarkup +
      result.slice(citation.end);
  }

  return result;
}

/**
 * Generate plain text reference list from citations
 */
export function generateCitationReferenceList(
  citations: InlineCitation[],
  includeSnippets: boolean = false
): string {
  const sorted = [...citations].sort((a, b) => a.index - b.index);
  const unique = Array.from(new Map(sorted.map(c => [c.index, c])).values());

  const lines = unique.map(citation => {
    let line = `[${citation.index}] ${citation.sourceDomain || citation.sourceUrl}`;
    if (citation.sourceTitle) {
      line += ` — ${citation.sourceTitle}`;
    }
    return line;
  });

  return lines.join('\n');
}

/**
 * React component helper: Generate citation badge props
 */
export function getCitationBadgeProps(citation: InlineCitation): {
  key: string;
  title: string;
  className: string;
  dataIndex: number;
  dataUrl: string;
} {
  return {
    key: citation.id,
    title: `${citation.sourceDomain || citation.sourceUrl}${citation.sourceTitle ? ` — ${citation.sourceTitle}` : ''}`,
    className: 'citation-badge',
    dataIndex: citation.index,
    dataUrl: citation.sourceUrl,
  };
}

/**
 * Inject citations into text at specific positions
 * Updates citation markers with source information
 */
export function injectCitationsIntoText(
  text: string,
  sources: Source[],
  pattern: 'brackets' | 'superscript' = 'brackets'
): TextWithCitations {
  const citations = extractCitationMarkers(text);
  const mapped = mapCitationsToSources(citations, sources);

  return {
    text,
    citations: mapped,
  };
}

/**
 * Validate citation indices are within range
 */
export function validateCitations(citations: InlineCitation[], sourceCount: number): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const maxIndex = sourceCount;

  for (const citation of citations) {
    if (citation.index < 1) {
      errors.push(`Invalid citation index ${citation.index} at position ${citation.start}: must be >= 1`);
    }
    if (citation.index > maxIndex) {
      errors.push(
        `Citation index ${citation.index} at position ${citation.start} exceeds source count ${sourceCount}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Count unique citations in text
 */
export function countUniqueCitations(citations: InlineCitation[]): number {
  return new Set(citations.map(c => c.index)).size;
}

/**
 * Get citation coverage ratio (cited sources / total sources)
 */
export function getCitationCoverage(citations: InlineCitation[], sourceCount: number): number {
  if (sourceCount === 0) return 0;
  const coverage = countUniqueCitations(citations) / sourceCount;
  return Math.min(coverage, 1); // Cap at 100%
}

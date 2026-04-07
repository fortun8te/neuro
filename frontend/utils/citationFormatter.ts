/**
 * citationFormatter.ts — Citation formatting utilities
 *
 * Supports multiple citation formats:
 * - APA: Author (Year). Title. Retrieved from URL
 * - MLA: Author. "Title." Website, Year, URL.
 * - Chicago: Author. "Title." Website. Accessed Month Day, Year. URL.
 */

import type { Source } from './sourceExtractor';

export type CitationFormat = 'APA' | 'MLA' | 'Chicago';

interface CitationData {
  authors?: string[];
  title?: string;
  domain?: string;
  url: string;
  publicationDate?: string;
  accessDate?: string;
}

/**
 * Extract citation data from Source
 */
function extractCitationData(source: Source): CitationData {
  return {
    title: source.title || 'Web Page',
    domain: source.domain,
    url: source.url,
    publicationDate: source.fetchedAt ? new Date(source.fetchedAt).getFullYear().toString() : undefined,
    accessDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

/**
 * Format citation in APA style
 */
export function formatAPA(source: Source): string {
  const data = extractCitationData(source);
  const domain = data.domain || new URL(source.url).hostname;
  const year = data.publicationDate || new Date().getFullYear();

  return `${domain} (${year}). ${data.title}. Retrieved from ${source.url}`;
}

/**
 * Format citation in MLA style
 */
export function formatMLA(source: Source): string {
  const data = extractCitationData(source);
  const domain = data.domain || new URL(source.url).hostname;
  const year = data.publicationDate || new Date().getFullYear();

  return `"${data.title}." ${domain}, ${year}, ${source.url}.`;
}

/**
 * Format citation in Chicago style
 */
export function formatChicago(source: Source): string {
  const data = extractCitationData(source);
  const domain = data.domain || new URL(source.url).hostname;

  return `"${data.title}." ${domain}. Accessed ${data.accessDate}. ${source.url}`;
}

/**
 * Format citation in specified format
 */
export function formatCitation(source: Source, format: CitationFormat): string {
  switch (format) {
    case 'APA':
      return formatAPA(source);
    case 'MLA':
      return formatMLA(source);
    case 'Chicago':
      return formatChicago(source);
    default:
      return formatAPA(source);
  }
}

/**
 * Generate full citation text for multiple sources
 */
export function generateBibliography(sources: Source[], format: CitationFormat): string {
  const citations = sources.map((source, idx) => {
    const citation = formatCitation(source, format);
    return `${idx + 1}. ${citation}`;
  });

  return citations.join('\n\n');
}

/**
 * Get format description
 */
export function getFormatDescription(format: CitationFormat): string {
  const descriptions: Record<CitationFormat, string> = {
    APA: 'American Psychological Association',
    MLA: 'Modern Language Association',
    Chicago: 'Chicago Manual of Style',
  };

  return descriptions[format];
}

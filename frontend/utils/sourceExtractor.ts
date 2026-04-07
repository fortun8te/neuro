/**
 * sourceExtractor.ts — Extract sources from research findings and agent outputs
 *
 * Handles:
 * - Extracting URLs from text
 * - Parsing research findings' SourceCitation arrays
 * - Getting page metadata (title, snippet)
 * - Deduplicating and normalizing sources
 */

import type { SourceCitation } from '../types';

export interface Source {
  url: string;
  title?: string;
  domain: string;
  snippet?: string;
  favicon?: string;
  fetchedAt?: number;
  relevanceScore?: number;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

/**
 * Convert SourceCitation to SourcesList Source format
 */
export function citationToSource(citation: SourceCitation): Source {
  return {
    url: citation.url,
    title: citation.title,
    domain: extractDomain(citation.url),
  };
}

/**
 * Extract all URLs from text using regex
 * Matches http(s), www., and common domain patterns
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];

  const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlPattern) || [];

  // Convert www. URLs to http://
  return matches.map(url => {
    if (url.startsWith('www.')) return `http://${url}`;
    return url;
  });
}

/**
 * Deduplicate sources by URL (case-insensitive)
 */
export function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter(s => {
    const normalized = s.url.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Extract sources from research findings
 * Combines:
 * - Direct SourceCitation array
 * - URLs embedded in insights text
 * - Visual findings URLs
 */
export function extractSourcesFromFindings(findings: any): Source[] {
  const sources: Source[] = [];

  // 1. Direct source citations
  if (Array.isArray(findings.sources)) {
    sources.push(...findings.sources.map(citationToSource));
  }

  // 2. URLs from insights text
  if (findings.insights && typeof findings.insights === 'string') {
    const urls = extractUrlsFromText(findings.insights);
    urls.forEach(url => {
      sources.push({
        url,
        domain: extractDomain(url),
      });
    });
  }

  // 3. URLs from visual findings
  if (findings.visualFindings?.competitorVisuals) {
    findings.visualFindings.competitorVisuals.forEach((visual: any) => {
      if (visual.url) {
        sources.push({
          url: visual.url,
          title: `Visual Analysis: ${extractDomain(visual.url)}`,
          domain: extractDomain(visual.url),
        });
      }
    });
  }

  // 4. Audit trail URLs (research audit)
  if (findings.auditTrail?.urls) {
    findings.auditTrail.urls.forEach((url: string) => {
      sources.push({
        url,
        domain: extractDomain(url),
      });
    });
  }

  return deduplicateSources(sources);
}

/**
 * Extract sources from agent message text
 * Looks for patterns like:
 * - [1] https://example.com
 * - Source: https://example.com
 * - From: https://example.com
 * - Raw URLs
 */
export function extractSourcesFromMessage(text: string): Source[] {
  if (!text) return [];

  const sources: Source[] = [];

  // Pattern 1: [N] URL format
  const citedPattern = /\[\d+\]\s*(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const citedMatches = text.matchAll(citedPattern);
  for (const match of citedMatches) {
    let url = match[1];
    if (url.startsWith('www.')) url = `http://${url}`;
    sources.push({
      url,
      domain: extractDomain(url),
    });
  }

  // Pattern 2: "Source:" or "From:" or "URL:" prefixed
  const labeledPattern = /(?:Source|From|URL):\s*(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const labeledMatches = text.matchAll(labeledPattern);
  for (const match of labeledMatches) {
    let url = match[1];
    if (url.startsWith('www.')) url = `http://${url}`;
    sources.push({
      url,
      domain: extractDomain(url),
    });
  }

  // Pattern 3: Raw URLs
  const rawUrls = extractUrlsFromText(text);
  rawUrls.forEach(url => {
    sources.push({
      url,
      domain: extractDomain(url),
    });
  });

  return deduplicateSources(sources);
}

/**
 * Remove full URLs from message text
 * Keeps structured patterns like [Source: example.com] but removes bare URLs
 */
export function removeUrlsFromText(text: string): string {
  if (!text) return '';

  // Remove raw URLs but keep structured source references like [Source: domain]
  // This regex removes https://... or www.... when they appear as standalone text
  return text
    .split('\n')
    .map(line => {
      // Skip lines that are purely source metadata
      if (/^\[Source:\s*https?:\/\/.+?\]$/.test(line.trim())) {
        return '';
      }
      // Remove inline full URLs and clean up extra spaces
      return line
        .replace(/https?:\/\/[^\s\]]+/g, '')
        .replace(/\s+/g, ' ')  // collapse multiple spaces
        .trim();
    })
    .filter(line => line.length > 0)
    .join('\n');
}

/**
 * Merge multiple source arrays with deduplication
 */
export function mergeSources(...sourceLists: Source[][]): Source[] {
  const combined = sourceLists.flat();
  return deduplicateSources(combined);
}

/**
 * Get snippet from text for a given URL (first N chars around URL mention)
 */
export function getSnippetForUrl(text: string, url: string, contextLength: number = 100): string | undefined {
  const index = text.toLowerCase().indexOf(url.toLowerCase());
  if (index === -1) return undefined;

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + url.length + contextLength);
  const snippet = text.slice(start, end).trim();

  // Clean up snippet
  return snippet
    .replace(/\s+/g, ' ')
    .replace(/^[^\s]+\s+/, '') // Remove partial first word
    .replace(/\s+[^\s]+$/, '') // Remove partial last word
    .slice(0, 120) + (snippet.length > 120 ? '...' : '');
}

/**
 * Sort sources by relevance/importance
 * Factors:
 * - Domain diversity (prioritize unique domains)
 * - Relevance score (if available)
 * - Source type (direct citations > extracted URLs)
 */
export function sortSourcesByRelevance(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    // Favor sources with explicit metadata (title, snippet)
    const aHasMetadata = !!(a.title || a.snippet);
    const bHasMetadata = !!(b.title || b.snippet);
    if (aHasMetadata && !bHasMetadata) return -1;
    if (!aHasMetadata && bHasMetadata) return 1;

    // Then by domain name (alphabetical for consistency)
    return a.domain.localeCompare(b.domain);
  });
}

/**
 * Format source count for UI
 */
export function formatSourceCount(count: number): string {
  if (count === 0) return 'No sources';
  if (count === 1) return '1 source';
  return `${count} sources`;
}

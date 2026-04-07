/**
 * sourceExporter.ts — Export sources in multiple formats
 *
 * Supports:
 * - JSON: Full source objects
 * - CSV: Tabular format
 * - BibTeX: LaTeX bibliography format
 */

import type { Source } from './sourceExtractor';
import { formatCitation, type CitationFormat } from './citationFormatter';

export type ExportFormat = 'JSON' | 'CSV' | 'BibTeX' | 'Bibliography';

/**
 * Export sources as JSON
 */
export function exportJSON(sources: Source[], pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(sources, null, 2);
  }
  return JSON.stringify(sources);
}

/**
 * Export sources as CSV
 */
export function exportCSV(sources: Source[]): string {
  const headers = ['URL', 'Title', 'Domain', 'Snippet'];
  const rows: string[][] = [headers];

  for (const source of sources) {
    rows.push([
      source.url,
      `"${(source.title || '').replace(/"/g, '""')}"`,
      source.domain,
      `"${(source.snippet || '').replace(/"/g, '""')}"`,
    ]);
  }

  return rows.map(row => row.join(',')).join('\n');
}

/**
 * Escape special characters for BibTeX
 */
function escapeBibTeX(text: string): string {
  return text
    .replace(/[&]/g, '\\&')
    .replace(/[%]/g, '\\%')
    .replace(/[#]/g, '\\#')
    .replace(/[_]/g, '\\_')
    .replace(/[{]/g, '\\{')
    .replace(/[}]/g, '\\}')
    .replace(/[~]/g, '\\textasciitilde{}')
    .replace(/[\^]/g, '\\textasciicircum{}');
}

/**
 * Generate BibTeX key from URL
 */
function generateBibTeXKey(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const year = new Date().getFullYear();
    return `${domain}${year}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch {
    return `web${Date.now()}`.toLowerCase();
  }
}

/**
 * Export sources as BibTeX
 */
export function exportBibTeX(sources: Source[]): string {
  const entries: string[] = [];

  for (const source of sources) {
    const key = generateBibTeXKey(source.url);
    const title = escapeBibTeX(source.title || 'Web Page');
    const domain = escapeBibTeX(source.domain);
    const year = new Date().getFullYear();

    const entry = `@misc{${key},
  title = {${title}},
  author = {${domain}},
  year = {${year}},
  url = {${source.url}},
  urldate = {${new Date().toISOString().split('T')[0]}}
}`;

    entries.push(entry);
  }

  return entries.join('\n\n');
}

/**
 * Export sources as formatted bibliography
 */
export function exportBibliography(sources: Source[], format: CitationFormat = 'APA'): string {
  const citations = sources.map((source, idx) => {
    const citation = formatCitation(source, format);
    return `${idx + 1}. ${citation}`;
  });

  return citations.join('\n\n');
}

/**
 * Generic export function
 */
export function exportSources(sources: Source[], format: ExportFormat): string {
  switch (format) {
    case 'JSON':
      return exportJSON(sources, true);
    case 'CSV':
      return exportCSV(sources);
    case 'BibTeX':
      return exportBibTeX(sources);
    case 'Bibliography':
      return exportBibliography(sources, 'APA');
    default:
      return exportJSON(sources, true);
  }
}

/**
 * Download exported sources
 */
export function downloadSources(sources: Source[], format: ExportFormat): void {
  const content = exportSources(sources, format);

  const fileExtensions: Record<ExportFormat, string> = {
    JSON: 'json',
    CSV: 'csv',
    BibTeX: 'bib',
    Bibliography: 'txt',
  };

  const mimeTypes: Record<ExportFormat, string> = {
    JSON: 'application/json',
    CSV: 'text/csv',
    BibTeX: 'text/plain',
    Bibliography: 'text/plain',
  };

  const filename = `sources-${Date.now()}.${fileExtensions[format]}`;
  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy export to clipboard
 */
export async function copyToClipboard(sources: Source[], format: ExportFormat): Promise<void> {
  const content = exportSources(sources, format);
  await navigator.clipboard.writeText(content);
}

/**
 * Get export format description
 */
export function getFormatDescription(format: ExportFormat): string {
  const descriptions: Record<ExportFormat, string> = {
    JSON: 'Structured data format',
    CSV: 'Spreadsheet-compatible format',
    BibTeX: 'LaTeX bibliography format',
    Bibliography: 'Human-readable citations',
  };

  return descriptions[format];
}

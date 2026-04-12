/**
 * Document Generator — Export research reports in multiple formats
 *
 * Generates markdown, HTML, and PDF with citations and proper formatting
 */

import { createLogger } from '../utils/logger';

const log = createLogger('doc-generator');

export interface ReportSection {
  title: string;
  content: string;
  findings?: Array<{ fact: string; sources: string[] }>;
  confidence?: number;
}

export interface ResearchReport {
  question: string;
  sections: ReportSection[];
  executive_summary?: string;
  generated_at: string;
  metadata?: Record<string, any>;
}

export class DocumentGenerator {

  async generateMarkdownReport(report: ResearchReport, citations: Map<string, string[]> = new Map()): Promise<string> {
    try {
      let md = `# Research Report: ${report.question}\n\n`;
      md += `**Generated:** ${report.generated_at}\n`;
      md += `**Sections:** ${report.sections.length}\n\n`;

      if (report.executive_summary) {
        md += `## Executive Summary\n\n${report.executive_summary}\n\n---\n\n`;
      }

      let citationIndex = 1;
      const citationMap = new Map<string, number>();

      for (const section of report.sections) {
        md += `## ${section.title}\n\n`;
        md += `${section.content}\n\n`;

        if (section.findings && section.findings.length > 0) {
          md += `**Key Findings:**\n`;
          for (const finding of section.findings.slice(0, 5)) {
            const sources = finding.sources.map(s => {
              if (!citationMap.has(s)) {
                citationMap.set(s, citationIndex++);
              }
              return `[${citationMap.get(s)}]`;
            }).join(', ');

            md += `- ${finding.fact} ${sources}\n`;
          }
          md += `\n`;
        }

        if (section.confidence !== undefined) {
          const confidencePct = Math.round(section.confidence * 100);
          md += `*Confidence: ${confidencePct}%*\n\n`;
        }

        md += `---\n\n`;
      }

      // Bibliography
      md += `## Bibliography\n\n`;
      const sortedCitations = Array.from(citationMap.entries())
        .sort((a, b) => a[1] - b[1]);

      for (const [url, idx] of sortedCitations) {
        try {
          const domain = new URL(url).hostname || url;
          md += `[${idx}] ${domain} — ${url}\n`;
        } catch {
          md += `[${idx}] ${url}\n`;
        }
      }

      return md;
    } catch (err) {
      log.error('generateMarkdownReport failed:', err);
      return '';
    }
  }

  async generateHTMLReport(report: ResearchReport, cssCustom?: string): Promise<string> {
    try {
      const sections = report.sections.map((s, i) => `
        <section id="section-${i}">
          <h2>${escapeHtml(s.title)}</h2>
          <article>${escapeHtml(s.content)}</article>
          ${s.confidence ? `<p class="confidence">Confidence: ${Math.round(s.confidence * 100)}%</p>` : ''}
        </section>
      `).join('\n');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Research Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 2.5em; margin-bottom: 10px; color: #000; }
    h2 { font-size: 1.8em; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    section { margin-bottom: 30px; }
    article { background: #f9f9f9; padding: 15px; border-left: 4px solid #007acc; margin-bottom: 15px; }
    .meta { color: #666; font-size: 0.95em; margin-bottom: 20px; }
    .confidence { color: #666; font-style: italic; margin-top: 10px; }
    .bibliography { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; }
    .bibliography ol { margin-left: 20px; }
    .bibliography li { margin-bottom: 10px; }
    a { color: #007acc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) {
      body { padding: 20px 10px; }
      .container { padding: 20px; }
      h1 { font-size: 1.8em; }
      h2 { font-size: 1.3em; }
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      section { page-break-inside: avoid; }
    }
    ${cssCustom || ''}
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(report.question)}</h1>
    <div class="meta">
      <p><strong>Generated:</strong> ${report.generated_at}</p>
      <p><strong>Sections:</strong> ${report.sections.length}</p>
    </div>

    ${report.executive_summary ? `
      <h2>Executive Summary</h2>
      <article>${escapeHtml(report.executive_summary)}</article>
    ` : ''}

    ${sections}

    <div class="bibliography">
      <h2>Bibliography</h2>
      <ol>
        ${report.sections.flatMap(s => s.findings?.flatMap(f => f.sources) || [])
          .filter((url, i, arr) => arr.indexOf(url) === i)
          .map(url => {
            try {
              const domain = new URL(url).hostname || url;
              return `<li><a href="${escapeHtml(url)}">${escapeHtml(domain)}</a></li>`;
            } catch {
              return `<li>${escapeHtml(url)}</li>`;
            }
          })
          .join('\n        ')}
      </ol>
    </div>
  </div>
</body>
</html>`;

      return html;
    } catch (err) {
      log.error('generateHTMLReport failed:', err);
      return '';
    }
  }

  async saveReport(html: string, outputPath: string): Promise<void> {
    try {
      // Use dynamic import to avoid issues with Node.js fs in browser context
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, html, 'utf-8');
      log.info(`Report saved to ${outputPath}`);
    } catch (err) {
      log.error(`Failed to save report to ${outputPath}:`, err);
      throw err;
    }
  }

  getReportSummary(report: ResearchReport): {
    totalSections: number;
    totalFindings: number;
    averageConfidence: number;
    allUrls: string[];
  } {
    const allFindings = report.sections.flatMap(s => s.findings || []);
    const allUrls = allFindings.flatMap(f => f.sources);
    const uniqueUrls = Array.from(new Set(allUrls));
    const confidences = report.sections
      .filter(s => s.confidence !== undefined)
      .map(s => s.confidence as number);

    return {
      totalSections: report.sections.length,
      totalFindings: allFindings.length,
      averageConfidence: confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      allUrls: uniqueUrls
    };
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export const docGenerator = new DocumentGenerator();

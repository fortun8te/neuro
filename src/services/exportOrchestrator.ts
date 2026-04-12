/**
 * Export Orchestrator — Unified export interface
 *
 * Handles exporting research findings in multiple formats:
 * - PDF (raw and polished)
 * - Markdown
 * - HTML
 * - JSON
 *
 * Integrates with existing docGenerator for markdown/HTML
 */

import { createLogger } from '../utils/logger';
import { pdfExporter, type PDFExportOptions } from './pdfExporter';
import { docGenerator, type ResearchReport } from './docGenerator';
import type { ResearchFindings } from '../frontend/types';

const log = createLogger('export-orchestrator');

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf-raw' | 'pdf-polished' | 'pdf-both' | 'markdown' | 'html' | 'json';

export interface ExportRequest {
  findings: ResearchFindings;
  format: ExportFormat | ExportFormat[];
  outputDir: string;
  baseFilename?: string;
  pdfOptions?: PDFExportOptions;
}

export interface ExportResult {
  success: boolean;
  files: string[];
  format: ExportFormat | ExportFormat[];
  totalSize?: number;
  duration: number;
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// Export Orchestrator Class
// ──────────────────────────────────────────────────────────────

export class ExportOrchestrator {
  async export(request: ExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    const files: string[] = [];
    const formats = Array.isArray(request.format) ? request.format : [request.format];

    try {
      const baseFilename = request.baseFilename || 'research-findings';

      for (const format of formats) {
        try {
          switch (format) {
            case 'pdf-raw':
              await this.exportPdfRaw(
                request.findings,
                `${request.outputDir}/${baseFilename}-raw.pdf`,
              );
              files.push(`${baseFilename}-raw.pdf`);
              break;

            case 'pdf-polished':
              await this.exportPdfPolished(
                request.findings,
                `${request.outputDir}/${baseFilename}-polished.pdf`,
                request.pdfOptions,
              );
              files.push(`${baseFilename}-polished.pdf`);
              break;

            case 'pdf-both':
              await this.exportPdfRaw(
                request.findings,
                `${request.outputDir}/${baseFilename}-raw.pdf`,
              );
              await this.exportPdfPolished(
                request.findings,
                `${request.outputDir}/${baseFilename}-polished.pdf`,
                request.pdfOptions,
              );
              files.push(`${baseFilename}-raw.pdf`, `${baseFilename}-polished.pdf`);
              break;

            case 'markdown':
              await this.exportMarkdown(
                request.findings,
                `${request.outputDir}/${baseFilename}.md`,
              );
              files.push(`${baseFilename}.md`);
              break;

            case 'html':
              await this.exportHtml(
                request.findings,
                `${request.outputDir}/${baseFilename}.html`,
              );
              files.push(`${baseFilename}.html`);
              break;

            case 'json':
              await this.exportJson(
                request.findings,
                `${request.outputDir}/${baseFilename}.json`,
              );
              files.push(`${baseFilename}.json`);
              break;

            default:
              log.warn(`Unknown format: ${format}`);
          }
        } catch (error) {
          log.error(`Export format ${format} failed:`, error);
          // Continue with other formats
        }
      }

      const duration = Date.now() - startTime;

      if (files.length === 0) {
        return {
          success: false,
          files: [],
          format: request.format,
          duration,
          error: 'No files were successfully exported',
        };
      }

      log.info(`Export completed: ${files.length} files in ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        files,
        format: request.format,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      log.error('Export orchestration failed:', message);

      return {
        success: false,
        files,
        format: request.format,
        duration,
        error: message,
      };
    }
  }

  private async exportPdfRaw(findings: ResearchFindings, filepath: string): Promise<void> {
    log.info(`Exporting PDF (raw format): ${filepath}`);
    await pdfExporter.exportRaw(findings, filepath);
  }

  private async exportPdfPolished(
    findings: ResearchFindings,
    filepath: string,
    options?: PDFExportOptions,
  ): Promise<void> {
    log.info(`Exporting PDF (polished format): ${filepath}`);
    const opts: PDFExportOptions = {
      format: 'polished',
      includeVisuals: true,
      includeMetrics: true,
      ...options,
    };
    await pdfExporter.exportPolished(findings, filepath, opts);
  }

  private async exportMarkdown(findings: ResearchFindings, filepath: string): Promise<void> {
    log.info(`Exporting Markdown: ${filepath}`);

    const report: ResearchReport = {
      question: 'Research Findings Report',
      generated_at: new Date().toISOString(),
      sections: this.buildReportSections(findings),
      executive_summary: this.buildExecutiveSummary(findings),
    };

    const markdown = await docGenerator.generateMarkdownReport(report);
    await docGenerator.saveReport(markdown, filepath);
  }

  private async exportHtml(findings: ResearchFindings, filepath: string): Promise<void> {
    log.info(`Exporting HTML: ${filepath}`);

    const report: ResearchReport = {
      question: 'Research Findings Report',
      generated_at: new Date().toISOString(),
      sections: this.buildReportSections(findings),
      executive_summary: this.buildExecutiveSummary(findings),
    };

    const html = await docGenerator.generateHTMLReport(report);
    await docGenerator.saveReport(html, filepath);
  }

  private async exportJson(findings: ResearchFindings, filepath: string): Promise<void> {
    log.info(`Exporting JSON: ${filepath}`);

    const json = JSON.stringify(findings, null, 2);
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, json, 'utf-8');
  }

  private buildExecutiveSummary(findings: ResearchFindings): string {
    let summary = 'This research report provides a comprehensive analysis of customer desires, market objections, ';
    summary += 'competitor positioning, and visual insights. ';

    const metrics: string[] = [];

    if (findings.deepDesires?.length) {
      metrics.push(`${findings.deepDesires.length} customer desire layers`);
    }

    if (findings.objections?.length) {
      metrics.push(`${findings.objections.length} purchase objections`);
    }

    if (findings.competitorAds?.competitors?.length) {
      metrics.push(`${findings.competitorAds.competitors.length} competitors analyzed`);
    }

    if (findings.auditTrail) {
      metrics.push(`${findings.auditTrail.totalSources} sources`);
      metrics.push(`${(findings.auditTrail.coverageAchieved * 100).toFixed(0)}% coverage`);
    }

    if (metrics.length > 0) {
      summary += `Key metrics: ${metrics.join(', ')}. `;
    }

    summary += 'Findings are organized by research dimension with confidence scores and source citations.';

    return summary;
  }

  private buildReportSections(findings: ResearchFindings) {
    const sections: ResearchReport['sections'] = [];

    // Deep Desires
    if (findings.deepDesires?.length) {
      sections.push({
        title: 'Customer Desires',
        content: `Identified ${findings.deepDesires.length} distinct layers of customer desire, from surface problems to deepest motivations.`,
        findings: findings.deepDesires.map((d) => ({
          fact: `${d.surfaceProblem} → ${d.deepestDesire}`,
          sources: [],
        })),
        confidence: 0.85,
      });
    }

    // Objections
    if (findings.objections?.length) {
      sections.push({
        title: 'Purchase Objections',
        content: `Mapped ${findings.objections.length} key objections with handling strategies.`,
        findings: findings.objections.map((o) => ({
          fact: `${o.objection} (${o.impact} impact)`,
          sources: [],
        })),
        confidence: 0.8,
      });
    }

    // Avatar Language
    if (findings.avatarLanguage?.length) {
      sections.push({
        title: 'Customer Language & Voice',
        content: 'Extracted authentic customer language and conversation patterns.',
        findings: findings.avatarLanguage.slice(0, 10).map((phrase) => ({
          fact: `"${phrase}"`,
          sources: [],
        })),
        confidence: 0.75,
      });
    }

    // Market Positioning
    if (findings.competitorAds?.competitors?.length) {
      sections.push({
        title: 'Competitive Positioning',
        content: `Analyzed ${findings.competitorAds.competitors.length} competitors and market positioning strategies.`,
        findings: findings.competitorAds.competitors.slice(0, 5).map((c) => ({
          fact: `${c.brand}: ${c.positioning}`,
          sources: [],
        })),
        confidence: 0.8,
      });
    }

    // Audit Trail
    if (findings.auditTrail) {
      sections.push({
        title: 'Research Methodology',
        content: `Research conducted using ${findings.auditTrail.modelsUsed.join(', ')} with ${findings.auditTrail.totalSources} sources across ${findings.auditTrail.iterationsCompleted} iterations.`,
        findings: [
          {
            fact: `Coverage: ${(findings.auditTrail.coverageAchieved * 100).toFixed(1)}%`,
            sources: [],
          },
          {
            fact: `Duration: ${(findings.auditTrail.researchDuration / 1000 / 60).toFixed(1)} minutes`,
            sources: [],
          },
        ],
        confidence: 0.9,
      });
    }

    return sections;
  }
}

export const exportOrchestrator = new ExportOrchestrator();

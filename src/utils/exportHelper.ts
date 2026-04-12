/**
 * Export Helper — CLI-friendly export utilities
 *
 * Provides convenient methods for exporting research findings from CLI
 * Handles both programmatic and direct file path exports
 */

import * as path from 'path';
import * as os from 'os';
import { createLogger } from './logger';
import { exportOrchestrator, type ExportRequest, type ExportFormat } from '../services/exportOrchestrator';
import type { ResearchFindings } from '../frontend/types';

const log = createLogger('export-helper');

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface CLIExportOptions {
  /** Output directory (defaults to ~/research-output) */
  outputDir?: string;
  /** Base filename without extension (defaults to 'research-findings-{timestamp}') */
  filename?: string;
  /** Export formats to generate */
  formats?: ExportFormat[];
  /** PDF-specific options */
  companyName?: string;
  reportTitle?: string;
  authorName?: string;
  includeVisuals?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

export interface CLIExportResult {
  success: boolean;
  files: Array<{
    format: string;
    filename: string;
    fullPath: string;
    success: boolean;
  }>;
  outputDir: string;
  totalDuration: number;
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// Export Helper Class
// ──────────────────────────────────────────────────────────────

export class ExportHelper {
  /**
   * Export findings to file(s) with sensible defaults
   */
  async exportFindings(
    findings: ResearchFindings,
    options: CLIExportOptions = {},
  ): Promise<CLIExportResult> {
    const startTime = Date.now();

    try {
      // Prepare directories and filenames
      const outputDir = options.outputDir || path.join(os.homedir(), 'research-output');
      const timestamp = new Date().toISOString().split('T')[0];
      const baseFilename = options.filename || `research-findings-${timestamp}`;

      // Ensure output directory exists
      const fs = await import('fs/promises');
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (error) {
        log.error(`Failed to create output directory: ${outputDir}`, error);
        throw error;
      }

      if (options.verbose) {
        log.info(`Export output directory: ${outputDir}`);
        log.info(`Base filename: ${baseFilename}`);
      }

      // Determine formats to export
      const formats: ExportFormat[] = options.formats || ['pdf-polished', 'markdown'];

      // Create export request
      const request: ExportRequest = {
        findings,
        format: formats,
        outputDir,
        baseFilename,
        pdfOptions: {
          format: 'polished',
          companyName: options.companyName,
          reportTitle: options.reportTitle || 'Research Findings Report',
          authorName: options.authorName,
          includeVisuals: options.includeVisuals !== false,
          includeMetrics: true,
        },
      };

      // Execute export
      const result = await exportOrchestrator.export(request);

      const duration = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          files: [],
          outputDir,
          totalDuration: duration,
          error: result.error || 'Export failed for unknown reason',
        };
      }

      // Build detailed results
      const files = result.files.map((filename) => {
        const fullPath = path.join(outputDir, filename);
        return {
          format: this.getFormatFromFilename(filename),
          filename,
          fullPath,
          success: true,
        };
      });

      if (options.verbose) {
        log.info(`Export completed successfully`);
        files.forEach((f) => {
          log.info(`  ✓ ${f.format}: ${f.filename}`);
        });
        log.info(`Duration: ${(duration / 1000).toFixed(2)}s`);
      }

      return {
        success: true,
        files,
        outputDir,
        totalDuration: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      log.error('Export failed:', message);

      return {
        success: false,
        files: [],
        outputDir: options.outputDir || path.join(os.homedir(), 'research-output'),
        totalDuration: duration,
        error: message,
      };
    }
  }

  /**
   * Export raw PDF format only
   */
  async exportPdfRaw(findings: ResearchFindings, filepath: string): Promise<void> {
    const { pdfExporter } = await import('../services');
    await pdfExporter.exportRaw(findings, filepath);
  }

  /**
   * Export polished PDF format with options
   */
  async exportPdfPolished(
    findings: ResearchFindings,
    filepath: string,
    options: CLIExportOptions = {},
  ): Promise<void> {
    const { pdfExporter } = await import('../services');
    await pdfExporter.exportPolished(findings, filepath, {
      format: 'polished',
      companyName: options.companyName,
      reportTitle: options.reportTitle,
      authorName: options.authorName,
      includeVisuals: options.includeVisuals !== false,
      includeMetrics: true,
    });
  }

  /**
   * Export markdown format
   */
  async exportMarkdown(findings: ResearchFindings, filepath: string): Promise<void> {
    const { exportOrchestrator: exporter } = await import('../services');
    await exporter.export({
      findings,
      format: 'markdown',
      outputDir: path.dirname(filepath),
      baseFilename: path.basename(filepath, '.md'),
    });
  }

  /**
   * Export HTML format
   */
  async exportHtml(findings: ResearchFindings, filepath: string): Promise<void> {
    const { exportOrchestrator: exporter } = await import('../services');
    await exporter.export({
      findings,
      format: 'html',
      outputDir: path.dirname(filepath),
      baseFilename: path.basename(filepath, '.html'),
    });
  }

  /**
   * Export JSON (raw data)
   */
  async exportJson(findings: ResearchFindings, filepath: string): Promise<void> {
    const fs = await import('fs/promises');
    const json = JSON.stringify(findings, null, 2);
    await fs.writeFile(filepath, json, 'utf-8');
  }

  /**
   * Generate default export filename with timestamp
   */
  generateFilename(prefix: string = 'research'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `${prefix}-${timestamp}`;
  }

  /**
   * Get human-readable format name from filename
   */
  private getFormatFromFilename(filename: string): string {
    if (filename.endsWith('-raw.pdf')) return 'PDF (Raw)';
    if (filename.endsWith('-polished.pdf')) return 'PDF (Polished)';
    if (filename.endsWith('.pdf')) return 'PDF';
    if (filename.endsWith('.md')) return 'Markdown';
    if (filename.endsWith('.html')) return 'HTML';
    if (filename.endsWith('.json')) return 'JSON';
    return 'Unknown';
  }

  /**
   * Print export summary to console
   */
  printSummary(result: CLIExportResult): void {
    if (!result.success) {
      console.error(`\nExport Failed: ${result.error}`);
      return;
    }

    console.log('\n✓ Export successful!');
    console.log(`\nGenerated files (${result.files.length}):`);
    result.files.forEach((f) => {
      console.log(`  • ${f.format}`);
      console.log(`    Location: ${f.fullPath}`);
    });

    console.log(`\nDuration: ${(result.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Output directory: ${result.outputDir}`);
  }
}

export const exportHelper = new ExportHelper();

/**
 * Download CLI Service — Commands for file download and analysis
 * Integrates with downloadService, pdfUtils, csvService, imageBatchService
 */

import { downloadService } from './downloadService';
import { extractText, getMetadata, analyzePdf } from './pdfUtils';
import { csvService } from './csvService';
import { imageBatchService } from './imageBatchService';
import { createLogger } from './logger';

const log = createLogger('downloadCliService');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadCommandResult {
  success: boolean;
  path?: string;
  size?: number;
  mimeType?: string;
  filename?: string;
  error?: string;
}

export interface AnalysisCommandResult {
  success: boolean;
  type?: 'pdf' | 'csv' | 'json' | 'image';
  data?: any;
  error?: string;
}

// ─── Commands ──────────────────────────────────────────────────────────────────

/**
 * /download <url> — Download a file with validation
 */
export async function downloadFileCommand(
  urlStr: string,
  sessionId: string = 'default'
): Promise<DownloadCommandResult> {
  try {
    log.info('Download command', { url: urlStr });

    // Validate URL
    if (!downloadService.validateUrl(urlStr)) {
      return {
        success: false,
        error: `Invalid or blocked URL: ${urlStr}`,
      };
    }

    // Download file
    const result = await downloadService.downloadFile(urlStr, { sessionId });

    log.info('Download success', {
      url: urlStr,
      path: result.path,
      size: result.size,
    });

    return {
      success: true,
      path: result.path,
      size: result.size,
      mimeType: result.mimeType,
      filename: result.filename,
    };
  } catch (err) {
    log.error('Download failed', { url: urlStr, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * /download-batch <url1> <url2> ... — Download multiple files
 */
export async function downloadBatchCommand(
  urls: string[],
  sessionId: string = 'default'
): Promise<Array<DownloadCommandResult>> {
  try {
    log.info('Batch download command', { count: urls.length });

    const results = await downloadService.downloadBatch(urls, {
      concurrency: 10,
      sessionId,
    });

    return results.map((r) => ({
      success: !r.error,
      path: r.path,
      size: r.size,
      mimeType: r.mimeType,
      filename: r.filename,
      error: r.error,
    }));
  } catch (err) {
    log.error('Batch download failed', { count: urls.length, error: String(err) });
    return urls.map((url) => ({
      success: false,
      error: String(err),
    }));
  }
}

/**
 * /analyze <url-or-path> — Auto-detect file type and analyze
 */
export async function analyzeFileCommand(
  pathOrUrl: string,
  sessionId: string = 'default'
): Promise<AnalysisCommandResult> {
  try {
    log.info('Analyze command', { pathOrUrl });

    // Determine file type
    const ext = pathOrUrl.toLowerCase().split('.').pop() || '';

    // For URLs, download first
    let filePath = pathOrUrl;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const downloadResult = await downloadFileCommand(pathOrUrl, sessionId);
      if (!downloadResult.success) {
        return {
          success: false,
          error: `Failed to download: ${downloadResult.error}`,
        };
      }
      filePath = downloadResult.path!;
    }

    // Auto-detect and analyze
    if (ext === 'pdf') {
      return await parsePdfCommand(filePath);
    } else if (['csv', 'tsv'].includes(ext)) {
      return await parseCsvCommand(filePath);
    } else if (['json', 'ndjson'].includes(ext)) {
      return await analyzeJsonCommand(filePath);
    } else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return {
        success: true,
        type: 'image',
        data: { path: filePath },
      };
    }

    // Try to detect by content
    try {
      const csvResult = await parseCsvCommand(filePath);
      if (csvResult.success) return csvResult;
    } catch (err) {
      // Continue
    }

    try {
      const jsonResult = await analyzeJsonCommand(filePath);
      if (jsonResult.success) return jsonResult;
    } catch (err) {
      // Continue
    }

    return {
      success: false,
      error: `Unable to detect file type: ${pathOrUrl}`,
    };
  } catch (err) {
    log.error('Analyze failed', { pathOrUrl, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * /parse-pdf <url-or-path> — Extract text, tables, metadata from PDF
 */
export async function parsePdfCommand(
  pathOrUrl: string,
  sessionId: string = 'default'
): Promise<AnalysisCommandResult> {
  try {
    log.info('Parse PDF command', { pathOrUrl });

    // For URLs, download first
    let filePath = pathOrUrl;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const downloadResult = await downloadFileCommand(pathOrUrl, sessionId);
      if (!downloadResult.success) {
        return {
          success: false,
          error: `Failed to download PDF: ${downloadResult.error}`,
        };
      }
      filePath = downloadResult.path!;
    }

    // Read PDF file
    const { readFile } = await import('fs/promises');
    const pdfData = await readFile(filePath);

    // Extract text and metadata
    const [textResult, metadata] = await Promise.all([
      extractText(pdfData as any),
      getMetadata(pdfData as any),
    ]);

    // Note: Table extraction requires backend Wayfarer service
    // For now, we return text and metadata only

    return {
      success: true,
      type: 'pdf',
      data: {
        path: filePath,
        metadata: {
          title: metadata.title,
          author: metadata.author,
          pageCount: metadata.pageCount,
          isScanned: metadata.isScanned,
        },
        textSummary: {
          fullTextLength: textResult.fullText.length,
          pageCount: textResult.pages.length,
          isScanned: textResult.isScanned,
          avgTextConfidence: textResult.pages.length > 0
            ? textResult.pages.reduce((sum, p) => sum + p.textConfidence, 0) / textResult.pages.length
            : 0,
        },
        pages: textResult.pages.map((p) => ({
          pageNum: p.pageNum,
          textLength: p.text.length,
          textConfidence: p.textConfidence,
          textPreview: p.text.substring(0, 200),
        })),
      },
    };
  } catch (err) {
    log.error('Parse PDF failed', { pathOrUrl, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * /parse-csv <url-or-path> — Analyze CSV schema and detect patterns
 */
export async function parseCsvCommand(
  pathOrUrl: string,
  sessionId: string = 'default'
): Promise<AnalysisCommandResult> {
  try {
    log.info('Parse CSV command', { pathOrUrl });

    // For URLs, download first
    let filePath = pathOrUrl;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const downloadResult = await downloadFileCommand(pathOrUrl, sessionId);
      if (!downloadResult.success) {
        return {
          success: false,
          error: `Failed to download CSV: ${downloadResult.error}`,
        };
      }
      filePath = downloadResult.path!;
    }

    // Analyze CSV
    const result = await csvService.analyzeCsv(filePath);

    return {
      success: true,
      type: 'csv',
      data: {
        path: filePath,
        delimiter: result.delimiter,
        columnCount: result.columns.length,
        totalRows: result.stats.totalRows,
        columns: result.columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullCount: c.nullCount,
          uniqueValues: c.uniqueValues,
          pattern: c.pattern,
        })),
        sampleRows: result.sampleRows.slice(0, 5),
      },
    };
  } catch (err) {
    log.error('Parse CSV failed', { pathOrUrl, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * Analyze JSON file
 */
async function analyzeJsonCommand(
  pathOrUrl: string,
  sessionId: string = 'default'
): Promise<AnalysisCommandResult> {
  try {
    log.info('Analyze JSON command', { pathOrUrl });

    // For URLs, download first
    let filePath = pathOrUrl;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const downloadResult = await downloadFileCommand(pathOrUrl, sessionId);
      if (!downloadResult.success) {
        return {
          success: false,
          error: `Failed to download JSON: ${downloadResult.error}`,
        };
      }
      filePath = downloadResult.path!;
    }

    // Analyze JSON
    const result = await csvService.analyzeJson(filePath);

    return {
      success: true,
      type: 'json',
      data: {
        path: filePath,
        format: result.format,
        itemCount: result.itemCount,
        schema: {
          rootType: result.schema.rootType,
          uniqueKeys: result.schema.uniqueKeys,
          maxDepth: result.schema.maxDepth,
        },
        sampleData: result.sampleData.slice(0, 3),
      },
    };
  } catch (err) {
    log.error('Analyze JSON failed', { pathOrUrl, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

/**
 * /analyze-images <url1> <url2> ... — Download and analyze images
 */
export async function analyzeImagesCommand(
  urls: string[],
  sessionId: string = 'default'
): Promise<AnalysisCommandResult> {
  try {
    log.info('Analyze images command', { count: urls.length });

    // Download and analyze
    const result = await imageBatchService.analyzeImageUrls(urls, {
      sessionId,
      analyzeAfterDownload: true,
    });

    return {
      success: true,
      type: 'image',
      data: {
        totalImages: result.totalImages,
        processedImages: result.processedImages,
        failedImages: result.failedImages,
        colorPalette: Object.entries(result.colorDistribution)
          .slice(0, 5)
          .map(([color, count]) => ({ color, count })),
        durationMs: result.durationMs,
        imagesSummary: result.descriptions.slice(0, 3).map((img) => ({
          filename: img.filename,
          description: img.description,
          quality: img.quality,
          colors: img.colors.slice(0, 3),
          objects: img.objects.slice(0, 5),
        })),
      },
    };
  } catch (err) {
    log.error('Analyze images failed', { count: urls.length, error: String(err) });
    return {
      success: false,
      error: String(err),
    };
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const downloadCliService = {
  downloadFileCommand,
  downloadBatchCommand,
  analyzeFileCommand,
  parsePdfCommand,
  parseCsvCommand,
  analyzeJsonCommand,
  analyzeImagesCommand,
};

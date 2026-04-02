/**
 * PDF Utilities — Image rendering, text extraction, metadata extraction
 * Uses pdf.js to render pages, extract text layers, and parse metadata.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfPage {
  pageNumber: number;
  base64: string; // data:image/png;base64,...
  width: number;
  height: number;
}

export interface PdfTextPage {
  pageNum: number;
  text: string;
  textConfidence: number; // 0-1, low = likely scanned
}

export interface PdfTextExtractionResult {
  fullText: string;
  pages: PdfTextPage[];
  isScanned: boolean;
}

export interface PdfTable {
  pageNum: number;
  tableNum: number;
  data: string[][]; // 2D array of cells
  format: 'json' | 'csv';
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  isScanned: boolean;
  isEncrypted: boolean;
}

export interface PdfAnalysisResult {
  metadata: PdfMetadata;
  text: PdfTextExtractionResult;
  tables: PdfTable[];
  images: PdfPage[];
}

// ─── Existing: Image Rendering ────────────────────────────────────────────────

/**
 * Convert a PDF file (as ArrayBuffer) to an array of page images.
 * Each page is rendered at the given scale (default 2x for decent quality).
 */
export async function pdfToImages(
  pdfData: ArrayBuffer,
  options?: { scale?: number; maxPages?: number }
): Promise<PdfPage[]> {
  const scale = options?.scale ?? 2;
  const maxPages = options?.maxPages ?? 20;

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const pages: PdfPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // pdfjs-dist RenderParameters requires canvas + canvasContext
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise; // eslint-disable-line @typescript-eslint/no-explicit-any

    const dataUrl = canvas.toDataURL('image/png');
    pages.push({
      pageNumber: i,
      base64: dataUrl,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return pages;
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

/**
 * Extract text content from all pages of a PDF.
 * Returns per-page text + full document text + confidence score.
 */
export async function extractText(
  pdfData: ArrayBuffer,
  options?: { pages?: number[] }
): Promise<PdfTextExtractionResult> {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const numPages = pdf.numPages;
  const pagesToProcess = options?.pages || Array.from({ length: numPages }, (_, i) => i + 1);

  const pages: PdfTextPage[] = [];
  const allText: string[] = [];
  let textConfidenceSum = 0;
  let processedCount = 0;

  for (const pageNum of pagesToProcess) {
    if (pageNum < 1 || pageNum > numPages) continue;

    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract text from items
      const pageText = textContent.items
        .map((item: any) => {
          // Check for text item (has 'str' property)
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');

      // Calculate text confidence (0-1 scale)
      // If text length is minimal relative to page viewport, likely scanned
      const viewport = page.getViewport({ scale: 1 });
      const pageArea = viewport.width * viewport.height;
      const textDensity = pageText.length / (pageArea / 100); // Rough heuristic
      const confidence = Math.min(textDensity, 1.0); // Cap at 1.0

      pages.push({
        pageNum,
        text: pageText,
        textConfidence: confidence,
      });

      allText.push(pageText);
      textConfidenceSum += confidence;
      processedCount++;
    } catch (err) {
      // Skip pages that fail
      console.warn(`Failed to extract text from page ${pageNum}`, err);
    }
  }

  const fullText = allText.join('\n\n');
  const avgConfidence = processedCount > 0 ? textConfidenceSum / processedCount : 0;
  const isScanned = avgConfidence < 0.3; // Heuristic: low confidence = scanned

  return {
    fullText,
    pages,
    isScanned,
  };
}

// ─── Metadata Extraction ──────────────────────────────────────────────────────

/**
 * Extract PDF metadata (title, author, creation date, etc.)
 */
export async function getMetadata(pdfData: ArrayBuffer): Promise<PdfMetadata> {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  let title: string | undefined;
  let author: string | undefined;
  let subject: string | undefined;
  let keywords: string | undefined;
  let creationDate: Date | undefined;
  let modificationDate: Date | undefined;

  try {
    const metadata = await pdf.getMetadata();
    if (metadata?.info) {
      const info = metadata.info as Record<string, any>;
      title = info.Title || info.title;
      author = info.Author || info.author;
      subject = info.Subject || info.subject;
      keywords = info.Keywords || info.keywords;

      // Parse dates (PDF date format: D:YYYYMMDDHHmmSSOHH'mm')
      if (info.CreationDate) {
        creationDate = parsePdfDate(info.CreationDate);
      }
      if (info.ModDate) {
        modificationDate = parsePdfDate(info.ModDate);
      }
    }
  } catch (err) {
    console.warn('Failed to extract PDF metadata', err);
  }

  const isEncrypted = (pdf as any).isEncrypted || false;
  const pageCount = pdf.numPages;

  // Determine if scanned by checking first page text
  let isScanned = false;
  try {
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent();
    isScanned = textContent.items.length === 0; // No text layer = scanned
  } catch (err) {
    // Assume not scanned if check fails
  }

  return {
    title,
    author,
    subject,
    keywords,
    creationDate,
    modificationDate,
    pageCount,
    isScanned,
    isEncrypted,
  };
}

/**
 * Parse PDF date format (D:YYYYMMDDHHmmSSOHH'mm')
 */
function parsePdfDate(dateStr: string): Date {
  // Format: D:YYYYMMDDHHmmSSOHH'mm
  const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
  }
  return new Date(dateStr);
}

// ─── Combined Analysis (for future backend integration) ────────────────────────

export interface PdfAnalysisBasicResult {
  metadata: PdfMetadata;
  text: PdfTextExtractionResult;
  images: PdfPage[];
}

/**
 * Perform comprehensive PDF analysis:
 * - Render images
 * - Extract text
 * - Get metadata
 * - (Tables extraction requires backend service via Wayfarer)
 */
export async function analyzePdf(
  pdfData: ArrayBuffer,
  options?: { extractImages?: boolean; extractText?: boolean; extractMetadata?: boolean }
): Promise<PdfAnalysisBasicResult> {
  const extractImages = options?.extractImages ?? true;
  const extractText_ = options?.extractText ?? true;
  const extractMetadata = options?.extractMetadata ?? true;

  const [images, textResult, metadata] = await Promise.all([
    extractImages ? pdfToImages(pdfData, { maxPages: 20 }) : Promise.resolve([]),
    extractText_ ? extractText(pdfData) : Promise.resolve({ fullText: '', pages: [], isScanned: false }),
    extractMetadata ? getMetadata(pdfData) : Promise.resolve({
      pageCount: 0,
      isScanned: false,
      isEncrypted: false,
    }),
  ]);

  return {
    metadata,
    text: textResult,
    images,
  };
}

/**
 * Services Index — Central export for all service modules
 */

export { pdfExporter, PDFExporter, type PDFExportOptions } from './pdfExporter';
export { docGenerator, DocumentGenerator, type ResearchReport, type ReportSection } from './docGenerator';
export { chartGenerator, ChartGenerator, generatePositioningMatrix, generateCoverageChart, generateConfidenceGauge, svgToDataUrl, svgToBase64DataUrl, type ChartOptions, type ChartSize } from './chartGenerator';
export { exportOrchestrator, ExportOrchestrator, type ExportFormat, type ExportRequest, type ExportResult } from './exportOrchestrator';
export { citationService } from './citationService';

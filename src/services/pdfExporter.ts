/**
 * PDF Export System — Dual Format Export
 *
 * Two formats:
 * 1. RAW: Simple text dump with all findings, sources, confidence scores
 * 2. POLISHED: Professional report with tables, charts, colored sections, TOC
 *
 * Uses jsPDF + jsPDF-autotable for generation
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createLogger } from '../utils/logger';
import type {
  ResearchFindings,
  DeepDesire,
  Objection,
  CompetitorProfile,
  VisualAnalysis,
  ResearchAuditTrail,
  ResearchSource,
} from '../frontend/types';

const log = createLogger('pdf-exporter');

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface PDFExportOptions {
  format: 'raw' | 'polished';
  includeVisuals?: boolean;
  includeMetrics?: boolean;
  companyLogo?: string;
  companyName?: string;
  reportTitle?: string;
  authorName?: string;
  theme?: 'default' | 'dark';
}

// Color scheme for different sections
interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  lightBg: string;
  borders: string;
}

const COLOR_SCHEMES: Record<string, ColorScheme> = {
  default: {
    primary: '#1f2937',
    secondary: '#3b82f6',
    accent: '#10b981',
    text: '#1f2937',
    lightBg: '#f3f4f6',
    borders: '#e5e7eb',
  },
  dark: {
    primary: '#f3f4f6',
    secondary: '#60a5fa',
    accent: '#34d399',
    text: '#f3f4f6',
    lightBg: '#1f2937',
    borders: '#374151',
  },
};

// ──────────────────────────────────────────────────────────────
// RAW FORMAT EXPORTER
// ──────────────────────────────────────────────────────────────

class RawFormatExporter {
  private doc: jsPDF;
  private pageHeight: number = 277; // Standard letter height in mm
  private pageWidth: number = 210; // Standard letter width in mm
  private margin: number = 15;
  private currentY: number = this.margin;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.currentY = this.margin;
  }

  private addText(
    text: string,
    options: { size?: number; bold?: boolean; color?: string } = {},
  ): void {
    const { size = 10, bold = false, color = '#000000' } = options;
    const x = this.margin;
    const maxWidth = this.pageWidth - 2 * this.margin;

    this.doc.setFont('Helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(color.startsWith('#') ? parseInt(color.slice(1), 16) : 0);

    const lines = this.doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      if (this.currentY > this.pageHeight - 10) {
        this.addNewPage();
      }
      this.doc.text(line, x, this.currentY);
      this.currentY += size / 2.5;
    });
  }

  private addSection(title: string): void {
    this.currentY += 5;
    this.addText(title, { size: 14, bold: true, color: '#1f2937' });
    this.addText('═'.repeat(50), { size: 9, color: '#9ca3af' });
    this.currentY += 3;
  }

  private addFact(fact: string, sources: string[], confidence: number): void {
    if (this.currentY > this.pageHeight - 15) {
      this.addNewPage();
    }

    const indent = this.margin + 5;
    this.doc.setFont('Helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(31, 41, 55);

    const x = indent;
    const maxWidth = this.pageWidth - indent - this.margin;
    const lines = this.doc.splitTextToSize(`• ${fact}`, maxWidth);

    lines.forEach((line: string, idx: number) => {
      if (this.currentY > this.pageHeight - 10) {
        this.addNewPage();
      }
      this.doc.text(line, x, this.currentY);
      this.currentY += 4;
    });

    // Sources
    if (sources.length > 0) {
      this.doc.setFont('Helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(107, 114, 128);
      this.doc.text(`Sources: ${sources.slice(0, 2).join(', ')}${sources.length > 2 ? '...' : ''}`, indent + 5, this.currentY);
      this.currentY += 3;
    }

    // Confidence
    this.doc.setFont('Helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(156, 163, 175);
    this.doc.text(`Confidence: ${Math.round(confidence * 100)}%`, indent + 5, this.currentY);
    this.currentY += 4;
  }

  async export(findings: ResearchFindings, filename: string): Promise<void> {
    try {
      // Title page
      this.addText('RESEARCH FINDINGS EXPORT', { size: 20, bold: true, color: '#1f2937' });
      this.addText('Raw Data Dump Format', { size: 12, color: '#6b7280' });
      this.currentY += 10;
      this.addText(`Generated: ${new Date().toISOString().split('T')[0]}`, { size: 10, color: '#9ca3af' });
      this.currentY += 15;

      // Deep Desires
      if (findings.deepDesires && findings.deepDesires.length > 0) {
        this.addSection('DEEP DESIRES');
        findings.deepDesires.forEach((desire: DeepDesire) => {
          this.addFact(
            `${desire.surfaceProblem} → ${desire.deepestDesire} (${desire.desireIntensity})`,
            [],
            0.8,
          );
        });
      }

      // Objections
      if (findings.objections && findings.objections.length > 0) {
        this.addSection('OBJECTIONS');
        findings.objections.forEach((obj: Objection) => {
          this.addFact(
            `${obj.objection} (${obj.frequency}, impact: ${obj.impact})`,
            [],
            0.7,
          );
        });
      }

      // Avatar Language
      if (findings.avatarLanguage && findings.avatarLanguage.length > 0) {
        this.addSection('AVATAR LANGUAGE');
        findings.avatarLanguage.slice(0, 20).forEach((phrase: string) => {
          this.addFact(`"${phrase}"`, [], 0.75);
        });
      }

      // Where Audience Congregates
      if (findings.whereAudienceCongregates && findings.whereAudienceCongregates.length > 0) {
        this.addSection('WHERE AUDIENCE CONGREGATES');
        findings.whereAudienceCongregates.forEach((place: string) => {
          this.addFact(place, [], 0.7);
        });
      }

      // What They Tried Before
      if (findings.whatTheyTriedBefore && findings.whatTheyTriedBefore.length > 0) {
        this.addSection('WHAT THEY TRIED BEFORE');
        findings.whatTheyTriedBefore.forEach((attempt: string) => {
          this.addFact(attempt, [], 0.65);
        });
      }

      // Competitor Weaknesses
      if (findings.competitorWeaknesses && findings.competitorWeaknesses.length > 0) {
        this.addSection('COMPETITOR WEAKNESSES');
        findings.competitorWeaknesses.forEach((weakness: string) => {
          this.addFact(weakness, [], 0.75);
        });
      }

      // Audit Trail
      if (findings.auditTrail) {
        this.addSection('RESEARCH AUDIT TRAIL');
        this.addText(`Total Sources: ${findings.auditTrail.totalSources}`, { size: 10 });
        this.addText(`Models Used: ${findings.auditTrail.modelsUsed.join(', ')}`, { size: 10 });
        this.addText(`Total Tokens: ${findings.auditTrail.totalTokensGenerated}`, { size: 10 });
        this.addText(`Duration: ${(findings.auditTrail.researchDuration / 1000 / 60).toFixed(1)} minutes`, { size: 10 });
        this.addText(`Preset: ${findings.auditTrail.preset}`, { size: 10 });
        this.addText(`Iterations: ${findings.auditTrail.iterationsCompleted}`, { size: 10 });
        this.addText(`Coverage: ${(findings.auditTrail.coverageAchieved * 100).toFixed(1)}%`, { size: 10 });
      }

      // Save
      this.doc.save(filename);
      log.info(`Raw PDF exported: ${filename}`);
    } catch (error) {
      log.error('Raw format export failed:', error);
      throw error;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// POLISHED FORMAT EXPORTER
// ──────────────────────────────────────────────────────────────

class PolishedFormatExporter {
  private doc: jsPDF;
  private pageHeight: number = 277;
  private pageWidth: number = 210;
  private margin: number = 15;
  private currentY: number = this.margin;
  private colors: ColorScheme;
  private options: PDFExportOptions;

  constructor(options: PDFExportOptions = { format: 'polished' }) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.colors = COLOR_SCHEMES[options.theme || 'default'];
    this.options = options;
  }

  private addNewPage(includeHeader: boolean = true): void {
    this.doc.addPage();
    this.currentY = this.margin;
    if (includeHeader) {
      this.addPageHeader();
    }
  }

  private addPageHeader(): void {
    this.doc.setFont('Helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(156, 163, 175);
    this.doc.text(this.options.companyName || 'Research Report', this.margin, 10);
    this.doc.text(`Page ${this.doc.getPageCount()}`, this.pageWidth - this.margin - 20, 10);

    const lineY = 15;
    this.doc.setDrawColor(229, 231, 235);
    this.doc.line(this.margin, lineY, this.pageWidth - this.margin, lineY);

    this.currentY = 20;
  }

  private addColoredHeader(title: string, color: string = this.colors.secondary): void {
    if (this.currentY > this.pageHeight - 20) {
      this.addNewPage(true);
    }

    this.doc.setFillColor(
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    );
    this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 8, 'F');

    this.doc.setFont('Helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(title, this.margin + 3, this.currentY + 5);

    this.currentY += 12;
  }

  private addText(
    text: string,
    options: { size?: number; bold?: boolean; color?: string } = {},
  ): void {
    const { size = 10, bold = false, color = this.colors.text } = options;
    const x = this.margin;
    const maxWidth = this.pageWidth - 2 * this.margin;

    this.doc.setFont('Helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);

    const rgb = this.hexToRgb(color);
    this.doc.setTextColor(rgb.r, rgb.g, rgb.b);

    const lines = this.doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      if (this.currentY > this.pageHeight - 10) {
        this.addNewPage(true);
      }
      this.doc.text(line, x, this.currentY);
      this.currentY += size / 2.5;
    });
  }

  private addTable(
    headers: string[],
    rows: string[][],
    columnStyles?: Record<number, any>,
  ): void {
    if (this.currentY > this.pageHeight - 30) {
      this.addNewPage(true);
    }

    const rgb = this.hexToRgb(this.colors.secondary);
    autoTable(this.doc, {
      head: [headers],
      body: rows,
      startY: this.currentY,
      margin: this.margin,
      headStyles: {
        fillColor: [rgb.r, rgb.g, rgb.b],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 10,
      },
      bodyStyles: {
        textColor: [31, 41, 55],
        fontSize: 9,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246],
      },
      didDrawPage: () => {
        // Update currentY after table
        this.currentY = (this.doc as any).lastAutoTable?.finalY || this.currentY;
      },
      columnStyles,
    });

    this.currentY = (this.doc as any).lastAutoTable?.finalY || this.currentY + 10;
    this.currentY += 5;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  private addCoverPage(findings: ResearchFindings): void {
    this.doc.setPage(1);
    this.currentY = 60;

    this.doc.setFont('Helvetica', 'bold');
    this.doc.setFontSize(32);
    this.doc.setTextColor(31, 41, 55);
    this.doc.text(this.options.reportTitle || 'RESEARCH REPORT', 105, this.currentY, { align: 'center' });

    this.currentY += 30;
    this.doc.setFontSize(14);
    this.doc.setTextColor(107, 114, 128);
    this.doc.text('Market Research & Audience Analysis', 105, this.currentY, { align: 'center' });

    this.currentY += 40;
    this.doc.setFont('Helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.setTextColor(75, 85, 99);

    const today = new Date();
    this.doc.text(`Date: ${today.toLocaleDateString()}`, 105, this.currentY, { align: 'center' });
    this.currentY += 8;

    if (this.options.companyName) {
      this.doc.text(`Prepared for: ${this.options.companyName}`, 105, this.currentY, { align: 'center' });
      this.currentY += 8;
    }

    if (this.options.authorName) {
      this.doc.text(`Prepared by: ${this.options.authorName}`, 105, this.currentY, { align: 'center' });
    }

    // Footer with source count
    if (findings.auditTrail) {
      this.doc.setFontSize(10);
      this.doc.setTextColor(156, 163, 175);
      this.doc.text(
        `Sources: ${findings.auditTrail.totalSources} | Coverage: ${(findings.auditTrail.coverageAchieved * 100).toFixed(0)}%`,
        105,
        this.pageHeight - 20,
        { align: 'center' },
      );
    }
  }

  private addExecutiveSummary(findings: ResearchFindings): void {
    this.addNewPage(false);
    this.currentY = this.margin;

    this.addColoredHeader('EXECUTIVE SUMMARY', this.colors.secondary);

    const summary = this.generateSummary(findings);
    this.addText(summary, { size: 11, color: this.colors.text });

    this.currentY += 5;
    this.addText('Key Highlights:', { size: 11, bold: true });
    this.currentY += 3;

    const highlights = this.extractHighlights(findings);
    highlights.slice(0, 5).forEach((h: string) => {
      this.addText(`• ${h}`, { size: 10 });
    });
  }

  private generateSummary(findings: ResearchFindings): string {
    let summary = 'This research report provides comprehensive market and audience analysis based on ';
    if (findings.auditTrail) {
      summary += `${findings.auditTrail.totalSources} sources and ${findings.auditTrail.iterationsCompleted} research iterations. `;
    }
    summary += 'The analysis covers customer desires, objections, market positioning, and competitive landscape. ';
    summary += 'Key findings are organized by research dimension with confidence scores and source citations.';
    return summary;
  }

  private extractHighlights(findings: ResearchFindings): string[] {
    const highlights: string[] = [];

    if (findings.deepDesires?.length) {
      highlights.push(`${findings.deepDesires.length} distinct customer desire layers identified`);
    }
    if (findings.objections?.length) {
      highlights.push(`${findings.objections.length} purchase objections mapped and ranked`);
    }
    if (findings.competitorWeaknesses?.length) {
      highlights.push(`${findings.competitorWeaknesses.length} competitor positioning gaps discovered`);
    }
    if (findings.auditTrail) {
      highlights.push(`${(findings.auditTrail.coverageAchieved * 100).toFixed(0)}% dimensional coverage achieved`);
    }

    return highlights;
  }

  private addDesireSection(findings: ResearchFindings): void {
    if (!findings.deepDesires?.length) return;

    this.addNewPage(true);
    this.addColoredHeader('CUSTOMER DESIRES', '#3b82f6');

    const rows = findings.deepDesires.map((d: DeepDesire) => [
      d.surfaceProblem,
      d.deepestDesire,
      d.desireIntensity,
      d.targetSegment,
    ]);

    this.addTable(['Surface Problem', 'Deepest Desire', 'Intensity', 'Target Segment'], rows);

    this.currentY += 5;
    this.addText('Layered Desire Model:', { size: 11, bold: true, color: this.colors.secondary });
    this.currentY += 2;

    findings.deepDesires.slice(0, 3).forEach((d: DeepDesire) => {
      this.addText(`${d.surfaceProblem}:`, { size: 10, bold: true });
      d.layers.forEach((layer) => {
        this.addText(`  Level ${layer.level}: ${layer.description}`, { size: 9 });
      });
      this.addText(`  Core Desire: ${d.deepestDesire}`, { size: 9, color: this.colors.secondary });
      this.currentY += 2;
    });
  }

  private addObjectionSection(findings: ResearchFindings): void {
    if (!findings.objections?.length) return;

    this.addNewPage(true);
    this.addColoredHeader('PURCHASE OBJECTIONS', '#ef4444');

    const rows = findings.objections.map((o: Objection) => [
      o.objection,
      o.frequency,
      o.impact,
      o.handlingApproach.substring(0, 40) + '...',
    ]);

    this.addTable(['Objection', 'Frequency', 'Impact', 'Handling Approach'], rows);
  }

  private addCompetitorSection(findings: ResearchFindings): void {
    if (!findings.competitorAds?.competitors?.length) return;

    this.addNewPage(true);
    this.addColoredHeader('COMPETITOR ANALYSIS', '#f59e0b');

    findings.competitorAds.competitors.slice(0, 5).forEach((comp: CompetitorProfile) => {
      this.addText(`${comp.brand}`, { size: 11, bold: true, color: this.colors.secondary });

      if (comp.positioning) {
        this.addText(`Positioning: ${comp.positioning}`, { size: 10 });
      }

      if (comp.dominantAngles?.length) {
        this.addText('Primary Angles:', { size: 10, bold: true });
        comp.dominantAngles.slice(0, 3).forEach((angle) => {
          this.addText(`• ${angle}`, { size: 9 });
        });
      }

      this.currentY += 3;
    });

    if (findings.competitorAds.industryPatterns) {
      this.addText('Industry-Wide Patterns:', { size: 11, bold: true, color: this.colors.secondary });
      this.currentY += 2;

      const pattern = findings.competitorAds.industryPatterns;
      const patterns = [
        ['Dominant Hooks', pattern.dominantHooks?.slice(0, 3).join(', ') || 'N/A'],
        ['Common Drivers', pattern.commonEmotionalDrivers?.slice(0, 2).join(', ') || 'N/A'],
        ['Unused Angles', pattern.unusedAngles?.slice(0, 2).join(', ') || 'N/A'],
      ];

      this.addTable(['Pattern Type', 'Examples'], patterns);
    }
  }

  private addVisualsSection(findings: ResearchFindings): void {
    if (!findings.visualFindings || !this.options.includeVisuals) return;

    this.addNewPage(true);
    this.addColoredHeader('VISUAL ANALYSIS', '#8b5cf6');

    if (findings.visualFindings.commonPatterns?.length) {
      this.addText('Common Visual Patterns:', { size: 11, bold: true });
      findings.visualFindings.commonPatterns.slice(0, 5).forEach((p) => {
        this.addText(`• ${p}`, { size: 10 });
      });
      this.currentY += 3;
    }

    if (findings.visualFindings.visualGaps?.length) {
      this.addText('Market Gaps & Opportunities:', { size: 11, bold: true });
      findings.visualFindings.visualGaps.slice(0, 5).forEach((g) => {
        this.addText(`• ${g}`, { size: 10 });
      });
      this.currentY += 3;
    }

    if (findings.visualFindings.recommendedDifferentiation?.length) {
      this.addText('Recommended Visual Differentiation:', { size: 11, bold: true });
      findings.visualFindings.recommendedDifferentiation.slice(0, 4).forEach((r) => {
        this.addText(`• ${r}`, { size: 10 });
      });
    }
  }

  private addAuditTrailSection(findings: ResearchFindings): void {
    if (!findings.auditTrail) return;

    this.addNewPage(true);
    this.addColoredHeader('RESEARCH METHODOLOGY & AUDIT TRAIL', this.colors.accent);

    const audit = findings.auditTrail;

    this.addText('Research Parameters:', { size: 11, bold: true });
    this.currentY += 2;

    const params = [
      ['Total Sources', String(audit.totalSources)],
      ['Duration', `${(audit.researchDuration / 1000 / 60).toFixed(1)} minutes`],
      ['Iterations', String(audit.iterationsCompleted)],
      ['Coverage', `${(audit.coverageAchieved * 100).toFixed(1)}%`],
      ['Preset', audit.preset],
      ['Models Used', audit.modelsUsed.join(', ')],
    ];

    this.addTable(['Parameter', 'Value'], params);

    this.currentY += 5;
    this.addText('Token Usage:', { size: 11, bold: true });
    this.currentY += 2;

    const tokenRows = [
      ['Total Tokens', String(audit.totalTokensGenerated)],
      ...Object.entries(audit.tokensByModel || {}).map(([model, tokens]) => [
        model,
        String(tokens),
      ]),
    ];

    this.addTable(['Model', 'Tokens Used'], tokenRows);

    if (audit.sourceList?.length) {
      this.currentY += 5;
      this.addText('Top Sources:', { size: 11, bold: true });
      this.currentY += 2;

      const topSources = audit.sourceList.slice(0, 10).map((s: ResearchSource) => {
        try {
          const url = new URL(s.url);
          return [url.hostname || s.url, s.source, new Date(s.fetchedAt).toLocaleDateString()];
        } catch {
          return [s.url, s.source, new Date(s.fetchedAt).toLocaleDateString()];
        }
      });

      this.addTable(['Source', 'Type', 'Date'], topSources);
    }
  }

  async export(findings: ResearchFindings, filename: string): Promise<void> {
    try {
      this.addCoverPage(findings);
      this.addExecutiveSummary(findings);
      this.addDesireSection(findings);
      this.addObjectionSection(findings);
      this.addCompetitorSection(findings);
      this.addVisualsSection(findings);
      this.addAuditTrailSection(findings);

      this.doc.save(filename);
      log.info(`Polished PDF exported: ${filename}`);
    } catch (error) {
      log.error('Polished format export failed:', error);
      throw error;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────

export class PDFExporter {
  async exportRaw(findings: ResearchFindings, filename: string): Promise<void> {
    const exporter = new RawFormatExporter();
    await exporter.export(findings, filename);
  }

  async exportPolished(
    findings: ResearchFindings,
    filename: string,
    options: PDFExportOptions = { format: 'polished' },
  ): Promise<void> {
    const exporter = new PolishedFormatExporter(options);
    await exporter.export(findings, filename);
  }

  async export(
    findings: ResearchFindings,
    rawFilename?: string,
    polishedFilename?: string,
    options?: PDFExportOptions,
  ): Promise<{ raw?: string; polished?: string }> {
    const result: { raw?: string; polished?: string } = {};

    if (rawFilename) {
      await this.exportRaw(findings, rawFilename);
      result.raw = rawFilename;
    }

    if (polishedFilename) {
      await this.exportPolished(findings, polishedFilename, options);
      result.polished = polishedFilename;
    }

    return result;
  }
}

export const pdfExporter = new PDFExporter();

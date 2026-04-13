/**
 * pdfExporter.ts — Enhanced PDF Export for NEURO Ad Agent
 *
 * Covers all cycle data:
 *   Cover Page, Research Summary, Competitor Analysis,
 *   Fact Check Report, Visual Intelligence, Ad Concepts,
 *   Test Results, Memories, Audit Trail
 *
 * Two output modes:
 *   Full Report  — all sections, multi-page
 *   Executive Summary — 2-page: winner concept + top insights
 *
 * Depends on: jspdf ^4, jspdf-autotable ^5 (already installed)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Campaign, Cycle, ResearchFindings, AdConcept, TestVerdict } from '../types';
import type { FactCheckReport } from '../types/factCheck';

// ──────────────────────────────────────────────────────────────
// Public option types
// ──────────────────────────────────────────────────────────────

export interface ExportSectionFlags {
  research: boolean;
  competitors: boolean;
  factCheck: boolean;
  visual: boolean;
  concepts: boolean;
  testResults: boolean;
  memories: boolean;
  auditTrail: boolean;
}

export interface CyclePDFExportOptions {
  format: 'full' | 'executive';
  sections: ExportSectionFlags;
  includeRawData: boolean;
}

export const DEFAULT_SECTION_FLAGS: ExportSectionFlags = {
  research: true,
  competitors: true,
  factCheck: true,
  visual: true,
  concepts: true,
  testResults: true,
  memories: true,
  auditTrail: true,
};

// ──────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────

const BRAND_COLOR = [234, 88, 12] as [number, number, number];   // orange-600
const DARK_TEXT  = [31, 41, 55]  as [number, number, number];    // gray-800
const MUTED_TEXT = [107, 114, 128] as [number, number, number];  // gray-500
const LIGHT_BG   = [249, 250, 251] as [number, number, number];  // gray-50

const SECTION_COLORS: Record<string, [number, number, number]> = {
  research:    [59, 130, 246],   // blue-500
  competitors: [245, 158, 11],   // amber-500
  factCheck:   [16, 185, 129],   // emerald-500
  visual:      [139, 92, 246],   // violet-500
  concepts:    [236, 72, 153],   // pink-500
  testResults: [234, 88, 12],    // orange-600
  memories:    [20, 184, 166],   // teal-500
  auditTrail:  [100, 116, 139],  // slate-500
};

function today(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ──────────────────────────────────────────────────────────────
// Core builder class
// ──────────────────────────────────────────────────────────────

class NeuroPDFBuilder {
  private doc: jsPDF;
  private pageW = 210;
  private pageH = 297;
  private margin = 16;
  private y = this.margin;
  private reportTitle = '';
  private pageNum = 0;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  }

  // ─ Page management ──────────────────────────────────────────

  private newPage(addHeader = true): void {
    this.doc.addPage();
    this.y = this.margin;
    if (addHeader && this.reportTitle) this.pageHeader();
  }

  private checkY(needed = 20): void {
    if (this.y + needed > this.pageH - 12) this.newPage();
  }

  private pageHeader(): void {
    const n = this.doc.getNumberOfPages();
    this.doc.setFontSize(8);
    this.doc.setTextColor(...MUTED_TEXT);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(this.reportTitle, this.margin, 10);
    this.doc.text(`Page ${n}`, this.pageW - this.margin, 10, { align: 'right' });
    // hairline rule
    this.doc.setDrawColor(229, 231, 235);
    this.doc.setLineWidth(0.2);
    this.doc.line(this.margin, 13, this.pageW - this.margin, 13);
    this.y = 20;
  }

  // ─ Text primitives ──────────────────────────────────────────

  private h1(text: string): void {
    this.checkY(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(22);
    this.doc.setTextColor(...DARK_TEXT);
    this.doc.text(text, this.margin, this.y);
    this.y += 10;
  }

  private h2(text: string, color: [number, number, number] = BRAND_COLOR): void {
    this.checkY(16);
    this.doc.setFillColor(...color);
    this.doc.rect(this.margin, this.y, this.pageW - 2 * this.margin, 8, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(text, this.margin + 3, this.y + 5.5);
    this.y += 12;
  }

  private h3(text: string): void {
    this.checkY(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...DARK_TEXT);
    this.doc.text(text, this.margin, this.y);
    this.y += 6;
  }

  private body(text: string, indent = 0, color: [number, number, number] = DARK_TEXT): void {
    const maxW = this.pageW - 2 * this.margin - indent;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      this.checkY(5);
      this.doc.text(line, this.margin + indent, this.y);
      this.y += 4.5;
    }
  }

  private bullet(text: string, indent = 4): void {
    this.checkY(5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...DARK_TEXT);
    const maxW = this.pageW - 2 * this.margin - indent - 4;
    const lines = this.doc.splitTextToSize(text, maxW);
    this.doc.text('\u2022', this.margin + indent, this.y);
    lines.forEach((line: string, i: number) => {
      this.checkY(5);
      this.doc.text(line, this.margin + indent + 4, this.y);
      if (i < lines.length - 1) this.y += 4.5;
    });
    this.y += 4.5;
  }

  private small(text: string, color: [number, number, number] = MUTED_TEXT): void {
    this.checkY(4);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...color);
    this.doc.text(text, this.margin, this.y);
    this.y += 3.8;
  }

  private gap(mm = 4): void {
    this.y += mm;
  }

  private colorSwatch(hex: string, label: string, x: number, swatchY: number): void {
    // Parse hex → rgb
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    this.doc.setFillColor(r, g, b);
    this.doc.roundedRect(x, swatchY, 8, 8, 1, 1, 'F');
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.roundedRect(x, swatchY, 8, 8, 1, 1, 'S');
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...MUTED_TEXT);
    this.doc.text(label, x, swatchY + 11, { maxWidth: 18 });
  }

  private progressBar(value: number, x: number, barY: number, width = 50, height = 3.5): void {
    // Background
    this.doc.setFillColor(229, 231, 235);
    this.doc.roundedRect(x, barY, width, height, 1, 1, 'F');
    // Fill
    this.doc.setFillColor(...BRAND_COLOR);
    this.doc.roundedRect(x, barY, Math.max(1, (value / 100) * width), height, 1, 1, 'F');
  }

  private autoTable(
    headers: string[],
    rows: (string | number)[][],
    colWidths?: number[],
    headerColor: [number, number, number] = BRAND_COLOR,
  ): void {
    this.checkY(24);
    const colStyles: Record<number, { cellWidth: number }> = {};
    if (colWidths) {
      colWidths.forEach((w, i) => { colStyles[i] = { cellWidth: w }; });
    }

    autoTable(this.doc, {
      head: [headers],
      body: rows.map(row => row.map(String)),
      startY: this.y,
      margin: { left: this.margin, right: this.margin },
      tableWidth: this.pageW - 2 * this.margin,
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        cellPadding: 3,
      },
      bodyStyles: {
        textColor: DARK_TEXT,
        fontSize: 8.5,
        cellPadding: 2.5,
      },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: colStyles,
      didDrawPage: () => {
        this.y = (this.doc as any).lastAutoTable?.finalY ?? this.y;
      },
    });

    this.y = (this.doc as any).lastAutoTable?.finalY ?? this.y + 10;
    this.y += 5;
  }

  // ─ Section builders ─────────────────────────────────────────

  buildCoverPage(campaign: Campaign, cycle: Cycle): void {
    // Full-bleed header band
    this.doc.setFillColor(...BRAND_COLOR);
    this.doc.rect(0, 0, this.pageW, 55, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(28);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('NEURO Ad Agent', this.pageW / 2, 22, { align: 'center' });

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(13);
    this.doc.setTextColor(255, 220, 180);
    this.doc.text('Campaign Analysis Report', this.pageW / 2, 33, { align: 'center' });

    this.doc.setFontSize(10);
    this.doc.setTextColor(255, 200, 150);
    this.doc.text(`Cycle ${cycle.cycleNumber}  |  ${today()}`, this.pageW / 2, 44, { align: 'center' });

    this.y = 70;

    // Meta info box
    this.doc.setFillColor(...LIGHT_BG);
    this.doc.roundedRect(this.margin, this.y, this.pageW - 2 * this.margin, 52, 2, 2, 'F');
    this.doc.setDrawColor(229, 231, 235);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(this.margin, this.y, this.pageW - 2 * this.margin, 52, 2, 2, 'S');

    this.y += 8;
    const left = this.margin + 6;

    const metaRows: [string, string][] = [
      ['Brand', campaign.brand || 'N/A'],
      ['Product', (campaign.productDescription || '').substring(0, 80)],
      ['Target Audience', (campaign.targetAudience || '').substring(0, 80)],
      ['Marketing Goal', (campaign.marketingGoal || '').substring(0, 80)],
      ['Cycle', `#${cycle.cycleNumber}  |  Status: ${cycle.status}`],
      ['Report Date', today()],
    ];

    metaRows.forEach(([label, value]) => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...MUTED_TEXT);
      this.doc.text(label.toUpperCase(), left, this.y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      this.doc.setTextColor(...DARK_TEXT);
      this.doc.text(value, left + 32, this.y);
      this.y += 7;
    });

    this.y += 6;

    // Research stats (if available)
    const audit = cycle.researchFindings?.auditTrail;
    if (audit) {
      this.doc.setFillColor(234, 88, 12, 0.08);
      const statsY = this.y;
      this.doc.roundedRect(this.margin, statsY, this.pageW - 2 * this.margin, 28, 2, 2, 'F');

      const statItems = [
        { label: 'Sources', value: String(audit.totalSources) },
        { label: 'Coverage', value: pct(audit.coverageAchieved) },
        { label: 'Iterations', value: String(audit.iterationsCompleted) },
        { label: 'Duration', value: formatMs(audit.researchDuration) },
        { label: 'Tokens', value: audit.totalTokensGenerated.toLocaleString() },
        { label: 'Preset', value: audit.preset || 'N/A' },
      ];

      const colW = (this.pageW - 2 * this.margin) / statItems.length;
      statItems.forEach((item, i) => {
        const cx = this.margin + i * colW + colW / 2;
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(14);
        this.doc.setTextColor(...BRAND_COLOR);
        this.doc.text(item.value, cx, statsY + 12, { align: 'center' });
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(...MUTED_TEXT);
        this.doc.text(item.label, cx, statsY + 20, { align: 'center' });
      });

      this.y = statsY + 32;
    }

    // Footer
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...MUTED_TEXT);
    this.doc.text('Generated by NEURO Ad Agent — Confidential', this.pageW / 2, this.pageH - 10, { align: 'center' });
  }

  buildResearchSummary(findings: ResearchFindings, includeRaw: boolean): void {
    this.newPage();
    this.h2('RESEARCH SUMMARY', SECTION_COLORS.research);

    // Coverage bar
    if (findings.auditTrail) {
      const covPct = Math.round(findings.auditTrail.coverageAchieved * 100);
      this.h3('Dimensional Coverage');
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...MUTED_TEXT);
      this.doc.text(`${covPct}%`, this.margin, this.y);
      this.progressBar(covPct, this.margin + 10, this.y - 3.5, 120);
      this.y += 6;
      this.gap(2);
    }

    // Key insights from research report
    if (findings.researchReport?.keyInsights?.length) {
      this.h3('Top Insights');
      findings.researchReport.keyInsights.slice(0, 10).forEach((insight, i) => {
        const label = `[${insight.category.toUpperCase()}] ${insight.insight}`;
        this.bullet(`${i + 1}. ${label}`);
        if (insight.confidence && includeRaw) {
          this.small(`  Confidence: ${insight.confidence}%`, MUTED_TEXT);
        }
      });
      this.gap(3);
    }

    // Executive summary from report
    if (findings.researchReport?.executiveSummary) {
      this.h3('Executive Summary');
      this.body(findings.researchReport.executiveSummary);
      this.gap(3);
    }

    // Deep desires
    if (findings.deepDesires?.length) {
      this.h3('Customer Desires Mapped');
      const rows = findings.deepDesires.slice(0, 8).map(d => [
        d.surfaceProblem,
        d.deepestDesire,
        d.desireIntensity,
        d.targetSegment || '',
      ]);
      this.autoTable(
        ['Surface Problem', 'Deepest Desire', 'Intensity', 'Segment'],
        rows,
        undefined,
        SECTION_COLORS.research,
      );
    }

    // Objections
    if (findings.objections?.length) {
      this.h3('Purchase Objections');
      const rows = findings.objections.slice(0, 8).map(o => [
        o.objection,
        o.frequency,
        o.impact,
        o.handlingApproach.substring(0, 60),
      ]);
      this.autoTable(
        ['Objection', 'Frequency', 'Impact', 'Handling Approach'],
        rows,
        undefined,
        SECTION_COLORS.research,
      );
    }

    // Avatar language
    if (findings.avatarLanguage?.length) {
      this.h3('Audience Language');
      findings.avatarLanguage.slice(0, 12).forEach(phrase => this.bullet(`"${phrase}"`));
      this.gap(3);
    }

    // Where audience congregates
    if (findings.whereAudienceCongregates?.length) {
      this.h3('Where Audience Congregates');
      findings.whereAudienceCongregates.slice(0, 8).forEach(place => this.bullet(place));
      this.gap(3);
    }

    // What they tried before
    if (findings.whatTheyTriedBefore?.length) {
      this.h3('Failed Solutions (What They Tried Before)');
      findings.whatTheyTriedBefore.slice(0, 8).forEach(item => this.bullet(item));
      this.gap(3);
    }

    // Council verdict
    if (findings.councilVerdict) {
      const v = findings.councilVerdict;
      this.h3('Council Verdict');
      this.body(`Strategic Direction: ${v.strategicDirection}`);
      this.body(`Primary Ad Type: ${v.primaryAdType}  |  Confidence: ${Math.round(v.confidenceScore * 100)}%`);
      if (v.keyInsights?.length) {
        this.gap(2);
        this.small('Key Insights:');
        v.keyInsights.slice(0, 5).forEach(ins => this.bullet(ins));
      }
    }
  }

  buildCompetitorSection(findings: ResearchFindings): void {
    const comps = findings.competitorAds?.competitors;
    const positions = findings.competitivePositioning;
    if (!comps?.length && !positions?.length) return;

    this.newPage();
    this.h2('COMPETITOR ANALYSIS', SECTION_COLORS.competitors);

    // Competitor matrix table
    if (comps?.length) {
      this.h3('Competitor Landscape');
      const rows = comps.slice(0, 10).map(c => [
        c.brand,
        c.positioning,
        c.dominantAngles.slice(0, 2).join('; '),
        String(c.estimatedActiveAds ?? 'N/A'),
      ]);
      this.autoTable(
        ['Brand', 'Positioning', 'Primary Angles', 'Active Ads'],
        rows,
        [35, 65, 55, 20],
        SECTION_COLORS.competitors,
      );
    }

    // Competitive positioning detail
    if (positions?.length) {
      this.h3('Competitive Positioning Detail');
      positions.slice(0, 6).forEach(cp => {
        this.checkY(28);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(10);
        this.doc.setTextColor(...DARK_TEXT);
        this.doc.text(cp.name, this.margin, this.y);
        this.y += 5;
        this.body(`Claim: ${cp.positioning}`, 4);
        this.body(`Pricing: ${cp.pricing || 'N/A'}`, 4);
        this.body(`Structural Weakness: ${cp.structuralWeakness}`, 4);
        if (cp.customerComplaint) {
          this.body(`Top Customer Complaint: "${cp.customerComplaint}"`, 4, MUTED_TEXT);
        }
        this.gap(3);
      });
    }

    // Industry patterns
    if (findings.competitorAds?.industryPatterns) {
      const ip = findings.competitorAds.industryPatterns;
      this.h3('Industry-Wide Patterns');
      const patRows: [string, string][] = [
        ['Dominant Hooks', ip.dominantHooks?.slice(0, 4).join(', ') || 'N/A'],
        ['Emotional Drivers', ip.commonEmotionalDrivers?.slice(0, 4).join(', ') || 'N/A'],
        ['Unused Angles', ip.unusedAngles?.slice(0, 4).join(', ') || 'N/A'],
        ['Dominant Formats', ip.dominantFormats?.slice(0, 3).join(', ') || 'N/A'],
        ['Common Offers', ip.commonOffers?.slice(0, 3).join(', ') || 'N/A'],
      ];
      this.autoTable(['Pattern', 'Examples'], patRows, [50, 120], SECTION_COLORS.competitors);
    }

    // Competitor weaknesses
    if (findings.competitorWeaknesses?.length) {
      this.h3('Identified Positioning Gaps');
      findings.competitorWeaknesses.slice(0, 8).forEach(w => this.bullet(w));
    }
  }

  buildFactCheckSection(report: FactCheckReport): void {
    this.newPage();
    this.h2('FACT CHECK REPORT', SECTION_COLORS.factCheck);

    // Summary stats bar
    this.checkY(22);
    const statBarY = this.y;
    const bw = (this.pageW - 2 * this.margin) / 4;

    const statCells = [
      { label: 'Credibility', value: `${report.overallCredibility}%`, color: SECTION_COLORS.factCheck },
      { label: 'Verified', value: String(report.verifiedCount), color: [34, 197, 94] as [number, number, number] },
      { label: 'Disputed', value: String(report.disputedCount), color: [239, 68, 68] as [number, number, number] },
      { label: 'Unverified', value: String(report.unverifiedCount), color: [245, 158, 11] as [number, number, number] },
    ];

    statCells.forEach((cell, i) => {
      const cx = this.margin + i * bw + bw / 2;
      this.doc.setFillColor(...LIGHT_BG);
      this.doc.roundedRect(this.margin + i * bw, statBarY, bw - 1, 16, 1, 1, 'F');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(16);
      this.doc.setTextColor(...cell.color);
      this.doc.text(cell.value, cx, statBarY + 9, { align: 'center' });
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...MUTED_TEXT);
      this.doc.text(cell.label, cx, statBarY + 15, { align: 'center' });
    });
    this.y = statBarY + 20;

    // Credibility progress bar
    this.gap(2);
    this.progressBar(report.overallCredibility, this.margin, this.y, this.pageW - 2 * this.margin, 4);
    this.y += 8;

    // Verified claims
    const verified = report.checkedClaims.filter(c => c.verdict === 'verified');
    if (verified.length) {
      this.h3('Verified Claims');
      verified.slice(0, 8).forEach(c => {
        this.checkY(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(34, 197, 94);
        this.doc.text('\u2713', this.margin + 2, this.y);
        const maxW = this.pageW - 2 * this.margin - 8;
        const lines = this.doc.splitTextToSize(c.claim, maxW);
        this.doc.setTextColor(...DARK_TEXT);
        this.doc.text(lines[0] || '', this.margin + 8, this.y);
        this.y += 4.5;
        if (c.sourceAgreement !== undefined) {
          this.small(`  Agreement: ${c.sourceAgreement}%  |  Confidence: ${Math.round(c.confidence * 100)}%`);
        }
      });
      this.gap(3);
    }

    // Disputed claims
    const disputed = report.checkedClaims.filter(c => c.verdict === 'disputed');
    if (disputed.length) {
      this.h3('Disputed Claims');
      disputed.slice(0, 6).forEach(c => {
        this.checkY(12);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(239, 68, 68);
        this.doc.text('\u2717', this.margin + 2, this.y);
        this.doc.setTextColor(...DARK_TEXT);
        const maxW = this.pageW - 2 * this.margin - 8;
        const lines = this.doc.splitTextToSize(c.claim, maxW);
        this.doc.text(lines[0] || '', this.margin + 8, this.y);
        this.y += 4.5;
        this.body(`  Reason: ${c.reasonForVerdict}`, 8, MUTED_TEXT);
        this.gap(1);
      });
      this.gap(3);
    }

    // Flagged claims table
    if (report.flaggedClaims?.length) {
      this.h3('Flagged Claims');
      const rows = report.flaggedClaims.slice(0, 8).map(f => [
        f.claim.substring(0, 50),
        f.flag,
        f.severity,
        f.recommendation.substring(0, 50),
      ]);
      this.autoTable(
        ['Claim', 'Flag', 'Severity', 'Recommendation'],
        rows,
        [60, 30, 20, 60],
        SECTION_COLORS.factCheck,
      );
    }
  }

  buildVisualSection(findings: ResearchFindings): void {
    const vf = findings.visualFindings;
    if (!vf) return;

    this.newPage();
    this.h2('VISUAL INTELLIGENCE', SECTION_COLORS.visual);

    // Summary stats
    this.body(`${vf.totalScreenshots} competitor pages screenshotted  |  ${vf.totalAnalyzed} analyzed by vision model  |  Model: ${vf.analysisModel}`);
    this.gap(3);

    // Color palettes
    if (vf.dominantColorPalettes?.length) {
      this.h3('Competitor Color Palettes');
      const startY = this.y;
      const cols = Math.min(4, vf.dominantColorPalettes.length);
      const colW = (this.pageW - 2 * this.margin) / cols;

      vf.dominantColorPalettes.slice(0, 8).forEach((palette, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const px = this.margin + col * colW;
        const py = startY + row * 20;

        const colors = [palette.primary, palette.secondary, palette.accent].filter(Boolean) as string[];
        colors.forEach((hex, ci) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            this.colorSwatch(hex, hex, px + ci * 12, py);
          }
        });
        if (palette.description) {
          this.doc.setFont('helvetica', 'normal');
          this.doc.setFontSize(7.5);
          this.doc.setTextColor(...MUTED_TEXT);
          this.doc.text(palette.description.substring(0, 22), px, py + 14, { maxWidth: colW - 2 });
        }
      });

      const rows = Math.ceil(vf.dominantColorPalettes.length / cols);
      this.y = startY + rows * 22 + 4;
    }

    // Common patterns
    if (vf.commonPatterns?.length) {
      this.h3('Common Visual Patterns');
      vf.commonPatterns.slice(0, 8).forEach(p => this.bullet(p));
      this.gap(3);
    }

    // Visual gaps / opportunities
    if (vf.visualGaps?.length) {
      this.h3('Visual Market Gaps (Opportunities)');
      vf.visualGaps.slice(0, 8).forEach(g => this.bullet(g));
      this.gap(3);
    }

    // Recommended differentiation
    if (vf.recommendedDifferentiation?.length) {
      this.h3('Recommended Visual Differentiation');
      vf.recommendedDifferentiation.slice(0, 6).forEach(r => this.bullet(r));
      this.gap(3);
    }

    // Layout / tone summary
    const summaryRows: [string, string][] = [];
    if (vf.mostCommonLayout) summaryRows.push(['Most Common Layout', vf.mostCommonLayout]);
    if (vf.mostCommonTone) summaryRows.push(['Most Common Tone', vf.mostCommonTone]);
    if (vf.mostCommonCTAStyle) summaryRows.push(['Most Common CTA Style', vf.mostCommonCTAStyle]);
    if (summaryRows.length) {
      this.h3('Market Defaults');
      this.autoTable(['Dimension', 'Dominant Pattern'], summaryRows, [50, 120], SECTION_COLORS.visual);
    }

    // Individual competitor visual breakdown
    if (vf.competitorVisuals?.length) {
      this.h3('Competitor-by-Competitor Analysis');
      const rows = vf.competitorVisuals.slice(0, 10).map(cv => {
        let domain = cv.url;
        try { domain = new URL(cv.url).hostname; } catch { /* ignore */ }
        return [
          domain,
          cv.layoutStyle || '',
          cv.visualTone || '',
          cv.ctaStyle || '',
          cv.dominantColors?.slice(0, 2).join(', ') || '',
        ];
      });
      this.autoTable(
        ['Competitor', 'Layout', 'Tone', 'CTA Style', 'Colors'],
        rows,
        [35, 35, 30, 30, 40],
        SECTION_COLORS.visual,
      );
    }
  }

  buildConceptsSection(concepts: AdConcept[]): void {
    if (!concepts?.length) return;

    this.newPage();
    this.h2('AD CONCEPTS', SECTION_COLORS.concepts);

    concepts.forEach((concept, i) => {
      this.checkY(50);

      // Concept header band (lighter)
      this.doc.setFillColor(253, 242, 248);
      this.doc.roundedRect(this.margin, this.y, this.pageW - 2 * this.margin, 10, 1, 1, 'F');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(11);
      this.doc.setTextColor(...SECTION_COLORS.concepts);
      this.doc.text(`Concept ${concept.conceptNumber || i + 1}: ${concept.hookAngle || ''}`, this.margin + 4, this.y + 7);
      this.y += 14;

      // Copy block
      const fields: [string, string][] = [
        ['Headline', concept.headline || ''],
        ['Body', concept.body || ''],
        ['CTA', concept.cta || ''],
      ];

      fields.forEach(([label, value]) => {
        if (!value) return;
        this.checkY(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...MUTED_TEXT);
        this.doc.text(label.toUpperCase(), this.margin + 2, this.y);
        this.y += 4.5;
        this.body(value, 2);
        this.gap(1);
      });

      // Meta
      const metaFields: [string, string][] = [
        ['Emotional Driver', concept.emotionalDriver || ''],
        ['Ad Format', concept.adFormat || ''],
        ['Visual Direction', concept.visualDirection || ''],
        ['Colors', concept.colors?.join(', ') || ''],
        ['Rationale', (concept.rationale || '').substring(0, 120)],
      ];

      metaFields.filter(([, v]) => v).forEach(([label, value]) => {
        this.checkY(6);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...MUTED_TEXT);
        this.doc.text(`${label}: `, this.margin + 2, this.y);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...DARK_TEXT);
        const labelW = this.doc.getTextWidth(`${label}: `) + 2;
        const val = this.doc.splitTextToSize(value, this.pageW - 2 * this.margin - labelW - 2);
        this.doc.text(val[0] || value.substring(0, 80), this.margin + 2 + labelW, this.y);
        this.y += 4.5;
      });

      // Color swatches inline
      if (concept.colors?.length) {
        const swatchStartY = this.y;
        concept.colors.slice(0, 5).forEach((hex, ci) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            this.colorSwatch(hex, hex, this.margin + 2 + ci * 14, swatchStartY);
          }
        });
        this.y = swatchStartY + 14;
      }

      this.gap(6);
    });
  }

  buildTestResultsSection(verdict: TestVerdict): void {
    this.newPage();
    this.h2('TEST RESULTS', SECTION_COLORS.testResults);

    // Winner callout
    this.checkY(18);
    this.doc.setFillColor(254, 243, 199);
    this.doc.roundedRect(this.margin, this.y, this.pageW - 2 * this.margin, 14, 1, 1, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(180, 83, 9);
    this.doc.text(`Winner: ${verdict.winner}`, this.margin + 4, this.y + 9);
    this.y += 18;

    // Scores table
    if (verdict.concepts?.length) {
      const scoreHeaders = ['Concept', 'Desire Act.', 'Root Cause', 'Emo/Logic', 'Audience', 'Comp. Diff.', 'Total', 'Verdict'];
      const scoreRows = verdict.concepts.map(c => [
        c.name,
        String(c.scores.desireActivation),
        String(c.scores.rootCauseReveal),
        String(c.scores.emotionalLogical),
        String(c.scores.audienceLanguage),
        String(c.scores.competitiveDiff),
        String(c.totalScore),
        c.verdict.toUpperCase(),
      ]);
      this.autoTable(scoreHeaders, scoreRows, [40, 18, 18, 18, 18, 18, 14, 16], SECTION_COLORS.testResults);

      // Per-concept notes
      this.h3('Detailed Notes');
      verdict.concepts.forEach(c => {
        this.checkY(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9.5);
        this.doc.setTextColor(...DARK_TEXT);
        this.doc.text(`${c.name} (${c.verdict.toUpperCase()})`, this.margin, this.y);
        this.y += 5;
        this.body(c.notes, 4, MUTED_TEXT);
        this.gap(2);
      });
    }

    // Next cycle improvement
    if (verdict.nextCycleImprovement) {
      this.gap(3);
      this.h3('Recommended Improvement for Next Cycle');
      this.body(verdict.nextCycleImprovement);
    }
  }

  buildMemoriesSection(cycle: Cycle): void {
    const memories = cycle.priorMemories;
    if (!memories?.length) return;

    this.newPage();
    this.h2('MEMORIES EXTRACTED', SECTION_COLORS.memories);
    this.body('Patterns archived for the next research cycle:');
    this.gap(3);

    memories.forEach((mem, i) => {
      this.checkY(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...MUTED_TEXT);
      this.doc.text(`${i + 1}.`, this.margin, this.y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...DARK_TEXT);
      const lines = this.doc.splitTextToSize(mem.content, this.pageW - 2 * this.margin - 8);
      this.doc.text(lines, this.margin + 6, this.y);
      this.y += lines.length * 4.5;
      if (mem.tags?.length) {
        this.small(`  Tags: ${mem.tags.join(', ')}`);
      }
      this.gap(2);
    });
  }

  buildAuditTrailSection(findings: ResearchFindings): void {
    const audit = findings.auditTrail;
    if (!audit) return;

    this.newPage();
    this.h2('RESEARCH AUDIT TRAIL', SECTION_COLORS.auditTrail);

    // Parameters table
    this.h3('Research Parameters');
    const paramRows: [string, string][] = [
      ['Total Sources', String(audit.totalSources)],
      ['Duration', formatMs(audit.researchDuration)],
      ['Iterations Completed', String(audit.iterationsCompleted)],
      ['Coverage Achieved', pct(audit.coverageAchieved)],
      ['Preset', audit.preset],
      ['Session ID', audit.sessionId || 'N/A'],
    ];
    this.autoTable(['Parameter', 'Value'], paramRows, [60, 110], SECTION_COLORS.auditTrail);

    // Source breakdown
    if (audit.sourcesByType && Object.keys(audit.sourcesByType).length) {
      this.h3('Sources by Type');
      const typeRows = Object.entries(audit.sourcesByType).map(([type, count]) => [type, String(count)]);
      this.autoTable(['Source Type', 'Count'], typeRows, [80, 90], SECTION_COLORS.auditTrail);
    }

    // Token usage
    this.h3('Token Usage');
    const tokenRows: [string, string][] = [
      ['Total Tokens', audit.totalTokensGenerated.toLocaleString()],
    ];
    if (audit.totalThinkingTokens) {
      tokenRows.push(['Thinking Tokens', audit.totalThinkingTokens.toLocaleString()]);
    }
    if (audit.tokensByModel) {
      Object.entries(audit.tokensByModel).forEach(([model, tokens]) => {
        tokenRows.push([model, (tokens as number).toLocaleString()]);
      });
    }
    this.autoTable(['Model / Metric', 'Tokens'], tokenRows, [100, 70], SECTION_COLORS.auditTrail);

    // Phase timings
    if (audit.phaseTimes && Object.keys(audit.phaseTimes).length) {
      this.h3('Phase Timings');
      const phaseRows = Object.entries(audit.phaseTimes).map(([phase, ms]) => [phase, formatMs(ms as number)]);
      this.autoTable(['Phase', 'Duration'], phaseRows, [80, 90], SECTION_COLORS.auditTrail);
    }

    // Top 20 URLs
    if (audit.sourceList?.length) {
      this.h3(`Source URLs (top ${Math.min(20, audit.sourceList.length)} of ${audit.sourceList.length})`);
      const urlRows = audit.sourceList.slice(0, 20).map(s => {
        let domain = s.url;
        try { domain = new URL(s.url).hostname; } catch { /* ignore */ }
        return [
          domain,
          s.source || 'web',
          s.query?.substring(0, 35) || '',
          new Date(s.fetchedAt).toLocaleDateString(),
        ];
      });
      this.autoTable(
        ['Domain', 'Type', 'Query', 'Date'],
        urlRows,
        [45, 18, 80, 22],
        SECTION_COLORS.auditTrail,
      );
    }
  }

  // ─ Executive summary (2-page) ────────────────────────────────

  buildExecutiveSummary(campaign: Campaign, cycle: Cycle): void {
    // PAGE 1: Winner concept
    const concepts = cycle.stages['production']?.artifacts as AdConcept[] | undefined;
    const verdict = cycle.testVerdict;
    const winner = verdict && concepts?.find(c => c.hookAngle === verdict.winner) || concepts?.[0];

    this.h2(`WINNER CONCEPT: ${winner?.hookAngle || 'Top Ad Concept'}`, SECTION_COLORS.concepts);
    this.gap(2);

    if (winner) {
      const fields: [string, string][] = [
        ['Headline', winner.headline || ''],
        ['Body', winner.body || ''],
        ['CTA', winner.cta || ''],
        ['Format', winner.adFormat || ''],
        ['Emotional Driver', winner.emotionalDriver || ''],
        ['Visual Direction', winner.visualDirection || ''],
      ];
      fields.filter(([, v]) => v).forEach(([label, value]) => {
        this.checkY(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(9);
        this.doc.setTextColor(...MUTED_TEXT);
        this.doc.text(label.toUpperCase(), this.margin, this.y);
        this.y += 4.5;
        this.body(value, 2);
        this.gap(2);
      });

      if (winner.colors?.length) {
        this.h3('Brand Colors');
        winner.colors.slice(0, 5).forEach((hex, ci) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(hex)) this.colorSwatch(hex, hex, this.margin + ci * 14, this.y);
        });
        this.y += 14;
      }
    } else {
      this.body('No completed concepts found for this cycle.');
    }

    // Test verdict summary
    if (verdict) {
      this.gap(4);
      this.h3('Test Verdict Summary');
      this.body(`Winner: ${verdict.winner}`);
      if (verdict.nextCycleImprovement) {
        this.gap(2);
        this.body(`Next Cycle: ${verdict.nextCycleImprovement}`, 0, MUTED_TEXT);
      }
    }

    // PAGE 2: Top insights + key facts
    this.newPage(false);
    this.doc.setFillColor(...SECTION_COLORS.research);
    this.doc.rect(0, 0, this.pageW, 14, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text('TOP RESEARCH FINDINGS & KEY FACTS', this.margin, 10);
    this.y = 20;

    const findings = cycle.researchFindings;
    if (findings?.researchReport?.keyInsights?.length) {
      this.h3('Top 5 Strategic Insights');
      findings.researchReport.keyInsights.slice(0, 5).forEach((ins, i) => {
        this.bullet(`${i + 1}. [${ins.category}] ${ins.insight}`);
      });
      this.gap(4);
    }

    if (findings?.deepDesires?.length) {
      this.h3('Core Customer Desires');
      findings.deepDesires.slice(0, 3).forEach(d => {
        this.bullet(`${d.surfaceProblem} → ${d.deepestDesire} (${d.desireIntensity})`);
      });
      this.gap(4);
    }

    if (findings?.objections?.length) {
      this.h3('Primary Objections to Overcome');
      findings.objections.slice(0, 4).forEach(o => {
        this.bullet(`${o.objection} (${o.frequency}, ${o.impact} impact)`);
      });
      this.gap(4);
    }

    const fcr = findings?.factCheckReport;
    if (fcr) {
      this.h3('Fact Check Snapshot');
      this.body(`Overall Credibility: ${fcr.overallCredibility}%  |  Verified: ${fcr.verifiedCount}  |  Disputed: ${fcr.disputedCount}`);
      this.gap(4);
    }

    const audit = findings?.auditTrail;
    if (audit) {
      this.h3('Research Scope');
      this.body(`${audit.totalSources} sources  |  ${audit.iterationsCompleted} iterations  |  ${formatMs(audit.researchDuration)}  |  ${pct(audit.coverageAchieved)} coverage`);
    }

    // Campaign metadata footer
    this.y = this.pageH - 20;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...MUTED_TEXT);
    this.doc.text(`${campaign.brand}  |  Cycle ${cycle.cycleNumber}  |  ${today()}  |  NEURO Ad Agent`, this.pageW / 2, this.pageH - 8, { align: 'center' });
  }

  // ─ Save ─────────────────────────────────────────────────────

  save(filename: string): void {
    this.doc.save(filename);
  }

  setReportTitle(title: string): void {
    this.reportTitle = title;
  }
}

// ──────────────────────────────────────────────────────────────
// Public export API
// ──────────────────────────────────────────────────────────────

function buildFilename(campaign: Campaign, cycle: Cycle): string {
  const brand = (campaign.brand || 'brand').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  return `neuro-${brand}-cycle${cycle.cycleNumber}-${dateStr}.pdf`;
}

export async function exportCyclePDF(
  campaign: Campaign,
  cycle: Cycle,
  options: CyclePDFExportOptions,
): Promise<string> {
  const builder = new NeuroPDFBuilder();
  const findings: ResearchFindings | undefined = cycle.researchFindings;
  const filename = buildFilename(campaign, cycle);

  builder.setReportTitle(`${campaign.brand} — Cycle ${cycle.cycleNumber}`);

  if (options.format === 'executive') {
    // 2-page executive summary
    builder.buildCoverPage(campaign, cycle);
    builder.buildExecutiveSummary(campaign, cycle);
    builder.save(filename.replace('.pdf', '-exec.pdf'));
    return filename.replace('.pdf', '-exec.pdf');
  }

  // Full report
  builder.buildCoverPage(campaign, cycle);

  if (findings && options.sections.research) {
    builder.buildResearchSummary(findings, options.includeRawData);
  }

  if (findings && options.sections.competitors) {
    builder.buildCompetitorSection(findings);
  }

  if (findings?.factCheckReport && options.sections.factCheck) {
    builder.buildFactCheckSection(findings.factCheckReport);
  }

  if (findings && options.sections.visual) {
    builder.buildVisualSection(findings);
  }

  if (options.sections.concepts) {
    // Prefer advancedMakeConcepts, fall back to production stage artifacts, then legacy MakeOutput
    const legacyOutput = cycle.stages['production']?.artifacts;
    const concepts: AdConcept[] = (cycle.advancedMakeConcepts as AdConcept[] | undefined)
      ?? (Array.isArray(legacyOutput) ? legacyOutput as AdConcept[] : []);
    if (concepts.length > 0) {
      builder.buildConceptsSection(concepts);
    }
  }

  if (cycle.testVerdict && options.sections.testResults) {
    builder.buildTestResultsSection(cycle.testVerdict);
  }

  if (options.sections.memories) {
    builder.buildMemoriesSection(cycle);
  }

  if (findings && options.sections.auditTrail) {
    builder.buildAuditTrailSection(findings);
  }

  builder.save(filename);
  return filename;
}

// Re-export the old stub so nothing breaks
export async function exportResearchPDF(campaign: Campaign, cycle: Cycle): Promise<void> {
  await exportCyclePDF(campaign, cycle, {
    format: 'full',
    sections: DEFAULT_SECTION_FLAGS,
    includeRawData: false,
  });
}

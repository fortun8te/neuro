/**
 * Chart Generator — SVG-based charts for PDF embedding
 *
 * Generates charts that can be embedded in PDFs:
 * - Positioning matrix (2D scatter)
 * - Coverage bar chart
 * - Confidence radar chart (simplified)
 */

import { createLogger } from '../utils/logger';
import type { CompetitorProfile, ResearchFindings } from '../frontend/types';

const log = createLogger('chart-generator');

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ChartOptions {
  width?: number;
  height?: number;
  theme?: 'default' | 'dark';
}

export interface ChartSize {
  svg: string;
  width: number;
  height: number;
  mimeType: 'image/svg+xml';
}

// ──────────────────────────────────────────────────────────────
// Positioning Matrix Chart
// ──────────────────────────────────────────────────────────────

/**
 * Generates a 2D positioning matrix showing competitor placement.
 * X-axis: Price (low to high)
 * Y-axis: Prestige/Premium (basic to luxury)
 */
export function generatePositioningMatrix(
  competitors: CompetitorProfile[],
  options: ChartOptions = {},
): ChartSize {
  const width = options.width || 500;
  const height = options.height || 400;
  const padding = 60;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  // Assign positions (simplified for demo)
  const positions = competitors.map((comp, idx) => ({
    name: comp.brand,
    x: (idx + 1) / (competitors.length + 1), // 0-1
    y: Math.random(), // Random prestige for demo
    size: comp.adExamples?.length || 10,
  }));

  // Generate SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .axis { stroke: #d1d5db; stroke-width: 1; }
      .grid { stroke: #f3f4f6; stroke-width: 0.5; }
      .label { font-family: Helvetica, Arial, sans-serif; font-size: 12px; fill: #6b7280; }
      .title { font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #1f2937; }
      .competitor { fill: #3b82f6; opacity: 0.8; }
      .competitor-label { font-family: Helvetica, Arial, sans-serif; font-size: 11px; fill: #1f2937; font-weight: bold; }
      .axis-title { font-family: Helvetica, Arial, sans-serif; font-size: 13px; fill: #374151; font-weight: bold; }
    </style>

    <!-- Title -->
    <text x="${width / 2}" y="25" text-anchor="middle" class="title">Competitor Positioning Matrix</text>

    <!-- Grid lines -->
    ${Array.from({ length: 5 }).map((_, i) => {
      const x = padding + (graphWidth / 4) * i;
      return `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" class="grid"/>`;
    }).join('')}

    ${Array.from({ length: 5 }).map((_, i) => {
      const y = padding + (graphHeight / 4) * i;
      return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="grid"/>`;
    }).join('')}

    <!-- Axes -->
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis" stroke-width="2"/>
    <line x1="${padding}" y1="${height - padding}" x2="${padding}" y2="${padding}" class="axis" stroke-width="2"/>

    <!-- Axis labels -->
    <text x="${padding - 10}" y="${height - padding + 30}" text-anchor="end" class="label">Lower Price</text>
    <text x="${width - padding + 10}" y="${height - padding + 30}" text-anchor="start" class="label">Higher Price</text>
    <text x="${padding - 30}" y="${padding}" text-anchor="middle" class="label" transform="rotate(-90 ${padding - 30} ${padding})">Basic</text>
    <text x="${padding - 30}" y="${height - padding}" text-anchor="middle" class="label" transform="rotate(-90 ${padding - 30} ${height - padding})">Premium</text>

    <!-- Axis titles -->
    <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="axis-title">Price Position</text>
    <text x="15" y="${height / 2}" text-anchor="middle" class="axis-title" transform="rotate(-90 15 ${height / 2})">Premium Positioning</text>

    <!-- Data points -->
    ${positions.map((pos) => {
      const cx = padding + pos.x * graphWidth;
      const cy = height - padding - pos.y * graphHeight;
      const radius = Math.max(5, Math.min(15, pos.size / 2));

      return `
        <circle cx="${cx}" cy="${cy}" r="${radius}" class="competitor"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="competitor-label">${pos.name.substring(0, 3)}</text>
      `;
    }).join('')}

    <!-- Legend -->
    <text x="${padding}" y="${padding - 20}" class="label">Circle size = Ad volume</text>
  </svg>`;

  return {
    svg,
    width,
    height,
    mimeType: 'image/svg+xml',
  };
}

// ──────────────────────────────────────────────────────────────
// Coverage Bar Chart
// ──────────────────────────────────────────────────────────────

/**
 * Generates a horizontal bar chart showing research coverage by dimension
 */
export function generateCoverageChart(
  findings: ResearchFindings,
  options: ChartOptions = {},
): ChartSize {
  const width = options.width || 500;
  const height = options.height || 300;
  const padding = 50;
  const graphWidth = width - 2 * padding;

  // Define coverage dimensions
  const dimensions: Array<{ name: string; coverage: number }> = [
    {
      name: 'Customer Desires',
      coverage: findings.deepDesires?.length ? Math.min(1, findings.deepDesires.length / 5) : 0,
    },
    {
      name: 'Objections',
      coverage: findings.objections?.length ? Math.min(1, findings.objections.length / 5) : 0,
    },
    {
      name: 'Market Insights',
      coverage: findings.whereAudienceCongregates?.length ? 0.8 : 0.4,
    },
    {
      name: 'Competitor Analysis',
      coverage: findings.competitorAds?.competitors?.length ? 0.9 : 0.5,
    },
    {
      name: 'Visual Analysis',
      coverage: findings.visualFindings ? 0.85 : 0.3,
    },
  ];

  const barHeight = 30;
  const totalHeight = padding * 2 + dimensions.length * (barHeight + 10);
  const finalHeight = Math.max(height, totalHeight);

  let svg = `<svg width="${width}" height="${finalHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .bar-bg { fill: #f3f4f6; }
      .bar { fill: #3b82f6; }
      .bar-high { fill: #10b981; }
      .label { font-family: Helvetica, Arial, sans-serif; font-size: 12px; fill: #1f2937; }
      .percent { font-family: Helvetica, Arial, sans-serif; font-size: 11px; fill: #6b7280; }
      .title { font-family: Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #1f2937; }
    </style>

    <text x="${width / 2}" y="25" text-anchor="middle" class="title">Research Coverage by Dimension</text>

    ${dimensions.map((dim, idx) => {
      const y = padding + idx * (barHeight + 10);
      const barWidth = graphWidth * dim.coverage;
      const percentage = Math.round(dim.coverage * 100);
      const barColor = dim.coverage > 0.7 ? '#10b981' : '#3b82f6';

      return `
        <text x="${padding - 10}" y="${y + barHeight / 2 + 5}" text-anchor="end" class="label">${dim.name}</text>
        <rect x="${padding}" y="${y}" width="${graphWidth}" height="${barHeight}" class="bar-bg"/>
        <rect x="${padding}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${barColor}"/>
        <text x="${padding + graphWidth + 10}" y="${y + barHeight / 2 + 5}" class="percent">${percentage}%</text>
      `;
    }).join('')}

    <text x="${padding + graphWidth / 2}" y="${finalHeight - 10}" text-anchor="middle" class="label">Coverage Progress</text>
  </svg>`;

  return {
    svg,
    width,
    height: finalHeight,
    mimeType: 'image/svg+xml',
  };
}

// ──────────────────────────────────────────────────────────────
// Confidence Gauge Chart
// ──────────────────────────────────────────────────────────────

/**
 * Generates a simple gauge/thermometer chart showing overall confidence
 */
export function generateConfidenceGauge(
  findings: ResearchFindings,
  options: ChartOptions = {},
): ChartSize {
  const width = options.width || 300;
  const height = options.height || 150;
  const padding = 20;

  // Calculate confidence score
  let confidenceScore = 0.5; // Default

  if (findings.auditTrail) {
    const coverage = findings.auditTrail.coverageAchieved || 0;
    const sourceCount = Math.min(findings.auditTrail.totalSources / 50, 1); // Normalize
    const iterations = Math.min(findings.auditTrail.iterationsCompleted / 10, 1);
    confidenceScore = (coverage * 0.5 + sourceCount * 0.3 + iterations * 0.2);
  }

  confidenceScore = Math.max(0, Math.min(1, confidenceScore)); // Clamp 0-1

  const gaugeWidth = width - 2 * padding;
  const filledWidth = gaugeWidth * confidenceScore;
  const fillColor = confidenceScore > 0.7 ? '#10b981' : confidenceScore > 0.5 ? '#f59e0b' : '#ef4444';
  const percentage = Math.round(confidenceScore * 100);

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .gauge-bg { fill: #e5e7eb; }
      .gauge-fill { fill: ${fillColor}; }
      .label { font-family: Helvetica, Arial, sans-serif; font-size: 12px; fill: #1f2937; }
      .percent { font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #1f2937; }
      .title { font-family: Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #374151; }
    </style>

    <text x="${width / 2}" y="20" text-anchor="middle" class="title">Research Confidence Score</text>

    <!-- Gauge background -->
    <rect x="${padding}" y="40" width="${gaugeWidth}" height="30" rx="4" class="gauge-bg"/>

    <!-- Gauge fill -->
    <rect x="${padding}" y="40" width="${filledWidth}" height="30" rx="4" class="gauge-fill"/>

    <!-- Percentage text -->
    <text x="${width / 2}" y="110" text-anchor="middle" class="percent">${percentage}%</text>

    <!-- Scale labels -->
    <text x="${padding}" y="85" class="label" text-anchor="middle">Low</text>
    <text x="${width / 2}" y="85" class="label" text-anchor="middle">Medium</text>
    <text x="${width - padding}" y="85" class="label" text-anchor="middle">High</text>
  </svg>`;

  return {
    svg,
    width,
    height,
    mimeType: 'image/svg+xml',
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: Embed SVG in PDF
// ──────────────────────────────────────────────────────────────

/**
 * Convert SVG string to data URL for embedding in PDFs
 */
export function svgToDataUrl(svg: string): string {
  // Encode SVG as data URL
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Convert SVG to Base64 data URL (alternative method)
 */
export function svgToBase64DataUrl(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export class ChartGenerator {
  generatePositioningMatrix(
    competitors: CompetitorProfile[],
    options?: ChartOptions,
  ): ChartSize {
    return generatePositioningMatrix(competitors, options);
  }

  generateCoverageChart(findings: ResearchFindings, options?: ChartOptions): ChartSize {
    return generateCoverageChart(findings, options);
  }

  generateConfidenceGauge(findings: ResearchFindings, options?: ChartOptions): ChartSize {
    return generateConfidenceGauge(findings, options);
  }

  svgToDataUrl(svg: string): string {
    return svgToDataUrl(svg);
  }

  svgToBase64DataUrl(svg: string): string {
    return svgToBase64DataUrl(svg);
  }
}

export const chartGenerator = new ChartGenerator();

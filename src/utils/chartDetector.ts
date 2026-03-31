/**
 * Chart Type Detection — Intelligently choose the best chart type for data
 *
 * Analyzes data structure and characteristics to recommend:
 * - Line/Area: time series, continuous trends, multiple values over time
 * - Bar: categories with discrete values, comparisons
 * - Pie: parts of a whole (values sum to ~100%)
 * - Scatter: X/Y relationships, correlation analysis
 * - Heatmap: multi-dimensional data grid
 */

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'scatter' | 'heatmap';

export interface ChartDetectionResult {
  type: ChartType;
  confidence: number; // 0-1 confidence score
  reason: string;
}

/**
 * Detect if an array of values represents time/date data
 */
function isTimeSeriesData(values: unknown[]): boolean {
  if (values.length === 0) return false;

  // Check if values contain date-like patterns
  const datePatterns = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;

  const sampleSize = Math.min(5, values.length);
  let dateMatches = 0;

  for (let i = 0; i < sampleSize; i++) {
    const val = String(values[i]).toLowerCase();
    if (datePatterns.test(val)) {
      dateMatches++;
    }
  }

  return dateMatches >= sampleSize * 0.6; // 60% of sample looks like dates
}

/**
 * Check if data is categorical (distinct, non-numeric X values)
 */
function isCategoricalData(xValues: unknown[]): boolean {
  if (xValues.length === 0) return false;

  const uniqueCount = new Set(xValues.map(v => String(v))).size;
  const totalCount = xValues.length;

  // Categorical if high uniqueness and not numeric
  const uniquenessRatio = uniqueCount / totalCount;
  const allNumeric = xValues.every(v => !isNaN(Number(v)) && v !== '');

  return uniquenessRatio > 0.7 && !allNumeric;
}

/**
 * Check if data values sum to approximately 100 (pie chart indicator)
 */
function isSumTo100(values: number[]): boolean {
  if (values.length === 0) return false;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum >= 90 && sum <= 110; // Allow 10% tolerance
}

/**
 * Check if all data points are non-negative
 */
function isAllNonNegative(values: number[]): boolean {
  return values.every(v => v >= 0);
}

/**
 * Analyze data structure and detect best chart type
 * @param data - Array of data objects or primitives
 * @param xKey - Optional key for X-axis values
 * @param yKey - Optional key for Y-axis values
 * @returns Detection result with chart type and confidence
 */
export function detectChartType(
  data: unknown[],
  xKey?: string,
  yKey?: string,
): ChartDetectionResult {
  if (!Array.isArray(data) || data.length === 0) {
    return { type: 'bar', confidence: 0.5, reason: 'No data provided — defaulting to bar chart' };
  }

  // ── Extract X and Y values from data ──
  const isObjectArray = typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0]);
  const xValues = isObjectArray && xKey
    ? (data as Record<string, unknown>[]).map(d => d[xKey])
    : data;

  // Try to extract numeric Y values
  let yValues: number[] = [];

  if (isObjectArray && yKey) {
    yValues = (data as Record<string, unknown>[])
      .map(d => {
        const val = d[yKey];
        return typeof val === 'number' ? val : Number(val);
      })
      .filter(v => !isNaN(v));
  } else if (isObjectArray) {
    // Find numeric columns
    const firstObj = data[0] as Record<string, unknown>;
    const numericKey = Object.keys(firstObj).find(
      key => typeof firstObj[key] === 'number' || !isNaN(Number(firstObj[key])),
    );
    if (numericKey) {
      yValues = (data as Record<string, unknown>[])
        .map(d => {
          const val = d[numericKey];
          return typeof val === 'number' ? val : Number(val);
        })
        .filter(v => !isNaN(v));
    }
  } else if (typeof data[0] === 'number') {
    yValues = (data as number[]).filter(v => !isNaN(v));
  }

  // ── Heuristic Detection ──

  // 1. Pie Chart — values sum to ~100 and all non-negative
  if (yValues.length > 0 && isAllNonNegative(yValues) && isSumTo100(yValues) && yValues.length >= 2 && yValues.length <= 8) {
    return {
      type: 'pie',
      confidence: 0.95,
      reason: 'Values sum to 100% — parts of a whole (pie chart)',
    };
  }

  // 2. Time Series — X is dates and Y is numeric
  if (yValues.length > 0 && isTimeSeriesData(xValues)) {
    return {
      type: 'area',
      confidence: 0.90,
      reason: 'Time series data detected — showing trend over time (area chart)',
    };
  }

  // 3. Line Chart — Multiple Y values, continuous trend
  if (yValues.length > 3) {
    const isMonotonic = yValues.slice(1).every((v, i) => v >= yValues[i] || v <= yValues[i]);
    if (isMonotonic || isTimeSeriesData(xValues)) {
      return {
        type: 'line',
        confidence: 0.85,
        reason: 'Multiple points over continuous domain — showing trend (line chart)',
      };
    }
  }

  // 4. Scatter Chart — Many points with X/Y relationship
  if (yValues.length > 10 && xValues.length === yValues.length) {
    return {
      type: 'scatter',
      confidence: 0.80,
      reason: 'Multiple X/Y data points — showing correlation (scatter chart)',
    };
  }

  // 5. Bar Chart — Categorical X with numeric Y (default for most data)
  if (isCategoricalData(xValues) && yValues.length > 0) {
    return {
      type: 'bar',
      confidence: 0.85,
      reason: 'Categorical data with values — comparison across groups (bar chart)',
    };
  }

  // 6. Default fallback
  return {
    type: 'bar',
    confidence: 0.5,
    reason: 'Defaulting to bar chart — best for general comparisons',
  };
}

/**
 * Suggest alternative chart types for the detected data
 * Useful for user override options
 */
export function suggestAlternatives(
  detected: ChartDetectionResult,
  yValuesCount: number,
): ChartType[] {
  const alternatives: ChartType[] = [];

  switch (detected.type) {
    case 'pie':
      if (yValuesCount > 8) alternatives.push('bar'); // Too many slices for pie
      alternatives.push('bar', 'area');
      break;
    case 'line':
    case 'area':
      alternatives.push('scatter', 'bar');
      break;
    case 'bar':
      if (yValuesCount >= 2) alternatives.push('line', 'area');
      alternatives.push('scatter');
      break;
    case 'scatter':
      alternatives.push('line', 'area', 'bar');
      break;
    default:
      alternatives.push('bar', 'line', 'area');
  }

  return [...new Set(alternatives)]; // Remove duplicates
}

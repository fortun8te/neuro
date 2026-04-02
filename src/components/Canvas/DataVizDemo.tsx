/**
 * Data Visualization Tier 1 Component Demo & Storybook
 * Showcases all semantic highlighting, callout, badge, and data table components
 */

import React, { useState } from 'react';
import { SemanticHighlight } from './SemanticHighlight';
import { CalloutBox } from './CalloutBox';
import { Badge } from './Badge';
import { DataTable, type Column } from './DataTable';
import { ProgressBar, CircularProgress } from './ProgressIndicator';
import { CANVAS_SPACING, CANVAS_FONT_SIZE, getColorScheme } from '../../styles/canvasStyles';

interface DataVizDemoProps {
  isDarkMode?: boolean;
}

const competitorData = [
  { competitor: 'AppA', marketShare: 34, satisfaction: 4.2, trend: 'Growing', status: 'complete' },
  { competitor: 'AppB', marketShare: 28, satisfaction: 3.8, trend: 'Stable', status: 'inprogress' },
  { competitor: 'AppC', marketShare: 22, satisfaction: 3.5, trend: 'Declining', status: 'blocked' },
  { competitor: 'Our Product', marketShare: 8, satisfaction: 4.7, trend: 'Emerging', status: 'complete' },
  { competitor: 'Startup D', marketShare: 5, satisfaction: 4.1, trend: 'Growing', status: 'complete' },
];

const competitorColumns: Column[] = [
  { key: 'competitor', label: 'Competitor', sortable: true, width: '200px' },
  {
    key: 'marketShare',
    label: 'Market Share %',
    sortable: true,
    align: 'right',
    render: (val: number) => `${val}%`,
  },
  {
    key: 'satisfaction',
    label: 'Customer Rating',
    sortable: true,
    align: 'right',
    render: (val: number) => `${val}/5`,
  },
  { key: 'trend', label: 'Trend', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (val: string) => {
      const badgeType = val as 'complete' | 'inprogress' | 'blocked';
      return <Badge type={badgeType} size="sm">{val}</Badge>;
    },
  },
];

const metricsData = [
  { metric: 'Email Open Rate', value: 24.5, change: 3.2, trend: 'positive' },
  { metric: 'Click-Through Rate', value: 8.2, change: -1.5, trend: 'negative' },
  { metric: 'Conversion Rate', value: 3.8, change: 0.5, trend: 'neutral' },
  { metric: 'Cost Per Acquisition', value: 45.2, change: -2.1, trend: 'positive' },
  { metric: 'Customer Lifetime Value', value: 1250, change: 8.3, trend: 'positive' },
  { metric: 'Churn Rate', value: 5.2, change: 0.3, trend: 'negative' },
];

const metricsColumns: Column[] = [
  { key: 'metric', label: 'Metric', sortable: true },
  {
    key: 'value',
    label: 'Current Value',
    sortable: true,
    align: 'right',
    render: (val: number) => val.toFixed(1),
  },
  {
    key: 'change',
    label: 'Month-over-Month',
    sortable: true,
    align: 'right',
    render: (val: number) => (
      <span style={{ color: val > 0 ? '#22c55e' : val < 0 ? '#ef4444' : '#9ca3af' }}>
        {val > 0 ? '+' : ''}{val.toFixed(1)}%
      </span>
    ),
  },
  {
    key: 'trend',
    label: 'Trend',
    render: (val: string) => {
      const badgeType = val as 'positive' | 'negative' | 'neutral';
      return <Badge type={badgeType} size="sm">{val}</Badge>;
    },
  },
];

export function DataVizDemo({ isDarkMode = true }: DataVizDemoProps) {
  const colors = getColorScheme(isDarkMode);

  return (
    <div
      style={{
        padding: CANVAS_SPACING.xl,
        background: isDarkMode ? '#141420' : '#EEECEA',
        color: colors.textSecondary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Semantic Highlights Section */}
      <section style={{ marginBottom: CANVAS_SPACING.xxl }}>
        <h2
          style={{
            fontSize: CANVAS_FONT_SIZE['2xl'],
            fontWeight: 600,
            marginBottom: CANVAS_SPACING.lg,
            color: colors.text,
          }}
        >
          Semantic Highlights
        </h2>
        <p style={{ marginBottom: CANVAS_SPACING.lg }}>
          Use inline highlights to emphasize key insights:
        </p>

        <div style={{ marginBottom: CANVAS_SPACING.lg, lineHeight: '1.8' }}>
          <SemanticHighlight type="key" isDarkMode={isDarkMode}>
            Customer pain point: high purchase friction at checkout
          </SemanticHighlight>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg, lineHeight: '1.8' }}>
          <SemanticHighlight type="warn" isDarkMode={isDarkMode}>
            Only 12% of competitors address this in their messaging
          </SemanticHighlight>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg, lineHeight: '1.8' }}>
          <SemanticHighlight type="insight" isDarkMode={isDarkMode}>
            Reddit discussions show 89% sentiment alignment with this pain point
          </SemanticHighlight>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg, lineHeight: '1.8' }}>
          <SemanticHighlight type="evidence" isDarkMode={isDarkMode}>
            Evidence from 34 customer interviews validates this finding
          </SemanticHighlight>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg, lineHeight: '1.8' }}>
          <SemanticHighlight type="note" isDarkMode={isDarkMode}>
            This insight can be cross-referenced with market sizing data
          </SemanticHighlight>
        </div>
      </section>

      {/* Callout Boxes Section */}
      <section style={{ marginBottom: CANVAS_SPACING.xxl }}>
        <h2
          style={{
            fontSize: CANVAS_FONT_SIZE['2xl'],
            fontWeight: 600,
            marginBottom: CANVAS_SPACING.lg,
            color: colors.text,
          }}
        >
          Callout Boxes
        </h2>

        <CalloutBox type="tip" isDarkMode={isDarkMode}>
          Save time by pre-scanning competitor ad libraries before research phase begins.
        </CalloutBox>

        <CalloutBox type="warning" isDarkMode={isDarkMode}>
          Confidence score is below 65%. Recommend additional sources for validation.
        </CalloutBox>

        <CalloutBox type="critical" isDarkMode={isDarkMode}>
          Market size projection missing. Continue research in Phase 2 to fill gap.
        </CalloutBox>

        <CalloutBox type="success" isDarkMode={isDarkMode}>
          Competitor analysis 100% complete. Analyzed 23 sources, collected 1,200+ data points.
        </CalloutBox>

        <CalloutBox type="quote" isDarkMode={isDarkMode}>
          "Customers told us they want a solution that just works out of the box." — Focus group participant
        </CalloutBox>
      </section>

      {/* Badge System Section */}
      <section style={{ marginBottom: CANVAS_SPACING.xxl }}>
        <h2
          style={{
            fontSize: CANVAS_FONT_SIZE['2xl'],
            fontWeight: 600,
            marginBottom: CANVAS_SPACING.lg,
            color: colors.text,
          }}
        >
          Badge System
        </h2>
        <p style={{ marginBottom: CANVAS_SPACING.lg }}>
          Use badges for inline categorization and status indicators:
        </p>

        <div style={{ marginBottom: CANVAS_SPACING.lg }}>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            Topic Tags
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="research" isDarkMode={isDarkMode}>Research</Badge>
            <Badge type="market" isDarkMode={isDarkMode}>Market</Badge>
            <Badge type="competitor" isDarkMode={isDarkMode}>Competitor</Badge>
            <Badge type="finding" isDarkMode={isDarkMode}>Finding</Badge>
            <Badge type="insight" isDarkMode={isDarkMode}>Insight</Badge>
          </div>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg }}>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            Priority
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="high" isDarkMode={isDarkMode}>High</Badge>
            <Badge type="medium" isDarkMode={isDarkMode}>Medium</Badge>
            <Badge type="low" isDarkMode={isDarkMode}>Low</Badge>
          </div>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg }}>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            Status
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="complete" isDarkMode={isDarkMode}>Complete</Badge>
            <Badge type="inprogress" isDarkMode={isDarkMode}>In Progress</Badge>
            <Badge type="blocked" isDarkMode={isDarkMode}>Blocked</Badge>
          </div>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg }}>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            Sentiment
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="positive" isDarkMode={isDarkMode}>Positive</Badge>
            <Badge type="negative" isDarkMode={isDarkMode}>Negative</Badge>
            <Badge type="neutral" isDarkMode={isDarkMode}>Neutral</Badge>
          </div>
        </div>

        <div style={{ marginBottom: CANVAS_SPACING.lg }}>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            SWOT
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="strength" isDarkMode={isDarkMode}>Strength</Badge>
            <Badge type="weakness" isDarkMode={isDarkMode}>Weakness</Badge>
            <Badge type="opportunity" isDarkMode={isDarkMode}>Opportunity</Badge>
            <Badge type="threat" isDarkMode={isDarkMode}>Threat</Badge>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.md }}>
            Trust Level
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: CANVAS_SPACING.md }}>
            <Badge type="verified" isDarkMode={isDarkMode}>Verified</Badge>
            <Badge type="unverified" isDarkMode={isDarkMode}>Unverified</Badge>
            <Badge type="recommended" isDarkMode={isDarkMode}>Recommended</Badge>
            <Badge type="deprecated" isDarkMode={isDarkMode}>Deprecated</Badge>
          </div>
        </div>
      </section>

      {/* Data Tables Section */}
      <section style={{ marginBottom: CANVAS_SPACING.xxl }}>
        <h2
          style={{
            fontSize: CANVAS_FONT_SIZE['2xl'],
            fontWeight: 600,
            marginBottom: CANVAS_SPACING.lg,
            color: colors.text,
          }}
        >
          Sortable Data Tables
        </h2>

        <div style={{ marginBottom: CANVAS_SPACING.xxl }}>
          <h3 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.lg }}>
            Competitor Analysis Table
          </h3>
          <DataTable
            columns={competitorColumns}
            rows={competitorData}
            title="Market Snapshot"
            isDarkMode={isDarkMode}
          />
        </div>

        <div>
          <h3 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.lg }}>
            Campaign Metrics
          </h3>
          <DataTable
            columns={metricsColumns}
            rows={metricsData}
            title="Key Performance Indicators"
            isDarkMode={isDarkMode}
            compact={true}
          />
        </div>
      </section>

      {/* Progress Indicators Section */}
      <section style={{ marginBottom: CANVAS_SPACING.xxl }}>
        <h2
          style={{
            fontSize: CANVAS_FONT_SIZE['2xl'],
            fontWeight: 600,
            marginBottom: CANVAS_SPACING.lg,
            color: colors.text,
          }}
        >
          Progress Indicators
        </h2>

        <div style={{ marginBottom: CANVAS_SPACING.xxl }}>
          <h3 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.lg }}>
            Linear Progress Bars
          </h3>
          <ProgressBar
            value={92}
            label="Research Coverage"
            max="12 of 13 dimensions"
            isDarkMode={isDarkMode}
          />
          <ProgressBar
            value={78}
            label="Data Quality Score"
            max="78 of 100"
            isDarkMode={isDarkMode}
          />
          <ProgressBar
            value={45}
            label="Confidence Level"
            max="Medium"
            isDarkMode={isDarkMode}
          />
        </div>

        <div>
          <h3 style={{ fontSize: CANVAS_FONT_SIZE.lg, marginBottom: CANVAS_SPACING.lg }}>
            Circular Progress Rings
          </h3>
          <div style={{ display: 'flex', gap: CANVAS_SPACING.xxl, justifyContent: 'space-around' }}>
            <CircularProgress value={92} label="Research Depth" size={120} isDarkMode={isDarkMode} />
            <CircularProgress value={78} label="Data Quality" size={120} isDarkMode={isDarkMode} />
            <CircularProgress value={45} label="Confidence" size={120} isDarkMode={isDarkMode} />
          </div>
        </div>
      </section>
    </div>
  );
}

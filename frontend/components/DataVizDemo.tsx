// @ts-nocheck
/**
 * DataVizDemo.tsx
 * Comprehensive demo of all DataViz enhancements including:
 * - MetricCard with trends
 * - ComparisonCard for before/after
 * - GaugeIndicator for progress
 * - ProgressBar for tracking
 * - MultiSparkline for quick stats
 */

import React, { useState, useMemo } from 'react';
import {
  MetricCard,
  ComparisonCard,
  GaugeIndicator,
  ProgressBar,
  MultiSparkline,
  ChartBlock,
  Sparkline,
} from './DataViz';

function useDarkMode(): boolean {
  const [dark, setDark] = React.useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function DataVizDemo() {
  const dark = useDarkMode();

  // Generate sample data
  const sparklineData = useMemo(() => [
    { x: 'Mon', y: 120 },
    { x: 'Tue', y: 145 },
    { x: 'Wed', y: 98 },
    { x: 'Thu', y: 167 },
    { x: 'Fri', y: 189 },
    { x: 'Sat', y: 156 },
    { x: 'Sun', y: 201 },
  ], []);

  const chartData = useMemo(() => ({
    type: 'line' as const,
    series: [
      {
        name: 'Clicks',
        data: sparklineData.map(d => ({ x: d.x, y: d.y })),
        color: '#3b82f6',
      },
      {
        name: 'Conversions',
        data: sparklineData.map(d => ({ x: d.x, y: Math.floor(d.y * 0.08) })),
        color: '#22c55e',
      },
    ],
    xAxis: { label: 'Day of Week' },
    yAxis: { label: 'Count' },
  }), [sparklineData]);

  return (
    <div style={{
      background: dark ? '#0f0f13' : '#ffffff',
      color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
      minHeight: '100vh',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}>
            DataViz Components Demo
          </h1>
          <p style={{
            fontSize: 14,
            opacity: 0.6,
            margin: 0,
          }}>
            Comprehensive showcase of interactive data visualization components
          </p>
        </div>

        {/* Section 1: MetricCard */}
        <Section title="1. MetricCard — Metrics with Trends">
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            <MetricCard
              label="Revenue"
              value={45230}
              unit=" USD"
              trend={12.5}
              trendLabel="vs. last month"
              positive={true}
            />
            <MetricCard
              label="Engagement Rate"
              value="47.2"
              unit="%"
              trend={8.3}
              trendLabel="improvement"
              positive={true}
            />
            <MetricCard
              label="Bounce Rate"
              value="32.1"
              unit="%"
              trend={-5.2}
              trendLabel="better"
              positive={true}
            />
            <MetricCard
              label="Cost Per Click"
              value="1.24"
              unit=" USD"
              trend={3.1}
              trendLabel="increase"
              positive={false}
            />
            <MetricCard
              label="Active Users"
              value={8420}
              trend={2.3}
              positive
            />
          </div>
          <CodeBlock>{`<MetricCard
  label="Revenue"
  value={45230}
  unit=" USD"
  trend={12.5}
  trendLabel="vs. last month"
  positive={true}
/>`}</CodeBlock>
        </Section>

        {/* Section 2: ComparisonCard */}
        <Section title="2. ComparisonCard — Before/After Analysis">
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            <ComparisonCard
              label="Monthly Revenue"
              before={45000}
              after={52500}
              unit=" USD"
              beforeLabel="Q1"
              afterLabel="Q2"
            />
            <ComparisonCard
              label="Page Load Time"
              before={4.2}
              after={2.8}
              unit=" s"
              beforeLabel="Before"
              afterLabel="After Optimization"
            />
            <ComparisonCard
              label="Customer Satisfaction"
              before={78}
              after={89}
              unit=" pts"
              beforeLabel="Previous"
              afterLabel="Current"
            />
            <ComparisonCard
              label="Error Rate"
              before={3.5}
              after={1.2}
              unit="%"
              beforeLabel="Before"
              afterLabel="After Fix"
            />
          </div>
          <CodeBlock>{`<ComparisonCard
  label="Monthly Revenue"
  before={45000}
  after={52500}
  unit=" USD"
  beforeLabel="Q1"
  afterLabel="Q2"
/>`}</CodeBlock>
        </Section>

        {/* Section 3: GaugeIndicator */}
        <Section title="3. GaugeIndicator — Circular Progress">
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            <GaugeIndicator
              value={75}
              label="Completion"
              color="#3b82f6"
            />
            <GaugeIndicator
              value={92}
              label="Goal Progress"
              color="#22c55e"
            />
            <GaugeIndicator
              value={45}
              label="Storage Used"
              color="#f59e0b"
            />
            <GaugeIndicator
              value={65}
              label="Team Capacity"
              color="#8b5cf6"
            />
            <GaugeIndicator
              value={88}
              label="Quality Score"
              color="#06b6d4"
            />
          </div>
          <CodeBlock>{`<GaugeIndicator
  value={75}
  label="Completion"
  color="#3b82f6"
/>`}</CodeBlock>
        </Section>

        {/* Section 4: ProgressBar */}
        <Section title="4. ProgressBar — Horizontal Progress">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 400,
            marginBottom: 24,
          }}>
            <div>
              <ProgressBar
                label="Q3 Target"
                value={62}
                color="#3b82f6"
              />
            </div>
            <div>
              <ProgressBar
                label="Annual Goal"
                value={78}
                color="#22c55e"
              />
            </div>
            <div>
              <ProgressBar
                label="Project A"
                value={45}
                color="#f59e0b"
              />
            </div>
            <div>
              <ProgressBar
                label="Infrastructure"
                value={89}
                color="#8b5cf6"
              />
            </div>
          </div>
          <CodeBlock>{`<ProgressBar
  label="Q3 Target"
  value={62}
  color="#3b82f6"
/>`}</CodeBlock>
        </Section>

        {/* Section 5: MultiSparkline */}
        <Section title="5. MultiSparkline — Quick Stats Comparison">
          <div style={{ marginBottom: 24 }}>
            <MultiSparkline
              data={[
                {
                  label: 'Clicks',
                  values: sparklineData,
                  color: '#3b82f6',
                },
                {
                  label: 'Conversions',
                  values: sparklineData.map(d => ({ ...d, y: Math.floor(d.y * 0.08) })),
                  color: '#22c55e',
                },
                {
                  label: 'Revenue',
                  values: sparklineData.map(d => ({ ...d, y: Math.floor(d.y * 1.5) })),
                  color: '#f59e0b',
                },
              ]}
              width={180}
            />
          </div>
          <CodeBlock>{`<MultiSparkline
  data={[
    {
      label: 'Clicks',
      values: [
        { x: 'Mon', y: 120 },
        { x: 'Tue', y: 145 },
        ...
      ],
      color: '#3b82f6',
    },
    ...
  ]}
  width={180}
/>`}</CodeBlock>
        </Section>

        {/* Section 6: Charts */}
        <Section title="6. ChartBlock — Interactive Charts">
          <div style={{ marginBottom: 24 }}>
            <div style={{
              background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 12,
              padding: 20,
              backdropFilter: 'blur(12px)',
            }}>
              <ChartBlock spec={chartData} />
            </div>
          </div>
          <CodeBlock>{`<ChartBlock
  spec={{
    type: 'line',
    series: [
      {
        name: 'Clicks',
        data: [
          { x: 'Mon', y: 120 },
          { x: 'Tue', y: 145 },
          ...
        ],
        color: '#3b82f6',
      },
      ...
    ],
    xAxis: { label: 'Day of Week' },
    yAxis: { label: 'Count' },
  }}
/>`}</CodeBlock>
        </Section>

        {/* Section 7: Sparklines */}
        <Section title="7. Sparkline — Simple Trend Lines">
          <div style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ fontSize: 12, minWidth: 60 }}>
                Clicks:
              </div>
              <Sparkline data={sparklineData} color="#3b82f6" width={140} />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ fontSize: 12, minWidth: 60 }}>
                Revenue:
              </div>
              <Sparkline
                data={sparklineData.map(d => ({ ...d, y: Math.floor(d.y * 1.5) }))}
                color="#22c55e"
                width={140}
              />
            </div>
          </div>
          <CodeBlock>{`<Sparkline
  data={sparklineData}
  color="#3b82f6"
  width={140}
/>`}</CodeBlock>
        </Section>

        {/* Section 8: Combined Dashboard */}
        <Section title="8. Combined Dashboard Example">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            <MetricCard
              label="Total Revenue"
              value={182450}
              unit=" USD"
              trend={15.2}
              positive
            />
            <GaugeIndicator
              value={82}
              label="Target Progress"
              color="#22c55e"
            />
            <ComparisonCard
              label="Growth"
              before={158000}
              after={182450}
              unit=" USD"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <ProgressBar label="Annual Budget" value={68} />
          </div>
          <div style={{
            background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 12,
            padding: 20,
            backdropFilter: 'blur(12px)',
          }}>
            <ChartBlock spec={chartData} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const dark = useDarkMode();
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{
        fontSize: 22,
        fontWeight: 600,
        marginBottom: 24,
        paddingBottom: 12,
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      }}>
        {title}
      </h2>
      <div>{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const dark = useDarkMode();
  return (
    <pre style={{
      background: dark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 11,
      overflow: 'auto',
      fontFamily: "'ABC Diatype Plus', ui-monospace, monospace",
      color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
      margin: 0,
      lineHeight: 1.6,
    }}>
      {children}
    </pre>
  );
}

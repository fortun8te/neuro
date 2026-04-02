import React, { useMemo, useState, useRef } from 'react';
import {
  ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine
} from 'recharts';
import { exportChartToPng } from '../../utils/exportUtils';

export interface LineChartData {
  name: string;
  [key: string]: string | number;
}

export interface LineChartProps {
  data: LineChartData[];
  lines: Array<{
    key: string;
    label: string;
    color: string;
    showTrendline?: boolean;
  }>;
  title?: string;
  xAxisKey?: string;
  yAxisLabel?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  dateRange?: { start: string; end: string };
  predictTrend?: boolean;
  predictionPoints?: number;
}

function calculateTrendline(data: LineChartData[], key: string): LineChartData[] {
  if (data.length < 2) return data;

  const points = data
    .map((d, i) => ({ x: i, y: Number(d[key]) || 0 }))
    .filter(p => !isNaN(p.y));

  if (points.length < 2) return data;

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return data.map((d, i) => ({
    ...d,
    [`${key}_trend`]: slope * i + intercept,
  }));
}

function generateForecast(data: LineChartData[], key: string, points: number = 5): LineChartData[] {
  if (data.length < 2) return data;

  const trendData = calculateTrendline(data, key);
  const lastIndex = data.length - 1;
  const lastTrendValue = Number(trendData[lastIndex][`${key}_trend`]) || 0;

  // Calculate slope from last point
  const slope = lastIndex > 0
    ? (Number(trendData[lastIndex][`${key}_trend`]) || 0) - (Number(trendData[lastIndex - 1][`${key}_trend`]) || 0)
    : 0;

  const forecast = [...trendData];
  for (let i = 1; i <= points; i++) {
    forecast.push({
      name: `Forecast +${i}`,
      [`${key}_trend`]: lastTrendValue + (slope * i),
    });
  }

  return forecast;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  title,
  xAxisKey = 'name',
  yAxisLabel = 'Value',
  height = 300,
  showLegend = true,
  showGrid = true,
  dateRange,
  predictTrend = false,
  predictionPoints = 5,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filter data by date range if provided
  const filteredData = useMemo(() => {
    if (!dateRange || !data) return data;

    return data.filter((d) => {
      const dateName = String(d[xAxisKey]);
      return dateName >= dateRange.start && dateName <= dateRange.end;
    });
  }, [data, dateRange, xAxisKey]);

  // Add trendlines if requested
  const displayData = useMemo(() => {
    let result = [...filteredData];

    if (predictTrend) {
      const withAllTrends = lines
        .filter(l => l.showTrendline)
        .reduce((acc, line) => calculateTrendline(acc, line.key), result);

      result = generateForecast(withAllTrends, lines[0]?.key || '', predictionPoints);
    } else {
      result = lines
        .filter(l => l.showTrendline)
        .reduce((acc, line) => calculateTrendline(acc, line.key), result);
    }

    return result;
  }, [filteredData, lines, predictTrend, predictionPoints]);

  const isDark = () => document.documentElement.classList.contains('dark');

  const handleExport = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      await exportChartToPng(chartRef.current, title || 'linechart');
    } finally {
      setIsExporting(false);
    }
  };

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const dark = isDark();
      return (
        <div style={{
          background: dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: 8,
          padding: 10,
          color: dark ? '#fff' : '#000',
          fontSize: 12,
        }}>
          <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>
            {payload[0].payload[xAxisKey]}
          </p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ margin: 0, color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {title && (
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 12,
          color: isDark() ? '#fff' : '#000',
        }}>
          {title}
        </div>
      )}

      <div ref={chartRef} style={{
        width: '100%',
        height,
        background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        padding: 16,
        boxSizing: 'border-box',
      }}>
        <ResponsiveContainer width="100%" height={height - 32}>
          <RechartsLineChart data={displayData}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 12 }}
              axisLine={{ stroke: isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
            />
            <YAxis
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
              tick={{ fill: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 12 }}
              axisLine={{ stroke: isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
            />
            <Tooltip content={customTooltip} />
            {showLegend && <Legend wrapperStyle={{ color: isDark() ? '#fff' : '#000' }} />}

            {/* Actual data lines */}
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                dot={false}
                strokeWidth={2}
                isAnimationActive={true}
              />
            ))}

            {/* Trendlines */}
            {lines
              .filter(l => l.showTrendline)
              .map((line) => (
                <Line
                  key={`${line.key}_trend`}
                  type="monotone"
                  dataKey={`${line.key}_trend`}
                  name={`${line.label} Trend`}
                  stroke={line.color}
                  strokeDasharray="5 5"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        style={{
          marginTop: 12,
          padding: '8px 16px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: isExporting ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 600,
          opacity: isExporting ? 0.6 : 1,
        }}
      >
        {isExporting ? 'Exporting...' : 'Export as PNG'}
      </button>
    </div>
  );
};

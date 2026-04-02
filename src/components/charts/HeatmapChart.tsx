import React, { useRef, useState } from 'react';
import { exportChartToPng } from '../../utils/exportUtils';

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
  label?: string;
}

export interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  width?: number;
  height?: number;
  minColor?: string;
  maxColor?: string;
  showValues?: boolean;
  onCellClick?: (cell: HeatmapData) => void;
}

function interpolateColor(ratio: number, minColor: string, maxColor: string): string {
  const min = hexToRgb(minColor);
  const max = hexToRgb(maxColor);

  const r = Math.round(min.r + (max.r - min.r) * ratio);
  const g = Math.round(min.g + (max.g - min.g) * ratio);
  const b = Math.round(min.b + (max.b - min.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  title,
  width = 600,
  height = 400,
  minColor = '#e0f2fe',
  maxColor = '#0c4a6e',
  showValues = true,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<HeatmapData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDark = () => document.documentElement.classList.contains('dark');

  // Extract unique x and y values
  const xValues = Array.from(new Set(data.map(d => d.x))).sort();
  const yValues = Array.from(new Set(data.map(d => d.y))).sort();

  // Find min/max values for normalization
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  // Create a map for quick lookup
  const dataMap = new Map(data.map(d => [`${d.x}|${d.y}`, d]));

  const cellWidth = (width - 150) / (xValues.length || 1);
  const cellHeight = (height - 80) / (yValues.length || 1);

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      await exportChartToPng(containerRef.current, title || 'heatmap');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
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

      <div ref={containerRef} style={{
        display: 'inline-block',
        background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        padding: 16,
      }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          {/* Y-axis labels */}
          {yValues.map((y, yIdx) => (
            <text
              key={`y-${y}`}
              x={140}
              y={80 + yIdx * cellHeight + cellHeight / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}
              fontSize="11"
              fontFamily="system-ui"
            >
              {y}
            </text>
          ))}

          {/* X-axis labels */}
          {xValues.map((x, xIdx) => (
            <text
              key={`x-${x}`}
              x={150 + xIdx * cellWidth + cellWidth / 2}
              y={65}
              textAnchor="middle"
              dominantBaseline="hanging"
              fill={isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}
              fontSize="11"
              fontFamily="system-ui"
              transform={`rotate(-45, ${150 + xIdx * cellWidth + cellWidth / 2}, 65)`}
            >
              {x}
            </text>
          ))}

          {/* Heatmap cells */}
          {yValues.map((y, yIdx) =>
            xValues.map((x, xIdx) => {
              const cell = dataMap.get(`${x}|${y}`);
              const normalized = cell ? (cell.value - minValue) / range : 0;
              const color = interpolateColor(normalized, minColor, maxColor);

              const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;

              return (
                <g key={`cell-${x}-${y}`}>
                  <rect
                    x={150 + xIdx * cellWidth}
                    y={80 + yIdx * cellHeight}
                    width={cellWidth}
                    height={cellHeight}
                    fill={color}
                    stroke={isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
                    strokeWidth={1}
                    opacity={isHovered ? 1 : 0.8}
                    style={{ cursor: onCellClick ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHoveredCell(cell || { x, y, value: 0 })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => cell && onCellClick?.(cell)}
                  />
                  {showValues && cell && cellWidth > 40 && cellHeight > 30 && (
                    <text
                      x={150 + xIdx * cellWidth + cellWidth / 2}
                      y={80 + yIdx * cellHeight + cellHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={
                        getBrightness(
                          hexToRgb(color).r,
                          hexToRgb(color).g,
                          hexToRgb(color).b
                        ) > 128
                          ? 'rgba(0,0,0,0.8)'
                          : 'rgba(255,255,255,0.8)'
                      }
                      fontSize="10"
                      fontFamily="system-ui"
                      fontWeight="600"
                    >
                      {cell.value.toFixed(0)}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {/* Tooltip */}
        {hoveredCell && (
          <div style={{
            marginTop: 12,
            padding: 8,
            background: isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: 6,
            fontSize: 12,
            color: isDark() ? '#fff' : '#000',
          }}>
            <strong>{hoveredCell.label || `${hoveredCell.x} × ${hoveredCell.y}`}</strong>: {hoveredCell.value.toFixed(2)}
          </div>
        )}
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

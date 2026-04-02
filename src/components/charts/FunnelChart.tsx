import React, { useRef, useState } from 'react';
import { exportChartToPng } from '../../utils/exportUtils';

export interface FunnelStage {
  label: string;
  value: number;
  color?: string;
  description?: string;
}

export interface FunnelChartProps {
  stages: FunnelStage[];
  title?: string;
  height?: number;
  showPercentage?: boolean;
  showDropoff?: boolean;
  onStageClick?: (stage: FunnelStage, index: number) => void;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  stages,
  title,
  height = 400,
  showPercentage = true,
  showDropoff = true,
  onStageClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDark = () => document.documentElement.classList.contains('dark');

  if (!stages.length) return null;

  const maxValue = Math.max(...stages.map(s => s.value));
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308',
    '#10b981', '#06b6d4', '#6366f1', '#d946ef', '#f43f5e',
  ];

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      await exportChartToPng(containerRef.current, title || 'funnel');
    } finally {
      setIsExporting(false);
    }
  };

  const stageHeight = height / stages.length;
  const maxWidth = 300;

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
        background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height,
      }}>
        {stages.map((stage, idx) => {
          const isHovered = hoveredIdx === idx;
          const percentage = (stage.value / maxValue) * 100;
          const stageWidth = (percentage / 100) * maxWidth;
          const color = stage.color || colors[idx % colors.length];
          const dropoff = idx > 0 ? ((stages[idx - 1].value - stage.value) / stages[idx - 1].value) * 100 : 0;

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                position: 'relative',
              }}
            >
              {/* Funnel trapezoid */}
              <div
                style={{
                  position: 'relative',
                  marginBottom: 8,
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <svg
                  width={maxWidth}
                  height={stageHeight}
                  style={{
                    cursor: onStageClick ? 'pointer' : 'default',
                    opacity: isHovered ? 1 : 0.8,
                    transition: 'opacity 0.2s ease-out',
                  }}
                  onClick={() => onStageClick?.(stage, idx)}
                >
                  {/* Trapezoid shape */}
                  <defs>
                    <linearGradient id={`grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                      <stop offset="100%" stopColor={color} stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  <polygon
                    points={`
                      ${(maxWidth - stageWidth) / 2},0
                      ${(maxWidth + stageWidth) / 2},0
                      ${maxWidth},${stageHeight}
                      0,${stageHeight}
                    `}
                    fill={`url(#grad-${idx})`}
                    stroke={isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
                    strokeWidth="1"
                    style={{
                      filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
                      transition: 'filter 0.2s ease-out',
                    }}
                  />

                  {/* Label on trapezoid */}
                  <text
                    x={maxWidth / 2}
                    y={stageHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="system-ui"
                    style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                  >
                    {stage.label}
                  </text>
                </svg>
              </div>

              {/* Value and metrics */}
              <div style={{
                textAlign: 'center',
                fontSize: 11,
                color: isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              }}>
                <div style={{ fontWeight: 600, color: isDark() ? '#fff' : '#000' }}>
                  {stage.value.toLocaleString()}
                </div>
                {showPercentage && (
                  <div>
                    {percentage.toFixed(1)}% of initial
                  </div>
                )}
                {showDropoff && idx > 0 && (
                  <div style={{ color: '#ef4444' }}>
                    {dropoff.toFixed(1)}% dropoff
                  </div>
                )}
              </div>

              {/* Tooltip */}
              {isHovered && stage.description && (
                <div style={{
                  position: 'absolute',
                  bottom: -50,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: isDark() ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
                  border: `1px solid ${isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 11,
                  color: isDark() ? '#fff' : '#000',
                  maxWidth: 150,
                  zIndex: 10,
                  wordBreak: 'break-word',
                  boxShadow: isDark()
                    ? '0 4px 12px rgba(0,0,0,0.5)'
                    : '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                  {stage.description}
                </div>
              )}
            </div>
          );
        })}
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

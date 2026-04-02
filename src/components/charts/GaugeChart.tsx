import React, { useRef, useState } from 'react';
import { exportChartToPng } from '../../utils/exportUtils';

export interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  title?: string;
  label?: string;
  size?: number;
  zones?: Array<{
    from: number;
    to: number;
    color: string;
    label: string;
  }>;
  animated?: boolean;
  showPercentage?: boolean;
}

const DEFAULT_ZONES = [
  { from: 0, to: 33, color: '#ef4444', label: 'Critical' },
  { from: 33, to: 66, color: '#f59e0b', label: 'Warning' },
  { from: 66, to: 100, color: '#10b981', label: 'Good' },
];

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  title,
  label,
  size = 200,
  zones = DEFAULT_ZONES,
  animated = true,
  showPercentage = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const isDark = () => document.documentElement.classList.contains('dark');

  // Normalize value to 0-100 scale
  const normalizedValue = ((value - min) / (max - min)) * 100;
  const clampedValue = Math.max(0, Math.min(100, normalizedValue));

  // Find the current zone
  const currentZone = zones.find(z => clampedValue >= z.from && clampedValue <= z.to);

  // Convert percentage to angle (0-180 degrees)
  const angle = (clampedValue / 100) * 180;

  const radius = size / 2 - 20;
  const cx = size / 2;
  const cy = size / 2;

  // Calculate needle position
  const needleAngle = angle - 90; // Adjust for SVG coordinate system
  const needleLength = radius - 10;
  const needleX = cx + needleLength * Math.cos((needleAngle * Math.PI) / 180);
  const needleY = cy + needleLength * Math.sin((needleAngle * Math.PI) / 180);

  // Create arc path
  const arcRadius = radius - 15;
  const startAngle = -90;
  const endAngle = 90;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + arcRadius * Math.cos(rad),
      y: cy + arcRadius * Math.sin(rad),
    };
  };

  const startPoint = polarToCartesian(startAngle);
  const endPoint = polarToCartesian(endAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  const arcPath = `M ${startPoint.x} ${startPoint.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      await exportChartToPng(containerRef.current, title || 'gauge');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
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
        <svg width={size} height={size * 0.7} style={{ overflow: 'visible' }}>
          {/* Background zones */}
          {zones.map((zone, idx) => {
            const zoneStartAngle = (zone.from / 100) * 180 - 90;
            const zoneEndAngle = (zone.to / 100) * 180 - 90;

            const startPt = polarToCartesian(zoneStartAngle);
            const endPt = polarToCartesian(zoneEndAngle);
            const largeArcZone = zone.to - zone.from > 50 ? 1 : 0;

            const zonePath = `M ${startPt.x} ${startPt.y} A ${arcRadius} ${arcRadius} 0 ${largeArcZone} 1 ${endPt.x} ${endPt.y}`;

            return (
              <path
                key={`zone-${idx}`}
                d={zonePath}
                stroke={zone.color}
                strokeWidth={12}
                fill="none"
                opacity={0.3}
              />
            );
          })}

          {/* Main arc */}
          <path
            d={arcPath}
            stroke={isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
            strokeWidth={2}
            fill="none"
          />

          {/* Value arc */}
          {clampedValue > 0 && (
            <path
              d={`M ${startPoint.x} ${startPoint.y} A ${arcRadius} ${arcRadius} 0 ${clampedValue > 50 ? 1 : 0} 1 ${polarToCartesian(-90 + angle).x} ${polarToCartesian(-90 + angle).y}`}
              stroke={currentZone?.color || '#3b82f6'}
              strokeWidth={8}
              fill="none"
              style={{
                transition: animated ? 'stroke-dashoffset 0.3s ease-out' : 'none',
              }}
            />
          )}

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke={currentZone?.color || '#3b82f6'}
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              transition: animated ? 'all 0.5s ease-out' : 'none',
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />

          {/* Needle center circle */}
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill={currentZone?.color || '#3b82f6'}
          />

          {/* Tick marks and labels */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const tickAngle = (tick / 100) * 180 - 90;
            const outerRadius = arcRadius + 8;
            const innerRadius = arcRadius + 4;

            const outerPt = {
              x: cx + outerRadius * Math.cos((tickAngle * Math.PI) / 180),
              y: cy + outerRadius * Math.sin((tickAngle * Math.PI) / 180),
            };

            const innerPt = {
              x: cx + innerRadius * Math.cos((tickAngle * Math.PI) / 180),
              y: cy + innerRadius * Math.sin((tickAngle * Math.PI) / 180),
            };

            const labelRadius = arcRadius + 20;
            const labelPt = {
              x: cx + labelRadius * Math.cos((tickAngle * Math.PI) / 180),
              y: cy + labelRadius * Math.sin((tickAngle * Math.PI) / 180),
            };

            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={outerPt.x}
                  y1={outerPt.y}
                  x2={innerPt.x}
                  y2={innerPt.y}
                  stroke={isDark() ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  strokeWidth={1.5}
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
                  fontSize="10"
                  fontFamily="system-ui"
                >
                  {tick}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Value display */}
        <div style={{ marginTop: 16 }}>
          {showPercentage && (
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: currentZone?.color || '#3b82f6',
            }}>
              {clampedValue.toFixed(1)}%
            </div>
          )}
          {label && (
            <div style={{
              fontSize: 14,
              color: isDark() ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
              marginTop: 4,
            }}>
              {label}
            </div>
          )}
          {currentZone && (
            <div style={{
              fontSize: 12,
              color: currentZone.color,
              marginTop: 4,
              fontWeight: 600,
            }}>
              {currentZone.label}
            </div>
          )}
        </div>
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

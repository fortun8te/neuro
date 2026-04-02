import React, { useRef, useState } from 'react';
import { exportChartToPng } from '../../utils/exportUtils';

export interface TimelinePhase {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  description?: string;
  color?: string;
}

export interface TimelineChartProps {
  phases: TimelinePhase[];
  title?: string;
  height?: number;
  onPhaseClick?: (phase: TimelinePhase) => void;
}

const STATUS_COLORS = {
  pending: '#9ca3af',
  'in-progress': '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
};

export const TimelineChart: React.FC<TimelineChartProps> = ({
  phases,
  title,
  height = 300,
  onPhaseClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDark = () => document.documentElement.classList.contains('dark');

  if (!phases.length) return null;

  // Parse dates and find min/max
  const dates = phases.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  const timelineSpan = maxDate.getTime() - minDate.getTime();

  const getPosition = (date: string): number => {
    const d = new Date(date).getTime();
    return ((d - minDate.getTime()) / timelineSpan) * 80 + 10; // 10-90% of width
  };

  const getWidth = (start: string, end: string): number => {
    const startPos = getPosition(start);
    const endPos = getPosition(end);
    return Math.max(endPos - startPos, 2); // Minimum 2% width
  };

  const handleExport = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      await exportChartToPng(containerRef.current, title || 'timeline');
    } finally {
      setIsExporting(false);
    }
  };

  const dateFormat = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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
        background: isDark() ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        padding: 24,
      }}>
        <div style={{ position: 'relative', minHeight: height }}>
          {/* Timeline axis */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 2,
            background: isDark() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            borderRadius: 1,
          }} />

          {/* Date markers */}
          <div style={{
            position: 'absolute',
            top: 12,
            left: 0,
            right: 0,
            height: 20,
            display: 'flex',
            justifyContent: 'space-between',
            paddingLeft: '10%',
            paddingRight: '10%',
            fontSize: 11,
            color: isDark() ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          }}>
            <span>{dateFormat(minDate.toISOString())}</span>
            <span>{dateFormat(maxDate.toISOString())}</span>
          </div>

          {/* Phases */}
          <div style={{ marginTop: 60 }}>
            {phases.map((phase, idx) => {
              const isHovered = hoveredPhase === phase.id;
              const statusColor = phase.color || STATUS_COLORS[phase.status];
              const startPos = getPosition(phase.startDate);
              const phaseWidth = getWidth(phase.startDate, phase.endDate);

              return (
                <div key={phase.id} style={{ marginBottom: 24, position: 'relative' }}>
                  {/* Phase label */}
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: isDark() ? '#fff' : '#000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>{phase.label}</span>
                    <span style={{
                      fontSize: 11,
                      color: isDark() ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    }}>
                      {phase.progress}%
                    </span>
                  </div>

                  {/* Phase bar background */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: 28,
                    background: isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}>
                    {/* Phase bar progress fill */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: `${phase.progress}%`,
                        height: '100%',
                        background: statusColor,
                        opacity: 0.2,
                        borderRadius: 6,
                        transition: 'width 0.3s ease-out',
                      }}
                    />

                    {/* Phase bar - positioned absolutely on timeline */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${startPos}%`,
                        width: `${phaseWidth}%`,
                        height: '100%',
                        background: statusColor,
                        borderRadius: 6,
                        border: isHovered ? `2px solid ${statusColor}` : 'none',
                        cursor: onPhaseClick ? 'pointer' : 'default',
                        opacity: isHovered ? 1 : 0.7,
                        transition: 'all 0.2s ease-out',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={() => setHoveredPhase(phase.id)}
                      onMouseLeave={() => setHoveredPhase(null)}
                      onClick={() => onPhaseClick?.(phase)}
                    >
                      {phaseWidth > 15 && (
                        <div style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {dateFormat(phase.startDate)} — {dateFormat(phase.endDate)}
                        </div>
                      )}
                    </div>

                    {/* Status icon */}
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 16,
                    }}>
                      {phase.status === 'completed' && '✓'}
                      {phase.status === 'in-progress' && '●'}
                      {phase.status === 'failed' && '✕'}
                      {phase.status === 'pending' && '○'}
                    </div>
                  </div>

                  {/* Tooltip on hover */}
                  {isHovered && phase.description && (
                    <div style={{
                      position: 'absolute',
                      top: -60,
                      left: `${startPos}%`,
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
                      {phase.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

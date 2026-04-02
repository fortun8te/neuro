import React from 'react';

interface Props {
  utilization: number; // 0-1
}

export function ContextPressureIndicator({ utilization }: Props) {
  const percent = Math.round(utilization * 100);

  const getColor = () => {
    if (utilization < 0.50) return 'bg-green-600';
    if (utilization < 0.70) return 'bg-yellow-600';
    if (utilization < 0.85) return 'bg-orange-600';
    return 'bg-red-600';
  };

  const getText = () => {
    if (utilization < 0.50) return 'Healthy';
    if (utilization < 0.70) return 'Caution';
    if (utilization < 0.85) return 'Warning';
    return 'Critical';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-mono">{percent}% {getText()}</span>
    </div>
  );
}

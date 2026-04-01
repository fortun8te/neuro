import React from 'react'
import type { PerformanceChartData } from '../types'

export function PerformanceChart({ data }: { data: PerformanceChartData }) {
  // Find min/max for scaling
  const allValues = data.series.flatMap(s => s.data)
  const maxVal = Math.max(...allValues, 1)
  const chartH = 160
  const chartW = 400
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }
  const innerW = chartW - padding.left - padding.right
  const innerH = chartH - padding.top - padding.bottom

  const defaultColors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa']

  return (
    <div style={{
      borderRadius: 16, padding: '20px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 16 }}>{data.title}</div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding.top + innerH * (1 - pct)
          return (
            <g key={i}>
              <line x1={padding.left} x2={chartW - padding.right} y1={y} y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={padding.left - 6} y={y + 3} textAnchor="end"
                fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily="ABC Diatype Plus">
                {Math.round(maxVal * pct)}
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {data.xAxis.map((label, i) => {
          const x = padding.left + (innerW / (data.xAxis.length - 1 || 1)) * i
          return (
            <text key={i} x={x} y={chartH - 6} textAnchor="middle"
              fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily="ABC Diatype Plus">
              {label}
            </text>
          )
        })}

        {/* Series */}
        {data.series.map((series, si) => {
          const color = series.color || defaultColors[si % defaultColors.length]
          const points = series.data.map((val, i) => {
            const x = padding.left + (innerW / (series.data.length - 1 || 1)) * i
            const y = padding.top + innerH * (1 - val / maxVal)
            return `${x},${y}`
          })

          if (data.subtype === 'area') {
            const firstX = padding.left
            const lastX = padding.left + innerW
            const bottomY = padding.top + innerH
            return (
              <g key={si}>
                <polygon
                  points={`${firstX},${bottomY} ${points.join(' ')} ${lastX},${bottomY}`}
                  fill={color} fillOpacity={0.08}
                />
                <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )
          }

          if (data.subtype === 'bar') {
            const barW = innerW / series.data.length * 0.6
            return (
              <g key={si}>
                {series.data.map((val, i) => {
                  const x = padding.left + (innerW / series.data.length) * i + (innerW / series.data.length * 0.2)
                  const h = innerH * (val / maxVal)
                  const y = padding.top + innerH - h
                  return (
                    <rect key={i} x={x} y={y} width={barW} height={h}
                      rx={3} fill={color} fillOpacity={0.6} />
                  )
                })}
              </g>
            )
          }

          // Default: line
          return (
            <g key={si}>
              <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {series.data.map((val, i) => {
                const x = padding.left + (innerW / (series.data.length - 1 || 1)) * i
                const y = padding.top + innerH * (1 - val / maxVal)
                return <circle key={i} cx={x} cy={y} r={3} fill={color} />
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      {data.series.length > 1 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
          {data.series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || defaultColors[i % defaultColors.length] }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import React from 'react'
import type { StatGridData } from '../types'

export function StatGrid({ data }: { data: StatGridData }) {
  const cols = data.columns || Math.min(data.stats.length, 4)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10,
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.stats.map((stat, i) => (
        <div key={i} style={{
          borderRadius: 14, padding: '18px 20px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500 }}>{stat.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>{stat.value}</div>
          {stat.change !== undefined && (
            <div style={{
              marginTop: 6, fontSize: 11, fontWeight: 600,
              color: stat.change > 0 ? '#34d399' : stat.change < 0 ? '#f87171' : 'rgba(255,255,255,0.35)',
            }}>
              {stat.change > 0 ? '+' : ''}{stat.change}%
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

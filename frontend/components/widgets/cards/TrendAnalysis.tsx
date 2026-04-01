import React from 'react'
import type { TrendAnalysisData } from '../types'

const dirStyles: Record<string, { icon: string; color: string; bg: string }> = {
  up:     { icon: '\u2191', color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
  down:   { icon: '\u2193', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
  stable: { icon: '\u2192', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
}

export function TrendAnalysis({ data }: { data: TrendAnalysisData }) {
  const d = dirStyles[data.direction] || dirStyles.stable
  const fmt = (n?: number) => !n ? '' : n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n)
  return (
    <div style={{
      borderRadius: 14, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{data.topic}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{data.timeframe}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8, background: d.bg,
        }}>
          <span style={{ fontSize: 16, color: d.color }}>{d.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>
            {data.direction === 'up' ? 'Trending' : data.direction === 'down' ? 'Declining' : 'Stable'}
          </span>
        </div>
      </div>
      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 16 }}>
        {data.volume !== undefined && (
          <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Volume</div><div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{fmt(data.volume)}</div></div>
        )}
        {data.engagement !== undefined && (
          <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Engagement</div><div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{fmt(data.engagement)}</div></div>
        )}
      </div>
      {/* Related */}
      {data.relatedTrends && data.relatedTrends.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Related</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {data.relatedTrends.map((t, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

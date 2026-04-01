import React from 'react'
import type { ResearchFindingData } from '../types'

const confidenceStyles: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: '#34d399', bg: 'rgba(16,185,129,0.12)', label: 'High confidence' },
  medium: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', label: 'Medium confidence' },
  low:    { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  label: 'Low confidence' },
}

export function ResearchFinding({ data }: { data: ResearchFindingData }) {
  const conf = confidenceStyles[data.confidence || 'medium'] || confidenceStyles.medium

  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex' }}>
        <div style={{ width: 3, background: conf.color, opacity: 0.6, flexShrink: 0 }} />
        <div style={{ padding: '18px 22px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.4 }}>
              {data.title}
            </h4>
            {data.confidence && (
              <span style={{
                padding: '3px 8px', borderRadius: 6,
                background: conf.bg, color: conf.color,
                fontSize: 10, fontWeight: 600, letterSpacing: '0.03em',
                textTransform: 'uppercase', flexShrink: 0, marginLeft: 12,
              }}>
                {conf.label}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>
            {data.insight}
          </p>
          {data.details && data.details.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {data.details.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5,
                  marginTop: i > 0 ? 6 : 0,
                }}>
                  <span style={{ color: conf.color, flexShrink: 0, marginTop: 2 }}>-</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          )}
          {data.tags && data.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {data.tags.map((tag, i) => (
                <span key={i} style={{
                  padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>
          )}
          {data.source && (
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: 'rgba(255,255,255,0.3)',
              }}>S</div>
              <a href={data.source.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
                {data.source.title || data.source.url}
                {data.source.date && <span style={{ marginLeft: 6, opacity: 0.6 }}>{data.source.date}</span>}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

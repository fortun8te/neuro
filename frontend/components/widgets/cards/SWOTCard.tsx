import React from 'react'
import type { SWOTCardData } from '../types'

const quadrants = [
  { key: 'strengths',     label: 'Strengths',     color: '#34d399', bg: 'rgba(16,185,129,0.06)' },
  { key: 'weaknesses',    label: 'Weaknesses',    color: '#f87171', bg: 'rgba(239,68,68,0.06)' },
  { key: 'opportunities', label: 'Opportunities', color: '#60a5fa', bg: 'rgba(59,130,246,0.06)' },
  { key: 'threats',       label: 'Threats',        color: '#fbbf24', bg: 'rgba(245,158,11,0.06)' },
]

export function SWOTCard({ data }: { data: SWOTCardData }) {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.title && (
        <div style={{ padding: '16px 22px 0', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.title}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, padding: 16 }}>
        {quadrants.map(q => {
          const items = (data as any)[q.key] as string[] || []
          return (
            <div key={q.key} style={{ background: q.bg, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: q.color, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                {q.label}
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginTop: i > 0 ? 5 : 0, display: 'flex', gap: 6 }}>
                  <span style={{ color: q.color, flexShrink: 0 }}>-</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

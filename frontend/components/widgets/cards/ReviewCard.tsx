import React from 'react'
import type { ReviewCardData } from '../types'

export function ReviewCard({ data }: { data: ReviewCardData }) {
  return (
    <div style={{
      borderRadius: 14, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600,
          }}>{data.author[0]?.toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{data.author}</div>
            {data.date && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{data.date}</div>}
          </div>
        </div>
        {data.platform && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: 5 }}>{data.platform}</span>
        )}
      </div>
      {/* Stars */}
      <div style={{ marginBottom: 10, letterSpacing: 2 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ color: i <= data.rating ? '#fbbf24' : 'rgba(255,255,255,0.1)', fontSize: 14 }}>
            {'\u2605'}
          </span>
        ))}
      </div>
      {data.title && <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>{data.title}</div>}
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>{data.text}</p>
    </div>
  )
}

import React from 'react'
import type { TwitterPreviewData } from '../types'

export function TwitterPreview({ data }: { data: TwitterPreviewData }) {
  const fmt = (n?: number) => !n ? '0' : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n)
  return (
    <div style={{
      borderRadius: 16, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(29,155,240,0.3), rgba(29,155,240,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1d9bf0', fontSize: 14, fontWeight: 700,
        }}>
          {data.author[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.author}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>@{data.handle}</div>
        </div>
        {/* X logo */}
        <div style={{ marginLeft: 'auto', fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>X</div>
      </div>
      {/* Tweet text */}
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, margin: '0 0 14px' }}>{data.text}</p>
      {data.image && (
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={data.image} alt="" style={{ width: '100%', display: 'block' }} />
        </div>
      )}
      {/* Engagement */}
      <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
        {[
          { label: 'Replies', val: data.replies },
          { label: 'Reposts', val: data.retweets },
          { label: 'Likes', val: data.likes },
        ].map((m, i) => (
          <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginRight: 4 }}>{fmt(m.val)}</span>
            {m.label}
          </div>
        ))}
      </div>
    </div>
  )
}

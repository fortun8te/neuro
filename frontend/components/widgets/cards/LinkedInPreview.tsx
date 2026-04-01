import React from 'react'
import type { LinkedInPreviewData } from '../types'

export function LinkedInPreview({ data }: { data: LinkedInPreviewData }) {
  const fmt = (n?: number) => !n ? '0' : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n)
  return (
    <div style={{
      borderRadius: 16, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(10,102,194,0.3), rgba(10,102,194,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a66c2', fontSize: 16, fontWeight: 700,
        }}>{data.author[0]?.toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.author}</div>
          {data.title && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{data.title}</div>}
        </div>
        <div style={{ marginLeft: 'auto', color: '#0a66c2', fontWeight: 700, fontSize: 14 }}>in</div>
      </div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{data.content}</p>
      {data.image && (
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
          <img src={data.image} alt="" style={{ width: '100%', display: 'block' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
        {[
          { label: 'Likes', val: data.likes },
          { label: 'Comments', val: data.comments },
          { label: 'Shares', val: data.shares },
        ].map((m, i) => (
          <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginRight: 4 }}>{fmt(m.val)}</span>{m.label}
          </div>
        ))}
      </div>
    </div>
  )
}

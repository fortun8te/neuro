import React from 'react'
import type { CalloutCardData } from '../types'

const variants: Record<string, { accent: string; bg: string; icon: string }> = {
  info:    { accent: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  icon: 'i' },
  success: { accent: '#34d399', bg: 'rgba(16,185,129,0.08)',  icon: '\u2713' },
  warning: { accent: '#fbbf24', bg: 'rgba(245,158,11,0.08)',  icon: '!' },
  error:   { accent: '#f87171', bg: 'rgba(239,68,68,0.08)',   icon: '\u2717' },
}

export function CalloutCard({ data }: { data: CalloutCardData }) {
  const v = variants[data.variant || 'info'] || variants.info
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', display: 'flex',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ width: 3, background: v.accent, opacity: 0.6, flexShrink: 0 }} />
      <div style={{ padding: '16px 20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: v.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: v.accent, fontSize: 11, fontWeight: 700,
          }}>{v.icon}</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.title}</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>{data.message}</p>
      </div>
    </div>
  )
}

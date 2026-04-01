import React from 'react'
import type { EmailTemplateData } from '../types'

export function EmailTemplate({ data }: { data: EmailTemplateData }) {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {/* Email header bar */}
      <div style={{ padding: '12px 22px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Subject</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{data.subject}</div>
        {data.preheader && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{data.preheader}</div>}
      </div>
      {/* Body */}
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.body}</div>
        {data.cta && (
          <div style={{
            marginTop: 18, display: 'inline-block',
            padding: '10px 24px', borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white', fontSize: 13, fontWeight: 600, textAlign: 'center',
          }}>{data.cta.text}</div>
        )}
      </div>
      {/* Footer */}
      {data.footer && (
        <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
          {data.footer}
        </div>
      )}
    </div>
  )
}

import React from 'react'
import type { TimelineData } from '../types'

export function Timeline({ data }: { data: TimelineData }) {
  return (
    <div style={{
      borderRadius: 14, padding: '20px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.events.map((ev, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
          {/* Line + dot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i === 0 ? '#60a5fa' : 'rgba(255,255,255,0.12)',
              border: `2px solid ${i === 0 ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
              zIndex: 1,
            }} />
            {i < data.events.length - 1 && (
              <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', minHeight: 30 }} />
            )}
          </div>
          {/* Content */}
          <div style={{ paddingBottom: i < data.events.length - 1 ? 20 : 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500, marginBottom: 4, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              {ev.date}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>{ev.title}</div>
            {ev.description && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{ev.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

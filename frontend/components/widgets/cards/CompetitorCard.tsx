import React from 'react'
import type { CompetitorCardData } from '../types'

const statusStyles: Record<string, { border: string; badge: string; badgeText: string; glow: string }> = {
  leader: {
    border: 'rgba(96, 165, 250, 0.25)',
    badge: 'rgba(59, 130, 246, 0.15)',
    badgeText: '#60a5fa',
    glow: '0 0 40px rgba(59, 130, 246, 0.08)',
  },
  challenger: {
    border: 'rgba(251, 191, 36, 0.25)',
    badge: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#fbbf24',
    glow: '0 0 40px rgba(245, 158, 11, 0.08)',
  },
  emerging: {
    border: 'rgba(52, 211, 153, 0.25)',
    badge: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#34d399',
    glow: '0 0 40px rgba(16, 185, 129, 0.08)',
  },
}

export function CompetitorCard({ data }: { data: CompetitorCardData }) {
  const status = data.status || 'emerging'
  const s = statusStyles[status] || statusStyles.emerging

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${s.border}`,
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      backdropFilter: 'blur(20px)',
      boxShadow: s.glow,
      overflow: 'hidden',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {/* Top accent line */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${s.badgeText}, transparent)`,
        opacity: 0.5,
      }} />

      <div style={{ padding: '20px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              {data.logo && (
                <img src={data.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
              )}
              <span style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em' }}>
                {data.name}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0 }}>
              {data.positioning}
            </p>
          </div>
          <div style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: s.badge,
            color: s.badgeText,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}>
            {status}
          </div>
        </div>

        {/* Metrics */}
        {data.metrics && data.metrics.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(data.metrics.length, 3)}, 1fr)`,
            gap: 10,
          }}>
            {data.metrics.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{m.value}</div>
                {m.change !== undefined && (
                  <div style={{
                    fontSize: 11,
                    fontWeight: 500,
                    marginTop: 4,
                    color: m.change > 0 ? '#34d399' : m.change < 0 ? '#f87171' : 'rgba(255,255,255,0.35)',
                  }}>
                    {m.change > 0 ? '+' : ''}{m.change}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

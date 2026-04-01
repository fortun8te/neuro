import React from 'react'
import type { HeroCardData } from '../types'

const gradients: Record<string, string> = {
  blue:   'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(14,165,233,0.08))',
  orange: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(245,158,11,0.08))',
  green:  'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.08))',
  purple: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.08))',
  pink:   'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(244,114,182,0.08))',
}

export function HeroCard({ data }: { data: HeroCardData }) {
  const bg = gradients[data.gradient || 'blue'] || gradients.blue
  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ background: bg, padding: '32px 28px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          {data.title}
        </h2>
        {data.subtitle && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6, margin: '6px 0 0' }}>{data.subtitle}</p>
        )}
        {data.description && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginTop: 14, margin: '14px 0 0' }}>{data.description}</p>
        )}
        {data.cta && (
          <div style={{
            display: 'inline-block', marginTop: 18,
            padding: '8px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {data.cta.label}
          </div>
        )}
      </div>
    </div>
  )
}

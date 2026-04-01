import React from 'react'
import type { MetricsCardData } from '../types'

const palettes: Record<string, { accent: string; bg: string; glow: string }> = {
  blue:   { accent: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  glow: '0 0 40px rgba(59,130,246,0.06)' },
  green:  { accent: '#34d399', bg: 'rgba(16,185,129,0.08)',  glow: '0 0 40px rgba(16,185,129,0.06)' },
  orange: { accent: '#fb923c', bg: 'rgba(249,115,22,0.08)',  glow: '0 0 40px rgba(249,115,22,0.06)' },
  red:    { accent: '#f87171', bg: 'rgba(239,68,68,0.08)',   glow: '0 0 40px rgba(239,68,68,0.06)' },
  purple: { accent: '#a78bfa', bg: 'rgba(139,92,246,0.08)',  glow: '0 0 40px rgba(139,92,246,0.06)' },
}

export function MetricsCard({ data }: { data: MetricsCardData }) {
  const p = palettes[data.color || 'blue'] || palettes.blue
  const isUp = data.change?.direction === 'up'
  const isDown = data.change?.direction === 'down'

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid rgba(255,255,255,0.06)`,
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      backdropFilter: 'blur(20px)',
      boxShadow: p.glow,
      padding: '20px 24px',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent dot */}
      <div style={{
        position: 'absolute', top: 20, right: 24,
        width: 8, height: 8, borderRadius: '50%',
        background: p.accent,
        boxShadow: `0 0 12px ${p.accent}`,
        opacity: 0.7,
      }} />

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginBottom: 10, letterSpacing: '0.02em' }}>
        {data.label}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}>
          {data.value}
        </span>
        {data.unit && (
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{data.unit}</span>
        )}
      </div>

      {data.change && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 6,
            background: isUp ? 'rgba(16,185,129,0.12)' : isDown ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
            color: isUp ? '#34d399' : isDown ? '#f87171' : 'rgba(255,255,255,0.5)',
            fontSize: 12, fontWeight: 600,
          }}>
            {isUp ? '↑' : isDown ? '↓' : '→'} {Math.abs(data.change.percentage)}%
          </span>
          {data.context && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{data.context}</span>
          )}
        </div>
      )}

      {!data.change && data.context && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>{data.context}</div>
      )}
    </div>
  )
}

import React from 'react'
import type { AdCreativePreviewData } from '../types'

const platformColors: Record<string, { color: string; bg: string; label: string }> = {
  facebook:  { color: '#1877f2', bg: 'rgba(24,119,242,0.12)', label: 'Facebook' },
  google:    { color: '#4285f4', bg: 'rgba(66,133,244,0.12)', label: 'Google' },
  linkedin:  { color: '#0a66c2', bg: 'rgba(10,102,194,0.12)', label: 'LinkedIn' },
  instagram: { color: '#e4405f', bg: 'rgba(228,64,95,0.12)',  label: 'Instagram' },
  tiktok:    { color: '#ff0050', bg: 'rgba(255,0,80,0.12)',   label: 'TikTok' },
}

export function AdCreativePreview({ data }: { data: AdCreativePreviewData }) {
  const plat = platformColors[data.platform] || platformColors.facebook
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {/* Platform badge */}
      <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ padding: '3px 10px', borderRadius: 6, background: plat.bg, color: plat.color, fontSize: 11, fontWeight: 600 }}>
          {plat.label}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Ad Preview</span>
      </div>
      {/* Image */}
      {data.image && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <img src={data.image} alt="" style={{ width: '100%', display: 'block', maxHeight: 250, objectFit: 'cover' }} />
        </div>
      )}
      {/* Copy */}
      <div style={{ padding: '16px 22px' }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '0 0 6px', lineHeight: 1.35 }}>{data.headline}</h4>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, margin: 0 }}>{data.description}</p>
        {data.cta && (
          <div style={{
            marginTop: 14, display: 'inline-block',
            padding: '8px 20px', borderRadius: 8,
            background: plat.bg, border: `1px solid ${plat.color}33`,
            color: plat.color, fontSize: 12, fontWeight: 600,
          }}>{data.cta}</div>
        )}
      </div>
    </div>
  )
}

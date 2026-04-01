import React from 'react'
import type { AudienceCardData } from '../types'

export function AudienceCard({ data }: { data: AudienceCardData }) {
  return (
    <div style={{
      borderRadius: 16, padding: '20px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.title || 'Audience'}</span>
        {data.size && (
          <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(139,92,246,0.12)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
            {data.size >= 1000000 ? `${(data.size/1000000).toFixed(1)}M` : data.size >= 1000 ? `${(data.size/1000).toFixed(0)}K` : data.size} reach
          </span>
        )}
      </div>
      {/* Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {data.demographics.ageRange && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Age</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{data.demographics.ageRange}</div>
          </div>
        )}
        {data.demographics.gender && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Gender</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{data.demographics.gender}</div>
          </div>
        )}
        {data.demographics.income && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Income</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{data.demographics.income}</div>
          </div>
        )}
        {data.demographics.location && data.demographics.location.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Location</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{data.demographics.location.join(', ')}</div>
          </div>
        )}
      </div>
      {/* Interests */}
      {data.interests && data.interests.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Interests</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {data.interests.map((int, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', color: '#60a5fa', fontSize: 11, fontWeight: 500 }}>{int}</span>
            ))}
          </div>
        </div>
      )}
      {/* Behaviors */}
      {data.behaviors && data.behaviors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Behaviors</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {data.behaviors.map((b, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.08)', color: '#a78bfa', fontSize: 11, fontWeight: 500 }}>{b}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

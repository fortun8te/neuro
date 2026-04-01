import React from 'react'
import type { CopyVariationData } from '../types'

export function CopyVariation({ data }: { data: CopyVariationData }) {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.title && (
        <div style={{ padding: '16px 22px 0', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.title}</div>
      )}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.variations.map((v, i) => {
          const isWinner = data.winner === v.id
          return (
            <div key={v.id} style={{
              padding: '14px 16px', borderRadius: 12,
              background: isWinner ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isWinner ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
                  Variation {String.fromCharCode(65 + i)}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {v.estimatedCTR !== undefined && (
                    <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                      ~{v.estimatedCTR}% CTR
                    </span>
                  )}
                  {isWinner && (
                    <span style={{ fontSize: 10, color: '#34d399', background: 'rgba(16,185,129,0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Winner
                    </span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, margin: 0 }}>{v.text}</p>
              {v.wordCount && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{v.wordCount} words</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

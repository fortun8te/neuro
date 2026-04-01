import React from 'react'
import type { PricingComparisonData } from '../types'

export function PricingComparison({ data }: { data: PricingComparisonData }) {
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
      <div style={{ display: 'flex', gap: 1, padding: 16, overflowX: 'auto' }}>
        {data.competitors.map((comp, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 160 }}>
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 12 }}>{comp.name}</div>
              {comp.tiers.map((tier, ti) => (
                <div key={ti} style={{
                  padding: '10px 0', borderTop: ti > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{tier.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                      {typeof tier.price === 'number' ? `$${tier.price}` : tier.price}
                    </span>
                  </div>
                  {tier.features.map((f, fi) => (
                    <div key={fi} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3, paddingLeft: 10 }}>
                      {f}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

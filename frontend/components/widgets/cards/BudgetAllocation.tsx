import React from 'react'
import type { BudgetAllocationData } from '../types'

const channelColors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#e879f9', '#2dd4bf']

export function BudgetAllocation({ data }: { data: BudgetAllocationData }) {
  const sorted = [...data.channels].sort((a, b) => b.amount - a.amount)
  const maxAmount = sorted[0]?.amount || 1
  return (
    <div style={{
      borderRadius: 16, padding: '20px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>Budget Allocation</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
          ${data.total >= 1000 ? `${(data.total/1000).toFixed(0)}K` : data.total}
        </span>
      </div>
      {sorted.map((ch, i) => {
        const pct = ((ch.amount / data.total) * 100).toFixed(0)
        const color = channelColors[i % channelColors.length]
        return (
          <div key={i} style={{ marginBottom: i < sorted.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{ch.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  ${ch.amount >= 1000 ? `${(ch.amount/1000).toFixed(1)}K` : ch.amount}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
            {/* Bar */}
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ height: '100%', borderRadius: 2, background: color, width: `${(ch.amount / maxAmount) * 100}%`, opacity: 0.7, transition: 'width 0.5s' }} />
            </div>
            {ch.roi !== undefined && (
              <div style={{ fontSize: 10, color: ch.roi > 0 ? '#34d399' : '#f87171', marginTop: 3 }}>
                ROI: {ch.roi > 0 ? '+' : ''}{ch.roi}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

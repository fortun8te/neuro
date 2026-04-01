import React, { useState } from 'react'
import type { ChecklistData } from '../types'

export function Checklist({ data }: { data: ChecklistData }) {
  const [items, setItems] = useState(data.items)
  const completed = items.filter(i => i.completed).length

  const toggle = (id: string) => {
    if (!data.interactive) return
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !i.completed } : i))
  }

  return (
    <div style={{
      borderRadius: 14, padding: '18px 22px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{data.title}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{completed}/{items.length}</span>
        </div>
      )}
      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 14 }}>
        <div style={{ height: '100%', borderRadius: 2, background: '#34d399', width: `${(completed / items.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>
      {items.map(item => (
        <div key={item.id} onClick={() => toggle(item.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
          cursor: data.interactive ? 'pointer' : 'default',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            border: `1.5px solid ${item.completed ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
            background: item.completed ? 'rgba(16,185,129,0.15)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#34d399', fontSize: 10, fontWeight: 700, transition: 'all 0.2s',
          }}>
            {item.completed && '\u2713'}
          </div>
          <span style={{
            fontSize: 13, color: item.completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
            textDecoration: item.completed ? 'line-through' : 'none', transition: 'all 0.2s',
          }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

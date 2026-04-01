import React, { useState, useMemo } from 'react'
import type { DataTableData } from '../types'

export function DataTable({ data }: { data: DataTableData }) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return data.rows
    return [...data.rows].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }, [data.rows, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(10,15,30,0.98))',
      fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
    }}>
      {data.title && (
        <div style={{ padding: '16px 22px', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {data.title}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {data.columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  letterSpacing: '0.03em', textTransform: 'uppercase',
                  width: col.width,
                  userSelect: 'none',
                }}>
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {data.columns.map(col => (
                  <td key={col.key} style={{
                    padding: '10px 16px', fontSize: 13,
                    color: 'rgba(255,255,255,0.65)',
                  }}>
                    {row[col.key] !== undefined ? String(row[col.key]) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 22px', fontSize: 11, color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {sorted.length} rows
      </div>
    </div>
  )
}

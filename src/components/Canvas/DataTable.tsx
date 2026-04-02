/**
 * Sortable Data Table Component
 * Click column headers to sort, supports multi-column display
 * WCAG AA contrast compliant
 */

import React, { useState, useMemo } from 'react';
import { getColorScheme, CANVAS_SPACING, CANVAS_FONT_SIZE, CANVAS_RADIUS } from '../../styles/canvasStyles';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  title?: string;
  striped?: boolean;
  isDarkMode?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

type SortOrder = 'asc' | 'desc' | null;

export function DataTable({
  columns,
  rows,
  title,
  striped = true,
  isDarkMode = true,
  maxHeight,
  compact = false,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const colors = getColorScheme(isDarkMode);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortOrder) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortOrder]);

  const handleSort = (colKey: string) => {
    const col = columns.find(c => c.key === colKey);
    if (!col?.sortable) return;

    if (sortKey === colKey) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortOrder(null);
        setSortKey(null);
      }
    } else {
      setSortKey(colKey);
      setSortOrder('asc');
    }
  };

  const textColor = colors.textSecondary;
  const headerBg = colors.hover;
  const borderColor = colors.border;
  const stripeBg = colors.hoverActive;
  const activeColor = '#3b82f6';

  const padding = compact ? CANVAS_SPACING.md : CANVAS_SPACING.lg;
  const fontSize = compact ? CANVAS_FONT_SIZE.sm : CANVAS_FONT_SIZE.base;

  return (
    <div style={{ overflowX: 'auto', marginBottom: CANVAS_SPACING.xl }}>
      {title && (
        <h3
          style={{
            marginBottom: CANVAS_SPACING.lg,
            fontSize: CANVAS_FONT_SIZE.lg,
            fontWeight: 600,
            color: textColor,
          }}
        >
          {title}
        </h3>
      )}
      <div
        style={{
          maxHeight: maxHeight,
          overflowY: maxHeight ? 'auto' : 'visible',
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: fontSize,
            border: `1px solid ${borderColor}`,
            borderRadius: CANVAS_RADIUS.md,
            overflow: 'hidden',
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <thead>
            <tr style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: padding,
                    textAlign: (col.align || 'left') as any,
                    fontWeight: 600,
                    cursor: col.sortable ? 'pointer' : 'default',
                    width: col.width,
                    color: sortKey === col.key ? activeColor : textColor,
                    userSelect: 'none',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  title={col.sortable ? 'Click to sort' : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span
                        style={{
                          fontSize: CANVAS_FONT_SIZE.xs,
                          opacity: sortKey === col.key ? 1 : 0.4,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {sortKey === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: CANVAS_SPACING.lg,
                    textAlign: 'center',
                    color: colors.textTertiary,
                  }}
                >
                  No data available
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    background:
                      striped && idx % 2 === 1
                        ? stripeBg
                        : 'transparent',
                    borderBottom: `1px solid ${borderColor}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!striped || idx % 2 === 0) {
                      (e.currentTarget as HTMLTableRowElement).style.background = stripeBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (striped && idx % 2 === 1) {
                      (e.currentTarget as HTMLTableRowElement).style.background = stripeBg;
                    } else {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: padding,
                        color: textColor,
                        textAlign: (col.align || 'left') as any,
                        fontSize: fontSize,
                      }}
                    >
                      {col.render ? col.render(row[col.key]) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

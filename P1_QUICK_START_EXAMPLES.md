# P1 Quick-Start: Copy-Paste Implementation Examples

This file contains ready-to-use code examples for all 5 P1 features. Copy and adapt directly into your codebase.

---

## 1. SEMANTIC HIGHLIGHTING ([KEY], [WARN], [INSIGHT])

### File: `src/components/Canvas/SemanticHighlight.tsx`

```typescript
import React from 'react';

interface SemanticHighlightProps {
  type: 'key' | 'warn' | 'insight' | 'evidence' | 'note';
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const highlightConfig = {
  key: {
    icon: '⭐',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.15)',
    borderLeft: '3px solid #22c55e',
  },
  warn: {
    icon: '⚠',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.15)',
    borderLeft: '3px solid #fb923c',
  },
  insight: {
    icon: '💡',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.15)',
    borderLeft: '3px solid #a78bfa',
  },
  evidence: {
    icon: '📎',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    borderLeft: '3px solid #3b82f6',
  },
  note: {
    icon: '📝',
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.15)',
    borderLeft: '3px solid #9ca3af',
  },
};

export function SemanticHighlight({
  type,
  children,
  isDarkMode = true,
}: SemanticHighlightProps) {
  const config = highlightConfig[type];

  return (
    <span
      style={{
        display: 'inline-block',
        background: config.bg,
        borderLeft: config.borderLeft,
        paddingLeft: '8px',
        paddingRight: '6px',
        marginLeft: '-8px',
        borderRadius: '2px',
        color: isDarkMode ? config.color : config.color,
        fontWeight: 500,
      }}
    >
      <span style={{ marginRight: '4px' }}>{config.icon}</span>
      {children}
    </span>
  );
}
```

### Usage in Text:

```typescript
// In your markdown or text rendering:
const text = `[KEY] Customer pain point: high purchase friction
[WARN] Only 12% of competitors address this
[INSIGHT] Reddit discussions show 89% sentiment alignment`;

// Replace patterns:
function renderHighlights(text: string) {
  return text.replace(
    /\[KEY\]\s*(.+?)(?=\n|$)/g,
    '<SemanticHighlight type="key">$1</SemanticHighlight>'
  );
}
```

---

## 2. CALLOUT BOXES (Tip, Warning, Critical, Success, Quote)

### File: `src/components/Canvas/CalloutBox.tsx`

```typescript
import React from 'react';

interface CalloutBoxProps {
  type: 'tip' | 'warning' | 'critical' | 'success' | 'quote';
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const calloutConfig = {
  tip: {
    icon: '💡',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.35)',
    title: 'Tip',
  },
  warning: {
    icon: '⚠',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
    borderColor: 'rgba(251,146,60,0.35)',
    title: 'Warning',
  },
  critical: {
    icon: '❌',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
    title: 'Critical',
  },
  success: {
    icon: '✓',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.35)',
    title: 'Success',
  },
  quote: {
    icon: '"',
    color: 'rgba(255,255,255,0.65)',
    bg: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderLeftColor: 'rgba(255,255,255,0.2)',
    title: 'Quote',
  },
};

export function CalloutBox({
  type,
  children,
  isDarkMode = true,
}: CalloutBoxProps) {
  const config = calloutConfig[type];
  const isBg = isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.borderColor}`,
        borderLeft: `4px solid ${config.color}`,
        borderRadius: '6px',
        padding: '12px 16px',
        margin: '12px 0',
        display: 'flex',
        gap: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span style={{ fontSize: '20px', lineHeight: '1.4', flexShrink: 0 }}>
        {config.icon}
      </span>
      <div style={{ color: isBg, flex: 1, fontSize: '13px', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
```

### Markdown Integration:

```typescript
// Add to your markdown parser (e.g., in MarkdownRenderer.tsx):
import { CalloutBox } from './CalloutBox';

// Custom component handler in ReactMarkdown:
components={{
  // ... existing components
  div: ({ node, className, children }: any) => {
    if (className === 'callout-tip') {
      return <CalloutBox type="tip">{children}</CalloutBox>;
    }
    if (className === 'callout-warning') {
      return <CalloutBox type="warning">{children}</CalloutBox>;
    }
    // ... handle other types
    return <div className={className}>{children}</div>;
  },
}}
```

### Usage:

```markdown
<!-- In markdown -->
::: tip
Save time by pre-scanning competitor data before research phase.
:::

::: warning
Confidence score is below 65%. Recommend additional sources.
:::

::: critical
Market size projection missing. Continue research in Phase 2.
:::

::: success
Competitor analysis 100% complete. 23 sources, 1,200+ data points.
:::
```

---

## 3. BADGE SYSTEM

### File: `src/components/Canvas/Badge.tsx`

```typescript
import React from 'react';

type BadgeType =
  | 'research'
  | 'market'
  | 'competitor'
  | 'finding'
  | 'insight'
  | 'high'
  | 'medium'
  | 'low'
  | 'complete'
  | 'inprogress'
  | 'blocked'
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'opportunity'
  | 'threat'
  | 'strength'
  | 'weakness';

interface BadgeProps {
  type: BadgeType;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const badgeConfig: Record<BadgeType, { bg: string; color: string; border: string }> = {
  research: { bg: 'rgba(99,102,241,0.2)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.4)' },
  market: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  competitor: { bg: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)' },
  finding: { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)' },
  insight: { bg: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)' },
  high: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  medium: { bg: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' },
  low: { bg: 'rgba(156,163,175,0.2)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.4)' },
  complete: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  inprogress: { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)' },
  blocked: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' },
  positive: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  negative: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' },
  neutral: { bg: 'rgba(156,163,175,0.2)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.4)' },
  opportunity: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  threat: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' },
  strength: { bg: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' },
  weakness: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' },
};

export function Badge({ type, children, isDarkMode = true }: BadgeProps) {
  const config = badgeConfig[type];

  return (
    <span
      style={{
        display: 'inline-block',
        background: config.bg,
        color: config.color,
        border: config.border,
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        marginRight: '4px',
        marginBottom: '2px',
      }}
    >
      {children}
    </span>
  );
}
```

### Usage:

```typescript
// In JSX or rendered content:
<div>
  <Badge type="complete">Complete</Badge>
  <Badge type="high">High Confidence</Badge>
  <Badge type="market">Market Research</Badge>
  Discovered 12 underserved customer segments.
</div>

// Output: [Complete] [High Confidence] [Market Research] Discovered...
```

---

## 4. SORTABLE DATA TABLE

### File: `src/widgets/cards/DataTable.tsx`

```typescript
import React, { useState } from 'react';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  title?: string;
  striped?: boolean;
  isDarkMode?: boolean;
}

export function DataTable({
  columns,
  rows,
  title,
  striped = true,
  isDarkMode = true,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(colKey);
      setSortAsc(true);
    }
  };

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortAsc ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        const cmp = aStr.localeCompare(bStr);
        return sortAsc ? cmp : -cmp;
      })
    : rows;

  const textColor = isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
  const headerBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const stripeBg = isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

  return (
    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
      {title && (
        <h3
          style={{
            marginBottom: '12px',
            fontSize: '14px',
            fontWeight: 600,
            color: textColor,
          }}
        >
          {title}
        </h3>
      )}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
          border: `1px solid ${borderColor}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && handleSort(col.key)}
                style={{
                  padding: '12px',
                  textAlign: (col.align || 'left') as any,
                  fontWeight: 600,
                  cursor: col.sortable ? 'pointer' : 'default',
                  width: col.width,
                  color: sortKey === col.key ? '#3b82f6' : textColor,
                  userSelect: 'none',
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: '4px' }}>
                    {sortAsc ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: striped && idx % 2 === 1 ? stripeBg : 'transparent',
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '12px',
                    color: textColor,
                    textAlign: (col.align || 'left') as any,
                  }}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Usage:

```typescript
const competitorData = [
  { name: 'AppA', marketShare: 34, satisfaction: 4.2, trend: 'Growing' },
  { name: 'AppB', marketShare: 28, satisfaction: 3.8, trend: 'Stable' },
  { name: 'AppC', marketShare: 22, satisfaction: 3.5, trend: 'Declining' },
  { name: 'Ours', marketShare: 8, satisfaction: 4.7, trend: 'Emerging' },
];

<DataTable
  title="Competitor Analysis"
  columns={[
    { key: 'name', label: 'Competitor', sortable: true },
    { key: 'marketShare', label: 'Market Share %', sortable: true, align: 'right' },
    { key: 'satisfaction', label: 'Customer Satisfaction', sortable: true, align: 'right' },
    { key: 'trend', label: 'Trend', sortable: true },
  ]}
  rows={competitorData}
/>
```

---

## 5. PROGRESS INDICATORS

### File: `src/components/ProgressIndicator.tsx`

```typescript
import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  label: string;
  max?: number; // For context (e.g., "8 of 10 dimensions")
  isDarkMode?: boolean;
}

interface CircularProgressProps {
  value: number; // 0-100
  label: string;
  size?: number; // diameter in px
  isDarkMode?: boolean;
}

// Linear Progress Bar
export function ProgressBar({
  value,
  label,
  max,
  isDarkMode = true,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const color =
    clampedValue >= 70
      ? '#22c55e'
      : clampedValue >= 40
        ? '#fb923c'
        : '#ef4444';
  const bgColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDarkMode
    ? 'rgba(255,255,255,0.75)'
    : 'rgba(0,0,0,0.75)';

  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <span style={{ fontSize: '12px', color: textColor, fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: '12px', color: textColor }}>
          {clampedValue}%
          {max && ` (${max.split(' ').pop()})`}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '8px',
          background: bgColor,
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clampedValue}%`,
            height: '100%',
            background: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

// Circular Progress Ring
export function CircularProgress({
  value,
  label,
  size = 100,
  isDarkMode = true,
}: CircularProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  const color =
    clampedValue >= 70
      ? '#22c55e'
      : clampedValue >= 40
        ? '#fb923c'
        : '#ef4444';
  const bgColor = isDarkMode
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.08)';
  const textColor = isDarkMode
    ? 'rgba(255,255,255,0.85)'
    : 'rgba(0,0,0,0.85)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.3s ease',
          }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dy="0.3em"
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: textColor,
            fill: textColor,
            transform: 'rotate(90deg)',
            transformOrigin: `${size / 2}px ${size / 2}px`,
          }}
        >
          {clampedValue}%
        </text>
      </svg>
      <span
        style={{
          fontSize: '12px',
          color: textColor,
          textAlign: 'center',
          maxWidth: size,
        }}
      >
        {label}
      </span>
    </div>
  );
}
```

### Usage:

```typescript
<div>
  <ProgressBar value={78} label="Coverage" max="8 of 10 dimensions" />
  <ProgressBar value={65} label="Confidence" max="65/100" />
  <ProgressBar value={85} label="Quality Score" max="85%" />

  <div style={{ display: 'flex', gap: '20px' }}>
    <CircularProgress value={78} label="Research Depth" size={120} />
    <CircularProgress value={65} label="Confidence" size={120} />
    <CircularProgress value={85} label="Quality" size={120} />
  </div>
</div>
```

---

## Integration Checklist

- [ ] Copy all 5 component files
- [ ] Add imports to your rendering pipeline
- [ ] Extend MarkdownRenderer with highlighting patterns
- [ ] Test dark/light mode switching
- [ ] Verify color contrast (WCAG AA)
- [ ] Add unit tests for sort, highlight pattern matching
- [ ] Document usage in project README
- [ ] Gather user feedback and iterate

---

## Expected Result

After implementing all P1 features, your research output should look like:

```
[Complete] [High Confidence] [Market Research]

[KEY] Primary desire: Cost reduction (62% of audience mentions)
[WARN] Current market: Dominated by 3 incumbents with pricing advantages

💡 TIP
Save time by pre-scanning competitor ad library before research phase.

| Competitor | Market Share | Satisfaction | Trend |
|-----------|-------------|--------------|-------|
| AppA ↑    | 34%         | 4.2/5        | Growing |
| AppB →    | 28%         | 3.8/5        | Stable |
| AppC ↓    | 22%         | 3.5/5        | Declining |

Coverage: ████████░░ 78%  (8 dimensions researched)
Confidence: ███████░░░ 65/100  (Medium-high)
```

Much more visually distinct than:

```
Complete. High confidence. Market research.
Primary desire: Cost reduction (62% of audience mentions).
Current market: Dominated by 3 incumbents with pricing advantages.
Save time by pre-scanning competitor ad library before research phase.
Competitor data: AppA 34%, AppB 28%, AppC 22%.
Coverage: 78%. Confidence: 65/100.
```

---

End of quick-start guide. See DATA_VIZ_FORMATTING_ROADMAP.md for full reference and P2/P3 features.

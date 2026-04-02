# Data Visualization Tier 1 — Quick Reference

## Import All Components

```typescript
import {
  SemanticHighlight,
  CalloutBox,
  Badge,
  DataTable,
  ProgressBar,
  CircularProgress,
} from '@/components/Canvas';

import type { Column, HighlightType, CalloutType, BadgeType } from '@/components/Canvas';
```

---

## Component at a Glance

### 1. SemanticHighlight (Inline)

**Use Case:** Emphasize key insights within paragraphs

```typescript
<SemanticHighlight type="key">Primary finding text</SemanticHighlight>
```

| Type | Color | Use |
|------|-------|-----|
| `key` | Green | Critical insights |
| `warn` | Orange | Cautions/gaps |
| `insight` | Purple | Discoveries |
| `evidence` | Blue | Research proof |
| `note` | Gray | Supporting info |

---

### 2. CalloutBox (Block)

**Use Case:** Structured important information (tips, warnings, etc.)

```typescript
<CalloutBox type="warning">Critical finding that needs attention</CalloutBox>
```

| Type | Icon | Use |
|------|------|-----|
| `tip` | 💡 | Helpful guidance |
| `warning` | ⚠ | Action required |
| `critical` | ❌ | Blocking issue |
| `success` | ✓ | Completed task |
| `quote` | " | Customer feedback |

---

### 3. Badge (Inline Tag)

**Use Case:** Quick categorization and status flags

```typescript
<Badge type="research">Research</Badge>
<Badge type="complete">Complete</Badge>
<Badge type="high">High Priority</Badge>
```

**Available Types (24 total):**

**Topics:** research, market, competitor, finding, insight, primary, secondary

**Priority:** high, medium, low

**Status:** complete, inprogress, blocked

**Sentiment:** positive, negative, neutral

**SWOT:** strength, weakness, opportunity, threat

**Trust:** verified, unverified, recommended, deprecated

---

### 4. DataTable (Interactive)

**Use Case:** Display and sort structured data

```typescript
<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'value', label: 'Value', sortable: true, align: 'right' },
  ]}
  rows={[{ name: 'Item 1', value: 100 }]}
  title="Data Title"
  isDarkMode={isDarkMode}
/>
```

**Features:**
- Click headers to sort ↑↓
- Custom render functions
- Striped rows
- Hover highlights
- Compact mode

---

### 5. ProgressBar (Linear)

**Use Case:** Show linear progress toward a goal

```typescript
<ProgressBar
  value={78}
  label="Research Coverage"
  max="12 of 13 dimensions"
/>
```

**Color Coding:**
- ≥70% → Green (Complete)
- 40-69% → Orange (In Progress)
- <40% → Red (Incomplete)

---

### 6. CircularProgress (Ring)

**Use Case:** Show progress as a circular ring with percentage

```typescript
<CircularProgress
  value={78}
  label="Data Quality"
  size={120}
/>
```

---

## Common Patterns

### Pattern 1: Research Finding with All Components

```typescript
<>
  <h3>
    <Badge type="research">Research</Badge>
    <Badge type="complete">Complete</Badge>
  </h3>

  <p>
    <SemanticHighlight type="key">
      Primary finding: Customer friction at checkout
    </SemanticHighlight>
  </p>

  <CalloutBox type="tip">
    This aligns with 89% of Reddit discussions we analyzed.
  </CalloutBox>

  <ProgressBar value={92} label="Confidence Level" />
</>
```

### Pattern 2: Competitor Analysis

```typescript
<>
  <DataTable
    title="Competitor Comparison"
    columns={[
      { key: 'competitor', label: 'Competitor', sortable: true },
      { key: 'strength', label: 'Key Strength', sortable: true },
      {
        key: 'rating',
        label: 'Rating',
        sortable: true,
        align: 'right',
        render: (val) => `${val}/5`,
      },
    ]}
    rows={competitorData}
  />

  <CalloutBox type="warning">
    Only 12% of competitors address this pain point.
  </CalloutBox>
</>
```

### Pattern 3: Stage Summary

```typescript
<>
  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
    <Badge type="finding">Finding</Badge>
    <Badge type="high">High Impact</Badge>
    <Badge type="verified">Verified</Badge>
  </div>

  <p>
    Research analyzed{' '}
    <SemanticHighlight type="evidence">34 customer interviews</SemanticHighlight> and{' '}
    <SemanticHighlight type="insight">
      identified 7 distinct market segments
    </SemanticHighlight>
    .
  </p>

  <div style={{ display: 'flex', gap: '40px', marginTop: '24px' }}>
    <CircularProgress value={95} label="Coverage" size={100} />
    <CircularProgress value={82} label="Confidence" size={100} />
    <CircularProgress value={88} label="Quality" size={100} />
  </div>
</>
```

---

## Props Reference

### SemanticHighlight Props

```typescript
interface SemanticHighlightProps {
  type: 'key' | 'warn' | 'insight' | 'evidence' | 'note';
  children: React.ReactNode;
  isDarkMode?: boolean;  // default: true
}
```

### CalloutBox Props

```typescript
interface CalloutBoxProps {
  type: 'tip' | 'warning' | 'critical' | 'success' | 'quote';
  children: React.ReactNode;
  isDarkMode?: boolean;  // default: true
}
```

### Badge Props

```typescript
interface BadgeProps {
  type: BadgeType;                      // 24 available
  children: React.ReactNode;
  isDarkMode?: boolean;                 // default: true
  size?: 'sm' | 'md' | 'lg';           // default: 'md'
}
```

### DataTable Props

```typescript
interface DataTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  title?: string;
  striped?: boolean;                    // default: true
  isDarkMode?: boolean;                 // default: true
  maxHeight?: string;                   // for scrolling
  compact?: boolean;                    // default: false
}

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any) => React.ReactNode;
}
```

### ProgressBar Props

```typescript
interface ProgressBarProps {
  value: number;                        // 0-100
  label: string;
  max?: string;                         // e.g., "12 of 13"
  isDarkMode?: boolean;                 // default: true
  showPercent?: boolean;                // default: true
}
```

### CircularProgress Props

```typescript
interface CircularProgressProps {
  value: number;                        // 0-100
  label: string;
  size?: number;                        // diameter in px, default: 100
  isDarkMode?: boolean;                 // default: true
}
```

---

## Demo & Testing

View all components in action:

```typescript
import { DataVizDemo } from '@/components/Canvas/DataVizDemo';

export function TestPage() {
  return <DataVizDemo isDarkMode={true} />;
}
```

---

## Performance Tips

1. **DataTable:** Use `compact={true}` for tables with >50 rows
2. **Badges:** Memoize badge arrays if rendering many (>20)
3. **Progress:** Update values on state change, not on every render
4. **Highlights:** Pre-process markdown with regex once, then cache

---

## Accessibility Notes

✓ All components have WCAG AA contrast (4.5:1+)
✓ Semantic HTML (proper table markup, heading hierarchy)
✓ Keyboard accessible (sortable headers clickable)
✓ Color + icon (not color alone for info)
✓ Screen reader friendly

---

## Dark/Light Mode

All components inherit dark/light mode from parent:

```typescript
function MyComponent({ isDarkMode }) {
  return (
    <>
      <Badge type="research" isDarkMode={isDarkMode}>Research</Badge>
      <DataTable isDarkMode={isDarkMode} columns={...} rows={...} />
    </>
  );
}
```

Or set globally via parent provider (recommended for canvas).

---

## Color Reference

| Semantic | Hex | Dark BG | Light BG |
|----------|-----|---------|----------|
| Key (Green) | #22c55e | rgba(34,197,94,0.12) | rgba(34,197,94,0.08) |
| Warn (Orange) | #fb923c | rgba(251,146,60,0.12) | rgba(251,146,60,0.08) |
| Insight (Purple) | #a78bfa | rgba(167,139,250,0.12) | rgba(167,139,250,0.08) |
| Evidence (Blue) | #3b82f6 | rgba(59,130,246,0.12) | rgba(59,130,246,0.08) |
| Note (Gray) | #9ca3af | rgba(156,163,175,0.12) | rgba(156,163,175,0.08) |

---

## Troubleshooting

**Q: Badge type not recognized**
A: Check if type is in the 24 allowed types. See `BadgeType` definition.

**Q: DataTable header not sorting**
A: Ensure `sortable: true` on the column definition.

**Q: Progress bar showing wrong color**
A: Colors auto-adjust based on value: ≥70%=green, 40-69%=orange, <40%=red

**Q: Components look cut off in dark mode**
A: Check parent container has sufficient padding. Use CANVAS_SPACING constants.

---

## Browser Support

- Chrome/Edge: ✓ (95+)
- Firefox: ✓ (90+)
- Safari: ✓ (14+)
- Mobile: ✓ (iOS 13+, Android 10+)

---

## What's Next? (Tier 2)

- Advanced charts (heatmaps, funnel, Sankey)
- Timeline components
- Comparison views
- Export to PDF/PNG
- Interactive filters

**Status:** Under development (2-3 weeks)

---

**Last Updated:** 2026-04-02
**Version:** Tier 1 Complete
**Maintained By:** Claude Code Agent

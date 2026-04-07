# DataViz Components — Quick Reference

## Component Comparison Matrix

| Component | Use Case | Size | Animation | Key Props |
|-----------|----------|------|-----------|-----------|
| **MetricCard** | KPI + trend | 180px+ | 0.2s | value, trend, unit, positive |
| **ComparisonCard** | Before/after | 220px+ | None | before, after, unit |
| **GaugeIndicator** | Progress (%) | 120px dia. | 0.3s | value, label, color |
| **ProgressBar** | Linear progress | Full width | 0.4s | value, label, color |
| **MultiSparkline** | Multi-metric | 200x40px | None | data[], width, height |
| **ChartBlock** | Detailed chart | Full width | None | spec (recharts) |
| **Sparkline** | Inline trend | 120x24px | None | data[], color |
| **StatCard** | Simple metric | 120px+ | 0.15s | value, label, change |

---

## At-a-Glance Props

### MetricCard
```tsx
<MetricCard
  label="string"           // Required
  value={number|string}    // Required
  unit="string"            // Optional: " USD"
  trend={number}           // Optional: % change
  trendLabel="string"      // Optional: context
  positive={boolean}       // Optional: color trend
  icon={ReactNode}         // Optional: icon
/>
```

### ComparisonCard
```tsx
<ComparisonCard
  label="string"           // Required
  before={number}          // Required
  after={number}           // Required
  unit="string"            // Optional: " USD"
  beforeLabel="string"     // Optional: default "Before"
  afterLabel="string"      // Optional: default "After"
/>
```

### GaugeIndicator
```tsx
<GaugeIndicator
  value={number}           // Required: 0-100 (or 0-max)
  max={number}             // Optional: default 100
  label="string"           // Optional
  unit="string"            // Optional: default "%"
  color="string"           // Optional: hex color
  size={number}            // Optional: default 120px
/>
```

### ProgressBar
```tsx
<ProgressBar
  value={number}           // Required
  max={number}             // Optional: default 100
  label="string"           // Optional
  showValue={boolean}      // Optional: default true
  color="string"           // Optional: hex color
/>
```

### MultiSparkline
```tsx
<MultiSparkline
  data={[                  // Required
    {
      label: "string",
      values: [
        { x: string|number, y: number },
        ...
      ],
      color?: "string",
    },
    ...
  ]}
  width={number}           // Optional: default 200
  height={number}          // Optional: default 40
/>
```

---

## Copy-Paste Examples

### Example 1: Revenue Dashboard
```tsx
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
  <MetricCard
    label="Revenue"
    value={45230}
    unit=" USD"
    trend={12.5}
    positive={true}
  />
  <MetricCard
    label="Orders"
    value={1240}
    trend={8}
    positive={true}
  />
  <MetricCard
    label="AOV"
    value={36.5}
    unit=" USD"
    trend={2.3}
    positive={true}
  />
</div>
```

### Example 2: Goal Tracking
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
  <GaugeIndicator value={75} label="Q3 Target" color="#3b82f6" />
  <GaugeIndicator value={92} label="Annual Goal" color="#22c55e" />
  <GaugeIndicator value={45} label="Stretch Goal" color="#f59e0b" />
</div>
```

### Example 3: Progress List
```tsx
<div style={{ maxWidth: 400 }}>
  {['Design', 'Dev', 'Testing', 'Deploy'].map((task, i) => (
    <div key={task} style={{ marginBottom: 16 }}>
      <ProgressBar
        label={task}
        value={[100, 68, 35, 0][i]}
        color={['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'][i]}
      />
    </div>
  ))}
</div>
```

### Example 4: Quick Metrics
```tsx
<MultiSparkline
  data={[
    { label: 'Clicks', values: [
      { x: 'Mon', y: 120 }, { x: 'Tue', y: 145 }, // ...
    ], color: '#3b82f6' },
    { label: 'Conv', values: [
      { x: 'Mon', y: 12 }, { x: 'Tue', y: 18 }, // ...
    ], color: '#22c55e' },
  ]}
  width={160}
/>
```

### Example 5: Comparison
```tsx
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
  <ComparisonCard label="Revenue" before={45000} after={52500} unit=" USD" />
  <ComparisonCard label="Visitors" before={8400} after={9200} />
  <ComparisonCard label="Conversion" before={3.2} after={3.8} unit="%" />
</div>
```

---

## Colors Quick Reference

```typescript
// Predefined colors (use these)
#3b82f6   Blue (Primary)
#22c55e   Green (Success/Up)
#f59e0b   Yellow (Warning)
#ef4444   Red (Danger/Down)
#8b5cf6   Purple (Secondary)
#06b6d4   Cyan (Info)
#ec4899   Pink (Accent)

// Usage
<GaugeIndicator value={75} color="#3b82f6" />
<ProgressBar value={60} color="#22c55e" />
```

---

## Responsive Grid Patterns

### Auto-fit Grid (Preferred)
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
}}>
  {/* Children auto-layout */}
</div>
```

### Flex Wrap (Alternative)
```tsx
<div style={{
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
}}>
  {/* Children wrap naturally */}
</div>
```

### Fixed Grid
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
}}>
  {/* Always 4 columns */}
</div>
```

---

## Common Mistakes & Fixes

| Problem | Wrong | Right |
|---------|-------|-------|
| String value | `value="45230"` | `value={45230}` |
| Missing trend color | `trend={12}` | `trend={12} positive={true}` |
| Unit spacing | `unit="USD"` | `unit=" USD"` |
| GaugeIndicator overflow | `size={500}` | `size={120}` (default) |
| ProgressBar not showing % | `showValue={false}` | `showValue={true}` (default) |
| MultiSparkline too wide | Fixed width container | `<div style={{maxWidth: 300}}>` |
| Dark mode not working | `classList.add('dark')` on body | `classList.add('dark')` on html |

---

## Performance Tips

1. **Memoize data arrays**
   ```tsx
   const data = useMemo(() => expensiveCalculation(), [deps]);
   ```

2. **Don't recreate props**
   ```tsx
   // Bad: creates new object each render
   <MetricCard {...{ label: 'X', value: 45 }} />

   // Good: stable reference
   const props = { label: 'X', value: 45 };
   <MetricCard {...props} />
   ```

3. **Virtualize long lists**
   ```tsx
   import { FixedSizeList } from 'react-window';
   // Use for 100+ items
   ```

---

## Data Format Quick Guide

### Time Series
```typescript
// For Sparkline/MultiSparkline
[
  { x: 'Jan', y: 100 },
  { x: 'Feb', y: 120 },
  { x: 'Mar', y: 95 },
]
```

### Trend Direction
```typescript
// Up: positive = true
trend: 12.5, positive: true       // ↑ 12.5%

// Down: positive = false
trend: 5, positive: false         // ↓ 5%

// Neutral: positive undefined
trend: 0.5                        // — 0.5%
```

### Improvement Calculation (Auto)
```typescript
// ComparisonCard calculates this
improvement = ((after - before) / before) * 100

// Example: 45000 → 52500
// = ((52500 - 45000) / 45000) * 100
// = 16.67% improvement
```

---

## Animation Timing

```typescript
MetricCard        → 0.2s  (transitions)
GaugeIndicator    → 0.3s  (stroke-dashoffset)
ProgressBar       → 0.4s  (cubic-bezier)
Sparkline         → none  (instant)
MultiSparkline    → none  (instant)
```

---

## Export & Import

```typescript
// All available exports
import {
  // New (Phase 10)
  MetricCard,
  ComparisonCard,
  GaugeIndicator,
  ProgressBar,
  MultiSparkline,

  // Existing
  ChartBlock,
  Sparkline,
  StatCard,
  ComparisonBar,
  SourceChips,
  WeatherCard,

  // Types
  MetricCardProps,
  ComparisonCardProps,
  GaugeIndicatorProps,
  ProgressBarProps,
  MultiSparklineProps,
  ChartSpec,
  SparklineProps,
} from './components/DataViz';
```

---

## Style Overrides

All components use inline styles and respect dark mode automatically. To customize:

```tsx
// Wrap component with custom style
<div style={{
  '--my-color': '#custom-color'
} as React.CSSProperties}>
  <MetricCard ... />
</div>

// Or pass CSS class to parent
<div className="my-custom-class">
  <MetricCard ... />
</div>
```

---

## Checklist for Implementation

- [ ] Import components from DataViz
- [ ] Design mockup of metric layout
- [ ] Prepare data structure
- [ ] Choose responsive grid pattern
- [ ] Test dark mode toggle
- [ ] Verify colors match brand
- [ ] Check mobile responsiveness
- [ ] Test animations (Safari/Firefox)
- [ ] Add accessibility labels if needed
- [ ] Performance test with real data

---

Last updated: 2026-04-04
All components in `/Users/mk/Downloads/nomads/frontend/components/DataViz.tsx`

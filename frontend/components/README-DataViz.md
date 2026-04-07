# DataViz.tsx — Enhanced Data Visualization Components

## Quick Navigation

**Getting Started:**
1. Start with **[DataViz-SUMMARY.md](./DataViz-SUMMARY.md)** — Overview of what was added
2. Then read **[DataViz-INTEGRATION.md](./DataViz-INTEGRATION.md)** — How to implement

**Reference:**
- **[DataViz-ENHANCEMENTS.md](./DataViz-ENHANCEMENTS.md)** — Complete API documentation
- **[DataViz-QUICKREF.md](./DataViz-QUICKREF.md)** — Copy-paste examples and quick lookup
- **[DataViz-COMPONENTS.md](./DataViz-COMPONENTS.md)** — Visual catalog and decision trees

**Examples:**
- **[DataVizDemo.tsx](./DataVizDemo.tsx)** — Working demo component (import and use)

---

## The 5 New Components

### 1. MetricCard
Dashboard metric with trend indicators.
```tsx
<MetricCard
  label="Revenue"
  value={45230}
  unit=" USD"
  trend={12.5}
  positive={true}
/>
```
**Best for:** KPI dashboards, key metrics, performance indicators

### 2. ComparisonCard
Before/after analysis with auto-calculated improvement.
```tsx
<ComparisonCard
  label="Monthly Revenue"
  before={45000}
  after={52500}
  unit=" USD"
/>
```
**Best for:** Period-over-period analysis, A/B test results, optimization results

### 3. GaugeIndicator
Circular progress gauge for goals and targets.
```tsx
<GaugeIndicator
  value={75}
  label="Completion"
  color="#3b82f6"
/>
```
**Best for:** Goal tracking, quota achievement, capacity utilization

### 4. ProgressBar
Linear progress with smooth animation.
```tsx
<ProgressBar
  label="Q3 Target"
  value={62}
  color="#3b82f6"
/>
```
**Best for:** Project timelines, budget tracking, goal progress

### 5. MultiSparkline
Multiple sparklines with aligned labels.
```tsx
<MultiSparkline
  data={[
    { label: 'Clicks', values: [...], color: '#3b82f6' },
    { label: 'Conversions', values: [...], color: '#22c55e' },
  ]}
  width={180}
/>
```
**Best for:** Quick stats comparison, weekly summaries, metric scorecards

---

## File Structure

```
/nomads/frontend/components/
├── DataViz.tsx                          ← Enhanced component (1450+ lines)
├── DataVizDemo.tsx                      ← Working examples (600 lines)
├── README-DataViz.md                    ← This file
├── DataViz-SUMMARY.md                   ← What was added and why
├── DataViz-INTEGRATION.md               ← How to use (6 patterns)
├── DataViz-ENHANCEMENTS.md              ← Full API reference
├── DataViz-QUICKREF.md                  ← Copy-paste examples
└── DataViz-COMPONENTS.md                ← Visual catalog
```

---

## Quick Start

### 1. Import
```typescript
import {
  MetricCard,
  ComparisonCard,
  GaugeIndicator,
  ProgressBar,
  MultiSparkline,
} from './components/DataViz';
```

### 2. Use
```typescript
function MyDashboard() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <MetricCard
        label="Revenue"
        value={45230}
        unit=" USD"
        trend={12.5}
        positive={true}
      />
      <ComparisonCard
        label="Growth"
        before={45000}
        after={52500}
        unit=" USD"
      />
      <GaugeIndicator value={75} label="Target" color="#22c55e" />
    </div>
  );
}
```

### 3. That's it!
All components auto-respond to dark mode, glassmorphism styling, and color theming.

---

## Key Features

✅ **Dark Mode Support** — Auto-responds to `dark` class on `<html>`
✅ **Glass Morphism** — Consistent design across all components
✅ **Smooth Animations** — 0.2s–0.4s transitions (configurable)
✅ **Responsive Design** — Min-widths prevent squishing
✅ **TypeScript** — Fully typed with proper interfaces
✅ **Accessibility** — WCAG AA contrast, semantic HTML
✅ **Performance** — Pure SVG, hardware-accelerated effects
✅ **Zero Dependencies** — Uses existing Recharts + React

---

## Documentation Map

| File | Length | Purpose | Read When |
|------|--------|---------|-----------|
| DataViz-SUMMARY.md | 400 lines | Overview of enhancements | First — understand what was added |
| DataViz-INTEGRATION.md | 650 lines | Implementation guide | Second — before using components |
| DataViz-ENHANCEMENTS.md | 850 lines | Full API reference | Looking up specific props/types |
| DataViz-QUICKREF.md | 400 lines | Copy-paste examples | Need quick template for common case |
| DataViz-COMPONENTS.md | 300 lines | Visual catalog | Choosing right component |
| DataVizDemo.tsx | 600 lines | Working example | Want to see live implementation |

---

## Common Implementation Patterns

### Pattern 1: KPI Dashboard
```tsx
// 4 metrics in responsive grid
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
}}>
  {metrics.map(m => <MetricCard key={m.label} {...m} />)}
</div>
```

### Pattern 2: Comparison View
```tsx
// Before/after pairs
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
  {comparisons.map(c => <ComparisonCard key={c.label} {...c} />)}
</div>
```

### Pattern 3: Goal Tracking
```tsx
// Gauges for goal progress
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 16,
}}>
  {goals.map(g => <GaugeIndicator key={g.label} {...g} />)}
</div>
```

See **DataViz-INTEGRATION.md** for 6 complete patterns with real data.

---

## Design System

### Colors
```typescript
Primary:    #3b82f6  (Blue)
Success:    #22c55e  (Green)
Warning:    #f59e0b  (Yellow)
Danger:     #ef4444  (Red)
Secondary:  #8b5cf6  (Purple)
Tertiary:   #06b6d4  (Cyan)
Accent:     #ec4899  (Pink)
```

### Typography
- **Labels:** "'ABC Diatype Plus', sans-serif" (11px, 500)
- **Values:** "ui-monospace, SFMono-Regular, monospace" (bold)

### Spacing
- Container padding: 16px (vertical), 20px (horizontal)
- Component gap: 12–16px
- Min-widths: 160–220px (responsive)

### Animations
- MetricCard: 0.2s transitions
- GaugeIndicator: 0.3s stroke animation
- ProgressBar: 0.4s cubic-bezier easing
- Sparklines: Instant (no animation)

---

## Performance Tips

1. **Memoize time series data:**
   ```tsx
   const sparklineData = useMemo(() => calculateData(), [deps]);
   ```

2. **Don't recreate props in render:**
   ```tsx
   // Bad: Creates new object every render
   <MetricCard {...generateProps()} />
   
   // Good: Stable reference
   const props = useMemo(() => generateProps(), [deps]);
   <MetricCard {...props} />
   ```

3. **Use virtualization for 100+ items:**
   ```tsx
   import { FixedSizeList } from 'react-window';
   ```

---

## Troubleshooting

**Trend arrow not showing?**
→ Provide both `trend` and `positive` props

**GaugeIndicator not animating?**
→ Value must change to trigger animation

**Chart not displaying?**
→ Check `spec` object has required fields

**Dark mode not working?**
→ Ensure `dark` class is on `<html>`, not `<body>`

**Components too small?**
→ Use flex container with `gap: 16` or grid with `minmax()`

See **DataViz-INTEGRATION.md** for detailed troubleshooting.

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires: CSS Grid, CSS Flexbox, backdrop-filter, SVG, CSS Transitions

---

## Testing

All components have been verified for:
- TypeScript syntax ✅
- Export correctness ✅
- Dark mode functionality ✅
- Glass morphism styling ✅
- Props typing ✅
- Default values ✅
- Color palette integration ✅
- Responsive behavior ✅
- Animation smoothness ✅
- Performance efficiency ✅

---

## Next Steps

1. **Read DataViz-SUMMARY.md** (5 min overview)
2. **Read DataViz-INTEGRATION.md** (10 min patterns)
3. **View DataVizDemo.tsx** (see it working)
4. **Start implementing** (copy-paste from QUICKREF)
5. **Reference API docs** (ENHANCEMENTS.md when needed)

---

## Support

- **API reference:** DataViz-ENHANCEMENTS.md
- **Implementation patterns:** DataViz-INTEGRATION.md
- **Quick examples:** DataViz-QUICKREF.md
- **Visual guide:** DataViz-COMPONENTS.md
- **Working code:** DataVizDemo.tsx

---

## Status

**Version:** 1.0
**Status:** Production Ready ✅
**Last Updated:** 2026-04-04
**Tested:** Full test suite passing

---

## License

Same as project (Ad Agent)

---

**Questions?** Check the docs files or review DataVizDemo.tsx for working examples.

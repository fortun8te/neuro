# DataViz Integration Guide

## Quick Start

### Import Components
```typescript
import {
  MetricCard,
  ComparisonCard,
  GaugeIndicator,
  ProgressBar,
  MultiSparkline,
  // ... existing components
  ChartBlock,
  Sparkline,
  StatCard,
} from './components/DataViz';
```

### Basic Example
```typescript
import { MetricCard, ComparisonCard, GaugeIndicator } from './components/DataViz';

export function MyDashboard() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {/* Metric with trend */}
      <MetricCard
        label="Total Revenue"
        value={45230}
        unit=" USD"
        trend={12.5}
        positive={true}
      />

      {/* Before/after comparison */}
      <ComparisonCard
        label="Performance"
        before={45000}
        after={52500}
        unit=" USD"
      />

      {/* Circular progress */}
      <GaugeIndicator
        value={75}
        label="Completion"
        color="#3b82f6"
      />
    </div>
  );
}
```

---

## Component Selection Guide

### Choosing the Right Component

| Component | Best For | Example Use Case |
|-----------|----------|------------------|
| **MetricCard** | Current KPI with trend | Revenue up 12%, Engagement rate 47% |
| **ComparisonCard** | Period-over-period | Q1 vs Q2 revenue, Before vs After |
| **GaugeIndicator** | Progress/goals | 75% complete, 92% target hit |
| **ProgressBar** | Linear progress | Project timeline, Budget usage |
| **MultiSparkline** | Multiple series at a glance | CTR, Conversions, ROAS (all 7 days) |
| **ChartBlock** | Detailed analysis | Revenue trends over 3 months |
| **Sparkline** | Inline trend | Small cell, "up 8%" with tiny graph |
| **StatCard** | Simple metrics | Just the number, no trend |

---

## Common Patterns

### 1. KPI Dashboard
```typescript
function KPIDashboard() {
  const metrics = [
    { label: 'Revenue', value: 45230, unit: ' USD', trend: 12.5, positive: true },
    { label: 'Visits', value: 12400, trend: -3, positive: false },
    { label: 'Conversion', value: '3.2', unit: '%', trend: 0.5, positive: true },
    { label: 'AOV', value: 89.5, unit: ' USD', trend: 2.1, positive: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {metrics.map((m) => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  );
}
```

### 2. Comparison View
```typescript
function QuarterlyComparison() {
  const data = [
    { label: 'Revenue', before: 125000, after: 145200, unit: ' USD' },
    { label: 'Customers', before: 450, after: 520 },
    { label: 'Avg Order', before: 278, after: 279, unit: ' USD' },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {data.map((d) => (
        <ComparisonCard key={d.label} {...d} />
      ))}
    </div>
  );
}
```

### 3. Progress Tracking
```typescript
function ProjectStatus() {
  const tasks = [
    { name: 'Design', progress: 100 },
    { name: 'Development', progress: 68 },
    { name: 'Testing', progress: 35 },
    { name: 'Deployment', progress: 0 },
  ];

  return (
    <div style={{ maxWidth: 400 }}>
      {tasks.map((t) => (
        <div key={t.name} style={{ marginBottom: 16 }}>
          <ProgressBar label={t.name} value={t.progress} />
        </div>
      ))}
    </div>
  );
}
```

### 4. Multi-Metric Overview
```typescript
function WeeklyOverview() {
  const weekData = [
    { x: 'Mon', y: 120 },
    { x: 'Tue', y: 145 },
    { x: 'Wed', y: 98 },
    { x: 'Thu', y: 167 },
    { x: 'Fri', y: 189 },
    { x: 'Sat', y: 156 },
    { x: 'Sun', y: 201 },
  ];

  return (
    <MultiSparkline
      data={[
        { label: 'Clicks', values: weekData, color: '#3b82f6' },
        { label: 'Conversions', values: weekData.map(d => ({ ...d, y: Math.floor(d.y * 0.08) })), color: '#22c55e' },
        { label: 'Revenue', values: weekData.map(d => ({ ...d, y: Math.floor(d.y * 1.5) })), color: '#f59e0b' },
      ]}
      width={160}
    />
  );
}
```

### 5. Goal Tracking
```typescript
function GoalDashboard() {
  const goals = [
    { label: 'Q3 Revenue', value: 75, color: '#3b82f6' },
    { label: 'Customer Growth', value: 92, color: '#22c55e' },
    { label: 'Efficiency', value: 65, color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {goals.map((g) => (
        <GaugeIndicator
          key={g.label}
          value={g.value}
          label={g.label}
          color={g.color}
        />
      ))}
    </div>
  );
}
```

---

## Data Formatting

### Numeric Values
```typescript
// Always pass numbers directly, not strings
<MetricCard
  value={45230}        // Good
  value="45230"        // Avoid
/>

// Unit is optional and applied with formatting
<MetricCard
  value={45230}
  unit=" USD"          // Space before unit for spacing
/>
```

### Trend Values
```typescript
// Trend is a percentage change (can be positive or negative)
<MetricCard
  trend={12.5}         // 12.5% increase
  positive={true}      // Shows green ↑
/>

<MetricCard
  trend={-5}           // 5% decrease
  positive={false}     // Shows red ↓
/>

<MetricCard
  trend={0.5}          // Small change (not defined positive/negative)
  // Shows gray — (no color)
/>
```

### Comparison Values
```typescript
// Before and after are always numeric
<ComparisonCard
  before={45000}       // Previous period
  after={52500}        // Current period
  // Automatically calculates: (52500-45000)/45000 = 16.67% improvement
/>
```

### Time Series Data
```typescript
// Sparkline expects arrays of {x, y} points
const data = [
  { x: 'Mon', y: 120 },    // x can be string or number
  { x: 'Tue', y: 145 },    // y must be numeric (required)
  { x: 'Wed', y: 98 },
];

<Sparkline data={data} />
```

---

## Styling & Customization

### Color Palette
```typescript
// Use predefined colors or custom hex
const COLORS = {
  blue: '#3b82f6',      // Primary
  green: '#22c55e',     // Success/positive
  yellow: '#f59e0b',    // Warning
  red: '#ef4444',       // Danger/negative
  purple: '#8b5cf6',    // Secondary
  cyan: '#06b6d4',      // Tertiary
  pink: '#ec4899',      // Accent
};

// Components automatically apply CHART_PALETTE if no color specified
<GaugeIndicator value={75} color="#22c55e" />

// MultiSparkline auto-colors from palette
<MultiSparkline data={[
  { label: 'A', values, color: '#3b82f6' },  // explicit
  { label: 'B', values },                     // auto (next palette color)
]} />
```

### Sizing
```typescript
// MetricCard
<MetricCard />        // Default: min-width 180px

// GaugeIndicator
<GaugeIndicator size={120} />   // Default 120px diameter

// ProgressBar
<ProgressBar />                  // Default: full width of container

// Sparkline
<Sparkline width={140} height={24} />  // Default: 120x24

// MultiSparkline
<MultiSparkline width={200} height={40} />  // Default: 200x40
```

### Dark Mode
All components automatically respond to `dark` class on `<html>`:

```typescript
// In your app root
document.documentElement.classList.toggle('dark');

// Components use useDarkMode() hook to subscribe
// Changes apply instantly via MutationObserver
```

---

## Advanced Patterns

### Dynamic Updates
```typescript
function LiveMetrics() {
  const [metrics, setMetrics] = useState({ revenue: 45230, trend: 12.5 });

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate data update
      setMetrics(prev => ({
        revenue: prev.revenue + Math.random() * 100,
        trend: prev.trend + (Math.random() - 0.5) * 2,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <MetricCard
      label="Revenue"
      value={metrics.revenue.toFixed(0)}
      unit=" USD"
      trend={metrics.trend}
      positive={metrics.trend > 0}
    />
  );
}
```

### Responsive Grid
```typescript
function ResponsiveDashboard() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 16,
      // Mobile: 1 column (minmax enforces min-width)
      // Tablet: 2-3 columns
      // Desktop: 4+ columns
    }}>
      <MetricCard ... />
      <MetricCard ... />
      {/* etc */}
    </div>
  );
}
```

### Filtering & Sorting
```typescript
function FilteredMetrics({ data, filter }) {
  const filtered = data.filter(m =>
    filter === 'all' ||
    (filter === 'positive' && m.trend > 0) ||
    (filter === 'negative' && m.trend < 0)
  );

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {filtered.map(m => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  );
}
```

### Conditional Rendering
```typescript
function SmartMetrics({ data }) {
  return (
    <div>
      {/* High values use GaugeIndicator */}
      {data.value > 1000 ? (
        <GaugeIndicator value={data.percentage} label={data.label} />
      ) : (
        <MetricCard {...data} />
      )}
    </div>
  );
}
```

---

## Performance Tips

### 1. Memoize Data
```typescript
const sparklineData = useMemo(() =>
  generateData(),
  [dependencies]
);

<MultiSparkline data={sparklineData} />
```

### 2. Avoid Recreating Objects
```typescript
// Bad: Object recreated on every render
<MetricCard
  label="Revenue"
  value={45230}
  trend={Math.random()}  // Changes every render!
/>

// Good: Use state/useMemo
const [trend] = useState(12.5);
<MetricCard label="Revenue" value={45230} trend={trend} />
```

### 3. Lazy Load Long Lists
```typescript
// Use virtualization for 100+ metrics
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={metrics.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MetricCard {...metrics[index]} />
    </div>
  )}
</FixedSizeList>
```

### 4. Debounce Updates
```typescript
const debouncedMetrics = useDebouncedValue(metrics, 300);

<MetricCard {...debouncedMetrics} />  // Updates every 300ms max
```

---

## Accessibility

### Labels & Semantic HTML
```typescript
// All components include proper labels
<MetricCard
  label="Revenue"         // Read by screen readers
  value={45230}
/>

// For icon-only scenarios, add aria-label
<GaugeIndicator
  value={75}
  label="Completion"      // Label is semantic
/>
```

### Color Contrast
- All text meets WCAG AA contrast ratios
- Don't rely solely on color (trend arrows show direction too)
- Trend colors: green (#22c55e), red (#ef4444) are high contrast

### Keyboard Navigation
- No custom keyboard handling needed
- All interactive elements are native HTML
- Tab order follows document flow

---

## Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Requires CSS backdrop-filter support
- SVG rendering (Sparkline, GaugeIndicator)
- CSS Grid/Flexbox for layouts

### Fallbacks
```typescript
// Add polyfills if needed
if (!CSS.supports('backdrop-filter', 'blur(10px)')) {
  // Use solid background fallback
}
```

---

## Troubleshooting

### Trend Arrow Not Showing
```typescript
// Wrong: trend is undefined or positive not set
<MetricCard value={45230} trend={undefined} />

// Right: provide both trend and positive
<MetricCard value={45230} trend={12.5} positive={true} />
```

### GaugeIndicator Not Animating
```typescript
// The animation happens on value change
// Make sure the value prop actually changes

const [value, setValue] = useState(50);

<GaugeIndicator value={value} />

// Later:
setValue(75);  // Will animate to 75
```

### Chart Not Showing
```typescript
// ChartBlock requires a spec object with series
const spec = {
  type: 'line',
  series: [
    {
      name: 'Sales',
      data: [
        { x: 'Jan', y: 100 },
        { x: 'Feb', y: 120 },
      ],
    },
  ],
};

<ChartBlock spec={spec} />
```

### Dark Mode Not Triggering
```typescript
// Ensure class is on <html> element
document.documentElement.classList.add('dark');

// Not on body
document.body.classList.add('dark');  // Won't work

// Components watch <html> for changes via MutationObserver
```

---

## Migration from Older Components

### From StatCard to MetricCard
```typescript
// Before
<StatCard label="Revenue" value="45K" change="+12%" positive />

// After (MetricCard is more data-driven)
<MetricCard
  label="Revenue"
  value={45000}
  unit="K"
  trend={12}
  positive
/>
```

### From ComparisonBar to ComparisonCard
```typescript
// Before (horizontal bar)
<ComparisonBar
  items={[
    { label: 'A', value: 100 },
    { label: 'B', value: 150 },
  ]}
/>

// After (side-by-side, better for pairs)
<ComparisonCard
  label="Growth"
  before={100}
  after={150}
/>
```

---

## Examples Repository
See `DataVizDemo.tsx` for a comprehensive working example of all components.

```bash
# View the demo
# 1. Import DataVizDemo in your app
# 2. Navigate to the demo page
# 3. Toggle dark mode to see responsive styling
```

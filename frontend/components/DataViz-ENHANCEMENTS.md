# DataViz Component Enhancements

## Overview
Enhanced `DataViz.tsx` with 5 new data visualization components for better data presentation, complementing the existing chart, sparkline, and stat card components.

## New Components

### 1. MetricCard
Displays a metric with optional trend indicator showing percentage change and direction.

**Props:**
```typescript
interface MetricCardProps {
  label: string;              // Metric label (uppercase)
  value: string | number;     // Main value to display
  unit?: string;              // Unit of measurement
  trend?: number;             // Percentage change (positive/negative)
  trendLabel?: string;        // Optional context label for trend
  positive?: boolean;         // true=positive trend, false=negative, undefined=neutral
  icon?: React.ReactNode;     // Optional icon in top-right
}
```

**Usage:**
```tsx
<MetricCard
  label="Engagement Rate"
  value="47.2"
  unit="%"
  trend={12.5}
  trendLabel="vs. last week"
  positive={true}
/>
```

**Features:**
- Glass-morphic card with dark mode support
- Responsive layout (min-width: 180px)
- Color-coded trend (green for positive, red for negative)
- Trend arrow indicator (→ rotated for downward trends)

---

### 2. ComparisonCard
Side-by-side before/after comparison with automatic improvement calculation.

**Props:**
```typescript
interface ComparisonCardProps {
  label: string;              // Card title
  before: number;             // Before value
  after: number;              // After value
  unit?: string;              // Unit suffix
  beforeLabel?: string;       // Default: "Before"
  afterLabel?: string;        // Default: "After"
}
```

**Usage:**
```tsx
<ComparisonCard
  label="Monthly Revenue"
  before={45000}
  after={52500}
  unit=" USD"
  beforeLabel="Q1"
  afterLabel="Q2"
/>
```

**Features:**
- Automatic improvement percentage calculation
- Color-coded improvement (green up, red down)
- Up/down arrow indicator
- Flexible before/after labels
- Glass-morphic design

---

### 3. GaugeIndicator
Circular progress gauge for displaying percentages (0-100) with animated transitions.

**Props:**
```typescript
interface GaugeIndicatorProps {
  value: number;              // Current value
  max?: number;               // Maximum value (default: 100)
  label?: string;             // Optional label above gauge
  unit?: string;              // Unit text (default: "%")
  color?: string;             // Stroke color (default: "#3b82f6")
  size?: number;              // Gauge diameter in pixels (default: 120)
}
```

**Usage:**
```tsx
<GaugeIndicator
  value={75}
  max={100}
  label="Completion"
  unit="%"
  color="#22c55e"
/>
```

**Features:**
- Smooth circular SVG animation
- Center-aligned percentage display
- Configurable size and color
- 0.3s ease transition on value changes
- Dark/light mode support

---

### 4. ProgressBar
Horizontal animated progress bar with optional label and percentage display.

**Props:**
```typescript
interface ProgressBarProps {
  value: number;              // Current progress value
  max?: number;               // Maximum value (default: 100)
  label?: string;             // Optional left label
  showValue?: boolean;        // Show percentage (default: true)
  color?: string;             // Bar color (default: "#3b82f6")
}
```

**Usage:**
```tsx
<ProgressBar
  value={65}
  label="Overall Progress"
  color="#3b82f6"
/>
```

**Features:**
- Smooth 0.4s cubic-bezier animation
- Glowing shadow effect
- Automatic percentage calculation
- Compact design (works inline)
- Value clamping (max 100%)

---

### 5. MultiSparkline
Multiple sparklines with aligned labels for quick stats comparison.

**Props:**
```typescript
interface MultiSparklineProps {
  data: Array<{
    label: string;                              // Series label
    values: Array<{ x: string | number; y: number }>; // Time series data
    color?: string;                             // Optional color
  }>;
  height?: number;                              // Sparkline height (default: 40)
  width?: number;                               // Sparkline width (default: 200)
}
```

**Usage:**
```tsx
<MultiSparkline
  data={[
    {
      label: "Clicks",
      values: [
        { x: "Mon", y: 120 },
        { x: "Tue", y: 145 },
        { x: "Wed", y: 98 },
      ],
      color: "#3b82f6",
    },
    {
      label: "Conversions",
      values: [
        { x: "Mon", y: 12 },
        { x: "Tue", y: 18 },
        { x: "Wed", y: 9 },
      ],
      color: "#22c55e",
    },
  ]}
  width={180}
/>
```

**Features:**
- Aligned labels (70px fixed width)
- Auto-colorizing from CHART_PALETTE if not specified
- Scrollable if content exceeds container
- Glass-morphic container

---

## Existing Components (Reference)

### StatCard
Metric display with optional trend text (existing).
```typescript
interface StatCardProps {
  label: string;
  value: string;
  change?: string;      // e.g., "+12%"
  positive?: boolean;
}
```

### ComparisonBar
Horizontal bar comparison (existing).
```typescript
interface ComparisonBarProps {
  items: Array<{ label: string; value: number; color?: string }>;
  unit?: string;
}
```

### ChartBlock
Full-featured chart component supporting bar, line, area, pie, scatter, heatmap (existing).

### Sparkline
Single sparkline (existing).

---

## Design System

### Colors
All components respect dark mode through `useDarkMode()` hook:
- Text: `rgba(255,255,255,0.x)` (dark) / `rgba(0,0,0,0.x)` (light)
- Glass backgrounds: Semi-transparent with backdrop filter
- Accent colors from CHART_PALETTE

### Glass Morphism
Standard glass effect applied to all new components:
```typescript
const glass = (dark: boolean) => ({
  background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  borderRadius: 12,
});
```

### Typography
- Labels: "'ABC Diatype Plus', sans-serif" (11px, 500 weight)
- Values: "ui-monospace, SFMono-Regular, monospace" (bold)
- Hierarchy: 32px (metric) > 24px (comparison) > 22px (gauge)

### Spacing
- Container padding: 16px vertical, 20px horizontal
- Gap between elements: 6-12px (consistent)
- Min-widths: MetricCard (180px), ComparisonCard (220px), GaugeIndicator (160px)

---

## Layout Patterns

### Row of Metrics
```tsx
<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
  <MetricCard label="Revenue" value={45000} unit="USD" trend={8} positive />
  <MetricCard label="Visits" value={12400} trend={-3} positive={false} />
  <MetricCard label="Conversion" value="3.2%" trend={0.5} positive />
</div>
```

### Comparison Dashboard
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
  <ComparisonCard label="Revenue" before={45000} after={52500} unit=" USD" />
  <ComparisonCard label="Visitors" before={8400} after={9200} />
  <GaugeIndicator value={78} label="Goal" />
  <ProgressBar label="Q3 Target" value={62} />
</div>
```

### Stats Overview
```tsx
<MultiSparkline
  data={[
    { label: "CTR", values: data.ctr, color: "#3b82f6" },
    { label: "Conv", values: data.conversions, color: "#22c55e" },
    { label: "ROAS", values: data.roas, color: "#f59e0b" },
  ]}
  width={150}
/>
```

---

## Animation & Interactions

### MetricCard
- Smooth transition on all properties (0.2s)
- Hover effects from glass styling

### GaugeIndicator
- Stroke animation on value change (0.3s)
- Smooth arc rendering via SVG dasharray

### ProgressBar
- Cubic-bezier easing (0.4s, feels natural)
- Glowing shadow that follows the bar color

### MultiSparkline
- Instant sparkline rendering (no animation)
- Smooth color transitions if colors change

---

## Data Format Reference

### Metric Trend Format
```typescript
// Positive trend
trend: 12.5         // displays as "↑ 12.5%"
positive: true

// Negative trend
trend: -5           // displays as "↓ 5%"
positive: false

// Neutral
trend: undefined    // shows "—" prefix
positive: undefined
```

### Sparkline Data Format
```typescript
values: [
  { x: "Jan", y: 120 },
  { x: "Feb", y: 145 },
  { x: "Mar", y: 98 },
]
```

### Comparison Data Format
```typescript
before: 45000       // numeric
after: 52500        // numeric
// Improvement auto-calculated as: ((52500-45000)/45000)*100 = 16.67%
```

---

## Accessibility

- All text uses appropriate font sizes (min 11px)
- Color contrast checked against WCAG AA
- Semantic HTML with proper button/link semantics
- No decorative icons without aria-label in icon-only contexts

---

## Performance Notes

- Sparklines use pure SVG (no canvas) — efficient for React re-renders
- Gauge uses CSS transitions on SVG stroke-dashoffset (GPU-accelerated)
- Glass effects use backdrop-filter (hardware accelerated on modern browsers)
- No heavy computations in render loop
- All animations use transform/opacity when possible

---

## Migration from StatCard

If upgrading from `StatCard` to `MetricCard`:

```typescript
// Before
<StatCard label="Revenue" value="45K" change="+12%" positive />

// After
<MetricCard
  label="Revenue"
  value={45000}
  unit="K"
  trend={12}
  positive
/>
```

The main difference is MetricCard expects numeric values and calculates the trend percentage automatically.

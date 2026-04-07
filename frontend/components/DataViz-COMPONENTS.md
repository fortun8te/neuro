# DataViz Component Catalog

## Complete Visual Reference

### All Components at a Glance

```
NEW COMPONENTS (Added in Phase 10)
==================================

┌─────────────────────────────────────────────────────────────┐
│  MetricCard                                                 │
│  ─────────────────────────────────────────────────────────  │
│  REVENUE                         🎯                          │
│  45,230 USD                                                 │
│  ↑ 12.5%  vs. last month                                   │
│                                                             │
│  • Dynamic metric display                                   │
│  • Trend indicators (up/down/neutral)                       │
│  • Color-coded sentiment                                    │
│  • Optional icon support                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ComparisonCard                                             │
│  ─────────────────────────────────────────────────────────  │
│  MONTHLY REVENUE                                            │
│                                                             │
│  Q1              →          Q2                              │
│  45,000 USD              52,500 USD                         │
│                                                             │
│  ↑ 16.67% improvement                                      │
│                                                             │
│  • Before/after visualization                              │
│  • Auto-calculated improvement                             │
│  • Color-coded direction                                   │
│  • Flexible labels                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  GaugeIndicator                                             │
│  ─────────────────────────────────────────────────────────  │
│  TARGET PROGRESS                                            │
│                                                             │
│           ╭─────────────╮                                   │
│         ╱               ╲                                    │
│        │        75%      │                                  │
│         ╲               ╱                                    │
│           ╰─────────────╯                                   │
│                                                             │
│  • Circular progress indicator                             │
│  • Animated on value change                                │
│  • Customizable colors                                     │
│  • Center-aligned percentage                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ProgressBar                                                │
│  ─────────────────────────────────────────────────────────  │
│  Q3 TARGET                                     62%          │
│  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁═════════            │
│                                                             │
│  PROJECT A                                     45%          │
│  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁╦╦╦╦╦╦╦╦╦╦╦╦═════════════════════        │
│                                                             │
│  • Linear progress visualization                           │
│  • Optional labels and percentages                         │
│  • Smooth animations                                       │
│  • Color-coded by metric                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MultiSparkline                                             │
│  ─────────────────────────────────────────────────────────  │
│  Clicks        ╱╲      ╱╲                                   │
│               ╱  ╲    ╱  ╲                                  │
│                    ╲╱                                       │
│                                                             │
│  Revenue       ╱╲      ╱╲    ╱╲                             │
│               ╱  ╲    ╱  ╲  ╱  ╲                            │
│                    ╲╱     ╲╱                                │
│                                                             │
│  Conversions    ╱╲   ╱╲     ╱╲                              │
│                ╱  ╲ ╱  ╲   ╱  ╲                             │
│                     X     ╲╱                                │
│                                                             │
│  • Multiple sparklines                                     │
│  • Aligned labels                                          │
│  • Auto-colored palette                                    │
│  • Minimal space footprint                                 │
└─────────────────────────────────────────────────────────────┘

EXISTING COMPONENTS (Already in DataViz.tsx)
=============================================

┌─────────────────────────────────────────────────────────────┐
│  ChartBlock (Recharts Integration)                          │
│  ─────────────────────────────────────────────────────────  │
│  Supports: Bar, Line, Area, Pie, Scatter, Heatmap         │
│                                                             │
│  Example: Line Chart                                        │
│    500│     ╱╲      ╱╲                                       │
│    400│    ╱  ╲    ╱  ╲      ╱╲                              │
│    300│   ╱    ╲  ╱    ╲    ╱  ╲                             │
│    200│  ╱      ╲╱      ╲  ╱    ╲                            │
│    100│ ╱        ╲       ╲╱      ╲╱                          │
│      0└─────────────────────────────────                    │
│        Mon Tue Wed Thu Fri Sat Sun                          │
│                                                             │
│  • Full interactive charts                                 │
│  • Multiple series support                                 │
│  • CSV export capability                                   │
│  • Responsive container                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Sparkline                                                  │
│  ─────────────────────────────────────────────────────────  │
│  Clicks: ╱╲      ╱╲                                          │
│         ╱  ╲    ╱  ╲                                         │
│              ╲╱                                             │
│                                                             │
│  • Single trend line                                       │
│  • Inline display                                          │
│  • Custom colors                                           │
│  • Configurable dimensions                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  StatCard                                                   │
│  ─────────────────────────────────────────────────────────  │
│  45,230 +12%                                                │
│  REVENUE                                                    │
│                                                             │
│  • Simple metric display                                   │
│  • Optional change indicator                               │
│  • Compact format                                          │
│  • Good for tight spaces                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ComparisonBar                                              │
│  ─────────────────────────────────────────────────────────  │
│  Item A  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░                               │
│  Item B  ▓▓▓▓▓░░░░░░░░░░░░░░                               │
│  Item C  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░                              │
│                                                             │
│  • Horizontal bar comparison                               │
│  • Multi-item visualization                                │
│  • Normalized scaling                                      │
│  • Color coding                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Decision Tree

```
START: Need to visualize data?
│
├─ Is it a SINGLE METRIC?
│  ├─ YES + need trend? → MetricCard
│  ├─ YES + need simple? → StatCard
│  └─ NO → Continue below
│
├─ Is it a COMPARISON?
│  ├─ Two values (before/after)? → ComparisonCard
│  ├─ Multiple items (2-8)? → ComparisonBar
│  └─ NO → Continue below
│
├─ Is it PROGRESS tracking?
│  ├─ Goal/percentage? → GaugeIndicator
│  ├─ Linear progress? → ProgressBar
│  └─ NO → Continue below
│
├─ Is it TIME SERIES?
│  ├─ Many series (3+)? → MultiSparkline
│  ├─ Single series? → Sparkline
│  ├─ Detailed analysis? → ChartBlock
│  └─ NO → Continue below
│
├─ Is it DETAILED ANALYSIS?
│  ├─ Multiple chart types? → ChartBlock
│  ├─ Specific type needed? → ChartBlock
│  └─ Interactive zooming? → ChartBlock
│
└─ DEFAULT: ChartBlock or combine multiple
```

---

## Size & Spacing Reference

```
Component         Default Size      Responsive?   Min Width
──────────────────────────────────────────────────────────
MetricCard        180px wide         Yes           180px
ComparisonCard    220px wide         Yes           220px
GaugeIndicator    120px diameter     Yes (size)    160px container
ProgressBar       Full width         N/A           Full
MultiSparkline    200x40px           Yes           250px container
ChartBlock        Full width         Yes           100%
Sparkline         120x24px           Configurable  Inline
StatCard          120px wide         Yes           120px
ComparisonBar     Full width         Yes           300px+
```

---

## Color Assignments

```
Component           Default Color   Supports Custom?   Use Case
──────────────────────────────────────────────────────────────
MetricCard          Auto (green)    Via positive prop  Trend indication
ComparisonCard      Green/Red       Auto (based on %)  Improvement/decline
GaugeIndicator      Blue (#3b82f6)  Yes               Progress tracking
ProgressBar         Blue (#3b82f6)  Yes               Linear progress
MultiSparkline      Palette auto    Per-series        Multi-metric view
ChartBlock          Palette auto    Per-series        Detailed charts
Sparkline           Blue (#3b82f6)  Yes               Inline trends
StatCard            Auto            N/A               Change indication
ComparisonBar       Palette auto    Per-item          Multi-item compare
```

---

## Animation Characteristics

```
Component           Animation Type    Duration    Trigger
──────────────────────────────────────────────────────────
MetricCard          CSS transition    200ms       Mount/prop change
GaugeIndicator      SVG animate       300ms       Value change
ProgressBar         CSS width         400ms       Value change
MultiSparkline      None              Instant     Immediate
ChartBlock          Recharts native   300-500ms   Data change
Sparkline           None              Instant     Immediate
StatCard            CSS transition    150ms       Mount/change
ComparisonCard      None              Instant     Immediate
ComparisonBar       CSS width         200ms       Item change
```

---

## Props Complexity Levels

```
SIMPLE (Minimal props)
  • StatCard (3 props)
  • ProgressBar (2 required)
  • Sparkline (1 required)

MEDIUM (5-6 props)
  • MetricCard (7 props, 3 required)
  • GaugeIndicator (6 props, 1 required)
  • ComparisonCard (7 props, 3 required)

COMPLEX (Many variations)
  • MultiSparkline (data structure complexity)
  • ChartBlock (flexible spec object)
  • ComparisonBar (item arrays)
```

---

## Data Type Reference

```
Component           Input Format          Output         Calculation
──────────────────────────────────────────────────────────────────────
MetricCard          Number               Display        trend % manual
ComparisonCard      2 numbers            % improvement  Auto (before/after)
GaugeIndicator      1 number (0-max)     Percentage     Automatic
ProgressBar         1 number (0-max)     Percentage     Automatic
MultiSparkline      Array of series      Visual trends  None
ChartBlock          Structured spec      Interactive    None
Sparkline           Array of points      Trend line     None
StatCard            Number + string      Display        Provided
ComparisonBar       Array of items       Bar lengths    Normalized
```

---

## Browser & Feature Support

```
Feature              Chrome  Firefox  Safari  Edge   Fallback
────────────────────────────────────────────────────────────
CSS backdrop-filter  90+     88+      14+     90+    Solid color
SVG circles          All     All      All     All    N/A
CSS transitions      All     All      All     All    Instant
CSS Grid             All     All      All     All    Flexbox
Transform            All     All      All     All    Position
```

---

## Performance Characteristics

```
Component           Render Cost   Memory    Update Speed   Scale Limit
──────────────────────────────────────────────────────────────────────
MetricCard          Very Low      Minimal   <10ms          1000+ cards
ComparisonCard      Very Low      Minimal   <10ms          1000+ cards
GaugeIndicator      Low           Minimal   <20ms (SVG)    500+ gauges
ProgressBar         Very Low      Minimal   <10ms          1000+ bars
MultiSparkline      Low           Low       <50ms          100+ sets
ChartBlock          Medium        Medium    <200ms         10+ charts
Sparkline           Low           Low       <30ms          500+ lines
StatCard            Very Low      Minimal   <10ms          1000+ cards
ComparisonBar       Low           Low       <40ms          200+ bars
```

---

## Accessibility Features

```
Component           Semantic HTML   Color Contrast   Labels    Keyboard
────────────────────────────────────────────────────────────────────────
MetricCard          Div             WCAG AA          Yes       Tab-able
ComparisonCard      Div             WCAG AA          Yes       Tab-able
GaugeIndicator      SVG             WCAG AA          Yes       Read
ProgressBar         Div             WCAG AA          Yes       Read
MultiSparkline      Div+SVG         WCAG AA          Yes       Read
ChartBlock          Div+SVG         WCAG AA          Yes       Read
Sparkline           SVG             WCAG AA          N/A       Read
StatCard            Div             WCAG AA          Yes       Tab-able
ComparisonBar       Div             WCAG AA          Yes       Tab-able
```

---

## Use Case Matrix

```
                   KPI     Compare  Progress  Trend   Detailed
                   Dash    Period   Track     Quick   Analysis
────────────────────────────────────────────────────────────────
MetricCard         ★★★★★  ★☆☆☆☆   ☆☆☆☆☆    ★★★★★  ★★☆☆☆
ComparisonCard     ★★☆☆☆  ★★★★★   ★★☆☆☆    ★★☆☆☆  ★★★☆☆
GaugeIndicator     ★★★★☆  ★★☆☆☆   ★★★★★    ★☆☆☆☆  ★★☆☆☆
ProgressBar        ★★☆☆☆  ★☆☆☆☆   ★★★★★    ☆☆☆☆☆  ★★☆☆☆
MultiSparkline     ★★★★☆  ★★★☆☆   ☆☆☆☆☆    ★★★★☆  ★★★☆☆
ChartBlock         ★★★☆☆  ★★★★☆   ★★☆☆☆    ★★★★★  ★★★★★
Sparkline          ★★☆☆☆  ☆☆☆☆☆   ☆☆☆☆☆    ★★★☆☆  ★★☆☆☆
StatCard           ★★★★☆  ☆☆☆☆☆   ☆☆☆☆☆    ★★★☆☆  ★☆☆☆☆
ComparisonBar      ★★★☆☆  ★★★★☆   ☆☆☆☆☆    ★★☆☆☆  ★★★☆☆

★★★★★ = Excellent  ★★★★☆ = Very Good  ★★★☆☆ = Good  ★★☆☆☆ = Fair  ★☆☆☆☆ = Poor
```

---

## Copy-Paste Template Gallery

### Template 1: KPI Dashboard
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
  <MetricCard label="Revenue" value={45230} unit=" USD" trend={12.5} positive />
  <MetricCard label="Orders" value={1240} trend={8} positive />
  <MetricCard label="ARPU" value={36.5} unit=" USD" trend={2.3} positive />
</div>
```

### Template 2: Comparison View
```tsx
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
  <ComparisonCard label="Revenue" before={45000} after={52500} unit=" USD" />
  <ComparisonCard label="Visitors" before={8400} after={9200} />
  <ComparisonCard label="Conversion" before={3.2} after={3.8} unit="%" />
</div>
```

### Template 3: Goals Dashboard
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
  <GaugeIndicator value={75} label="Q3 Target" color="#3b82f6" />
  <GaugeIndicator value={92} label="Annual" color="#22c55e" />
  <GaugeIndicator value={45} label="Stretch" color="#f59e0b" />
</div>
```

### Template 4: Progress List
```tsx
<div style={{ maxWidth: 400 }}>
  {tasks.map(task => (
    <div key={task.name} style={{ marginBottom: 16 }}>
      <ProgressBar label={task.name} value={task.progress} />
    </div>
  ))}
</div>
```

### Template 5: Stats Overview
```tsx
<MultiSparkline
  data={[
    { label: 'Clicks', values: clickData, color: '#3b82f6' },
    { label: 'Conv', values: convData, color: '#22c55e' },
    { label: 'ROAS', values: roasData, color: '#f59e0b' },
  ]}
  width={160}
/>
```

---

Last updated: 2026-04-04
All components: `/Users/mk/Downloads/nomads/frontend/components/DataViz.tsx`

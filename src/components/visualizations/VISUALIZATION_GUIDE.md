# Advanced Data Visualization System

Complete guide to using the new visualization components in the Ad Agent platform.

## Overview

This system provides 9 visualization components organized into 3 tiers:

- **Tier 1**: Basic charts (LineChart, HeatmapChart, GaugeChart, TimelineChart, FunnelChart)
- **Tier 2**: Advanced networks (NetworkDiagram)
- **Tier 3**: Interactive tools (InteractiveSliders, ExportSystem, BrandingSystem)

## Quick Start

### Installation

All required dependencies are already installed:
- `vis-network` - Network graph visualization
- `html2canvas` - HTML to image conversion
- `pptxgenjs` - PowerPoint generation
- `jspdf` - PDF generation
- `recharts` - Chart library (already in project)

### Basic Usage

```tsx
import { LineChart, HeatmapChart, GaugeChart, TimelineChart, FunnelChart } from '@/components/charts';
import { NetworkDiagram, InteractiveSliders } from '@/components/visualizations';
import { ExportSystem } from '@/components/export';
import { BrandingSystemUI } from '@/components/branding';
```

## Tier 1: Chart Components

### 1. LineChart

Multi-line charts with trend predictions and custom date ranges.

```tsx
<LineChart
  data={[
    { date: '2025-01-01', competitor1: 45, competitor2: 52, us: 40 },
    { date: '2025-01-02', competitor1: 48, competitor2: 50, us: 43 },
  ]}
  lines={[
    { key: 'competitor1', label: 'Competitor A', color: '#ef4444', showTrendline: true },
    { key: 'competitor2', label: 'Competitor B', color: '#f59e0b', showTrendline: true },
    { key: 'us', label: 'Our Campaign', color: '#10b981', showTrendline: true },
  ]}
  title="Competitive Price Tracking"
  xAxisKey="date"
  yAxisLabel="Price ($)"
  showLegend
  predictTrend
  predictionPoints={7}
/>
```

**Features:**
- Multi-line support
- Trend line calculation
- Future prediction
- Custom date ranges
- PNG export
- Dark/light mode

### 2. HeatmapChart

Competitor matrix visualization with color intensity mapping.

```tsx
<HeatmapChart
  data={[
    { x: 'Company A', y: 'Feature 1', value: 85, label: 'Strong' },
    { x: 'Company A', y: 'Feature 2', value: 60, label: 'Moderate' },
    { x: 'Company B', y: 'Feature 1', value: 70, label: 'Strong' },
  ]}
  title="Competitor Feature Matrix"
  minColor="#e0f2fe"
  maxColor="#0c4a6e"
  showValues
  onCellClick={(cell) => console.log('Clicked:', cell)}
/>
```

**Features:**
- Grid-based heatmap
- Color intensity = value
- Interactive tooltips
- Cell click handlers
- Custom color ranges
- PNG export

### 3. GaugeChart

Circular progress gauges for key metrics.

```tsx
<GaugeChart
  value={75}
  min={0}
  max={100}
  title="Market Share %"
  label="Growth Potential"
  size={250}
  zones={[
    { from: 0, to: 33, color: '#ef4444', label: 'Critical' },
    { from: 33, to: 66, color: '#f59e0b', label: 'Warning' },
    { from: 66, to: 100, color: '#10b981', label: 'Optimal' },
  ]}
  animated
  showPercentage
/>
```

**Features:**
- Circular progress display
- Custom color zones
- Animated transitions
- Multiple metrics support
- PNG export

### 4. TimelineChart

Campaign phase visualization with progress tracking.

```tsx
<TimelineChart
  phases={[
    {
      id: 'research',
      label: 'Research Phase',
      status: 'completed',
      startDate: '2025-01-01',
      endDate: '2025-01-15',
      progress: 100,
      description: 'Market research and competitor analysis',
    },
    {
      id: 'objections',
      label: 'Objection Handling',
      status: 'in-progress',
      startDate: '2025-01-15',
      endDate: '2025-01-25',
      progress: 60,
      description: 'Develop customer objection responses',
    },
    {
      id: 'creative',
      label: 'Creative Development',
      status: 'pending',
      startDate: '2025-01-25',
      endDate: '2025-02-10',
      progress: 0,
      description: 'Design ad concepts',
    },
  ]}
  title="Campaign Timeline"
  height={400}
  onPhaseClick={(phase) => console.log('Clicked phase:', phase)}
/>
```

**Features:**
- Horizontal timeline
- Phase status tracking
- Progress indicators
- Hover descriptions
- Color-coded status
- PNG export

### 5. FunnelChart

Conversion funnel with stage analysis.

```tsx
<FunnelChart
  stages={[
    { label: 'Awareness', value: 10000, color: '#3b82f6', description: 'Initial impressions' },
    { label: 'Consideration', value: 6500, color: '#8b5cf6' },
    { label: 'Conversion', value: 2200, color: '#ec4899' },
    { label: 'Retention', value: 1800, color: '#f97316' },
  ]}
  title="Customer Journey Funnel"
  height={500}
  showPercentage
  showDropoff
  onStageClick={(stage, idx) => console.log(`Stage ${idx}:`, stage)}
/>
```

**Features:**
- Trapezoid visualization
- Conversion metrics
- Dropoff percentage
- Stage interactions
- Color gradients
- PNG export

## Tier 2: Advanced Visualizations

### NetworkDiagram

Interactive network graphs with community detection.

```tsx
<NetworkDiagram
  nodes={[
    { id: 'desire1', label: 'Save Time', group: 'desire', value: 15 },
    { id: 'objection1', label: 'Cost Concerns', group: 'objection', value: 10 },
    { id: 'solution1', label: 'Automated Tools', group: 'solution', value: 12 },
  ]}
  edges={[
    { from: 'desire1', to: 'objection1', label: 'creates', value: 5 },
    { from: 'desire1', to: 'solution1', label: 'addresses', value: 8 },
  ]}
  title="Customer Ecosystem Map"
  height={600}
  physics
  hierarchical={false}
  detectCommunities
  onNodeClick={(node) => console.log('Node:', node)}
  onEdgeClick={(edge) => console.log('Connection:', edge)}
/>
```

**Features:**
- Interactive pan/zoom
- Physics simulation
- Community detection with colors
- Node/edge clicking
- Hierarchical layout option
- PNG export
- FIT view button

## Tier 3: Interactive & Export Tools

### InteractiveSliders

Budget allocation and campaign planning sliders.

```tsx
<InteractiveSliders
  initialState={{
    tamEstimate: 50000000,
    budgetAllocation: {
      'Paid Search': 40,
      'Social Media': 30,
      'Email': 15,
      'Content': 10,
      'Partnerships': 5,
    },
    campaignDuration: 90,
  }}
  channels={['Paid Search', 'Social Media', 'Email', 'Content', 'Partnerships']}
  showPercentages
  onStateChange={(state) => {
    console.log('Campaign state updated:', state);
    // Update dependent charts
  }}
/>
```

**Features:**
- TAM estimation slider
- Budget allocation by channel
- Campaign duration planning
- Real-time metric calculations
- Percentage verification
- Projected reach calculation

### ExportSystem

Multi-format export for all charts and data.

```tsx
<ExportSystem
  config={{
    title: 'Campaign Analysis Report',
    description: 'Q1 2025 Performance Review',
    charts: [
      { element: chartRef1.current, title: 'Competitive Positioning' },
      { element: chartRef2.current, title: 'Budget Allocation' },
    ],
    data: [
      { date: '2025-01-01', revenue: 50000, roi: 2.5 },
      { date: '2025-01-02', revenue: 55000, roi: 2.7 },
    ],
    includeTimestamp: true,
    logo: logoImageDataUrl,
  }}
  onExportStart={() => console.log('Export started')}
  onExportComplete={(format) => console.log(`Exported as ${format}`)}
  onExportError={(error) => console.error('Export failed:', error)}
/>
```

**Export Formats:**
- **PNG**: Single chart image (300 DPI)
- **PDF**: Multi-chart document with branding
- **PowerPoint**: Presentation slides (one per chart)
- **CSV**: Raw data for spreadsheets
- **JSON**: Structured data export
- **Batch**: Export all formats at once

**Features:**
- Format selection grid
- Progress indicators
- Batch export option
- Logo support
- Timestamp inclusion
- Branding integration

### BrandingSystemUI

Customize colors, fonts, and branding.

```tsx
<BrandingSystemUI
  config={{
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      background: '#ffffff',
      text: '#000000',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: { small: 12, base: 14, large: 16, xl: 24 },
    borderRadius: 8,
    companyName: 'Acme Corp',
    companyUrl: 'https://acme.com',
  }}
  onConfigChange={(config) => {
    console.log('Brand updated:', config);
    applyBrandingToCharts(config);
  }}
/>
```

**Features:**
- Color palette editor
- Logo upload
- Font family selection
- Border radius customization
- Company information
- Live preview
- Auto-apply to all charts

## Advanced Patterns

### Integrated Dashboard

```tsx
function CampaignDashboard() {
  const [brandConfig, setBrandConfig] = useState(defaultBranding);
  const [sliderState, setSliderState] = useState(initialSliderState);
  const chartRefs = useRef({});

  return (
    <BrandingProvider initialConfig={brandConfig}>
      <div style={{ display: 'grid', gap: 24, padding: 24 }}>
        {/* Branding Control */}
        <BrandingSystemUI onConfigChange={setBrandConfig} />

        {/* Planning */}
        <InteractiveSliders onStateChange={setSliderState} />

        {/* Visualizations */}
        <div ref={(el) => chartRefs.current.line = el}>
          <LineChart {...lineChartProps} />
        </div>

        <div ref={(el) => chartRefs.current.heatmap = el}>
          <HeatmapChart {...heatmapProps} />
        </div>

        <div ref={(el) => chartRefs.current.funnel = el}>
          <FunnelChart {...funnelProps} />
        </div>

        {/* Network Analysis */}
        <div ref={(el) => chartRefs.current.network = el}>
          <NetworkDiagram {...networkProps} />
        </div>

        {/* Export All */}
        <ExportSystem
          config={{
            title: 'Campaign Report',
            charts: Object.entries(chartRefs.current).map(([name, ref]) => ({
              element: ref,
              title: name,
            })),
            data: campaignData,
          }}
        />
      </div>
    </BrandingProvider>
  );
}
```

### Real-Time Updates

Charts support real-time data updates:

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    // Fetch new data
    setChartData(prev => [...prev, newDataPoint]);
  }, 5000);

  return () => clearInterval(interval);
}, []);

// Charts will re-render automatically with new data
<LineChart data={chartData} {...props} />
```

### Custom Styling

Apply custom CSS classes for advanced styling:

```tsx
// charts.css
.chart-container.custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

// React component
<div className="chart-container custom">
  <LineChart {...props} />
</div>
```

## Performance Optimization

### Memoization

```tsx
const MemoizedLineChart = React.memo(LineChart, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.lines === next.lines &&
    prev.title === next.title
  );
});
```

### Large Datasets

For datasets with 1000+ points:
1. Use data aggregation/sampling
2. Enable virtual scrolling
3. Consider timeline-based filtering
4. Use `requestAnimationFrame` for updates

```tsx
const aggregateData = (data: any[], points: number) => {
  const step = Math.ceil(data.length / points);
  return data.filter((_, i) => i % step === 0);
};
```

## Accessibility

All components include:
- WCAG AA color contrast compliance
- Keyboard navigation support
- Screen reader labels
- Focus indicators
- Semantic HTML

```tsx
<LineChart
  role="img"
  aria-label="Competitive pricing trends over time"
  {...props}
/>
```

## Troubleshooting

### Charts not rendering
- Check data format matches component spec
- Verify colors are valid hex/rgb
- Ensure ref is properly set for export

### Export issues
- Ensure element is visible in DOM
- Check browser console for errors
- Verify file-saver library is loaded

### Network diagram layout
- Reduce node count for better performance
- Increase physics iterations for stability
- Use hierarchical layout for tree-like structures

## File Structure

```
src/components/
├── charts/
│   ├── LineChart.tsx
│   ├── HeatmapChart.tsx
│   ├── GaugeChart.tsx
│   ├── TimelineChart.tsx
│   ├── FunnelChart.tsx
│   ├── charts.css
│   └── index.ts
├── visualizations/
│   ├── NetworkDiagram.tsx
│   ├── InteractiveSliders.tsx
│   ├── networks.css
│   └── index.ts
├── export/
│   ├── ExportSystem.tsx
│   └── index.ts
└── branding/
    ├── BrandingSystem.tsx
    └── index.ts

src/utils/
└── exportUtils.ts
```

## API Reference

See individual component files for complete TypeScript interfaces and props documentation.

## Support

For issues or feature requests, refer to the project's issue tracker or documentation.

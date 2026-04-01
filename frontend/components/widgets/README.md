# Nomads Widget Library

Base44-style card components for rich agent output visualization.

## Usage

### In Agent Output

Agents output markdown with embedded widget blocks:

```markdown
# Competitor Analysis

## Market Position

```widget
{
  "type": "competitor-card",
  "name": "Figma",
  "logo": "https://...",
  "positioning": "All-in-one design platform",
  "status": "leader",
  "metrics": [
    {"label": "Annual Growth", "value": "42%", "change": 18},
    {"label": "Market Share", "value": "$12.2B", "change": 8}
  ]
}
```

## Component Categories

### Phase 1 (Core)
- ✅ CompetitorCard — competitor intelligence
- ✅ MetricsCard — single metric display
- 🔲 ResearchFinding — research insight with source
- 🔲 HeroCard — featured highlight card
- 🔲 CalloutCard — info/warning/error callouts
- 🔲 StatGrid — 2-4 stat cards in grid
- 🔲 Checklist — interactive todo list
- 🔲 Timeline — event timeline
- 🔲 TwitterPreview — tweet simulation
- 🔲 LinkedInPreview — LinkedIn post simulation
- 🔲 ReviewCard — customer review display
- 🔲 DataTable — sortable, filterable table

### Phase 2 (Ad-Tech Specific)
- 🔲 AdCreativePreview — ad mockup
- 🔲 AudienceCard — audience demographics
- 🔲 SWOTCard — SWOT analysis matrix
- 🔲 PricingComparison — pricing tiers comparison
- 🔲 TrendAnalysis — trending topic card
- 🔲 CopyVariation — A/B copy variants

### Phase 3 (Advanced)
- 🔲 PerformanceChart — line/bar/area charts
- 🔲 EmailTemplate — email preview
- 🔲 BudgetAllocation — budget breakdown
- 🔲 (And 15+ more specialized widgets)

## Architecture

```
WidgetFactory.tsx
├─ parseWidgetsFromMarkdown() — Extract widgets from markdown
├─ WidgetRenderer() — Route widget to component
└─ MarkdownWithWidgets() — Render markdown + widgets

Widget Components
├─ cards/ — Card-style components
├─ tables/ — Table components
└─ charts/ — Chart components
```

## Styling

All widgets use:
- **Glassmorphism** — frosted glass effect with backdrop blur
- **Gradients** — color-coded by category
- **Dark theme** — slate-900/950 backgrounds
- **Responsive** — mobile-friendly
- **Hover states** — interactive feedback

## Example: Adding a New Widget

1. Create type in `types.ts`
2. Create component in appropriate folder
3. Export from folder's `index.ts`
4. Add case to `WidgetFactory.tsx`
5. Document in this README

## Widget Output Format

All widgets are JSON with:
```typescript
{
  "type": "widget-name",      // required
  "id"?: "unique-id",         // optional
  "className"?: "extra-css",  // optional
  // ... type-specific fields
}
```

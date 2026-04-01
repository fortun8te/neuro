/**
 * Widget Type System — Nomads Card/Component Library
 * Inspired by Base44, tailored for ad-tech research
 */

// ── Base Widget Interface ──
export interface BaseWidget {
  id?: string
  type: string
  className?: string
}

// ── COMPETITOR WIDGETS ──
export interface CompetitorCardData extends BaseWidget {
  type: 'competitor-card'
  name: string
  logo?: string
  positioning: string
  status?: 'leader' | 'challenger' | 'emerging'
  metrics?: Array<{
    label: string
    value: string | number
    change?: number // percentage
  }>
}

export interface SWOTCardData extends BaseWidget {
  type: 'swot-card'
  title?: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

export interface PricingComparisonData extends BaseWidget {
  type: 'pricing-comparison'
  title?: string
  competitors: Array<{
    name: string
    logo?: string
    tiers: Array<{
      name: string
      price: string | number
      features: string[]
    }>
  }>
}

// ── METRICS & PERFORMANCE ──
export interface MetricsCardData extends BaseWidget {
  type: 'metrics-card'
  label: string
  value: string | number
  unit?: string
  change?: {
    value: number
    percentage: number
    direction: 'up' | 'down' | 'neutral'
  }
  context?: string
  icon?: string
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
}

export interface PerformanceChartData extends BaseWidget {
  type: 'performance-chart'
  title: string
  subtype: 'line' | 'bar' | 'area'
  xAxis: string[]
  series: Array<{
    name: string
    data: number[]
    color?: string
  }>
  yAxisLabel?: string
}

export interface AdCreativePreviewData extends BaseWidget {
  type: 'ad-creative-preview'
  platform: 'facebook' | 'google' | 'linkedin' | 'instagram' | 'tiktok'
  headline: string
  description: string
  image?: string
  cta?: string
  estimatedEngagement?: number
}

export interface AudienceCardData extends BaseWidget {
  type: 'audience-card'
  title?: string
  demographics: {
    ageRange?: string
    gender?: string
    location?: string[]
    income?: string
  }
  interests?: string[]
  behaviors?: string[]
  size?: number
}

// ── RESEARCH & DATA ──
export interface ResearchFindingData extends BaseWidget {
  type: 'research-finding'
  title: string
  insight: string
  details?: string[]
  source?: {
    url: string
    title: string
    author?: string
    date?: string
  }
  confidence?: 'low' | 'medium' | 'high'
  tags?: string[]
}

export interface SourceCardData extends BaseWidget {
  type: 'source-card'
  title: string
  url: string
  author?: string
  date?: string
  excerpt?: string
  domain?: string
}

export interface TrendAnalysisData extends BaseWidget {
  type: 'trend-analysis'
  topic: string
  direction: 'up' | 'down' | 'stable'
  timeframe: string
  volume?: number
  engagement?: number
  relatedTrends?: string[]
}

export interface KeywordCloudData extends BaseWidget {
  type: 'keyword-cloud'
  keywords: Array<{
    text: string
    size: number // relative size 1-10
    opportunity?: 'high' | 'medium' | 'low'
    volume?: number
  }>
}

// ── CHARTS ──
export interface ChartData extends BaseWidget {
  type: 'chart'
  subtype: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'funnel' | 'gauge'
  title?: string
  subtitle?: string
  xAxisLabel?: string
  yAxisLabel?: string
  data: any // flexible based on chart type
}

// ── TABLES ──
export interface DataTableData extends BaseWidget {
  type: 'data-table'
  title?: string
  columns: Array<{
    key: string
    label: string
    sortable?: boolean
    width?: string
  }>
  rows: Record<string, any>[]
  exportable?: boolean
}

export interface FeatureComparisonData extends BaseWidget {
  type: 'feature-comparison'
  title?: string
  features: string[]
  products: Array<{
    name: string
    logo?: string
    values: (boolean | string | number)[]
  }>
}

// ── CARDS & CONTENT ──
export interface HeroCardData extends BaseWidget {
  type: 'hero-card'
  title: string
  subtitle?: string
  description?: string
  image?: string
  gradient?: 'blue' | 'orange' | 'green' | 'purple' | 'pink'
  cta?: {
    label: string
    action: string
  }
}

export interface CalloutCardData extends BaseWidget {
  type: 'callout-card'
  variant: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  icon?: string
  action?: {
    label: string
    action: string
  }
}

export interface StatGridData extends BaseWidget {
  type: 'stat-grid'
  stats: Array<{
    label: string
    value: string | number
    change?: number
    icon?: string
    color?: string
  }>
  columns?: number // 2, 3, or 4
}

// ── LISTS ──
export interface ChecklistData extends BaseWidget {
  type: 'checklist'
  title?: string
  items: Array<{
    id: string
    label: string
    completed: boolean
  }>
  interactive?: boolean
}

export interface TimelineData extends BaseWidget {
  type: 'timeline'
  direction?: 'vertical' | 'horizontal'
  events: Array<{
    date: string
    title: string
    description?: string
    icon?: string
  }>
}

// ── SOCIAL MEDIA ──
export interface TwitterPreviewData extends BaseWidget {
  type: 'twitter-preview'
  author: string
  handle: string
  avatar?: string
  text: string
  image?: string
  likes?: number
  retweets?: number
  replies?: number
  timestamp?: string
}

export interface LinkedInPreviewData extends BaseWidget {
  type: 'linkedin-preview'
  author: string
  title?: string
  avatar?: string
  content: string
  image?: string
  likes?: number
  comments?: number
  shares?: number
}

export interface ReviewCardData extends BaseWidget {
  type: 'review-card'
  author: string
  rating: number // 1-5
  title?: string
  text: string
  date?: string
  platform?: string
}

// ── COPY & CREATIVE ──
export interface CopyVariationData extends BaseWidget {
  type: 'copy-variation'
  title?: string
  variations: Array<{
    id: string
    text: string
    estimatedCTR?: number
    sentiment?: 'positive' | 'neutral' | 'negative'
    wordCount?: number
  }>
  winner?: string // id of best performer
}

export interface EmailTemplateData extends BaseWidget {
  type: 'email-template'
  subject: string
  preheader?: string
  body: string
  cta?: {
    text: string
    url: string
  }
  footer?: string
}

// ── STRATEGY ──
export interface FunnelData extends BaseWidget {
  type: 'funnel'
  stages: Array<{
    name: string
    value: number
    description?: string
  }>
}

export interface CustomerJourneyData extends BaseWidget {
  type: 'customer-journey'
  stages: Array<{
    name: string
    description: string
    touchpoints: string[]
    painPoints?: string[]
    opportunities?: string[]
  }>
}

export interface BudgetAllocationData extends BaseWidget {
  type: 'budget-allocation'
  total: number
  channels: Array<{
    name: string
    amount: number
    roi?: number
    recommendation?: string
  }>
}

// ── Union Type ──
export type Widget =
  | CompetitorCardData
  | SWOTCardData
  | PricingComparisonData
  | MetricsCardData
  | PerformanceChartData
  | AdCreativePreviewData
  | AudienceCardData
  | ResearchFindingData
  | SourceCardData
  | TrendAnalysisData
  | KeywordCloudData
  | ChartData
  | DataTableData
  | FeatureComparisonData
  | HeroCardData
  | CalloutCardData
  | StatGridData
  | ChecklistData
  | TimelineData
  | TwitterPreviewData
  | LinkedInPreviewData
  | ReviewCardData
  | CopyVariationData
  | EmailTemplateData
  | FunnelData
  | CustomerJourneyData
  | BudgetAllocationData

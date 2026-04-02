/**
 * Widget Factory — Renders any widget type
 * Maps widget data to React components
 */

import React from 'react'
import DOMPurify from 'dompurify'
import type { Widget } from './types'

// Import all widget components
import { CompetitorCard } from './cards/CompetitorCard'
import { SWOTCard } from './cards/SWOTCard'
import { MetricsCard } from './cards/MetricsCard'
import { ResearchFinding } from './cards/ResearchFinding'
import { HeroCard } from './cards/HeroCard'
import { CalloutCard } from './cards/CalloutCard'
import { StatGrid } from './cards/StatGrid'
import { Checklist } from './cards/Checklist'
import { Timeline } from './cards/Timeline'
import { TwitterPreview } from './cards/TwitterPreview'
import { LinkedInPreview } from './cards/LinkedInPreview'
import { ReviewCard } from './cards/ReviewCard'
import { AdCreativePreview } from './cards/AdCreativePreview'
import { PerformanceChart } from './charts/PerformanceChart'
import { DataTable } from './tables/DataTable'
import { PricingComparison } from './cards/PricingComparison'
import { AudienceCard } from './cards/AudienceCard'
import { TrendAnalysis } from './cards/TrendAnalysis'
import { CopyVariation } from './cards/CopyVariation'
import { EmailTemplate } from './cards/EmailTemplate'
import { BudgetAllocation } from './cards/BudgetAllocation'

interface WidgetRendererProps {
  widget: Widget
  className?: string
}

/**
 * Main widget renderer — maps widget types to components
 */
export function WidgetRenderer({ widget, className = '' }: WidgetRendererProps) {
  const containerClass = `widget-container ${className}`

  try {
    switch (widget.type) {
      // Competitor & Strategy
      case 'competitor-card':
        return (
          <div className={containerClass}>
            <CompetitorCard data={widget as any} />
          </div>
        )
      case 'swot-card':
        return (
          <div className={containerClass}>
            <SWOTCard data={widget as any} />
          </div>
        )
      case 'pricing-comparison':
        return (
          <div className={containerClass}>
            <PricingComparison data={widget as any} />
          </div>
        )

      // Metrics & Performance
      case 'metrics-card':
        return (
          <div className={containerClass}>
            <MetricsCard data={widget as any} />
          </div>
        )
      case 'performance-chart':
        return (
          <div className={containerClass}>
            <PerformanceChart data={widget as any} />
          </div>
        )
      case 'ad-creative-preview':
        return (
          <div className={containerClass}>
            <AdCreativePreview data={widget as any} />
          </div>
        )
      case 'audience-card':
        return (
          <div className={containerClass}>
            <AudienceCard data={widget as any} />
          </div>
        )

      // Research & Data
      case 'research-finding':
        return (
          <div className={containerClass}>
            <ResearchFinding data={widget as any} />
          </div>
        )
      case 'trend-analysis':
        return (
          <div className={containerClass}>
            <TrendAnalysis data={widget as any} />
          </div>
        )
      case 'data-table':
        return (
          <div className={containerClass}>
            <DataTable data={widget as any} />
          </div>
        )

      // Content Cards
      case 'hero-card':
        return (
          <div className={containerClass}>
            <HeroCard data={widget as any} />
          </div>
        )
      case 'callout-card':
        return (
          <div className={containerClass}>
            <CalloutCard data={widget as any} />
          </div>
        )
      case 'stat-grid':
        return (
          <div className={containerClass}>
            <StatGrid data={widget as any} />
          </div>
        )

      // Interactive
      case 'checklist':
        return (
          <div className={containerClass}>
            <Checklist data={widget as any} />
          </div>
        )
      case 'timeline':
        return (
          <div className={containerClass}>
            <Timeline data={widget as any} />
          </div>
        )

      // Social Media
      case 'twitter-preview':
        return (
          <div className={containerClass}>
            <TwitterPreview data={widget as any} />
          </div>
        )
      case 'linkedin-preview':
        return (
          <div className={containerClass}>
            <LinkedInPreview data={widget as any} />
          </div>
        )
      case 'review-card':
        return (
          <div className={containerClass}>
            <ReviewCard data={widget as any} />
          </div>
        )

      // Copy & Creative
      case 'copy-variation':
        return (
          <div className={containerClass}>
            <CopyVariation data={widget as any} />
          </div>
        )
      case 'email-template':
        return (
          <div className={containerClass}>
            <EmailTemplate data={widget as any} />
          </div>
        )

      // Budget
      case 'budget-allocation':
        return (
          <div className={containerClass}>
            <BudgetAllocation data={widget as any} />
          </div>
        )

      default:
        return (
          <div className={`${containerClass} bg-red-50 border border-red-200 p-4 rounded`}>
            <p className="text-red-600">Unknown widget type: {widget.type}</p>
          </div>
        )
    }
  } catch (error) {
    return (
      <div className={`${containerClass} bg-red-50 border border-red-200 p-4 rounded`}>
        <p className="text-red-600">Error rendering widget: {String(error)}</p>
      </div>
    )
  }
}

/**
 * Parse markdown with embedded widget blocks
 * ```widget { "type": "...", "data": {...} } ```
 */
export function parseWidgetsFromMarkdown(markdown: string): (string | Widget)[] {
  const widgetRegex = /```widget\n([\s\S]*?)\n```/g
  const parts: (string | Widget)[] = []
  let lastIndex = 0

  let match
  while ((match = widgetRegex.exec(markdown)) !== null) {
    // Add text before widget
    if (match.index > lastIndex) {
      parts.push(markdown.substring(lastIndex, match.index))
    }

    // Parse and add widget
    try {
      const widgetData = JSON.parse(match[1])
      parts.push(widgetData as Widget)
    } catch (e) {
      console.warn('Failed to parse widget:', match[1], e)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < markdown.length) {
    parts.push(markdown.substring(lastIndex))
  }

  return parts
}

/**
 * Render markdown with embedded widgets
 */
export function MarkdownWithWidgets({ content }: { content: string }) {
  const parts = parseWidgetsFromMarkdown(content)

  return (
    <div className="prose prose-sm max-w-none space-y-4">
      {parts.map((part, idx) => {
        if (typeof part === 'string') {
          return (
            <div key={idx} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(part) }} />
          )
        } else {
          return <WidgetRenderer key={idx} widget={part} />
        }
      })}
    </div>
  )
}

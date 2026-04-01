/**
 * SourcesList — Displays sources with favicons, domains, and titles
 *
 * Props:
 *   - sources: Array of { url, title, domain, snippet? }
 *   - maxVisible?: Number of sources to show before collapsing (default: 3)
 *   - variant?: 'inline' | 'sidebar' | 'modal' (default: 'inline')
 *   - groupByDomain?: Group sources by domain (default: false)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown } from 'lucide-react';
import type { Source } from '../utils/sourceExtractor';

interface SourcesListProps {
  sources: Source[];
  maxVisible?: number;
  variant?: 'inline' | 'sidebar' | 'modal';
  groupByDomain?: boolean;
  compact?: boolean;
}

const DEFAULT_FAVICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23999"/></svg>';

/**
 * Fetch favicon from domain, with fallback to default
 * Uses a simple favicon service to avoid CORS issues
 */
function getFaviconUrl(domain: string): string {
  // Extract root domain (e.g., example.com from www.example.com)
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
  // Use DuckDuckGo's favicon service (reliable, no CORS issues)
  return `https://icons.duckduckgo.com/ip3/${rootDomain}.ico`;
}

/**
 * Extract domain name from URL (e.g., "example.com" from "https://example.com/path")
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname || url;
  } catch {
    return url;
  }
}

/**
 * Get display name for domain (remove www prefix)
 */
function getDomainDisplay(domain: string): string {
  return domain.replace(/^www\./, '');
}

/**
 * Single source item
 */
function SourceItem({ source, index }: { source: Source; index: number }) {
  const [faviconError, setFaviconError] = useState(false);
  const faviconUrl = !faviconError ? getFaviconUrl(source.domain) : DEFAULT_FAVICON;
  const domainDisplay = getDomainDisplay(source.domain);
  const title = source.title || source.domain;

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Favicon */}
      <div className="flex-shrink-0 w-5 h-5 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
        <img
          src={faviconUrl}
          alt={source.domain}
          className="w-full h-full object-cover"
          onError={() => setFaviconError(true)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {index + 1}. {domainDisplay}
            </p>
            <p className="text-sm text-slate-900 dark:text-white truncate leading-snug">
              {title}
            </p>
            {source.snippet && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                {source.snippet}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* External link icon */}
      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex-shrink-0 mt-0.5" />
    </motion.a>
  );
}

/**
 * Main SourcesList component
 */
export function SourcesList({
  sources,
  maxVisible = 3,
  variant = 'inline',
  groupByDomain = false,
  compact = false,
}: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'modal' || sources.length <= maxVisible);

  if (!sources || sources.length === 0) {
    return null;
  }

  // Normalize sources to ensure domain is set
  const normalizedSources = sources.map(s => ({
    ...s,
    domain: s.domain || extractDomain(s.url),
  }));

  // Sort by domain if grouping
  let displaySources = normalizedSources;
  if (groupByDomain) {
    displaySources = [...normalizedSources].sort((a, b) =>
      a.domain.localeCompare(b.domain),
    );
  }

  const visibleCount = isExpanded ? displaySources.length : Math.min(maxVisible, displaySources.length);
  const hiddenCount = displaySources.length - visibleCount;

  const containerClasses = {
    inline: 'w-full space-y-2',
    sidebar: 'w-64 space-y-1.5',
    modal: 'w-full max-w-2xl space-y-2',
  };

  const headerClasses = {
    inline: 'text-sm font-semibold text-slate-900 dark:text-white',
    sidebar: 'text-xs font-semibold text-slate-700 dark:text-slate-300',
    modal: 'text-base font-semibold text-slate-900 dark:text-white',
  };

  return (
    <div className={containerClasses[variant]}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={headerClasses[variant]}>
          Sources ({displaySources.length})
        </h3>
        {hiddenCount > 0 && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            +{hiddenCount} more
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Sources grid/list */}
      <AnimatePresence>
        <motion.div
          className={
            compact
              ? 'space-y-1'
              : variant === 'sidebar'
              ? 'space-y-1'
              : 'space-y-2'
          }
          layout
        >
          {displaySources.slice(0, visibleCount).map((source, idx) => (
            <motion.div
              key={source.url}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: idx * 0.05 }}
            >
              <SourceItem source={source} index={idx} />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Collapse button */}
      {isExpanded && hiddenCount === 0 && displaySources.length > maxVisible && (
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors mt-1"
        >
          Show less
          <ChevronDown className="w-3 h-3 rotate-180" />
        </button>
      )}
    </div>
  );
}

export default SourcesList;

/**
 * SourceFooter — Compact source display at message bottom
 *
 * Shows sources as small inline badges:
 * - Gray text, minimal padding
 * - Right-aligned or inline
 * - Displays only domain names with favicon
 * - Links to full URL on click
 */

import { useState } from 'react';
import type { Source } from '../utils/sourceExtractor';
import { useTheme } from '../context/ThemeContext';

interface SourceFooterProps {
  sources: Source[];
  isDarkMode?: boolean;
  variant?: 'inline' | 'stacked';
}

function getFaviconUrl(domain: string): string {
  // Extract root domain
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
  return `https://icons.duckduckgo.com/ip3/${rootDomain}.ico`;
}

function getDomainDisplay(domain: string): string {
  return domain.replace(/^www\./, '');
}

export function SourceFooter({ sources, isDarkMode: propDarkMode, variant = 'inline' }: SourceFooterProps) {
  const { isDarkMode: themeDarkMode } = useTheme();
  const isDark = propDarkMode !== undefined ? propDarkMode : themeDarkMode;
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());

  if (!sources || sources.length === 0) {
    return null;
  }

  // Deduplicate by domain
  const uniqueDomains = Array.from(
    sources.reduce((map, src) => {
      if (!map.has(src.domain)) {
        map.set(src.domain, src);
      }
      return map;
    }, new Map<string, Source>())
    .values()
  );

  const handleFaviconError = (domain: string) => {
    setFaviconErrors(prev => new Set(prev).add(domain));
  };

  const baseTextColor = isDark ? 'rgba(113, 113, 122, 1)' : 'rgba(161, 161, 170, 1)';
  const containerBg = isDark ? 'rgba(0, 0, 0, 0)' : 'rgba(0, 0, 0, 0)';

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 6,
        borderTop: isDark ? '1px solid rgba(113, 113, 122, 0.2)' : '1px solid rgba(209, 213, 219, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        background: containerBg,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: baseTextColor,
          fontWeight: 500,
          letterSpacing: 0.3,
        }}
      >
        SOURCES
      </span>

      {uniqueDomains.map((source, idx) => {
        const domain = getDomainDisplay(source.domain);
        const hasFaviconError = faviconErrors.has(source.domain);

        return (
          <a
            key={`${source.domain}-${idx}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 6px',
              borderRadius: 4,
              background: isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(229, 231, 235, 0.5)',
              border: isDark ? '1px solid rgba(113, 113, 122, 0.3)' : '1px solid rgba(209, 213, 219, 0.4)',
              fontSize: 10,
              color: baseTextColor,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = isDark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(229, 231, 235, 0.8)';
              el.style.borderColor = isDark ? 'rgba(113, 113, 122, 0.5)' : 'rgba(209, 213, 219, 0.6)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(229, 231, 235, 0.5)';
              el.style.borderColor = isDark ? '1px solid rgba(113, 113, 122, 0.3)' : '1px solid rgba(209, 213, 219, 0.4)';
            }}
          >
            {/* Favicon */}
            {!hasFaviconError && (
              <img
                src={getFaviconUrl(source.domain)}
                alt=""
                width={10}
                height={10}
                style={{
                  borderRadius: 2,
                  flexShrink: 0,
                }}
                onError={() => handleFaviconError(source.domain)}
              />
            )}
            {/* Domain */}
            <span style={{ fontSize: 9, fontWeight: 500 }}>
              {domain}
            </span>
          </a>
        );
      })}
    </div>
  );
}

export default SourceFooter;

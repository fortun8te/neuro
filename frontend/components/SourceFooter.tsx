/**
 * SourceFooter — Compact inline source chips at message bottom
 *
 * Shows cited sources as a wrapping row of small pills:
 * [N] domain.com  [N] domain.com  +3 more
 */

import type { Source } from '../utils/sourceExtractor';
import { useTheme } from '../context/ThemeContext';

type SourceMap = Map<number, { title: string; url: string }>;

interface SourceFooterProps {
  sources: Source[];
  sourceMap?: SourceMap;
  isDarkMode?: boolean;
  variant?: 'inline' | 'stacked';
}

const MAX_CHIPS = 8;

function getFaviconUrl(domain: string): string {
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
  return `https://icons.duckduckgo.com/ip3/${rootDomain}.ico`;
}

export function SourceFooter({ sources, sourceMap, isDarkMode: propDarkMode }: SourceFooterProps) {
  const { isDarkMode: themeDarkMode } = useTheme();
  const isDark = propDarkMode !== undefined ? propDarkMode : themeDarkMode;

  if (!sources || sources.length === 0) return null;

  // Deduplicate by URL
  const uniqueSources = Array.from(
    sources.reduce((map, src) => {
      if (!map.has(src.url)) map.set(src.url, src);
      return map;
    }, new Map<string, Source>()).values()
  );

  const visible = uniqueSources.slice(0, MAX_CHIPS);
  const overflow = uniqueSources.length - visible.length;

  const chipBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const numColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';

  // Build a reverse url→number map from sourceMap for numbering
  const urlToNum = new Map<string, number>();
  if (sourceMap) {
    sourceMap.forEach((src, num) => {
      urlToNum.set(src.url, num);
    });
  }

  return (
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 6px',
        alignItems: 'center',
      }}
    >
      {visible.map((source, idx) => {
        const num = urlToNum.get(source.url) ?? (idx + 1);
        let domain = source.domain || source.url;
        try { domain = new URL(source.url).hostname.replace(/^www\./, ''); } catch { /* keep */ }

        return (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title || domain}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px 2px 5px',
              borderRadius: 5,
              background: chipBg,
              border: `1px solid ${chipBorder}`,
              textDecoration: 'none',
              transition: 'background 0.1s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = chipBg; }}
          >
            {/* Citation number */}
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: numColor,
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1,
              }}
            >
              [{num}]
            </span>

            {/* Tiny favicon */}
            <img
              src={getFaviconUrl(domain)}
              alt=""
              width={9}
              height={9}
              style={{ borderRadius: 2, flexShrink: 0, opacity: 0.65 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />

            {/* Domain */}
            <span
              style={{
                fontSize: 10,
                color: textColor,
                fontFamily: 'system-ui, sans-serif',
                whiteSpace: 'nowrap',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {domain}
            </span>
          </a>
        );
      })}

      {overflow > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: 5,
            background: chipBg,
            border: `1px solid ${chipBorder}`,
            fontSize: 10,
            color: numColor,
            fontFamily: 'system-ui, sans-serif',
            flexShrink: 0,
          }}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}

export default SourceFooter;

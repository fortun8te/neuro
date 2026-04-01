/**
 * SourcePreview — Hover tooltip for inline source citations
 *
 * Shows a card with favicon, domain, title, and snippet when hovering
 * over a source chip/pill in chat messages. Similar to search engine
 * link previews.
 */

import { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

interface SourcePreviewProps {
  url: string;
  title?: string;
  snippet?: string;
  children: React.ReactNode;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

export function SourcePreview({ url, title, snippet, children }: SourcePreviewProps) {
  const { isDarkMode } = useTheme();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<'above' | 'below'>('below');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const domain = getDomain(url);
  const displayTitle = title || domain;

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => {
      // Check if tooltip would overflow below viewport
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPos(rect.bottom + 160 > window.innerHeight ? 'above' : 'below');
      }
      setShow(true);
    }, 200); // 200ms delay to avoid flicker
  };

  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const bg = isDarkMode ? '#1e1e2e' : '#ffffff';
  const border = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {children}

      {show && (
        <div
          ref={tooltipRef}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={handleLeave}
          style={{
            position: 'absolute',
            left: 0,
            [pos === 'above' ? 'bottom' : 'top']: '100%',
            marginTop: pos === 'below' ? 6 : 0,
            marginBottom: pos === 'above' ? 6 : 0,
            zIndex: 9999,
            width: 320,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 10,
            boxShadow: isDarkMode
              ? '0 8px 24px rgba(0,0,0,0.5)'
              : '0 8px 24px rgba(0,0,0,0.12)',
            padding: '12px 14px',
            fontFamily: FONT_FAMILY,
            pointerEvents: 'auto',
          }}
        >
          {/* Domain row with favicon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <img
              src={getFaviconUrl(domain)}
              alt=""
              width={14}
              height={14}
              style={{ borderRadius: 3 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span style={{ fontSize: 12, color: textSecondary, fontWeight: 500 }}>
              {domain}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, lineHeight: 1.3, marginBottom: snippet ? 6 : 0 }}>
            {displayTitle}
          </div>

          {/* Snippet */}
          {snippet && (
            <div style={{
              fontSize: 12,
              color: textSecondary,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {snippet}
            </div>
          )}

          {/* Open link */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: isDarkMode ? '#60a5fa' : '#2563eb',
              marginTop: 8,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} />
            Open
          </a>
        </div>
      )}
    </span>
  );
}

/**
 * SourceChip — Inline pill for source citations
 * Renders as a small colored pill: [favicon domain]
 * Shows SourcePreview tooltip on hover
 */
export function SourceChip({ url, title, snippet }: { url: string; title?: string; snippet?: string }) {
  const { isDarkMode } = useTheme();
  const domain = getDomain(url);

  return (
    <SourcePreview url={url} title={title} snippet={snippet}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          background: isDarkMode ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.08)',
          border: `1px solid ${isDarkMode ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.15)'}`,
          fontSize: 11,
          fontWeight: 500,
          color: isDarkMode ? '#93bbfc' : '#2563eb',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
          verticalAlign: 'middle',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDarkMode ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDarkMode ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.08)';
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={getFaviconUrl(domain)}
          alt=""
          width={12}
          height={12}
          style={{ borderRadius: 2 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {domain}
      </a>
    </SourcePreview>
  );
}

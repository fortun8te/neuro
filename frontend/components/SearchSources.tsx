import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FaviconCircle } from './FaviconCircle';

interface Source {
  index: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface SearchSourcesProps {
  resultText: string;
}

/**
 * Parse web_search result text into sources and extracted content.
 * Expected format:
 * [web_search] Results for "query" (X/Y pages):
 *
 * Sources:
 * 1. Title
 *    URL
 *    Snippet
 *
 * Extracted content:
 * ...content...
 */
function parseSearchResult(text: string): { sources: Source[]; extractedContent: string } {
  const sources: Source[] = [];
  let extractedContent = '';

  // Split into sections
  const sourcesMatch = text.match(/Sources:\n([\s\S]*?)(?:Extracted content:|$)/);
  const contentMatch = text.match(/Extracted content:\n?([\s\S]*?)$/);

  if (contentMatch) {
    extractedContent = contentMatch[1].trim();
  }

  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1];
    // Split by number. followed by title
    const sourceLines = sourcesText.split(/\n(?=\d+\.)/);

    for (const block of sourceLines) {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      // First line: "N. Title"
      const titleMatch = lines[0].match(/^\d+\.\s*(.+)$/);
      const title = titleMatch ? titleMatch[1] : lines[0];

      // Next line: URL
      let url = '';
      let snippet = '';
      let urlLine = 1;

      if (lines[1] && (lines[1].startsWith('http://') || lines[1].startsWith('https://'))) {
        url = lines[1];
        urlLine = 2;
      }

      // Remaining lines: snippet
      snippet = lines.slice(urlLine).join(' ');

      if (url) {
        try {
          const domain = new URL(url).hostname.replace(/^www\./, '');
          sources.push({
            index: sources.length + 1,
            title,
            url,
            snippet,
            domain,
          });
        } catch {
          // Skip invalid URLs
        }
      }
    }
  }

  return { sources, extractedContent };
}


export function SearchSources({ resultText }: SearchSourcesProps) {
  const { isDarkMode } = useTheme();
  const [expandedSourceId, setExpandedSourceId] = useState<number | null>(null);
  const [showAllContent, setShowAllContent] = useState(false);

  const { sources, extractedContent } = parseSearchResult(resultText);

  if (sources.length === 0) {
    return null;
  }

  const contentPreview = extractedContent.slice(0, 500);
  const hasMoreContent = extractedContent.length > 500;

  return (
    <div
      className="mt-2 rounded-lg overflow-hidden space-y-0"
      style={{
        background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }}
        >
          Search Sources
        </span>
      </div>

      {/* Sources List */}
      <div className="divide-y" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
        {sources.map(source => (
          <div key={source.index}>
            {/* Source Header */}
            <button
              onClick={() => setExpandedSourceId(expandedSourceId === source.index ? null : source.index)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
              }}
            >
              {/* Favicon Circle */}
              <div style={{ marginTop: 1 }}>
                <FaviconCircle url={source.url} size={24} />
              </div>

              {/* Title, Domain, Snippet */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[12px] font-semibold truncate"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)' }}
                >
                  {source.title}
                </div>
                <div
                  className="text-[10px] truncate mt-0.5"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' }}
                >
                  {source.domain}
                </div>
                {source.snippet && (
                  <div
                    className="text-[11px] line-clamp-2 mt-1"
                    style={{ color: isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }}
                  >
                    {source.snippet}
                  </div>
                )}
              </div>

              {/* Visit Link + Chevron */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 1 }}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.6,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.opacity = '0.6';
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={13} style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
                </a>
                <div style={{ color: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}>
                  <ChevronDown size={13} style={{ transform: expandedSourceId === source.index ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedSourceId === source.index && extractedContent && (
              <div
                style={{
                  padding: '8px 10px',
                  background: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)',
                  borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                }}
              >
                <div
                  className="text-[11px] leading-relaxed"
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)' }}
                >
                  {contentPreview}
                  {hasMoreContent && !showAllContent && (
                    <button
                      onClick={() => setShowAllContent(true)}
                      style={{
                        marginTop: 6,
                        display: 'block',
                        color: 'rgba(99,102,241,0.7)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(99,102,241,1)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(99,102,241,0.7)';
                      }}
                    >
                      Show all content
                    </button>
                  )}
                  {showAllContent && extractedContent}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

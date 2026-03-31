import { useState } from 'react';

/**
 * Get favicon URL from domain. Uses DuckDuckGo's favicon service.
 */
function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return '';
  }
}

/**
 * Render favicon in a circle, with fallback to domain initials.
 * Reusable component for displaying website favicons in search results,
 * source citations, and other contexts.
 */
export function FaviconCircle({ url, size = 28 }: { url: string; size?: number }) {
  const [imageError, setImageError] = useState(false);

  // Extract domain and generate initials as fallback
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  })();

  const initials = domain
    .split('.')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        flexShrink: 0,
        fontSize: size / 2.2,
        fontWeight: 600,
        color: 'white',
        overflow: 'hidden',
      }}
    >
      {!imageError && (
        <img
          src={getFaviconUrl(url)}
          alt={domain}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 3,
          }}
          onError={() => setImageError(true)}
        />
      )}
      {imageError && <span>{initials || '🔗'}</span>}
    </div>
  );
}

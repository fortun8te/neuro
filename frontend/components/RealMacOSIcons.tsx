/**
 * RealMacOSIcons — Authentic macOS icons from converted .icns files
 *
 * Maps real macOS app icons (converted to PNG) with fallback support.
 * Icons are stored in public/icons/ and imported as static assets.
 */

interface RealIconProps {
  size?: number;
  className?: string;
}

// Icon asset paths
const ICONS = {
  chrome: '/icons/chrome.png',
  finder: '/icons/finder.png',
  terminal: '/icons/terminal.png',
  preview: '/icons/preview.png',
  googleDocs: '/icons/google-docs.png',
  unknown: '/icons/unknown.png',
} as const;

// Chrome Browser
export function IconChromeReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.chrome}
      alt="Chrome"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Finder
export function IconFinderReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.finder}
      alt="Finder"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Terminal
export function IconTerminalReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.terminal}
      alt="Terminal"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Preview
export function IconPreviewReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.preview}
      alt="Preview"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Google Docs
export function IconGoogleDocsReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.googleDocs}
      alt="Google Docs"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

// Unknown icon
export function IconUnknownReal({ size = 32, className = '' }: RealIconProps) {
  return (
    <img
      src={ICONS.unknown}
      alt="Unknown"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

/**
 * Generic real icon component for mapping app names to icons
 */
export function RealMacOSIcon({ app, size = 32, className = '' }: { app: keyof typeof ICONS; size?: number; className?: string }) {
  const iconPath = ICONS[app];

  return (
    <img
      src={iconPath}
      alt={app}
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}

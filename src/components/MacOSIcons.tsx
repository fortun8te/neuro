/**
 * Real macOS Icons
 *
 * Authentic macOS app icons that actually look like the real thing
 */

interface IconProps {
  size?: number;
  className?: string;
}

// ── Navigation & Actions ──
export function IconArrowRight({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconArrowLeft({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconChevronUp({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function IconClose({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconPlus({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ── File & Folder ──
export function IconFolder({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8a1 1 0 011-1h7l1-1h8a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
    </svg>
  );
}

export function IconFile({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 2h7l5 5v12a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z" />
    </svg>
  );
}

export function IconDocument({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 2h7l5 5v12a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function IconImage({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="1" ry="1" />
      <circle cx="7.5" cy="7.5" r="1" />
      <path d="M3 13l4.5-6 7 9 6-8v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
    </svg>
  );
}

// ── App Icons (Real macOS style) ──

/**
 * Finder - The iconic macOS Finder folder icon with face-like appearance
 */
export function IconFinder({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Blue gradient folder */}
      <defs>
        <linearGradient id="finderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64B5FF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Folder shape */}
      <path d="M2 7c0-1 .6-1.5 1.5-1.5h6l1.5-1.5h9c1 0 1.5.5 1.5 1.5v11c0 1-.5 1.5-1.5 1.5h-16c-1 0-1.5-.5-1.5-1.5V7z" fill="url(#finderGradient)" />

      {/* Face features */}
      <circle cx="9" cy="13" r="0.8" fill="rgba(255,255,255,0.7)" />
      <circle cx="15" cy="13" r="0.8" fill="rgba(255,255,255,0.7)" />
      <path d="M11 15.5c1 .5 1.5.5 2 0" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Safari - The compass/globe icon
 */
export function IconSafari({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="safariGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9500" />
          <stop offset="100%" stopColor="#FF6B35" />
        </linearGradient>
      </defs>

      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" fill="url(#safariGradient)" />

      {/* Compass lines */}
      <g stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.9">
        <path d="M12 2v20M2 12h20" />
        <path d="M5 5l14 14M19 5l-14 14" />
      </g>

      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="white" />
    </svg>
  );
}

/**
 * Terminal - The command line terminal
 */
export function IconTerminal({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="terminalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1F2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
      </defs>

      {/* Terminal window */}
      <rect x="2" y="3" width="20" height="18" rx="2" fill="url(#terminalGradient)" stroke="#22D3EE" strokeWidth="1.5" />

      {/* Command prompt */}
      <g stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round">
        <polyline points="6 8 8 10 6 12" fill="none" />
        <line x1="10" y1="12" x2="16" y2="12" />
      </g>

      {/* Cursor blink indicator */}
      <rect x="6" y="15" width="2" height="2" rx="0.3" fill="#22D3EE" opacity="0.8" />
    </svg>
  );
}

/**
 * Mail - The envelope icon
 */
export function IconMail({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="mailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {/* Envelope */}
      <rect x="2" y="4" width="20" height="16" rx="2" fill="url(#mailGradient)" />

      {/* Envelope flap */}
      <path d="M2 4l10 6.5 10-6.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── System & Settings ──
export function IconSettings({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.12-2.12l4.24-4.24M19.78 19.78l-4.24-4.24m-2.12-2.12l-4.24-4.24M19.78 4.22l-4.24 4.24m-2.12 2.12l-4.24 4.24" />
    </svg>
  );
}

export function IconSearch({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function IconBell({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function IconCheckmark({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconError({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function IconInfo({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ── Action Icons ──
export function IconDownload({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconUpload({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 10 12 5 7 10" />
      <line x1="12" y1="5" x2="12" y2="15" />
    </svg>
  );
}

export function IconRefresh({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36M20.49 15a9 9 0 01-14.85 3.36" />
    </svg>
  );
}

export function IconTrash({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// ── Status Icons ──
export function IconLoading({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="10" opacity="0.2" />
      <path d="M12 2a10 10 0 0110 10" strokeDasharray="20" />
    </svg>
  );
}

export function IconPlay({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function IconPause({ size = 16, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

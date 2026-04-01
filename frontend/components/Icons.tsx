/**
 * Icons — standardized SVG icons used throughout the app.
 * All accept size, color, className, and style props.
 */

import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ChevronDown({ size = 14, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={className} style={style} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronRight({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={className} style={style} viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ArrowRight({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={className} style={style} viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function HomeIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" className={className} style={style} viewBox="0 0 24 24">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function SidebarIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" className={className} style={{ color, ...style }} viewBox="0 0 16 16">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M6 2v12M3.333 2h9.334C13.403 2 14 2.597 14 3.333v9.334c0 .736-.597 1.333-1.333 1.333H3.333A1.333 1.333 0 0 1 2 12.667V3.333C2 2.597 2.597 2 3.333 2" />
    </svg>
  );
}

export function UserIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" className={className} style={style} viewBox="0 0 24 24">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function LogOutIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" className={className} style={style} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function SettingsIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" className={className} style={style} viewBox="0 0 24 24">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Send button — arrow inside a rounded square */
export function SendButton({ size = 36, active = false, isDarkMode = false, className, style }: IconProps & { active?: boolean; isDarkMode?: boolean }) {
  const bg = active
    ? (isDarkMode ? '#3b82f6' : '#0F0F0F')
    : (isDarkMode ? 'rgba(255,255,255,0.06)' : '#e5e5e5');
  const iconColor = active ? '#ffffff' : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#a1a1aa');

  return (
    <div
      className={className}
      style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: active ? 'pointer' : 'default',
        transition: 'background 0.15s',
        ...style,
      }}
    >
      <ArrowRight size={size * 0.44} color={iconColor} />
    </div>
  );
}

export function SunIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={className} style={style} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function MoonIcon({ size = 16, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={className} style={style} viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

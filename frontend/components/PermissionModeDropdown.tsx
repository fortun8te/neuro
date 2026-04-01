/**
 * PermissionModeDropdown — Mode selector, opens upward
 * SVG icons, no emojis, clean minimal style
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';
import { getPermissionMode, setPermissionMode, PERMISSION_MODES } from '../utils/permissionMode';
import type { PermissionMode } from '../utils/harness/types';

interface PermissionModeDropdownProps {
  onModeChange?: (mode: PermissionMode) => void;
}

// SVG icons per mode — neutral grayscale style, like tool status icons
function ModeIcon({ mode, size = 14, isActive = false }: { mode: string; size?: number; isActive?: boolean }) {
  // Grayscale stroke color based on theme context passed from parent
  const strokeColor = 'currentColor';

  switch (mode) {
    case 'bypass':
      // Lightning bolt — fast, unrestricted
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'default':
      // Shield — balanced protection
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'strict':
      // Lock — maximum restriction
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'plan':
      // List with check — plan before execute
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <polyline points="3 6 4 7 6 5" />
          <polyline points="3 12 4 13 6 11" />
          <polyline points="3 18 4 19 6 17" />
        </svg>
      );
    default:
      return null;
  }
}

export function PermissionModeDropdown({ onModeChange }: PermissionModeDropdownProps) {
  const { isDarkMode } = useTheme();
  const [mode, setMode] = useState<PermissionMode>(() => getPermissionMode());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModeConfig = PERMISSION_MODES.find(m => m.mode === mode);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setMode(customEvent.detail.mode);
    };
    window.addEventListener('neuro-permission-mode-changed', handler);
    return () => window.removeEventListener('neuro-permission-mode-changed', handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModeChange = (newMode: PermissionMode) => {
    setMode(newMode);
    setPermissionMode(newMode);
    setIsOpen(false);
    onModeChange?.(newMode);
  };

  if (!currentModeConfig) return null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
        }}
      >
        <ModeIcon mode={currentModeConfig.mode} size={13} isActive={false} />
        <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>{currentModeConfig.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
          strokeWidth="2.5"
          style={{
            transition: 'transform 0.18s',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown — opens UPWARD */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 rounded-xl shadow-xl z-50 min-w-[210px] overflow-hidden"
          style={{
            background: isDarkMode ? 'rgba(16,16,22,0.97)' : 'rgba(255,255,255,0.97)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)'}`,
            backdropFilter: 'blur(16px)',
          }}
        >
          {PERMISSION_MODES.map((m, idx) => (
            <button
              key={m.mode}
              onClick={() => handleModeChange(m.mode)}
              className="w-full flex items-start gap-3 px-3.5 py-2.5 transition-colors text-left"
              style={{
                background: mode === m.mode
                  ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                  : 'transparent',
                borderBottom: idx < PERMISSION_MODES.length - 1
                  ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
                  : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (mode !== m.mode) {
                  (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                }
              }}
              onMouseLeave={e => {
                if (mode !== m.mode) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0" style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', opacity: mode === m.mode ? 1 : 0.5 }}>
                <ModeIcon mode={m.mode} size={15} isActive={mode === m.mode} />
              </div>

              {/* Text */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isDarkMode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)',
                    fontFamily: FONT_FAMILY,
                    letterSpacing: '0.01em',
                  }}>
                    {m.label}
                  </span>
                  {mode === m.mode && (
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      fontFamily: FONT_FAMILY,
                    }}>
                      ON
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: '10px',
                  color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)',
                  lineHeight: '1.4',
                  fontFamily: FONT_FAMILY,
                }}>
                  {m.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

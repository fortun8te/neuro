/**
 * Breadcrumb — Navigation path indicator with styling
 * Shows current location and allows quick navigation
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  // Home
  if (pathname === '/' || pathname === '/neuro') {
    return [{ label: 'Home', path: '/neuro' }];
  }

  // Chat view — don't show a breadcrumb for individual chats (no "Home > Chat" noise)
  const chatMatch = pathname.match(/^\/neuro\/([a-f0-9-]+)$/);
  if (chatMatch) {
    return [{ label: 'Home', path: '/neuro' }];
  }

  // Default
  return [{ label: 'Home', path: '/neuro' }];
}

export function Breadcrumb() {
  const { isDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const items = getBreadcrumbItems(location.pathname);

  if (items.length <= 1) return null;

  const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : '#374151';
  const linkColor = isDarkMode ? '#3b82f6' : '#0F0F0F';
  const separatorColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: FONT_FAMILY,
        color: textColor,
        userSelect: 'none',
      }}
    >
      {items.map((item, idx) => (
        <React.Fragment key={item.path}>
          {idx > 0 && (
            <ChevronRight
              size={14}
              style={{
                color: separatorColor,
                opacity: 0.6,
                margin: '0 2px',
              }}
            />
          )}
          <button
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: idx === items.length - 1 ? textColor : linkColor,
              fontFamily: FONT_FAMILY,
              fontSize: 12,
              fontWeight: idx === items.length - 1 ? 500 : 400,
              transition: 'color 0.2s',
              padding: '2px 4px',
              borderRadius: 4,
            }}
            onMouseEnter={e => {
              if (idx < items.length - 1) {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.03)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {item.icon && <span style={{ fontSize: 13 }}>{item.icon}</span>}
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

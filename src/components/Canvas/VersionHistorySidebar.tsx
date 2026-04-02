/**
 * Version History Sidebar Component
 * Collapsible version list with timestamps
 */

import { motion } from 'framer-motion';
import type { CanvasVersion } from './useCanvasState';
import { CANVAS_COLORS, CANVAS_FONT_SIZE, CANVAS_SPACING, CANVAS_TRANSITIONS, getColorScheme, getSidebarWidth } from '../../styles/canvasStyles';
import { useState, useEffect } from 'react';
import '../../styles/canvasButtons.css';

interface VersionHistorySidebarProps {
  versions: CanvasVersion[];
  isDarkMode: boolean;
  onVersionSelect: (version: CanvasVersion) => void;
}

export function VersionHistorySidebar({
  versions,
  isDarkMode,
  onVersionSelect,
}: VersionHistorySidebarProps) {
  const colors = getColorScheme(isDarkMode);
  const theme = isDarkMode ? 'dark' : 'light';
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth());

  useEffect(() => {
    const handleResize = () => setSidebarWidth(getSidebarWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: sidebarWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: parseFloat(CANVAS_TRANSITIONS.normal) }}
      style={{
        borderLeft: `1px solid ${colors.border}`,
        background: colors.bgSubtler,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="complementary"
      aria-label="Version history"
    >
      {/* Header */}
      <div
        style={{
          padding: CANVAS_SPACING.lg,
          fontSize: CANVAS_FONT_SIZE.xs,
          fontWeight: 600,
          color: colors.textTertiary,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        Versions ({versions.length})
      </div>

      {/* Versions List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {versions.length === 0 ? (
          <div
            style={{
              padding: CANVAS_SPACING.lg,
              fontSize: CANVAS_FONT_SIZE.sm,
              color: colors.textQuaternary,
              textAlign: 'center',
            }}
          >
            No versions yet
          </div>
        ) : (
          versions.map((v, i) => (
            <button
              key={v.id}
              onClick={() => onVersionSelect(v)}
              className="canvas-button"
              data-theme={theme}
              style={{
                width: '100%',
                padding: `${CANVAS_SPACING.lg} ${CANVAS_SPACING.lg}`,
                border: 'none',
                background: 'transparent',
                borderBottom: `1px solid ${colors.border}`,
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 0,
                display: 'block',
              }}
              title={`Revert to version ${versions.length - i}`}
              aria-label={`Version ${versions.length - i} from ${v.savedAt.toLocaleTimeString()}`}
            >
              <div
                style={{
                  fontSize: CANVAS_FONT_SIZE.sm,
                  color: colors.textSecondary,
                  fontWeight: 500,
                }}
              >
                v{versions.length - i}
              </div>
              <div
                style={{
                  fontSize: CANVAS_FONT_SIZE.xs,
                  color: colors.textQuaternary,
                  marginTop: '2px',
                }}
              >
                {v.savedAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div
                style={{
                  fontSize: CANVAS_FONT_SIZE.xs,
                  color: colors.textQuaternary,
                  marginTop: CANVAS_SPACING.xs,
                }}
              >
                {v.content.length} chars
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}

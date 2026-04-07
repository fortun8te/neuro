/**
 * Tool Status Panel — Real-time display of tool execution status
 * Shows running, completed, and failed tools with execution times
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FONT_FAMILY } from '../constants/ui';
import { useTheme } from '../context/ThemeContext';

interface ToolStatus {
  id: string;
  name: string;
  status: 'running' | 'done' | 'failed';
  startTime: number;
  endTime?: number;
  error?: string;
}

interface ToolStatusPanelProps {
  isDarkMode?: boolean;
  animationsEnabled?: boolean;
  maxItems?: number;
}

export function ToolStatusPanel({
  isDarkMode: isDarkModeProp,
  animationsEnabled = true,
  maxItems = 10,
}: ToolStatusPanelProps) {
  const { isDarkMode: contextDarkMode } = useTheme();
  const isDarkMode = isDarkModeProp !== undefined ? isDarkModeProp : contextDarkMode;
  const [tools, setTools] = useState<ToolStatus[]>([]);

  useEffect(() => {
    const handleToolStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const toolCall = detail.toolCall || detail;
      setTools(prev => [
        ...prev,
        {
          id: toolCall.id || `tool-${Date.now()}`,
          name: toolCall.name || 'Unknown',
          status: 'running',
          startTime: Date.now(),
        },
      ]);
    };

    const handleToolDone = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const toolCall = detail.toolCall || detail;
      setTools(prev =>
        prev.map(t =>
          t.id === (toolCall.id || t.id)
            ? {
                ...t,
                status: 'done',
                endTime: Date.now(),
              }
            : t
        )
      );
    };

    const handleToolError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const toolCall = detail.toolCall || detail;
      setTools(prev =>
        prev.map(t =>
          t.id === (toolCall.id || t.id)
            ? {
                ...t,
                status: 'failed',
                endTime: Date.now(),
                error: detail.error || toolCall.error,
              }
            : t
        )
      );
    };

    window.addEventListener('tool_start', handleToolStart);
    window.addEventListener('tool_done', handleToolDone);
    window.addEventListener('tool_error', handleToolError);

    return () => {
      window.removeEventListener('tool_start', handleToolStart);
      window.removeEventListener('tool_done', handleToolDone);
      window.removeEventListener('tool_error', handleToolError);
    };
  }, []);

  // Keep only the last maxItems tools
  const displayTools = tools.slice(-maxItems);

  if (displayTools.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontFamily: FONT_FAMILY,
        background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        borderRadius: '6px',
        maxHeight: '200px',
        overflowY: 'auto',
        borderLeft: `3px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      }}
    >
      <div style={{
        marginBottom: '6px',
        fontSize: '10px',
        opacity: 0.6,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
      }}>
        Tool Status
      </div>

      <AnimatePresence>
        {displayTools.map((tool) => {
          const duration = tool.endTime
            ? ((tool.endTime - tool.startTime) / 1000).toFixed(2)
            : ((Date.now() - tool.startTime) / 1000).toFixed(2);

          const statusColor =
            tool.status === 'running'
              ? isDarkMode ? '#fbbf24' : '#f59e0b'
              : tool.status === 'done'
                ? isDarkMode ? '#4ade80' : '#22c55e'
                : isDarkMode ? '#f87171' : '#ef4444';

          const statusBg =
            tool.status === 'running'
              ? isDarkMode ? 'rgba(251,191,36,0.1)' : 'rgba(245,158,11,0.1)'
              : tool.status === 'done'
                ? isDarkMode ? 'rgba(74,222,128,0.1)' : 'rgba(34,197,94,0.1)'
                : isDarkMode ? 'rgba(248,113,113,0.1)' : 'rgba(239,68,68,0.1)';

          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                padding: '6px 8px',
                marginBottom: '4px',
                borderRadius: '4px',
                background: statusBg,
                border: `1px solid ${statusColor}33`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflow: 'hidden',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: statusColor,
                  flexShrink: 0,
                  animation: tool.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />

              {/* Tool name */}
              <span
                style={{
                  flex: 1,
                  color: statusColor,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: 500,
                }}
              >
                {tool.name}
              </span>

              {/* Duration or error */}
              <span
                style={{
                  fontSize: '10px',
                  color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tool.status === 'failed' && tool.error
                  ? tool.error.slice(0, 20)
                  : `${duration}s`}
              </span>

              {/* Status text */}
              <span
                style={{
                  fontSize: '9px',
                  color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                {tool.status === 'running' ? '...' : tool.status === 'done' ? '✓' : '✗'}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

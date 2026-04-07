/**
 * CommandPalette -- Global keyboard command interface (Cmd+K / Ctrl+K)
 * Fuzzy searchable commands, actions, and navigation
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { FONT_FAMILY } from '../constants/ui';

interface Command {
  id: string;
  label: string;
  description: string;
  category: 'Navigation' | 'Chat' | 'Settings' | 'View' | 'Actions';
  shortcut?: string;
  action: () => void;
  icon?: string;
}

export function CommandPalette({ onNewChat }: { onNewChat?: () => void }) {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Command definitions
  const commands: Command[] = useMemo(() => [
    {
      id: 'new-chat',
      label: 'New Chat',
      description: 'Start a new conversation',
      category: 'Chat',
      shortcut: 'Cmd+N',
      action: () => {
        if (onNewChat) onNewChat();
        setIsOpen(false);
      },
      icon: 'C',
    },
    {
      id: 'go-home',
      label: 'Go to Home',
      description: 'Return to home screen',
      category: 'Navigation',
      shortcut: 'Cmd+H',
      action: () => {
        navigate('/neuro');
        setIsOpen(false);
      },
      icon: 'H',
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      description: 'View application settings',
      category: 'Settings',
      shortcut: 'Cmd+,',
      action: () => {
        window.dispatchEvent(new CustomEvent('neuro-open-settings'));
        setIsOpen(false);
      },
      icon: 'S',
    },
    {
      id: 'toggle-theme',
      label: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle between dark and light theme',
      category: 'View',
      shortcut: 'Cmd+Shift+L',
      action: () => {
        window.dispatchEvent(new CustomEvent('neuro-toggle-theme'));
        setIsOpen(false);
      },
      icon: isDarkMode ? 'L' : 'D',
    },
    {
      id: 'open-debug',
      label: 'Open Debug Panel',
      description: 'View debug logs and system info',
      category: 'Settings',
      shortcut: 'Cmd+Shift+D',
      action: () => {
        window.dispatchEvent(new CustomEvent('neuro-open-debug'));
        setIsOpen(false);
      },
      icon: '🐛',
    },
  ], [isDarkMode, navigate, onNewChat]);

  // Filter commands based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIdx(0);
      }

      // Navigation within palette
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIdx(i => (i + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIdx(i => (i - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[selectedIdx]) {
            filtered[selectedIdx].action();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIdx]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bgColor = isDarkMode ? '#0a0a0f' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const textColor = isDarkMode ? 'rgba(255,255,255,0.9)' : '#0f0f0f';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.5)' : '#71717a';
  const hoverBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const selectedBg = isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)';

  return (
    <div
      onClick={() => setIsOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 5000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 500,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: `1px solid ${borderColor}`,
          background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: textColor,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
            }}
          />
          <span style={{ fontSize: 11, color: mutedColor, opacity: 0.6 }}>ESC</span>
        </div>

        {/* Commands list */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: mutedColor,
              fontSize: 13,
            }}>
              No commands found
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setIsOpen(false);
                }}
                style={{
                  padding: '10px 16px',
                  background: idx === selectedIdx ? selectedBg : 'transparent',
                  borderBottom: idx < filtered.length - 1 ? `1px solid ${borderColor}` : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                {cmd.icon && <span style={{ fontSize: 14 }}>{cmd.icon}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: textColor }}>
                    {cmd.label}
                  </div>
                  <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>
                    {cmd.description}
                  </div>
                </div>
                {cmd.shortcut && (
                  <span style={{
                    fontSize: 10,
                    color: mutedColor,
                    background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}>
                    {cmd.shortcut}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

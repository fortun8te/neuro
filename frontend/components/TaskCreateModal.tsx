/**
 * TaskCreateModal -- Modal for creating a scheduled task block
 * with time, duration, category, and priority selectors.
 */
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { FONT_FAMILY } from '../constants/ui';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_OPTIONS = [
  { value: 'research',    label: 'Research',    color: '#3b82f6' },
  { value: 'creative',    label: 'Creative',    color: '#a855f7' },
  { value: 'analysis',    label: 'Analysis',    color: '#22c55e' },
  { value: 'maintenance', label: 'Maintenance', color: '#6b7280' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low' },
  { value: 'normal',   label: 'Normal' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

const DURATION_OPTIONS = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
] as const;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: {
    prompt: string;
    scheduledStart: number;
    duration: number;
    category: string;
    priority: string;
  }) => void;
  defaultHour?: number;
  defaultDate?: Date;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TaskCreateModal({
  isOpen,
  onClose,
  onCreate,
  defaultHour,
  defaultDate,
}: TaskCreateModalProps) {
  const { isDarkMode } = useTheme();

  const [prompt, setPrompt] = useState('');
  const [hour, setHour] = useState(defaultHour ?? new Date().getHours());
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState('research');
  const [priority, setPriority] = useState('normal');

  // Reset form when modal opens with new defaults
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setHour(defaultHour ?? new Date().getHours());
      setMinute(0);
      setDuration(60);
      setCategory('research');
      setPriority('normal');
    }
  }, [isOpen, defaultHour]);

  const handleCreate = useCallback(() => {
    if (!prompt.trim()) return;
    const base = defaultDate ? new Date(defaultDate) : new Date();
    base.setHours(hour, minute, 0, 0);
    const scheduledStart = base.getTime();

    onCreate({
      prompt: prompt.trim(),
      scheduledStart,
      duration,
      category,
      priority,
    });
    onClose();
  }, [prompt, hour, minute, duration, category, priority, defaultDate, onCreate, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* ---- Styles ---- */
  const bg = isDarkMode ? '#1c1c1e' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.88)';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const textTertiary = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const inputBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const inputBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: textSecondary,
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    color: textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 30,
    cursor: 'pointer',
  };

  const pillBaseStyle: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: FONT_FAMILY,
    cursor: 'pointer',
    border: `1px solid ${borderColor}`,
    transition: 'all 0.15s ease',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1000,
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 420,
              maxWidth: '92vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: bg,
              borderRadius: 16,
              border: `1px solid ${borderColor}`,
              boxShadow: isDarkMode
                ? '0 24px 64px rgba(0,0,0,0.6)'
                : '0 24px 64px rgba(0,0,0,0.15)',
              zIndex: 1001,
              fontFamily: FONT_FAMILY,
              padding: '24px',
            }}
          >
            {/* Title */}
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: textPrimary,
              marginBottom: 20,
              letterSpacing: '-0.01em',
            }}>
              Schedule Task
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What should the agent do?"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: 72,
                }}
                autoFocus
              />
            </div>

            {/* Time: hour + minute */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Hour</label>
                <select
                  value={hour}
                  onChange={e => setHour(Number(e.target.value))}
                  style={selectStyle}
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const h12 = i % 12 || 12;
                    const suffix = i >= 12 ? 'PM' : 'AM';
                    return (
                      <option key={i} value={i}>
                        {h12} {suffix}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Minute</label>
                <select
                  value={minute}
                  onChange={e => setMinute(Number(e.target.value))}
                  style={selectStyle}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>
                      :{m.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Duration</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                style={selectStyle}
              >
                {DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Category</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORY_OPTIONS.map(opt => {
                  const selected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setCategory(opt.value)}
                      style={{
                        ...pillBaseStyle,
                        background: selected ? `${opt.color}18` : 'transparent',
                        borderColor: selected ? opt.color : borderColor,
                        color: selected ? opt.color : textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: opt.color,
                        display: 'inline-block',
                        flexShrink: 0,
                      }} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRIORITY_OPTIONS.map(opt => {
                  const selected = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      style={{
                        ...pillBaseStyle,
                        background: selected
                          ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                          : 'transparent',
                        borderColor: selected
                          ? (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')
                          : borderColor,
                        color: selected ? textPrimary : textSecondary,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: FONT_FAMILY,
                  color: textSecondary,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!prompt.trim()}
                style={{
                  background: prompt.trim() ? '#3b82f6' : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: FONT_FAMILY,
                  color: prompt.trim() ? '#ffffff' : textTertiary,
                  cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s ease',
                }}
              >
                Create
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

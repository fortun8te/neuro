/**
 * SettingsModal — Clean Apple-style settings with left sidebar tabs
 * Tabs: Account, General
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile } from '../services/auth';
import { INFRASTRUCTURE } from '../config/infrastructure';
import BlobAvatar from './BlobAvatar';
import { SunIcon, MoonIcon, LogOutIcon } from './Icons';
import { FileSyncStatus } from './FileSyncStatus';

const font = "'ABC Diatype Plus', system-ui, sans-serif";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning?: boolean;
  user?: UserProfile;
  onUpdateProfile?: (u: UserProfile) => void;
  onLogout?: () => void;
}

type Tab = 'account' | 'general' | 'sync';

// ── Seed stored in localStorage so it persists across sessions ──────────────
const AVATAR_SEED_KEY = 'neuro_user_avatar_seed';

function getAvatarSeed(userId: string): string {
  return localStorage.getItem(AVATAR_SEED_KEY) || userId || 'guest';
}

function newAvatarSeed(): string {
  const seed = crypto.randomUUID();
  localStorage.setItem(AVATAR_SEED_KEY, seed);
  window.dispatchEvent(new CustomEvent('neuro-avatar-seed-changed', { detail: seed }));
  return seed;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDarkMode, toggleTheme, animationsEnabled, toggleAnimations } = useTheme();
  const { user, updateProfile, logout } = useAuth();

  const [tab, setTab] = useState<Tab>('account');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(() => getAvatarSeed(user?.id || 'guest'));
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarSeed(getAvatarSeed(user.id));
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const c = {
    bg: isDarkMode ? '#111111' : '#FFFFFF',
    sidebar: isDarkMode ? '#0a0a0a' : '#F5F5F7',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDarkMode ? 'rgba(255,255,255,0.9)' : '#0F0F0F',
    textSec: isDarkMode ? 'rgba(255,255,255,0.4)' : '#6B7280',
    accent: '#2B79FF',
    accentBg: 'rgba(43,121,255,0.1)',
    inputBg: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F9F9F9',
    inputBorder: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    hover: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    activeTab: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = () => {
    const seed = newAvatarSeed();
    setAvatarSeed(seed);
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'account', label: 'Account',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
    {
      id: 'general', label: 'General',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      ),
    },
    {
      id: 'sync', label: 'Cloud Sync',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 17a2 2 0 104 0 2 2 0 10-4 0zM6 14v-2a2 2 0 012-2h8a2 2 0 012 2v2M9.5 9h5M12 3v4"/><circle cx="19" cy="17" r="2"/>
        </svg>
      ),
    },
  ];

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 780,
        height: '80vh',
        background: c.bg,
        borderRadius: 18,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        border: `1px solid ${c.border}`,
        display: 'flex',
        overflow: 'hidden',
        fontFamily: font,
      }}>

        {/* ── Left sidebar ── */}
        <div style={{
          width: 180, flexShrink: 0,
          background: c.sidebar,
          borderRight: `1px solid ${c.border}`,
          display: 'flex', flexDirection: 'column',
          padding: '24px 12px',
          gap: 4,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, paddingLeft: 10, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Settings
          </div>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: 8,
                background: tab === t.id ? c.activeTab : 'transparent',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? c.text : c.textSec,
                fontFamily: font,
                transition: 'all 0.1s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = c.hover; }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = 'transparent'; }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 28px 16px',
            borderBottom: `1px solid ${c.border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: c.text }}>
              {TABS.find(t => t.id === tab)?.label}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                width: 28, height: 28, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: c.textSec, fontSize: 16,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = c.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── ACCOUNT TAB ── */}
            {tab === 'account' && (
              <>
                {/* Avatar row */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <BlobAvatar
                      seed={avatarSeed}
                      size={72}
                      initials={(user?.name?.[0] || 'G').toUpperCase()}
                      animated={animationsEnabled}
                    />
                    <button
                      onClick={handleRegenerate}
                      style={{
                        fontSize: 11, fontWeight: 500,
                        color: c.accent, background: c.accentBg,
                        border: `1px solid ${c.accent}`,
                        borderRadius: 6, padding: '5px 10px',
                        cursor: 'pointer', fontFamily: font,
                      }}
                    >
                      Regenerate
                    </button>
                  </div>

                  {/* Name field */}
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: c.textSec, display: 'block', marginBottom: 6 }}>
                      Name
                    </label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      placeholder="Your name"
                      style={{
                        width: '100%', padding: '10px 12px',
                        background: c.inputBg, border: `1px solid ${c.inputBorder}`,
                        borderRadius: 8, fontSize: 14, color: c.text,
                        fontFamily: font, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        style={{
                          padding: '8px 16px', borderRadius: 8,
                          background: saved ? 'rgba(34,197,94,0.15)' : c.accent,
                          color: saved ? 'rgba(34,197,94,0.9)' : '#fff',
                          border: 'none', cursor: saving ? 'default' : 'pointer',
                          fontSize: 13, fontWeight: 500, fontFamily: font,
                          opacity: saving ? 0.6 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    {user?.email && (
                      <div style={{ marginTop: 10, fontSize: 12, color: c.textSec }}>
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: c.border }} />

                {/* Danger zone */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(239,68,68,0.6)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Danger Zone
                  </div>
                  <button
                    onClick={async () => { await logout(); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 14px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: 'rgba(239,68,68,0.9)', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: font,
                    }}
                  >
                    <LogOutIcon size={14} />
                    Log out
                  </button>
                </div>
              </>
            )}

            {/* ── GENERAL TAB ── */}
            {tab === 'general' && (
              <>
                {/* Appearance */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Appearance
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isDarkMode ? <MoonIcon size={15} color={c.textSec} /> : <SunIcon size={15} color={c.textSec} />}
                      <span style={{ fontSize: 13, fontWeight: 500, color: c.text, fontFamily: font }}>
                        {isDarkMode ? 'Dark mode' : 'Light mode'}
                      </span>
                    </div>
                    <button
                      onClick={toggleTheme}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: isDarkMode ? c.accent : '#d1d5db',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: isDarkMode ? 'calc(100% - 21px)' : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Animations */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Animations
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>Blob animations</div>
                      <div style={{ fontSize: 12, color: c.textSec, marginTop: 2 }}>Animate avatar blobs</div>
                    </div>
                    <button
                      onClick={toggleAnimations}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: animationsEnabled ? c.accent : (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: animationsEnabled ? 'calc(100% - 21px)' : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Infrastructure */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Infrastructure
                  </div>
                  <div style={{
                    borderRadius: 10, border: `1px solid ${c.border}`,
                    overflow: 'hidden',
                  }}>
                    {[
                      { label: 'Ollama', value: INFRASTRUCTURE.ollamaUrl },
                      { label: 'Wayfarer', value: INFRASTRUCTURE.wayfarerUrl },
                      { label: 'SearXNG', value: INFRASTRUCTURE.searxngUrl },
                    ].map((item, i, arr) => (
                      <div
                        key={item.label}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 16px',
                          borderBottom: i < arr.length - 1 ? `1px solid ${c.border}` : 'none',
                          background: c.inputBg,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: c.textSec }}>{item.label}</span>
                        <span style={{ fontSize: 12, color: c.textSec, fontFamily: 'JetBrains Mono, monospace' }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: c.textSec, marginTop: 8 }}>
                    Override via VITE_OLLAMA_URL / VITE_WAYFARER_URL / VITE_SEARXNG_URL
                  </div>
                </div>

              </>
            )}

            {/* ── CLOUD SYNC TAB ── */}
            {tab === 'sync' && (
              <>
                {/* Sync Status Component */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Sync Status
                  </div>
                  <div style={{
                    borderRadius: 10, border: `1px solid ${c.border}`,
                    padding: '14px 16px',
                    background: c.inputBg,
                  }}>
                    <div style={{ fontSize: 13, color: c.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      Synced
                    </div>
                    <div style={{ fontSize: 12, color: c.textSec, marginTop: 6 }}>
                      Last sync: Just now
                    </div>
                  </div>
                </div>

                {/* Shell Exec Service Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Backend Service
                  </div>
                  <div style={{
                    borderRadius: 10, border: `1px solid ${c.border}`,
                    padding: '12px 16px',
                    background: c.inputBg,
                  }}>
                    <div style={{ fontSize: 12, color: c.textSec }}>
                      <div>Shell Exec Service</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                        {import.meta.env.VITE_SHELL_EXEC_URL || 'http://localhost:3001'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: c.textSec, lineHeight: 1.5 }}>
                    The Shell Exec Service must be running to enable file sync. Start it with:<br/>
                    <code style={{ background: c.hover, padding: '4px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>
                      node shell-exec-server.js
                    </code>
                  </div>
                </div>

                {/* Storage Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Local Storage
                  </div>
                  <div style={{
                    borderRadius: 10, border: `1px solid ${c.border}`,
                    padding: '12px 16px',
                    background: c.inputBg,
                  }}>
                    <div style={{ fontSize: 12, color: c.textSec }}>
                      <div>Documents Location</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                        ~/Neuro/Documents/
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: c.textSec, lineHeight: 1.5 }}>
                    Canvas documents, research findings, and workspace files are synced to this location automatically. Open in Finder to view or edit files.
                  </div>
                </div>

              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

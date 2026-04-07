/**
 * SettingsModal — Clean Apple-style settings with left sidebar tabs
 * Tabs: Account, General
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile } from '../services/auth';
import { INFRASTRUCTURE } from '../config/infrastructure';
import { costTracker } from '../utils/costTracker';
import BlobAvatar from './BlobAvatar';
import { getUserAvatarSeed, getUserAvatarColor, setUserAvatarColor, getUserInitials } from './UserAvatar';
import { AvatarColorPicker } from './AvatarColorPicker';
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

type Tab = 'account' | 'general' | 'sync' | 'infrastructure' | 'agent' | 'cost' | 'about';

// ── Seed stored in localStorage so it persists across sessions ──────────────
const AVATAR_SEED_KEY = 'neuro_user_avatar_seed';

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
  const [avatarSeed, setAvatarSeed] = useState(() => getUserAvatarSeed());
  const [avatarColor, setAvatarColorState] = useState(() => getUserAvatarColor());

  // Agent settings
  const [neuroRewriteEnabled, setNeuroRewriteEnabled] = useState(
    () => localStorage.getItem('neuro_rewrite_enabled') !== 'false'
  );
  const [maxSubagents, setMaxSubagents] = useState(
    () => parseInt(localStorage.getItem('neuro_max_subagents') || '5', 10)
  );
  const [autoParallelEnabled, setAutoParallelEnabled] = useState(
    () => localStorage.getItem('neuro_auto_parallel') !== 'false'
  );

  // Infrastructure settings
  const [infrastructureMode, setInfrastructureMode] = useState<'local' | 'remote'>(
    () => (localStorage.getItem('neuro_infrastructure_mode') as any) || 'remote'
  );

  // Cost & Budget settings
  const [hardLimit, setHardLimit] = useState(() => costTracker.getConfig().hardLimitTokens);
  const [softLimit, setSoftLimitState] = useState(() => costTracker.getConfig().softLimitTokens);
  const [warnOnSoftLimit, setWarnOnSoftLimit] = useState(() => costTracker.getConfig().warnOnSoftLimit);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAvatarSeed(getUserAvatarSeed());
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
      // Broadcast profile update event for avatar/UI components to react
      window.dispatchEvent(new CustomEvent('neuro-profile-updated', { detail: { name: name.trim() } }));
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

  // Save agent settings
  const saveAgentSettings = () => {
    localStorage.setItem('neuro_rewrite_enabled', String(neuroRewriteEnabled));
    localStorage.setItem('neuro_max_subagents', String(maxSubagents));
    localStorage.setItem('neuro_auto_parallel', String(autoParallelEnabled));
    // Dispatch event so other components react to setting changes
    window.dispatchEvent(new CustomEvent('neuro-agent-settings-changed', { detail: { neuroRewriteEnabled, maxSubagents, autoParallelEnabled } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Save infrastructure settings
  const saveInfrastructureSettings = () => {
    localStorage.setItem('neuro_infrastructure_mode', infrastructureMode);
    window.dispatchEvent(new CustomEvent('neuro-infrastructure-changed', { detail: { mode: infrastructureMode } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      id: 'infrastructure', label: 'Infrastructure',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2"/>
        </svg>
      ),
    },
    {
      id: 'agent', label: 'Agent',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>
        </svg>
      ),
    },
    {
      id: 'cost', label: 'Cost & Budget',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"/><path d="M12 7v10M9 10h6M9 14h6"/><circle cx="12" cy="12" r="10"/>
        </svg>
      ),
    },
    {
      id: 'about', label: 'About',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
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
                      color={avatarColor}
                      size={72}
                      initials={getUserInitials(user?.name)}
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

                {/* Avatar color */}
                <AvatarColorPicker
                  value={avatarColor}
                  onChange={(color) => {
                    setAvatarColorState(color);
                    setUserAvatarColor(color);
                  }}
                />

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

            {/* ── INFRASTRUCTURE TAB ── */}
            {tab === 'infrastructure' && (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Server Mode
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {['local', 'remote'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setInfrastructureMode(mode as 'local' | 'remote')}
                        style={{
                          flex: 1, padding: '12px 14px', borderRadius: 8,
                          background: infrastructureMode === mode ? c.accentBg : c.inputBg,
                          border: `1px solid ${infrastructureMode === mode ? c.accent : c.border}`,
                          color: c.text, cursor: 'pointer',
                          fontSize: 13, fontWeight: 500, fontFamily: font,
                          transition: 'all 0.2s',
                        }}
                      >
                        {mode === 'local' ? '🖥️ Local' : '☁️ Remote'}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: c.textSec, marginTop: 8 }}>
                    {infrastructureMode === 'local'
                      ? 'Run Ollama, Wayfarer, and SearXNG on your machine (localhost)'
                      : 'Connect to remote Ollama server at 100.74.135.83:11440'}
                  </div>
                </div>

                <div style={{ height: 1, background: c.border }} />

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Connection Status
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>Connected</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 2 }}>
                        {infrastructureMode === 'local' ? 'localhost:11434' : '100.74.135.83:11440'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveInfrastructureSettings}
                    style={{
                      padding: '9px 16px', borderRadius: 8,
                      background: saved ? 'rgba(34,197,94,0.15)' : c.accent,
                      color: saved ? 'rgba(34,197,94,0.9)' : '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: font,
                      transition: 'all 0.2s',
                    }}
                  >
                    {saved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </>
            )}

            {/* ── AGENT TAB ── */}
            {tab === 'agent' && (
              <>
                {/* NEURO Rewriting */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    NEURO Rewriting
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>AI voice enhancement</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 2 }}>Rewrite responses in Neuro style</div>
                    </div>
                    <button
                      onClick={() => setNeuroRewriteEnabled(!neuroRewriteEnabled)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: neuroRewriteEnabled ? c.accent : (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: neuroRewriteEnabled ? 'calc(100% - 21px)' : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Max Subagents */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Parallel Agents
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <label style={{ fontSize: 13, color: c.text, flex: 1 }}>Max subagents per task:</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={maxSubagents}
                      onChange={e => setMaxSubagents(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      style={{
                        width: 50, padding: '6px 8px',
                        background: c.inputBg, border: `1px solid ${c.border}`,
                        borderRadius: 6, fontSize: 13, color: c.text,
                        fontFamily: font, textAlign: 'center', outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Auto Parallel */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Execution
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>Auto-parallel tools</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 2 }}>Run independent tools simultaneously</div>
                    </div>
                    <button
                      onClick={() => setAutoParallelEnabled(!autoParallelEnabled)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: autoParallelEnabled ? c.accent : (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: autoParallelEnabled ? 'calc(100% - 21px)' : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveAgentSettings}
                    style={{
                      padding: '9px 16px', borderRadius: 8,
                      background: saved ? 'rgba(34,197,94,0.15)' : c.accent,
                      color: saved ? 'rgba(34,197,94,0.9)' : '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, fontFamily: font,
                      transition: 'all 0.2s',
                    }}
                  >
                    {saved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </>
            )}


            {/* ── COST & BUDGET TAB ── */}
            {tab === 'cost' && (
              <>
                {/* Current Usage */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Current Usage
                  </div>
                  <div style={{
                    padding: '16px',
                    background: c.inputBg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: c.text }}>Tokens Used</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                        {costTracker.getUsage().totalTokens.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: c.text }}>Total Cost</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                        ${costTracker.getUsage().totalCost.toFixed(4)}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: 'rgba(0,0,0,0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}>
                      <div
                        style={{
                          width: `${Math.min(costTracker.getUsagePercentage(), 100)}%`,
                          height: '100%',
                          background: costTracker.getUsagePercentage() >= 100 ? '#ef4444' : costTracker.getUsagePercentage() >= 80 ? '#eab308' : '#22c55e',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: c.textSec,
                    }}>
                      <span>{costTracker.getRemainingTokens().toLocaleString()} remaining</span>
                      <span>{costTracker.getUsagePercentage().toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Hard Limit */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Hard Limit (Tokens)
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <input
                      type="number"
                      value={hardLimit}
                      onChange={(e) => setHardLimit(Math.max(1000, parseInt(e.target.value) || 1000))}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: c.inputBg,
                        border: `1px solid ${c.inputBorder}`,
                        borderRadius: 8,
                        fontSize: 13,
                        color: c.text,
                        fontFamily: font,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => {
                        costTracker.setHardLimit(hardLimit);
                        setSaved(true);
                        setTimeout(() => setSaved(false), 2000);
                      }}
                      style={{
                        padding: '9px 14px',
                        background: c.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: font,
                      }}
                    >
                      {saved ? 'Saved' : 'Update'}
                    </button>
                  </div>
                </div>

                {/* Soft Limit */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Soft Limit (Tokens)
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <input
                      type="number"
                      value={softLimit}
                      onChange={(e) => setSoftLimitState(Math.max(0, parseInt(e.target.value) || hardLimit * 0.8))}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        background: c.inputBg,
                        border: `1px solid ${c.inputBorder}`,
                        borderRadius: 8,
                        fontSize: 13,
                        color: c.text,
                        fontFamily: font,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={() => {
                        costTracker.setSoftLimit(softLimit);
                        setSaved(true);
                        setTimeout(() => setSaved(false), 2000);
                      }}
                      style={{
                        padding: '9px 14px',
                        background: c.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: font,
                      }}
                    >
                      {saved ? 'Saved' : 'Update'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: c.textSec, marginTop: 6 }}>
                    Warning shown when usage reaches this threshold
                  </div>
                </div>

                {/* Warning Toggle */}
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 10,
                    background: c.inputBg, border: `1px solid ${c.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>Soft limit warnings</div>
                      <div style={{ fontSize: 11, color: c.textSec, marginTop: 2 }}>Show alert at 80%</div>
                    </div>
                    <button
                      onClick={() => {
                        setWarnOnSoftLimit(!warnOnSoftLimit);
                        costTracker.setConfig({ ...costTracker.getConfig(), warnOnSoftLimit: !warnOnSoftLimit });
                      }}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: warnOnSoftLimit ? c.accent : (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: warnOnSoftLimit ? 'calc(100% - 21px)' : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Reset Button */}
                <div>
                  <button
                    onClick={() => {
                      costTracker.resetUsage();
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2000);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'rgba(239,68,68,0.08)',
                      color: 'rgba(239,68,68,0.9)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: font,
                    }}
                  >
                    Reset Usage Counter
                  </button>
                </div>
              </>
            )}
            {/* ── ABOUT TAB ── */}
            {tab === 'about' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      About Neuro
                    </div>
                    <div style={{ fontSize: 13, color: c.text, lineHeight: 1.6 }}>
                      <p>Neuro is an advanced AI agent with specialized capabilities for research, content creation, and autonomous task execution.</p>
                      <p style={{ marginTop: 8 }}>Built with React, Vite, and powered by local Ollama models for maximum privacy and control.</p>
                    </div>
                  </div>

                  <div style={{ height: 1, background: c.border }} />

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Version
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8,
                      background: c.inputBg, border: `1px solid ${c.border}`,
                      fontSize: 13, color: c.text,
                    }}>
                      <span>Neuro v0.4</span>
                      <span style={{ fontSize: 12, color: c.textSec }}>Latest</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Credits
                    </div>
                    <div style={{ fontSize: 13, color: c.text, lineHeight: 1.6 }}>
                      <div>Created by <strong>Michael</strong></div>
                      <div style={{ marginTop: 8, fontSize: 12, color: c.textSec }}>
                        Built with Claude, React 18, Vite, Tailwind CSS, and Ollama
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Privacy
                    </div>
                    <div style={{ fontSize: 12, color: c.textSec, lineHeight: 1.6 }}>
                      All data is processed locally. No external requests unless explicitly enabled. Your privacy is paramount.
                    </div>
                  </div>

                  <div style={{ height: 1, background: c.border }} />

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.textSec, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      System
                    </div>
                    <button
                      onClick={() => { onClose(); setTimeout(() => window.location.reload(), 100); }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        color: c.text,
                        border: `1px solid ${c.border}`,
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: font,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                      }}
                    >
                      <span>Restart Frontend</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
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

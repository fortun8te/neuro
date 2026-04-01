/**
 * ProfileSettings -- Centered modal for editing account details
 * Dark mode aware, DM Sans, opacity fade animation
 */

import React, { useState, useRef, useEffect } from 'react'
import type { UserProfile } from '../services/auth'
import { updateProfile, uploadAvatar } from '../services/auth'
import { useTheme } from '../context/ThemeContext'
import BlobAvatar from './BlobAvatar'
import { getUserAvatarSeed } from './UserAvatar'
import { SunIcon, MoonIcon } from './Icons'

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ProfileSettingsProps {
  user: UserProfile
  isOpen: boolean
  onClose: () => void
  onUpdate: (user: UserProfile) => void
  onLogout: () => void
}

export function ProfileSettings({ user, isOpen, onClose, onUpdate, onLogout }: ProfileSettingsProps) {
  const [name, setName] = useState(user.name)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { isDarkMode, toggleTheme, animationsEnabled } = useTheme()

  useEffect(() => {
    setName(user.name)
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    const updated = await updateProfile({ name })
    if (updated) onUpdate(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!isOpen) return null

  const accent = isDarkMode ? '#3b82f6' : '#374151'
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'N'

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pfModalFadeIn 0.18s ease',
        }}
      >
        {/* Modal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: isDarkMode ? '#12121a' : '#FFFFFF',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : 'none',
            borderRadius: 20,
            maxWidth: 480,
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: 32,
            boxShadow: isDarkMode ? '0 25px 50px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
            fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
            position: 'relative',
            animation: 'pfModalFadeIn 0.18s ease',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#18181b' }}>
              Profile
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#a1a1aa',
                fontSize: 20,
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
                borderRadius: 6,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = isDarkMode ? 'rgba(255,255,255,0.7)' : '#52525b')}
              onMouseLeave={e => (e.currentTarget.style.color = isDarkMode ? 'rgba(255,255,255,0.4)' : '#a1a1aa')}
            >
              {'\u2715'}
            </button>
          </div>

          {/* Avatar section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 28,
          }}>
            <BlobAvatar
              seed={getUserAvatarSeed()}
              size={80}
              initials={getInitials(user.name)}
              animated={animationsEnabled}
            />
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Name" value={name} onChange={setName} isDarkMode={isDarkMode} />

            {/* Email -- display only */}
            <div>
              <label style={{
                fontSize: 13,
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#71717a',
                fontWeight: 500,
                marginBottom: 6,
                display: 'block',
                fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
              }}>
                Email
              </label>
              <div style={{
                fontSize: 14,
                color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#a1a1aa',
                padding: '10px 14px',
                fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
              }}>
                {user.email}
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 6,
            }}>
              <label style={{
                fontSize: 13,
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#71717a',
                fontWeight: 500,
                fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
              }}>
                Theme
              </label>
              <div
                onClick={toggleTheme}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: 54,
                  height: 28,
                  borderRadius: 999,
                  background: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(167,139,250,0.15)',
                  border: `1px solid ${isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(167,139,250,0.3)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  padding: '2px',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(59,130,246,0.3)' : 'rgba(167,139,250,0.25)'
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(59,130,246,0.6)' : 'rgba(167,139,250,0.5)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(167,139,250,0.15)'
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(167,139,250,0.3)'
                }}
              >
                {/* Animated toggle circle */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: isDarkMode ? 'rgba(59,130,246,0.9)' : 'rgba(167,139,250,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.25s ease',
                    transform: isDarkMode ? 'translateX(26px)' : 'translateX(0px)',
                  }}
                >
                  {isDarkMode ? (
                    <MoonIcon size={12} color="white" />
                  ) : (
                    <SunIcon size={12} color="white" />
                  )}
                </div>
              </div>
            </div>

            {/* Company and Role removed — keeping profile minimal */}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 999,
                border: 'none',
                background: saved ? '#16a34a' : isDarkMode ? accent : '#0F0F0F',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
                transition: 'background 0.15s',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saved ? 'Saved' : saving ? 'Saving...' : 'Save changes'}
            </button>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#71717a',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pfModalFadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
      `}</style>
    </>
  )
}

// -- Reusable Field --

function Field({ label, value, onChange, type = 'text', placeholder, isDarkMode }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; isDarkMode: boolean
}) {
  const accent = isDarkMode ? '#3b82f6' : '#374151'
  return (
    <div>
      <label style={{
        fontSize: 13,
        color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#71717a',
        fontWeight: 500,
        marginBottom: 6,
        display: 'block',
        fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
          background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
          fontSize: 14,
          color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#18181b',
          fontFamily: "'ABC Diatype Plus', system-ui, sans-serif",
          outline: 'none',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = isDarkMode ? 'rgba(59,130,246,0.4)' : '#A78BFA'
          e.currentTarget.style.boxShadow = isDarkMode ? 'none' : '0 0 0 3px rgba(167,139,250,0.15)'
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

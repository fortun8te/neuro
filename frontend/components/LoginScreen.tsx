/**
 * LoginScreen -- Split-screen login/signup with blurred gradient right panel
 */

import React, { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

interface LoginScreenProps {
  onLogin: (method: 'google' | 'email', email?: string, password?: string) => void
  onSignup?: (name: string, email: string, password: string) => void
}

const FONT = "'ABC Diatype Plus', system-ui, sans-serif"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen({ onLogin, onSignup }: LoginScreenProps) {
  const { isDarkMode } = useTheme()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // -- colors per mode --
  const bg = isDarkMode ? '#0a0a0f' : '#ffffff'
  const textPrimary = isDarkMode ? 'rgba(255,255,255,0.95)' : '#0F0F0F'
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.4)' : '#71717a'
  const inputBorder = isDarkMode ? 'rgba(255,255,255,0.15)' : '#E5E7EB'
  const btnBg = isDarkMode ? '#3b82f6' : '#0F0F0F'
  const btnBgGray = isDarkMode ? '#3b82f6' : '#6B7280'
  const btnHover = isDarkMode ? '#2563eb' : '#2a2a2a'
  const linkColor = isDarkMode ? '#3b82f6' : '#0F0F0F'

  const bothFilled = email.trim() !== '' && password.trim() !== ''

  // -- validation --
  function validate(): boolean {
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.')
      return false
    }
    if (mode === 'signup') {
      if (fullName.trim().length === 0) {
        setError('Full name is required.')
        return false
      }
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        setError('Password needs 8+ characters, 1 uppercase, 1 number')
        return false
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return false
      }
    } else {
      if (password.length < 1) {
        setError('Password is required.')
        return false
      }
    }
    setError('')
    return true
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin('email', email, password)
      } else if (onSignup) {
        await onSignup(fullName, email, password)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await onLogin('google')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Firebase not configured') || msg.includes('not configured')) {
        setError('Google login requires Firebase setup')
      } else {
        setError(msg || 'Google login failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  // -- shared input style --
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    border: 'none',
    borderBottom: `1px solid ${inputBorder}`,
    borderRadius: 0,
    background: 'transparent',
    fontSize: 15,
    color: textPrimary,
    fontFamily: FONT,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: textPrimary,
    marginBottom: 6,
    fontFamily: FONT,
  }

  // -- Google icon SVG --
  const googleIcon = (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'row',
      fontFamily: FONT,
      height: '100vh',
    }}>

      {/* ===== LEFT PANEL ===== */}
      <div style={{
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: bg,
        position: 'relative',
        padding: 0,
      }}>

        {/* Top-left: logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'absolute',
          top: 24,
          left: 32,
        }}>
          <img
            src="/neuro-icon.png"
            alt=""
            style={{ width: 24, height: 24, borderRadius: 6 }}
          />
          <img
            src="/neuro-wordmark.svg"
            alt="Neuro"
            style={{ height: 14 }}
          />
        </div>

        {/* Center content */}
        <div style={{
          maxWidth: 380,
          width: '100%',
          margin: 'auto',
          padding: '0 32px',
          boxSizing: 'border-box',
        }}>

          {/* Heading */}
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: textPrimary,
            letterSpacing: '-0.5px',
            margin: '0 0 32px',
            fontFamily: FONT,
            whiteSpace: 'nowrap',
          }}>
            {mode === 'login' ? 'Welcome to NEURO' : 'Create your account'}
          </h1>

          {/* Google button (login only) */}
          {mode === 'login' && (
            <>
              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: 999,
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'}`,
                  background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 15,
                  fontWeight: 500,
                  color: isDarkMode ? 'rgba(255,255,255,0.9)' : '#3f3f46',
                  fontFamily: FONT,
                  transition: 'border-color 0.15s, background 0.15s',
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)'
                  e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.1)' : '#fafafa'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)'
                  e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.06)' : '#ffffff'
                }}
              >
                {googleIcon}
                <span>Log in with Google</span>
              </button>

              {/* OR divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                margin: '24px 0',
              }}>
                <div style={{ flex: 1, height: 1, background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e4e4e7' }} />
                <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, fontFamily: FONT }}>OR</span>
                <div style={{ flex: 1, height: 1, background: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e4e4e7' }} />
              </div>
            </>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} autoComplete="on">
          {/* Signup: Full name */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError('') }}
                placeholder="Your full name"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderBottomColor = isDarkMode ? 'rgba(255,255,255,0.4)' : '#0F0F0F' }}
                onBlur={e => { e.currentTarget.style.borderBottomColor = inputBorder }}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="Enter your email address"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderBottomColor = isDarkMode ? 'rgba(255,255,255,0.4)' : '#0F0F0F' }}
              onBlur={e => { e.currentTarget.style.borderBottomColor = inputBorder }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: mode === 'signup' ? 16 : 0 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Enter your password"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderBottomColor = isDarkMode ? 'rgba(255,255,255,0.4)' : '#0F0F0F' }}
              onBlur={e => { e.currentTarget.style.borderBottomColor = inputBorder }}
            />
          </div>

          {/* Confirm password (signup only) */}
          {mode === 'signup' && (
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                placeholder="Confirm your password"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderBottomColor = isDarkMode ? 'rgba(255,255,255,0.4)' : '#0F0F0F' }}
                onBlur={e => { e.currentTarget.style.borderBottomColor = inputBorder }}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <p style={{
              fontSize: 12,
              color: '#ef4444',
              margin: '8px 0 0',
              fontFamily: FONT,
            }}>
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 999,
              border: 'none',
              background: mode === 'signup'
                ? btnBg
                : (bothFilled ? btnBg : btnBgGray),
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: '#ffffff',
              fontFamily: FONT,
              transition: 'background 0.2s',
              marginTop: 24,
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = btnHover }}
            onMouseLeave={e => {
              if (!loading) {
                e.currentTarget.style.background = mode === 'signup'
                  ? btnBg
                  : (bothFilled ? btnBg : btnBgGray)
              }
            }}
          >
            {loading
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
              : (mode === 'login' ? 'Continue' : 'Create account')}
          </button>
          </form>

          {/* Toggle link */}
          <p style={{
            textAlign: 'center',
            fontSize: 14,
            color: textSecondary,
            margin: '16px 0 0',
            fontFamily: FONT,
          }}>
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <span
                  onClick={() => { setMode('signup'); setError('') }}
                  style={{
                    textDecoration: 'underline',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: linkColor,
                  }}
                >
                  Sign up
                </span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span
                  onClick={() => { setMode('login'); setError('') }}
                  style={{
                    textDecoration: 'underline',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: linkColor,
                  }}
                >
                  Log in
                </span>
              </>
            )}
          </p>
        </div>

        {/* Bottom spacer */}
        <div style={{ padding: '0 0 24px' }} />
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div style={{ width: '50%', position: 'relative', overflow: 'hidden' }}>
        {/* Gradient layer -- oversized to avoid blur edge artifacts */}
        <div style={{
          position: 'absolute',
          inset: -60,
          background: `
            radial-gradient(ellipse at 30% 40%, rgba(56,189,248,0.8) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.7) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(147,197,253,0.6) 0%, transparent 45%),
            radial-gradient(ellipse at 80% 20%, rgba(186,230,253,0.5) 0%, transparent 55%),
            radial-gradient(ellipse at 20% 70%, rgba(96,165,250,0.4) 0%, transparent 50%),
            #7dd3fc
          `,
          filter: 'blur(40px)',
        }} />
      </div>
    </div>
  )
}

// @ts-nocheck
/**
 * Auth Service — Persistent account system
 * Stores user profile in IndexedDB, handles Google OAuth + guest flow
 */

import { get, set, del } from 'idb-keyval'

// ── Types ──

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string          // base64 data URL or external URL
  provider: 'google' | 'guest'
  createdAt: string
  lastLoginAt: string
  // Optional profile fields
  company?: string
  role?: string
  useCase?: 'ads' | 'research' | 'learning' | 'other'
  communicationStyle?: 'detailed' | 'summary' | 'flexible'
  // Storage
  quotaUsedBytes?: number
  quotaLimitBytes?: number
}

const AUTH_KEY = 'nomads_user'
const SESSIONS_KEY = 'nomads_sessions'

// ── Core Auth ──

/**
 * Get current logged-in user (or null)
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const user = await get<UserProfile>(AUTH_KEY)
    return user || null
  } catch {
    return null
  }
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Login with Google OAuth
 * In production, this would redirect to Google's OAuth flow
 * For now, creates a profile from the Google response
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  // TODO: Replace with real Google OAuth when deploying
  // For now, simulate with a prompt or use Google Identity Services
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (googleClientId && typeof google !== 'undefined') {
    // Real Google OAuth flow
    return new Promise((resolve, reject) => {
      (google as any).accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          try {
            // Decode JWT token from Google
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            const user: UserProfile = {
              id: `u_${payload.sub.slice(0, 12)}`,
              email: payload.email,
              name: payload.name || payload.email.split('@')[0],
              avatar: payload.picture || undefined,
              provider: 'google',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              quotaUsedBytes: 0,
              quotaLimitBytes: 100 * 1024 * 1024, // 100MB
            }

            // Check if returning user
            const existing = await getCurrentUser()
            if (existing && existing.email === user.email) {
              existing.lastLoginAt = new Date().toISOString()
              existing.avatar = user.avatar || existing.avatar
              await set(AUTH_KEY, existing)
              resolve(existing)
            } else {
              await set(AUTH_KEY, user)
              resolve(user)
            }
          } catch (err) {
            reject(err)
          }
        },
      })
      ;(google as any).accounts.id.prompt()
    })
  }

  // Fallback: manual email entry (for dev/testing)
  throw new Error('Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID in .env')
}

/**
 * Continue as guest — creates a local-only profile
 */
export async function loginAsGuest(name?: string, email?: string): Promise<UserProfile> {
  // Check for existing guest session
  const existing = await getCurrentUser()
  if (existing && existing.provider === 'guest') {
    existing.lastLoginAt = new Date().toISOString()
    if (name) existing.name = name
    if (email) existing.email = email
    await set(AUTH_KEY, existing)
    return existing
  }

  const id = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const user: UserProfile = {
    id,
    email: email || `guest_${id}@local`,
    name: name || 'Guest',
    provider: 'guest',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    quotaUsedBytes: 0,
    quotaLimitBytes: 100 * 1024 * 1024,
  }

  await set(AUTH_KEY, user)
  return user
}

/**
 * Logout — clears auth but preserves data
 */
export async function logout(): Promise<void> {
  await del(AUTH_KEY)
}

// ── Profile Management ──

/**
 * Update profile fields
 */
export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // Don't allow changing id, provider, createdAt
  const { id: _id, provider: _p, createdAt: _c, ...safeUpdates } = updates as any
  const updated = { ...user, ...safeUpdates }
  await set(AUTH_KEY, updated)
  return updated
}

/**
 * Upload profile picture — stores as base64 in IndexedDB
 * For MinIO integration later, this would upload to storage
 */
export async function uploadAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Image too large (max 2MB)'))
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string

      // Resize to 256x256 max
      const resized = await resizeImage(dataUrl, 256)

      // Save to profile
      await updateProfile({ avatar: resized })
      resolve(resized)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Resize image to max dimension while maintaining aspect ratio
 */
function resizeImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = dataUrl
  })
}

/**
 * Delete account — removes all user data
 */
export async function deleteAccount(): Promise<void> {
  await del(AUTH_KEY)
  await del(SESSIONS_KEY)
  // In production, also delete MinIO bucket contents
}

// ── Session Tracking ──

interface SessionRecord {
  id: string
  startedAt: string
  lastActiveAt: string
  wrapper: string
  title?: string
  messageCount: number
}

/**
 * Record a session for history
 */
export async function recordSession(session: SessionRecord): Promise<void> {
  const sessions = (await get<SessionRecord[]>(SESSIONS_KEY)) || []
  const existing = sessions.findIndex(s => s.id === session.id)
  if (existing >= 0) {
    sessions[existing] = session
  } else {
    sessions.unshift(session) // newest first
  }
  // Keep last 100 sessions
  await set(SESSIONS_KEY, sessions.slice(0, 100))
}

/**
 * Get session history
 */
export async function getSessionHistory(): Promise<SessionRecord[]> {
  return (await get<SessionRecord[]>(SESSIONS_KEY)) || []
}

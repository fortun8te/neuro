/**
 * useAuth -- React hook for authentication state
 * Tries Firebase first (Google OAuth + email/password), falls back to IndexedDB auth
 */

import { useState, useEffect, useCallback } from 'react'
import type { UserProfile } from '../services/auth'
import {
  getCurrentUser,
  loginWithGoogle as legacyLoginWithGoogle,
  loginAsGuest,
  logout as doLogout,
  updateProfile as doUpdateProfile,
} from '../services/auth'
import { set } from 'idb-keyval'
import {
  firebaseLoginWithGoogle,
  firebaseLoginWithEmail,
  firebaseSignOut,
  onFirebaseAuthChange,
  firebaseSignupWithEmail,
} from '../services/firebase'

const AUTH_KEY = 'nomads_user'

interface AuthState {
  user: UserProfile | null
  loading: boolean
  error: string | null
}

function firebaseUserToProfile(fbUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): UserProfile {
  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    avatar: fbUser.photoURL || undefined,
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    quotaUsedBytes: 0,
    quotaLimitBytes: 100 * 1024 * 1024,
  }
}

async function saveUser(profile: UserProfile) {
  await set(AUTH_KEY, profile)
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  // Check for existing session on mount + listen to Firebase auth changes
  useEffect(() => {
    // First, check IndexedDB for existing session
    getCurrentUser().then(user => {
      if (user) {
        setState({ user, loading: false, error: null })
      }
    }).catch(() => {})

    // Listen to Firebase auth state (will fire with null if not configured)
    const unsubscribe = onFirebaseAuthChange(async (fbUser) => {
      if (fbUser) {
        // Firebase user signed in -- sync to IndexedDB
        const existing = await getCurrentUser()
        if (existing && existing.id === fbUser.uid) {
          // Update last login
          existing.lastLoginAt = new Date().toISOString()
          existing.avatar = fbUser.photoURL || existing.avatar
          await saveUser(existing)
          setState({ user: existing, loading: false, error: null })
        } else {
          const profile = firebaseUserToProfile(fbUser)
          await saveUser(profile)
          setState({ user: profile, loading: false, error: null })
        }
      } else {
        // No Firebase user -- fall back to IndexedDB check
        const localUser = await getCurrentUser()
        setState({ user: localUser, loading: false, error: null })
      }
    })

    return () => { unsubscribe() }
  }, [])

  const handleGoogleLogin = useCallback(async () => {
    try {
      setState(s => ({ ...s, loading: true, error: null }))
      // Try Firebase first
      const fbUser = await firebaseLoginWithGoogle()
      const profile = firebaseUserToProfile(fbUser)
      await saveUser(profile)
      setState({ user: profile, loading: false, error: null })
      return profile
    } catch (err) {
      // Firebase not configured -- fall back to legacy Google OAuth
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg.includes('Firebase not configured')) {
        try {
          const user = await legacyLoginWithGoogle()
          setState({ user, loading: false, error: null })
          return user
        } catch (legacyErr) {
          const legacyMsg = legacyErr instanceof Error ? legacyErr.message : 'Login failed'
          setState(s => ({ ...s, loading: false, error: legacyMsg }))
          // Last resort: guest login
          if (legacyMsg.includes('not configured')) {
            return handleGuestLogin()
          }
          return null
        }
      }
      setState(s => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [])

  const handleEmailLogin = useCallback(async (email: string, password: string) => {
    try {
      setState(s => ({ ...s, loading: true, error: null }))
      // Try Firebase email/password
      const fbUser = await firebaseLoginWithEmail(email, password)
      const profile = firebaseUserToProfile(fbUser)
      profile.provider = 'google' // Firebase auth, stored as non-guest
      profile.email = email
      profile.name = fbUser.displayName || email.split('@')[0]
      await saveUser(profile)
      setState({ user: profile, loading: false, error: null })
      return profile
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      if (msg.includes('Firebase not configured')) {
        // Fall back to guest login with the email
        return handleGuestLogin(undefined, email)
      }
      setState(s => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [])

  const handleSignup = useCallback(async (name: string, email: string, password: string) => {
    try {
      setState(s => ({ ...s, loading: true, error: null }))
      // Try Firebase signup first
      const fbUser = await firebaseSignupWithEmail(email, password, name)
      const profile = firebaseUserToProfile(fbUser)
      profile.provider = 'google' // Firebase auth, stored as non-guest
      profile.email = email
      profile.name = name || fbUser.displayName || email.split('@')[0]
      await saveUser(profile)
      setState({ user: profile, loading: false, error: null })
      return profile
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      if (msg.includes('Firebase not configured')) {
        // Fall back to local auth -- create user in IndexedDB
        return handleGuestLogin(name, email)
      }
      setState(s => ({ ...s, loading: false, error: msg }))
      throw new Error(msg)
    }
  }, [])

  const handleGuestLogin = useCallback(async (name?: string, email?: string) => {
    try {
      setState(s => ({ ...s, loading: true, error: null }))
      const user = await loginAsGuest(name, email)
      setState({ user, loading: false, error: null })
      return user
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: 'Guest login failed' }))
      return null
    }
  }, [])

  const handleLogout = useCallback(async () => {
    await firebaseSignOut()
    await doLogout()
    setState({ user: null, loading: false, error: null })
  }, [])

  const handleUpdateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = await doUpdateProfile(updates)
    if (updated) {
      setState(s => ({ ...s, user: updated }))
    }
    return updated
  }, [])

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isLoggedIn: !!state.user,
    loginWithGoogle: handleGoogleLogin,
    loginWithEmail: handleEmailLogin,
    signupWithEmail: handleSignup,
    loginAsGuest: handleGuestLogin,
    logout: handleLogout,
    updateProfile: handleUpdateProfile,
  }
}

/**
 * UserAvatar — Clickable avatar in nav bar that opens profile settings
 * Uses BlobAvatar for consistent generative blobs with user profile
 */

import React from 'react'
import BlobAvatar from './BlobAvatar'
import type { UserProfile } from '../services/auth'

const AVATAR_SEED_KEY = 'neuro_user_avatar_seed';
const AVATAR_COLOR_KEY = 'neuro_user_avatar_color';
const DEFAULT_AVATAR_COLOR = '#8b5cf6'; // violet

/**
 * Returns the persistent avatar seed for the user.
 * If none exists in localStorage, creates a random UUID, persists it,
 * and dispatches the neuro-avatar-seed-changed event so all listeners update.
 */
export function getUserAvatarSeed(): string {
  try {
    let seed = localStorage.getItem(AVATAR_SEED_KEY);
    if (!seed) {
      seed = crypto.randomUUID();
      localStorage.setItem(AVATAR_SEED_KEY, seed);
      window.dispatchEvent(new CustomEvent('neuro-avatar-seed-changed', { detail: seed }));
    }
    return seed;
  } catch {
    return 'user'; // fallback if localStorage unavailable
  }
}

/**
 * Returns the persistent avatar color for the user.
 * Defaults to violet (#8b5cf6) if none is set.
 */
export function getUserAvatarColor(): string {
  try {
    return localStorage.getItem(AVATAR_COLOR_KEY) || DEFAULT_AVATAR_COLOR;
  } catch {
    return DEFAULT_AVATAR_COLOR;
  }
}

/**
 * Sets and persists the user avatar color, dispatching an event so all listeners update.
 */
export function setUserAvatarColor(color: string): void {
  try {
    localStorage.setItem(AVATAR_COLOR_KEY, color);
    window.dispatchEvent(new CustomEvent('neuro-avatar-color-changed', { detail: color }));
  } catch {
    // ignore
  }
}

/**
 * Extracts up to 2 initials from a display name.
 * "Michael Katz" -> "MK", "Alice" -> "A", "" -> "?"
 */
export function getUserInitials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  user: UserProfile
  size?: number
  onClick?: () => void
}

export function UserAvatar({ user, size = 32, onClick }: UserAvatarProps) {
  const initials = getUserInitials(user.name)
  const avatarSeed = getUserAvatarSeed()
  const avatarColor = getUserAvatarColor()

  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        transition: 'transform 0.1s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
      title={`${user.name} — ${user.email}`}
    >
      <BlobAvatar
        seed={avatarSeed}
        color={avatarColor}
        size={size}
        initials={initials}
        animated={false}
      />
    </button>
  )
}

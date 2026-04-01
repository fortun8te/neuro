/**
 * UserAvatar — Clickable avatar in nav bar that opens profile settings
 * Uses BlobAvatar for consistent generative blobs with user profile
 */

import React from 'react'
import BlobAvatar from './BlobAvatar'
import type { UserProfile } from '../services/auth'

const AVATAR_SEED_KEY = 'neuro_user_avatar_seed';

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

interface UserAvatarProps {
  user: UserProfile
  size?: number
  onClick?: () => void
}

export function UserAvatar({ user, size = 32, onClick }: UserAvatarProps) {
  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Get consistent avatar seed from localStorage — creates and persists one if missing
  const avatarSeed = getUserAvatarSeed()

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
        color="#8b5cf6"
        size={size}
        initials={initials}
        animated={false}
      />
    </button>
  )
}

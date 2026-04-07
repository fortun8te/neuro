/**
 * Supabase Auth Service
 *
 * CRITICAL: No async operations inside onAuthStateChange callback.
 * Async calls inside the listener cause a deadlock in supabase-js
 * where the session never resolves. Defer all async work with setTimeout.
 */
import { supabase } from './supabaseClient';
import type { UserProfile } from './auth';

// ---- Helpers ----

function toUserProfile(
  user: { id: string; email?: string | null; created_at: string; user_metadata?: Record<string, unknown> },
  profile?: { name?: string; avatar?: string } | null,
): UserProfile {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    name:
      (profile?.name as string) ??
      (meta.full_name as string) ??
      (meta.name as string) ??
      user.email?.split('@')[0] ??
      'User',
    avatar: (profile?.avatar as string) ?? (meta.avatar_url as string) ?? undefined,
    provider: ((meta.iss as string)?.includes('google') ? 'google' : 'guest') as 'google' | 'guest',
    createdAt: user.created_at ?? new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

async function ensureProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<void> {
  const meta = user.user_metadata ?? {};
  try {
    await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? '',
        name:
          (meta.full_name as string) ??
          (meta.name as string) ??
          user.email?.split('@')[0] ??
          'User',
        avatar: (meta.avatar_url as string) ?? undefined,
      },
      { onConflict: 'id' },
    );
  } catch {
    // Non-fatal
  }
}

// ---- Public API ----

export async function supabaseSignupWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign up failed');
  await ensureProfile({ ...data.user, user_metadata: { ...data.user.user_metadata, name } });
  return toUserProfile(data.user, { name });
}

export async function supabaseLoginWithEmail(
  email: string,
  password: string,
): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Login failed');
  await ensureProfile(data.user);
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar')
    .eq('id', data.user.id)
    .single();
  return toUserProfile(data.user, profile);
}

export async function supabaseLoginWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function supabaseLogout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function supabaseGetCurrentUser(): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', session.user.id)
      .single();
    return toUserProfile(session.user, profile);
  } catch {
    return toUserProfile(session.user, null);
  }
}

export async function supabaseUpdateProfile(
  userId: string,
  updates: { name?: string; avatar?: string },
): Promise<UserProfile | null> {
  await supabase.from('profiles').update(updates).eq('id', userId);
  return supabaseGetCurrentUser();
}

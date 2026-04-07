/**
 * Supabase Client — Singleton instance
 *
 * IMPORTANT: Only ONE createClient call in the entire app.
 * Multiple instances = multiple GoTrueClients = only one processes the hash.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://nrnubwurmpuziqmideav.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_T0hp3_LpDVttqenw0ieBBg_AyaDRIg2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'neuro-supabase-auth',
  },
});

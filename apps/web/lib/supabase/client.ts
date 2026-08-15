'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Anon key only — every read it can perform is one
 * the public RLS policy already allows (technical-plan §07).
 *
 * Returns null when the environment is not configured, so the demo build runs
 * against lib/fixtures without crashing. Callers must handle null.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

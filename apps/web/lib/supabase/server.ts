import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Server Supabase client, bound to the request's cookie jar.
 *
 * Logged-out feed and issue pages render through this with the anon key and
 * therefore see exactly the public policy — no client-side filtering of
 * confidential rows, ever (technical-plan §06/§07).
 *
 * Returns null when unconfigured; query modules fall back to lib/fixtures.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component — middleware refreshes the session
          // instead. Safe to swallow.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          /* see above */
        }
      },
    },
  });
}

/** The signed-in user, or null. Never throws — logged-out is a first-class state. */
export async function getSessionUser() {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * client.ts — Supabase client factories.
 *
 * Two variants, and the distinction is the whole security model:
 *
 *   anonClient(...)  — the `anon` key. RLS applies. Safe in a browser, safe in
 *                      a server component rendering for a logged-out user.
 *   userClient(jwt)  — the anon key plus a caller's access token. RLS applies
 *                      *as that user*. This is what a route handler should use
 *                      for anything acting on behalf of a signed-in person.
 *
 * The service-role variant lives in ./admin.ts and is deliberately NOT
 * re-exported here, so that a client bundle importing `db/client` can never
 * transitively pull in the service key.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.gen.ts';

export type Db = SupabaseClient<Database>;

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

/** Missing config is a startup error, never a silent fallback to a dead URL. */
export function readPublicEnv(env: NodeJS.ProcessEnv = process.env): SupabasePublicEnv {
  const url = env['SUPABASE_URL'] ?? env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = env['SUPABASE_ANON_KEY'] ?? env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url) {
    throw new Error('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set.');
  }
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set.');
  }
  return { url, anonKey };
}

const DEFAULT_AUTH = {
  // Nothing in backend/core owns a browser session. The Next app and the
  // workers manage their own token lifecycle; persisting here would leak a
  // session between requests in a server process.
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/**
 * Anonymous client. Sees exactly what a logged-out visitor sees: the public
 * feed policy and nothing else.
 */
export function anonClient(env?: SupabasePublicEnv): Db {
  const { url, anonKey } = env ?? readPublicEnv();
  return createClient<Database>(url, anonKey, {
    auth: { ...DEFAULT_AUTH },
    global: { headers: { 'x-swaram-client': 'anon' } },
  });
}

/**
 * Client scoped to one signed-in user. RLS evaluates against that user's JWT
 * claims (app_role / juris_id / juris_lvl — see technical-plan.html §07), so
 * this is the correct client for every request-path read and write.
 *
 * @param accessToken the caller's Supabase access token (NOT the service key).
 */
export function userClient(accessToken: string, env?: SupabasePublicEnv): Db {
  if (!accessToken) {
    throw new Error('userClient() requires an access token; use anonClient() for logged-out reads.');
  }
  const { url, anonKey } = env ?? readPublicEnv();
  return createClient<Database>(url, anonKey, {
    auth: { ...DEFAULT_AUTH },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-swaram-client': 'user',
      },
    },
  });
}

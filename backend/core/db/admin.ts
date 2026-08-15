/**
 * admin.ts — the service-role client. Bypasses RLS completely.
 *
 * SERVER ONLY. Importing this module from code that can reach a browser
 * bundle is a security incident, not a bug. Two guards enforce that:
 *
 *   1. A server-only marker check at module load. If the module is evaluated
 *      in an environment that looks like a browser, or without the explicit
 *      server marker, it throws immediately — at import time, so it fails in
 *      the build/dev server rather than in production traffic.
 *   2. The key itself is read from SUPABASE_SERVICE_ROLE_KEY, which must never
 *      be prefixed NEXT_PUBLIC_. There is no fallback to the anon key: an
 *      admin client that silently degrades to RLS-enforced reads would make
 *      the workers fail in confusing, data-dependent ways.
 *
 * Who is allowed to import this:
 *   backend/workers/**        — the poll loop and every job
 *   backend/scripts/**        — one-shot ingest
 *   apps/web  route handlers and server actions that have already
 *             authenticated + authorised the caller themselves
 *
 * Who is not: anything under a "use client" boundary, any shared component,
 * any module that apps/web/lib imports unconditionally.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.gen.ts';

// --- guard 1: this module must not evaluate anywhere client-ish ------------

const IS_BROWSER_LIKE =
  typeof (globalThis as { window?: unknown }).window !== 'undefined' ||
  typeof (globalThis as { document?: unknown }).document !== 'undefined';

/**
 * The marker. Next sets NEXT_RUNTIME on the server ('nodejs' | 'edge'); the
 * workers and scripts set SWARAM_SERVER=1 in their own entrypoints. Either is
 * sufficient; neither being present means we cannot prove we are server-side,
 * and we refuse rather than assume.
 */
function assertServerOnly(): void {
  if (IS_BROWSER_LIKE) {
    throw new Error(
      '@swaram/backend/db/admin was imported in a browser-like environment. ' +
        'The service-role key must never reach a client bundle. Import db/client instead.',
    );
  }
  const marker = process.env['SWARAM_SERVER'] ?? process.env['NEXT_RUNTIME'];
  if (!marker) {
    throw new Error(
      '@swaram/backend/db/admin requires a server-only marker. Set SWARAM_SERVER=1 in ' +
        'worker/script entrypoints, or run inside Next server runtime (NEXT_RUNTIME). ' +
        'If you are seeing this in a React component, you are on the wrong side of the ' +
        'client boundary — use db/client.',
    );
  }
}

assertServerOnly();

export type AdminDb = SupabaseClient<Database>;

let cached: AdminDb | null = null;

/**
 * Service-role client. Cached per process — creating one per request leaks
 * connections and defeats PostgREST's keep-alive.
 */
export function adminClient(): AdminDb {
  if (cached) return cached;

  assertServerOnly(); // re-check: the marker could be unset after load in tests

  const url = process.env['SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url) throw new Error('SUPABASE_URL is not set.');
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Do NOT substitute the anon key — ' +
        'the workers need to bypass RLS and would fail silently and partially.',
    );
  }
  if (serviceKey === process.env['SUPABASE_ANON_KEY']) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is set to the anon key. That is a misconfiguration.',
    );
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-swaram-client': 'service-role' } },
    db: { schema: 'public' },
  });
  return cached;
}

/** Test seam. Never call this from application code. */
export function __resetAdminClientForTests(): void {
  cached = null;
}

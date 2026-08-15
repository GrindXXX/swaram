import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export type SessionResult = {
  response: NextResponse;
  /** app_role claim from the JWT, or 'ANON'. */
  appRole: string;
  userId: string | null;
};

/**
 * Refreshes the Supabase session on every request and reads the custom
 * `app_role` claim minted by public.custom_access_token (technical-plan §07).
 *
 * Claims go stale: a JWT minted before a role change carries the old role until
 * it refreshes. That is tolerable here because this is UX only — RLS is the
 * real boundary, and this guard fails *closed* (unknown role => not gov).
 */
export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Unconfigured (fixture/demo mode): no session to refresh, everyone is anon.
    return { response, appRole: 'ANON', userId: null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // getUser() (not getSession()) — it revalidates the token with the auth
  // server, which is what actually performs the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let appRole = 'ANON';
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    appRole = readRoleClaim(session?.access_token) ?? 'CITIZEN';
  }

  return { response, appRole, userId: user?.id ?? null };
}

/** Decodes the JWT payload without verifying it — verification already happened
 *  in getUser(); this only reads a claim for a UX redirect. */
function readRoleClaim(accessToken?: string | null): string | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    const claims = JSON.parse(json) as { app_role?: string };
    return typeof claims.app_role === 'string' ? claims.app_role : null;
  } catch {
    return null;
  }
}

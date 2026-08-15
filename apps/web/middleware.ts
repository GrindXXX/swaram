import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Two jobs, in this order:
 *   1. Refresh the Supabase session cookie on every request.
 *   2. Gate /gov and /admin on the app_role JWT claim.
 *
 * (2) is UX, NOT security — RLS is the real boundary (technical-plan §07). A
 * citizen who forges their way past this guard sees an empty dashboard, because
 * every query underneath it is policy-filtered.
 *
 * The (gov) and (admin) route groups are owned by another agent; this file only
 * has to not get in their way.
 */
export async function middleware(request: NextRequest) {
  const { response, appRole, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const wantsGov = pathname === '/gov' || pathname.startsWith('/gov/');
  const wantsAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (!wantsGov && !wantsAdmin) return response;

  // Not signed in → sign in, then resume the exact intent (PRD §16: "No lost
  // intent, ever").
  if (!userId) {
    const to = request.nextUrl.clone();
    to.pathname = '/auth/sign-in';
    to.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(to);
  }

  const allowed =
    (wantsGov && (appRole === 'GOVERNMENT' || appRole === 'ADMIN')) ||
    (wantsAdmin && appRole === 'ADMIN');

  if (!allowed) {
    // Fail closed, and land them somewhere real rather than on a 403 wall.
    const to = request.nextUrl.clone();
    to.pathname = '/';
    to.search = '?notice=no-access';
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the service worker and image files.
     * The feed and issue pages DO pass through — they need the session refresh
     * so that "Following"/"You reported this" render correctly on first paint.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};

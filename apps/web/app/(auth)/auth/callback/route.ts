import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requested = request.nextUrl.searchParams.get('next') || '/gov';
  const next = requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')
    ? requested
    : '/gov';
  const supabase = createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const signIn = new URL('/auth/sign-in', request.url);
  signIn.searchParams.set('error', 'The sign-in link is invalid or expired. Request a new one.');
  signIn.searchParams.set('next', next);
  return NextResponse.redirect(signIn);
}

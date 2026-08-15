'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '/gov';
  return next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/gov';
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(formData.get('next'));
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(`/auth/sign-in?error=${encodeURIComponent('Enter a valid email address.')}&next=${encodeURIComponent(next)}`);
  }

  const supabase = createClient();
  if (!supabase) {
    redirect(`/auth/sign-in?error=${encodeURIComponent('Authentication is not configured.')}&next=${encodeURIComponent(next)}`);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });
  if (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent('Could not send the sign-in link. Try again.')}&next=${encodeURIComponent(next)}`);
  }
  redirect(`/auth/sign-in?sent=1&next=${encodeURIComponent(next)}`);
}

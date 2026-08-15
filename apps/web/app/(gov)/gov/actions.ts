'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function publicId(formData: FormData) {
  const value = String(formData.get('publicId') ?? '');
  if (!/^CIV-\d+$/.test(value)) throw new Error('Invalid issue identifier');
  return value;
}

function outcomeUrl(id: string, kind: 'success' | 'error', message: string) {
  return `/gov/t/${encodeURIComponent(id)}?${kind}=${encodeURIComponent(message)}`;
}

export async function startIssue(formData: FormData) {
  const id = publicId(formData);
  const supabase = createClient();
  if (!supabase) redirect(outcomeUrl(id, 'error', 'Supabase is not configured.'));
  const { error } = await supabase.rpc('gov_start_issue', { p_public_id: id });
  if (error) redirect(outcomeUrl(id, 'error', 'This issue cannot move to in progress. Check its status and routing tier.'));
  revalidatePath('/gov'); revalidatePath(`/gov/t/${id}`);
  redirect(outcomeUrl(id, 'success', 'Issue moved to in progress.'));
}

export async function postReply(formData: FormData) {
  const id = publicId(formData);
  const content = String(formData.get('content') ?? '').trim();
  const supabase = createClient();
  if (!supabase) redirect(outcomeUrl(id, 'error', 'Supabase is not configured.'));
  const { error } = await supabase.rpc('gov_post_public_reply', { p_public_id: id, p_content: content });
  if (error) redirect(outcomeUrl(id, 'error', 'The official reply was not published.'));
  revalidatePath(`/gov/t/${id}`);
  redirect(outcomeUrl(id, 'success', 'Official public reply published.'));
}

export async function submitResolution(formData: FormData) {
  const id = publicId(formData);
  const action = String(formData.get('actionTaken') ?? '').trim();
  const intent = String(formData.get('intent') ?? '').trim();
  const photo = String(formData.get('photoUrl') ?? '').trim();
  const supabase = createClient();
  if (!supabase) redirect(outcomeUrl(id, 'error', 'Supabase is not configured.'));
  const { error } = await supabase.rpc('gov_submit_resolution', {
    p_public_id: id, p_action_taken: action, p_intent: intent || null, p_photo_url: photo || null,
  });
  if (error) redirect(outcomeUrl(id, 'error', 'The resolution was not submitted. Check the issue status and evidence.'));
  revalidatePath('/gov'); revalidatePath(`/gov/t/${id}`);
  redirect(outcomeUrl(id, 'success', 'Resolution submitted for community verification.'));
}

export async function signOut() {
  const supabase = createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/auth/sign-in');
}

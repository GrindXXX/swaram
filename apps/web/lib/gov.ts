import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type GovIssue = {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  address?: string | null;
  status: string;
  priority: string;
  severity: string;
  routing_tier: 'ONBOARDED' | 'CONTACTABLE' | 'UNMAPPED';
  department: string | null;
  jurisdiction: string | null;
  owner: string | null;
  report_count: number;
  follower_count: number;
  civic_pressure: number;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GovDetail = GovIssue & {
  comments: Array<{ id: string; content: string; visibility: string; is_official: boolean; author: string; created_at: string }>;
  history: Array<{ id: number; action: string; old_value: string | null; new_value: string | null; actor_type: string; created_at: string }>;
  resolutions: Array<{ id: string; attempt: number; action_taken: string; intent: string | null; photo_url: string | null; submitted_at: string; outcome: string | null }>;
};

export async function getGovQueue(): Promise<{ data: GovIssue[]; error: string | null }> {
  noStore();
  const supabase = createClient();
  if (!supabase) return { data: [], error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('gov_queue');
  return { data: (data as GovIssue[] | null) ?? [], error: error ? 'The live queue could not be loaded.' : null };
}

export async function getGovIssue(publicId: string): Promise<{ data: GovDetail | null; error: string | null }> {
  noStore();
  const supabase = createClient();
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('gov_issue_detail', { p_public_id: publicId });
  return { data: data as GovDetail | null, error: error ? 'The live issue record could not be loaded.' : null };
}

export function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

export function slaLabel(issue: GovIssue) {
  if (issue.routing_tier !== 'ONBOARDED' || !issue.sla_due_at) return 'No SLA';
  const hours = Math.round((new Date(issue.sla_due_at).getTime() - Date.now()) / 3_600_000);
  return hours < 0 ? `${Math.abs(hours)}h overdue` : `${hours}h left`;
}

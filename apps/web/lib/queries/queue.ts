import { createClient } from '@/lib/supabase/server';
import { QUEUE, applyView, OFFICER } from '@/components/gov/fixtures';
import type { QueueIssue, SavedView } from '@/components/gov/types';

/**
 * Same fallback discipline as lib/queries/dashboard.ts: try Supabase, fall
 * back to the fixture QUEUE + applyView() on anything that isn't a clean
 * result. There is no `issues` table query wired here yet beyond a plain
 * select — the real version needs the saved-view predicates in
 * applyView() reimplemented as RLS-safe SQL (owner_id = auth.uid(), sla
 * breach, cluster-confidence band, etc.), which is follow-up work, not
 * something to fake with a partial query.
 */
export async function getQueue(view: SavedView): Promise<QueueIssue[]> {
  const supabase = createClient();
  if (!supabase) return applyView(QUEUE, view);
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('jurisdiction_id', OFFICER.jurisdiction_id);
    if (error || !data || data.length === 0) return applyView(QUEUE, view);
    return applyView(data as QueueIssue[], view);
  } catch {
    return applyView(QUEUE, view);
  }
}

import { createClient } from '@/lib/supabase/server';
import { OFFICER, GOV_KPIS, COVERAGE, DEPT_PERFORMANCE, TREND } from '@/components/gov/fixtures';
import type { GovKpis, CoverageRow, DeptPerformance, TrendPoint } from '@/components/gov/types';

/**
 * Dashboard query layer.
 *
 * Each function tries a real Supabase call first and falls back to the
 * fixtures in components/gov/fixtures.ts on any failure — unconfigured client,
 * missing table/function, RLS denial, network error, whatever. That fallback
 * is not hypothetical right now: `gov_kpis()`, `mv_department_performance` and
 * `mv_coverage` are referenced in components/gov/types.ts's doc comments as
 * the intended source, but none of the three are defined in
 * backend/supabase/migrations/*.sql yet (checked directly — only comments
 * mentioning them exist, e.g. 0007_issues.sql:123 and 0012_agent_runs.sql:58).
 * So today, every one of these calls fails over to fixtures unconditionally.
 * That's the honest current state, not a bug — the seam is here so wiring up
 * the real function/view later is a one-line swap, not a rewrite.
 */

export async function getGovKpis(): Promise<GovKpis> {
  const supabase = createClient();
  if (!supabase) return GOV_KPIS;
  try {
    const { data, error } = await supabase.rpc('gov_kpis', {
      p_juris: OFFICER.jurisdiction_id,
      p_dept: OFFICER.department_id,
    });
    if (error || !data) return GOV_KPIS;
    return data as GovKpis;
  } catch {
    return GOV_KPIS;
  }
}

/**
 * Issues grouped by jurisdiction. This is the "related districts" view — see
 * the caveat on COVERAGE in fixtures.ts: `level` is inferred from a name
 * string, not a verified administrative boundary. No ward/district polygon
 * data exists in this repo yet, so don't let this table's UI imply
 * point-in-polygon precision it doesn't have.
 */
export async function getCoverage(): Promise<CoverageRow[]> {
  const supabase = createClient();
  if (!supabase) return COVERAGE;
  try {
    const { data, error } = await supabase.from('mv_coverage').select('*');
    if (error || !data || data.length === 0) return COVERAGE;
    return data as CoverageRow[];
  } catch {
    return COVERAGE;
  }
}

export async function getDeptPerformance(): Promise<DeptPerformance[]> {
  const supabase = createClient();
  if (!supabase) return DEPT_PERFORMANCE;
  try {
    const { data, error } = await supabase.from('mv_department_performance').select('*');
    if (error || !data || data.length === 0) return DEPT_PERFORMANCE;
    return data as DeptPerformance[];
  } catch {
    return DEPT_PERFORMANCE;
  }
}

export async function getTrend(days = 14): Promise<TrendPoint[]> {
  const supabase = createClient();
  if (!supabase) return TREND.slice(-days);
  try {
    const { data, error } = await supabase
      .from('mv_issue_trend')
      .select('day, created, resolved')
      .order('day', { ascending: true })
      .limit(days);
    if (error || !data || data.length === 0) return TREND.slice(-days);
    return data as TrendPoint[];
  } catch {
    return TREND.slice(-days);
  }
}

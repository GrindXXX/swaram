import type { Session } from '@supabase/supabase-js';
import {
  currentUser,
  issues as fixtureIssues,
  trendingHeatingUp,
  trendingMomentum,
  trendingWaitingLongest,
  weeklyRecord as fixtureWeekly,
} from './mock-data';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Issue, Reply } from './types';
import type { ReportDraft } from './report-draft';

export { currentUser, trendingHeatingUp, trendingMomentum, trendingWaitingLongest };
export { isSupabaseConfigured };

type IssueRow = {
  id: string;
  public_id: string;
  title: string | null;
  category_id: string | null;
  location_precision: Issue['locationPrecision'];
  location_visibility: Issue['locationVisibility'];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  civic_pressure: number;
  estimated_people_affected: number | null;
  routing_tier: Issue['routingTier'];
  jurisdiction_id: number | null;
  jurisdiction_match_method: Issue['jurisdictionMatchMethod'];
  department_id: number | null;
  status: Issue['status'];
  published_at: string | null;
  sla_due_at: string | null;
  report_count: number;
  follower_count: number;
  created_at: string;
};

const ISSUE_COLUMNS = [
  'id',
  'public_id',
  'title',
  'category_id',
  'location_precision',
  'location_visibility',
  'severity',
  'civic_pressure',
  'estimated_people_affected',
  'routing_tier',
  'jurisdiction_id',
  'jurisdiction_match_method',
  'department_id',
  'status',
  'published_at',
  'sla_due_at',
  'report_count',
  'follower_count',
  'created_at',
].join(',');

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithEmail(email: string, returnPath = '/report/confirm'): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}${returnPath}` },
  });
  if (error) throw error;
}

export async function submitReport(draft: ReportDraft) {
  if (!supabase) throw new Error('Supabase is not configured for this build.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in is required to submit a report.');

  const { data, error } = await supabase.rpc('submit_citizen_report', {
    p_client_report_id: draft.clientReportId,
    p_description: draft.description,
    p_lat: draft.coordinates.lat,
    p_lng: draft.coordinates.lng,
    p_location_precision: draft.locationPrecision,
    p_location_visibility: draft.locationVisibility,
    p_is_anonymous: true,
  });

  if (error) throw error;
  const accepted = data[0];
  if (!accepted) throw new Error('The report was accepted but no issue identifier was returned.');
  return accepted;
}

export async function getIssues(): Promise<Issue[]> {
  if (!supabase) return fixtureIssues;
  return loadIssues();
}

export async function getIssue(publicId: string): Promise<Issue | null> {
  if (!supabase) return fixtureIssues.find((issue) => issue.id === publicId) ?? null;
  const loaded = await loadIssues(publicId);
  return loaded[0] ?? null;
}

export async function getCitizenIssueState(publicId: string) {
  if (!supabase) return { isFollowing: false, hasReported: false };
  const { data, error } = await supabase.rpc('citizen_issue_state', { p_public_id: publicId });
  if (error) throw error;
  return {
    isFollowing: data[0]?.is_following ?? false,
    hasReported: data[0]?.has_reported ?? false,
  };
}

export async function setIssueFollowing(publicId: string, following: boolean) {
  if (!supabase) throw new Error('Live actions are unavailable in demo mode.');
  const { data, error } = await supabase.rpc('set_citizen_issue_following', {
    p_public_id: publicId,
    p_following: following,
  });
  if (error) throw error;
  return data[0];
}

export async function createPublicComment(publicId: string, content: string) {
  if (!supabase) throw new Error('Live actions are unavailable in demo mode.');
  const { error } = await supabase.rpc('create_citizen_comment', {
    p_public_id: publicId,
    p_content: content,
  });
  if (error) throw error;
}

export async function addFacingTooReport(publicId: string, clientReportId: string) {
  if (!supabase) throw new Error('Live actions are unavailable in demo mode.');
  const { data, error } = await supabase.rpc('add_citizen_issue_report', {
    p_public_id: publicId,
    p_client_report_id: clientReportId,
  });
  if (error) throw error;
  return data[0];
}

export async function getMyIssues(): Promise<{ created: Issue[]; following: Issue[] }> {
  if (!supabase) {
    return { created: fixtureIssues.slice(0, 2), following: fixtureIssues.slice(2, 5) };
  }
  const session = await getSession();
  if (!session) throw new Error('Sign in to see issues you created or follow.');

  const { data, error } = await supabase.rpc('citizen_my_issue_ids');
  if (error) throw error;
  const createdIds = (data ?? []).filter((row) => row.relation === 'created').map((row) => row.issue_id);
  const followingIds = (data ?? []).filter((row) => row.relation === 'following').map((row) => row.issue_id);
  const loaded = await loadIssues(undefined, unique([...createdIds, ...followingIds]));
  return {
    created: loaded.filter((issue) => issue.internalId && createdIds.includes(issue.internalId)),
    following: loaded.filter((issue) => issue.internalId && followingIds.includes(issue.internalId)),
  };
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  meta: string;
  to: string;
  isRead: boolean;
};

/**
 * Real notifications for the signed-in citizen (RLS: notifications_self).
 * The backend team's own verification found this table has 0 rows and no
 * delivery path wired up yet — so today this genuinely returns an empty
 * list for a real account. That's correct, not a bug: showing nothing is
 * more honest than the hand-authored engagement notifications this used to
 * render unconditionally. Demo mode (no Supabase configured) keeps its own
 * illustrative array, kept in Alerts.tsx rather than duplicated here.
 */
export async function getNotifications(): Promise<NotificationItem[]> {
  if (!supabase) return [];
  const session = await getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,title,body,url,is_read,created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    type: row.type,
    title: row.title,
    body: row.body,
    meta: relativeTime(row.created_at),
    to: row.url ?? '/',
    isRead: row.is_read,
  }));
}

export type WeeklyDigest = {
  posted: number;
  resolved: number;
  waiting: number;
  hottest: { rage: number; label: string; publicId: string }[];
};

/**
 * Real aggregate counts from `issues`, scoped by whatever RLS already lets
 * this client see (published/public rows). There is no digest RPC or
 * per-week bucketing in the schema yet, so this is deliberately narrower
 * than the old mock: it covers "posted / resolved / waiting" and a real
 * "hottest by pressure" list, and leaves out "fastest fixed" and the
 * district-spotlight trend — those need resolution-time and weekly
 * date-bucketed history this backend doesn't compute yet. Demo mode keeps
 * the full illustrative record from mock-data.ts.
 */
export async function getWeeklyDigest(): Promise<WeeklyDigest> {
  if (!supabase) {
    return {
      posted: fixtureWeekly.posted,
      resolved: fixtureWeekly.resolved,
      waiting: fixtureWeekly.waiting,
      hottest: fixtureWeekly.hottest.map((h) => ({ ...h, publicId: '' })),
    };
  }

  const [postedResult, resolvedResult, waitingResult, hottestResult] = await Promise.all([
    supabase.from('issues').select('id', { count: 'exact', head: true }),
    supabase.from('issues').select('id', { count: 'exact', head: true }).in('status', ['RESOLVED', 'CLOSED']),
    supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(RESOLVED,CLOSED,REJECTED,MERGED)'),
    supabase.from('issues').select('public_id,title,civic_pressure').order('civic_pressure', { ascending: false }).limit(3),
  ]);

  const firstError = [postedResult.error, resolvedResult.error, waitingResult.error, hottestResult.error].find(Boolean);
  if (firstError) throw firstError;

  return {
    posted: postedResult.count ?? 0,
    resolved: resolvedResult.count ?? 0,
    waiting: waitingResult.count ?? 0,
    hottest: (hottestResult.data ?? []).map((row) => ({
      rage: Math.round(Number(row.civic_pressure)),
      label: row.title ?? row.public_id,
      publicId: row.public_id,
    })),
  };
}

/**
 * Real per-jurisdiction issue counts, keyed by jurisdiction name, for the
 * civic-terrain map to use in place of its hash-fabricated numbers where a
 * name actually matches. In practice the overlap with the topojson's
 * official state/district names is thin right now — this repo's seeded
 * jurisdictions are ward-level ("Ward 42 · Whitefield") — but the wiring is
 * correct for when jurisdiction naming lines up with administrative
 * boundaries. Unmatched regions keep the map's existing labelled-as-sample
 * behaviour; this never claims polygon-grade precision either way.
 */
export async function getJurisdictionCounts(): Promise<Record<string, number>> {
  if (!supabase) return {};

  const { data: issueRows, error } = await supabase.from('issues').select('jurisdiction_id').not('jurisdiction_id', 'is', null);
  if (error) throw error;

  const counts = new Map<number, number>();
  (issueRows ?? []).forEach((row) => {
    if (row.jurisdiction_id != null) counts.set(row.jurisdiction_id, (counts.get(row.jurisdiction_id) ?? 0) + 1);
  });
  const ids = [...counts.keys()];
  if (ids.length === 0) return {};

  const { data: jurisdictionRows, error: jError } = await supabase.from('jurisdictions').select('id,name').in('id', ids);
  if (jError) throw jError;

  const byName: Record<string, number> = {};
  (jurisdictionRows ?? []).forEach((row) => {
    byName[row.name] = counts.get(row.id) ?? 0;
  });
  return byName;
}

export type TrendingHeating = { id: string; rank: number; title: string; rage: number; affected: number; posts: number };
export type TrendingWaiting = { title: string; days: string };

/**
 * "Heating up" and "waiting longest" for the Feed's Trending tab, from real
 * `issues` rows. "Gaining momentum" isn't included — it needs a delta over
 * time (e.g. reports in the last 48h) this backend doesn't track, so making
 * it up would be worse than leaving it out. Demo mode keeps all three from
 * mock-data.ts, unchanged.
 */
export async function getTrending(): Promise<{ heating: TrendingHeating[]; waiting: TrendingWaiting[] }> {
  if (!supabase) return { heating: [], waiting: [] };

  const [heatingResult, waitingResult] = await Promise.all([
    supabase
      .from('issues')
      .select('public_id,title,civic_pressure,estimated_people_affected,report_count')
      .order('civic_pressure', { ascending: false })
      .limit(5),
    supabase
      .from('issues')
      .select('title,created_at')
      .not('status', 'in', '(RESOLVED,CLOSED,REJECTED,MERGED)')
      .order('created_at', { ascending: true })
      .limit(5),
  ]);

  if (heatingResult.error) throw heatingResult.error;
  if (waitingResult.error) throw waitingResult.error;

  return {
    heating: (heatingResult.data ?? []).map((row, i) => ({
      id: row.public_id,
      rank: i + 1,
      title: row.title ?? row.public_id,
      rage: Math.round(Number(row.civic_pressure)),
      affected: row.estimated_people_affected ?? row.report_count,
      posts: row.report_count,
    })),
    waiting: (waitingResult.data ?? []).map((row) => ({
      title: row.title ?? 'Untitled report',
      days: `${Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000))}d`,
    })),
  };
}

async function loadIssues(publicId?: string, internalIds?: string[]): Promise<Issue[]> {
  if (!supabase) return fixtureIssues;

  let query = supabase
    .from('issues')
    .select(ISSUE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(publicId ? 1 : 30);

  if (publicId) query = query.eq('public_id', publicId);
  if (internalIds) {
    if (internalIds.length === 0) return [];
    query = query.in('id', internalIds).limit(100);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as IssueRow[];
  if (rows.length === 0) return [];

  const issueIds = rows.map((row) => row.id);
  const categoryIds = unique(rows.map((row) => row.category_id));
  const jurisdictionIds = unique(rows.map((row) => row.jurisdiction_id));
  const departmentIds = unique(rows.map((row) => row.department_id));

  const [commentsResult, reportsResult, historyResult, categoriesResult, jurisdictionsResult, departmentsResult, descriptionsResult] =
    await Promise.all([
      supabase
        .from('comments')
        .select('id,issue_id,user_id,content,is_official,created_at')
        .in('issue_id', issueIds)
        .order('created_at', { ascending: true }),
      supabase.from('reports').select('id,issue_id,media_type').in('issue_id', issueIds),
      supabase
        .from('issue_history')
        .select('id,issue_id,action,created_at')
        .in('issue_id', issueIds)
        .order('created_at', { ascending: true }),
      categoryIds.length
        ? supabase.from('categories').select('id,label').in('id', categoryIds)
        : Promise.resolve({ data: [], error: null }),
      jurisdictionIds.length
        ? supabase.from('jurisdictions').select('id,name').in('id', jurisdictionIds)
        : Promise.resolve({ data: [], error: null }),
      departmentIds.length
        ? supabase.from('departments').select('id,name').in('id', departmentIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('citizen_issue_descriptions', { p_issue_ids: issueIds }),
    ]);

  const firstError = [
    commentsResult.error,
    reportsResult.error,
    historyResult.error,
    categoriesResult.error,
    jurisdictionsResult.error,
    departmentsResult.error,
    descriptionsResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const categories = new Map((categoriesResult.data ?? []).map((row) => [row.id, row.label]));
  const jurisdictions = new Map((jurisdictionsResult.data ?? []).map((row) => [row.id, row.name]));
  const departments = new Map((departmentsResult.data ?? []).map((row) => [row.id, row.name]));
  const descriptions = new Map((descriptionsResult.data ?? []).map((row) => [row.issue_id, row.description]));

  return rows.map((row) => {
    const replies: Reply[] = (commentsResult.data ?? [])
      .filter((comment) => comment.issue_id === row.id)
      .map((comment) => ({
        id: comment.id,
        authorKind: comment.is_official ? 'government' : 'citizen',
        authorLabel: comment.is_official
          ? departments.get(row.department_id ?? -1) ?? 'Government response'
          : citizenHandle(comment.user_id),
        timeAgo: relativeTime(comment.created_at),
        body: comment.content,
      }));

    const history = (historyResult.data ?? [])
      .filter((entry) => entry.issue_id === row.id)
      .map((entry) => historyLabel(entry.action));

    const reportMedia = (reportsResult.data ?? []).filter(
      (report) => report.issue_id === row.id && report.media_type !== 'NONE',
    );
    const jurisdiction = row.jurisdiction_id ? jurisdictions.get(row.jurisdiction_id) : null;

    return {
      id: row.public_id,
      internalId: row.id,
      title: row.title ?? 'Civic issue reported',
      body: descriptions.get(row.id) ?? 'Details are restricted to the reporter and responsible authority.',
      category: (row.category_id && categories.get(row.category_id)) ?? 'Unclassified',
      ward: jurisdictionLabel(jurisdiction, row.jurisdiction_match_method),
      city: 'Location recorded',
      status: row.status,
      authorHandle: 'Citizen reporter',
      timeAgo: relativeTime(row.created_at),
      filedOn: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
        new Date(row.created_at),
      ),
      rage: Math.round(Number(row.civic_pressure)),
      affected: row.estimated_people_affected ?? row.report_count,
      reportCount: row.report_count,
      standingWithCount: row.follower_count,
      photoCount: reportMedia.length,
      overdueDays: overdueDays(row.sla_due_at),
      routingTier: row.routing_tier,
      jurisdictionMatchMethod: row.jurisdiction_match_method,
      locationPrecision: row.location_precision,
      locationVisibility: row.location_visibility,
      publishedToFeed: row.published_at !== null,
      replies,
      history: history.length > 0 ? [...new Set(history)] : ['Reported'],
    } satisfies Issue;
  });
}

function unique<T>(values: (T | null | undefined)[]): T[] {
  return [...new Set(values.filter((value): value is T => value !== null && value !== undefined))];
}

function citizenHandle(userId: string | null): string {
  return `Citizen #${(userId ?? 'ANON').replaceAll('-', '').slice(0, 4).toUpperCase()}`;
}

function jurisdictionLabel(name: string | null | undefined, method: Issue['jurisdictionMatchMethod']): string {
  if (!name) return 'Jurisdiction pending';
  return method === 'POLYGON' ? name : `${name} · approximate match`;
}

function overdueDays(dueAt: string | null): number | undefined {
  if (!dueAt) return undefined;
  const days = Math.floor((Date.now() - new Date(dueAt).getTime()) / 86_400_000);
  return days > 0 ? days : undefined;
}

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function historyLabel(action: string): string {
  switch (action) {
    case 'CREATED':
      return 'Reported';
    case 'DEPARTMENT_CHANGED':
      return 'Routed';
    case 'OWNER_CHANGED':
      return 'Assigned';
    case 'PUBLISHED':
      return 'Published';
    case 'STATUS_CHANGED':
      return 'Status updated';
    case 'ESCALATED':
      return 'Escalated';
    default:
      return action.toLowerCase().replaceAll('_', ' ');
  }
}

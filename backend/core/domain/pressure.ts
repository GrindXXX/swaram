/**
 * pressure.ts — civic pressure and feed ranking (PRD §06).
 *
 * Three numbers that must never collapse into one:
 *
 *   severity        objective danger. Drives priority and SLA. NEVER influenced
 *                   by report count. Lives in domain/sla.ts.
 *   civic pressure  social demand. Drives feed ranking, escalation candidacy,
 *                   the weekly digest. NEVER drives SLA. Lives here.
 *   people affected estimate. Drives priority weighting (capped) and scale
 *                   escalation. Lives in sla.ts + escalation checks.
 *
 * Everything in this file is a pure, auditable formula. PRD §13 is explicit
 * that this must not be a model: "a 'rage score' nobody can explain will be
 * accused of bias the first week." Every call returns its own breakdown so an
 * officer who disagrees can be shown the arithmetic term by term.
 */

import type { Db } from '../db/client.ts';
import type { AdminDb } from '../db/admin.ts';
import type { IssueSeverity } from '../types/enums.ts';
import type { PressureInputs, PressureResult } from '../types/index.ts';

type AnyDb = Db | AdminDb;

/** Server-side config. Tunable live; logged per request for debugging. */
export interface PressureWeights {
  reports: number;
  supports: number;
  followers: number;
  discussion: number;
  age: number;
  rejectedResolution: number;
  reopen: number;
  /** Subtracted when the authority is genuinely engaging. */
  engagementDamping: number;
}

export const DEFAULT_PRESSURE_WEIGHTS: Readonly<PressureWeights> = Object.freeze({
  reports: 26,
  supports: 20,
  followers: 10,
  discussion: 10,
  age: 18,
  rejectedResolution: 12,
  reopen: 8,
  engagementDamping: 22,
});

/**
 * Civic pressure, 0..100.
 *
 * Design constraints from PRD §06/§20:
 *  - every crowd term is log-scaled, so the 200th report cannot pin one issue
 *    to the top of the feed forever, and gaming has sharply diminishing returns;
 *  - pressure RISES when a resolution is rejected or the issue is reopened —
 *    "this is the accountability loop's teeth";
 *  - pressure DECAYS when the authority is genuinely engaging (acknowledgement,
 *    official replies, progress evidence). It measures unmet demand, not hostility.
 */
export function computePressure(
  inputs: PressureInputs,
  weights: PressureWeights = DEFAULT_PRESSURE_WEIGHTS,
): PressureResult {
  const breakdown: Record<string, number> = {};

  breakdown['reports'] = weights.reports * logScale(inputs.reportCount, 50);
  breakdown['supports'] = weights.supports * logScale(inputs.supportCount, 200);
  breakdown['followers'] = weights.followers * logScale(inputs.followerCount, 200);
  breakdown['discussion'] = weights.discussion * logScale(inputs.commentCount, 60);

  // Unresolved age. Saturates at 30 days — a year-old issue is not 12x the
  // pressure of a month-old one, it is just neglected, which the feed's
  // "longest pending" sort already surfaces.
  breakdown['age'] = weights.age * clamp01(inputs.ageHours / (30 * 24));

  breakdown['rejectedResolution'] =
    weights.rejectedResolution * clamp01(inputs.rejectedResolutions / 2);
  breakdown['reopen'] = weights.reopen * clamp01(inputs.reopenCount / 2);

  // Damping. Acknowledgement alone is worth something; replies and progress
  // evidence are worth more, because they are harder to fake than a status flip.
  const engagement =
    (inputs.acknowledged ? 0.3 : 0) +
    0.35 * clamp01(inputs.officialReplies / 3) +
    0.35 * clamp01(inputs.progressEvidenceCount / 3);

  // Engagement that has gone stale stops damping: an acknowledgement three
  // weeks ago is not engagement.
  const staleness =
    inputs.hoursSinceAuthorityActivity === null
      ? 1
      : clamp01(1 - inputs.hoursSinceAuthorityActivity / (14 * 24));

  breakdown['engagementDamping'] = -(weights.engagementDamping * engagement * staleness);

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.round(clamp(raw, 0, 100) * 10) / 10;

  return { score, breakdown };
}

/** Feed ranking weights (PRD §06). Server-side config, tunable without a release. */
export interface RankingWeights {
  proximity: number;
  severity: number;
  reportCount: number;
  recentActivity: number;
  peopleAffected: number;
  staleness: number;
}

export const DEFAULT_RANKING_WEIGHTS: Readonly<RankingWeights> = Object.freeze({
  proximity: 0.3,
  severity: 0.2,
  reportCount: 0.2,
  recentActivity: 0.15,
  peopleAffected: 0.1,
  staleness: 0.05,
});

const SEVERITY_SCORE: Readonly<Record<IssueSeverity, number>> = Object.freeze({
  LOW: 0.2,
  MEDIUM: 0.5,
  HIGH: 0.8,
  CRITICAL: 1.0,
});

export interface RankingInputs {
  distanceKm: number;
  severity: IssueSeverity;
  reportCount: number;
  hoursSinceLastActivity: number;
  estimatedPeopleAffected: number | null;
  isResolved: boolean;
  ageHours: number;
  /** An issue with a report in the last hour gets a temporary lift. */
  hasFreshReport: boolean;
}

/**
 * score = w1·proximity + w2·severity + w3·log(reports) + w4·recency
 *       + w5·people − w6·staleness
 *
 * Returned with its breakdown so a feed request can be logged and replayed.
 */
export function rankIssue(
  inputs: RankingInputs,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  breakdown['proximity'] = weights.proximity * (1 / (1 + Math.max(0, inputs.distanceKm)));
  breakdown['severity'] = weights.severity * SEVERITY_SCORE[inputs.severity];
  breakdown['reportCount'] = weights.reportCount * logScale(inputs.reportCount, 50);
  // 72-hour decay, per §06.
  breakdown['recentActivity'] =
    weights.recentActivity * Math.exp(-Math.max(0, inputs.hoursSinceLastActivity) / 72);
  breakdown['peopleAffected'] =
    weights.peopleAffected * logScale(inputs.estimatedPeopleAffected ?? 0, 5000);

  // Resolved issues stay in the feed for 48h with before/after media — visible
  // wins keep people reporting — then sink hard.
  const stalenessTerm = inputs.isResolved ? clamp01((inputs.ageHours - 48) / 48) : 0;
  breakdown['staleness'] = -(weights.staleness * stalenessTerm);

  let score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  if (inputs.hasFreshReport) {
    breakdown['freshReportBoost'] = score * 0.15;
    score += breakdown['freshReportBoost'];
  }

  return { score: Math.round(score * 10000) / 10000, breakdown };
}

/**
 * Department diversity: no more than 3 consecutive cards from one department
 * (PRD §06). Applied after ranking, as a stable reshuffle rather than a re-sort,
 * so the feed stays explainable.
 */
export function enforceDepartmentDiversity<T extends { departmentId: number | null }>(
  ranked: T[],
  maxRun = 3,
): T[] {
  const out: T[] = [];
  const deferred: T[] = [];
  let lastDept: number | null | undefined;
  let run = 0;

  for (const item of [...ranked]) {
    if (item.departmentId === lastDept && run >= maxRun) {
      deferred.push(item);
      continue;
    }
    if (item.departmentId === lastDept) run += 1;
    else {
      lastDept = item.departmentId;
      run = 1;
    }
    out.push(item);

    // Flush anything deferred that no longer violates the run.
    for (let i = deferred.length - 1; i >= 0; i--) {
      const d = deferred[i]!;
      if (d.departmentId !== lastDept) {
        deferred.splice(i, 1);
        out.push(d);
        lastDept = d.departmentId;
        run = 1;
      }
    }
  }
  return [...out, ...deferred];
}

/**
 * Recompute and persist pressure for one issue. Cheap enough to run on every
 * report/support/comment; the pg_cron recompute sweep exists only for the age
 * term, which changes with no user action.
 */
export async function recomputePressure(
  db: AnyDb,
  issueId: string,
  weights: PressureWeights = DEFAULT_PRESSURE_WEIGHTS,
): Promise<PressureResult> {
  const { data: issue, error } = await db
    .from('issues')
    .select(
      'id, report_count, support_count, follower_count, comment_count, created_at, acknowledged_at, last_activity_at, status',
    )
    .eq('id', issueId)
    .single();

  if (error) throw new Error(`recomputePressure read failed: ${error.message}`);

  const [{ count: replies }, { count: progress }, { count: rejections }] = await Promise.all([
    db
      .from('issue_transfers')
      .select('id', { count: 'exact', head: true })
      .eq('issue_id', issueId),
    db
      .from('evidence')
      .select('id', { count: 'exact', head: true })
      .eq('issue_id', issueId)
      .eq('type', 'PROGRESS'),
    db
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .eq('issue_id', issueId)
      .in('verdict', ['STILL_EXISTS', 'NEW_PROBLEM']),
  ]);

  const now = Date.now();
  const createdAt = new Date(issue.created_at).getTime();
  const lastActivity = new Date(issue.last_activity_at).getTime();

  const result = computePressure(
    {
      reportCount: issue.report_count,
      supportCount: issue.support_count,
      followerCount: issue.follower_count,
      commentCount: issue.comment_count,
      ageHours: (now - createdAt) / 3_600_000,
      hoursSinceAuthorityActivity: issue.acknowledged_at
        ? (now - lastActivity) / 3_600_000
        : null,
      acknowledged: issue.acknowledged_at !== null,
      officialReplies: replies ?? 0,
      progressEvidenceCount: progress ?? 0,
      rejectedResolutions: rejections ?? 0,
      reopenCount: issue.status === 'REOPENED' ? 1 : 0,
    },
    weights,
  );

  const { error: updErr } = await db
    .from('issues')
    .update({ civic_pressure: result.score })
    .eq('id', issueId);
  if (updErr) throw new Error(`recomputePressure write failed: ${updErr.message}`);

  return result;
}

// --- helpers --------------------------------------------------------------

/** log1p normalised against a saturation point. 0 at n=0, ~1 at n=saturateAt. */
function logScale(n: number, saturateAt: number): number {
  if (n <= 0) return 0;
  return clamp01(Math.log1p(n) / Math.log1p(saturateAt));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

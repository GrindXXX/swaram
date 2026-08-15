import type { IssueSummary } from './types';

/**
 * Feed ranking — PRD §06.
 *
 * The feed is NOT chronological. For V1 a transparent scoring formula beats a
 * learned model: it is explainable, debuggable and demo-able.
 *
 *   score = w1·proximity + w2·severity + w3·report_count
 *         + w4·recent_activity + w5·people_affected − w6·staleness
 *
 * ⚠ Weights are server-side config in production, tunable without a client
 * release and logged per feed request. The defaults below mirror the PRD so the
 * fixture feed ranks correctly; `packages/shared/scoring.ts` is the eventual
 * single source (imported by the app AND the workers so they cannot drift).
 */

export const DEFAULT_WEIGHTS = {
  proximity: 0.3,
  severity: 0.2,
  reportCount: 0.2,
  recentActivity: 0.15,
  peopleAffected: 0.1,
  staleness: 0.05,
} as const;

export type Weights = typeof DEFAULT_WEIGHTS;

const SEVERITY_SCORE = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.8, CRITICAL: 1.0 } as const;

export function scoreIssue(
  issue: IssueSummary,
  now: Date = new Date(),
  w: Weights = DEFAULT_WEIGHTS,
): number {
  const km = (issue.distanceM ?? 5000) / 1000;
  const proximity = 1 / (1 + km);

  const severity = SEVERITY_SCORE[issue.severity];

  // Log-scale and cap, so the 200th report doesn't permanently pin one issue.
  const reportCount = Math.min(1, Math.log10(1 + issue.reportCount) / Math.log10(101));

  // Decay over 72h.
  const hours = (now.getTime() - new Date(issue.lastActivityAt).getTime()) / 3600000;
  const recentActivity = Math.max(0, 1 - hours / 72);

  const peopleAffected = Math.min(1, Math.log10(1 + issue.peopleAffected) / 5);

  // Resolved and old sinks.
  const ageDays = (now.getTime() - new Date(issue.createdAt).getTime()) / 86400000;
  const closed = issue.status === 'RESOLVED' || issue.status === 'CLOSED';
  const staleness = Math.min(1, (closed ? 0.6 : 0.15) * ageDays);

  let score =
    w.proximity * proximity +
    w.severity * severity +
    w.reportCount * reportCount +
    w.recentActivity * recentActivity +
    w.peopleAffected * peopleAffected -
    w.staleness * staleness;

  // Fresh-report boost: a report in the last hour gets a temporary multiplier
  // so live problems surface.
  if (hours < 1) score *= 1.25;

  return score;
}

/**
 * Rank, then enforce the two structural rules the raw score cannot express:
 *   · resolved issues stay visible for 48h (visible wins keep people reporting)
 *   · no more than 3 consecutive cards from the same department
 */
export function rankFeed(
  issues: IssueSummary[],
  now: Date = new Date(),
  w: Weights = DEFAULT_WEIGHTS,
): IssueSummary[] {
  const visible = issues.filter((i) => {
    if (i.status !== 'RESOLVED' && i.status !== 'CLOSED') return true;
    const hrs = (now.getTime() - new Date(i.lastActivityAt).getTime()) / 3600000;
    return hrs <= 48;
  });

  const scored = visible
    .map((issue) => ({ issue, score: scoreIssue(issue, now, w) }))
    .sort((a, b) => b.score - a.score);

  return diversify(scored.map((s) => s.issue));
}

/** Guaranteed diversity: never more than 3 in a row from one department. */
export function diversify(list: IssueSummary[], maxRun = 3): IssueSummary[] {
  const out: IssueSummary[] = [];
  const held: IssueSummary[] = [];
  let run = 0;
  let lastDept: string | null = null;

  for (const item of list) {
    if (item.department === lastDept && run >= maxRun) {
      held.push(item);
      continue;
    }
    // Before appending, see if a held card can break the run.
    out.push(item);
    run = item.department === lastDept ? run + 1 : 1;
    lastDept = item.department;

    const idx = held.findIndex((h) => h.department !== lastDept);
    if (idx >= 0 && run >= maxRun) {
      const [next] = held.splice(idx, 1);
      if (next) {
        out.push(next);
        run = 1;
        lastDept = next.department;
      }
    }
  }
  return out.concat(held);
}

/** The other two numbers that must never collapse into the score (PRD §06). */
export function pressureBand(pressure: number): { label: string; tone: 'rage' | 'ember' | 'ink' } {
  if (pressure >= 75) return { label: 'Boiling over', tone: 'rage' };
  if (pressure >= 50) return { label: 'Heating up', tone: 'ember' };
  if (pressure >= 25) return { label: 'Simmering', tone: 'ink' };
  return { label: 'Quiet', tone: 'ink' };
}

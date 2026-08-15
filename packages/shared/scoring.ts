/**
 * scoring.ts — pure functions. No database, no network, no clock of its own.
 *
 * Everything here is deterministic given its inputs. `now` is always a
 * parameter, never `Date.now()` inside a formula, because these numbers get
 * recomputed on the server, replayed in tests and explained to an officer who
 * disagrees with them. A function that reads the wall clock cannot be replayed.
 *
 * PRD §06 ("three numbers that must never collapse into one") is the contract:
 *
 *   severity        objective, from report content. NEVER reads report count.
 *   civic pressure  social, 0-100. NEVER drives the SLA.
 *   people affected an estimate, capped in its influence.
 *
 * The tests in scoring.test.ts assert those separations directly. If you are
 * tempted to pass reportCount into a severity path, that test is why you can't.
 */

import { IssuePriority, IssueSeverity, IssueStatus } from './enums.js';

/* ================================================================== *
 * Severity
 * ================================================================== */

/** LOW…CRITICAL → 0.2…1.0 (PRD §06 ranking formula, term w2). */
export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  LOW: 0.2,
  MEDIUM: 0.4,
  HIGH: 0.7,
  CRITICAL: 1.0,
};

/**
 * Numeric weight of a severity.
 *
 * Note the signature: severity in, number out. There is deliberately no way to
 * pass a report count, a supporter count or an age into this function. Severity
 * is what the intake agent read off the photo and the words; the crowd does not
 * get a vote on how dangerous a live wire is (PRD §06).
 */
export function severityWeight(severity: IssueSeverity): number {
  return SEVERITY_WEIGHT[severity];
}

/* ================================================================== *
 * SLA — PRD §10
 * ================================================================== */

export interface Sla {
  /** Hours from creation within which the owner must acknowledge. */
  readonly ackHours: number;
  /** Days from creation within which the issue must be resolved. */
  readonly resolveDays: number;
  /** What happens when the resolve window is missed. */
  readonly escalationOnBreach: string;
}

const SLA_TABLE: Record<IssuePriority, Sla> = {
  CRITICAL: {
    ackHours: 1,
    resolveDays: 1,
    escalationOnBreach: 'Immediate supervisor alert + admin dashboard flag',
  },
  HIGH: {
    ackHours: 4,
    resolveDays: 3,
    escalationOnBreach: 'Supervisor alert at breach',
  },
  MEDIUM: {
    ackHours: 24,
    resolveDays: 7,
    escalationOnBreach: 'Appears in Overdue view; weekly digest',
  },
  LOW: {
    ackHours: 48,
    resolveDays: 14,
    escalationOnBreach: 'Overdue view only',
  },
};

/**
 * The SLA promised for a priority (PRD §10).
 *
 *   CRITICAL  1 hour  / 24 hours
 *   HIGH      4 hours / 3 days
 *   MEDIUM    1 day   / 7 days
 *   LOW       2 days  / 14 days
 *
 * Priority — not severity, and never civic pressure — sets this clock. A
 * thousand angry reports about a cracked kerb do not make it a one-hour job.
 */
export function slaFor(priority: IssuePriority): Sla {
  return SLA_TABLE[priority];
}

/** Absolute deadline by which the owner must acknowledge. */
export function ackDeadline(priority: IssuePriority, createdAt: Date): Date {
  return new Date(createdAt.getTime() + slaFor(priority).ackHours * 3_600_000);
}

/** Absolute deadline by which the issue must be resolved. */
export function resolveDeadline(priority: IssuePriority, createdAt: Date): Date {
  return new Date(createdAt.getTime() + slaFor(priority).resolveDays * 86_400_000);
}

export interface SlaState {
  /** Milliseconds until the resolve deadline. Negative once breached. */
  readonly msRemaining: number;
  readonly breached: boolean;
  /** Whole days overdue, 0 when not breached. For "overdue by 2 days". */
  readonly daysOverdue: number;
  readonly deadline: Date;
}

/**
 * Where an issue stands against its resolve deadline.
 *
 * Terminal statuses have no live clock — a closed issue is not accruing
 * lateness, and rendering a running countdown on one is a lie.
 */
export function slaState(
  priority: IssuePriority,
  createdAt: Date,
  now: Date,
  status?: IssueStatus,
): SlaState {
  const deadline = resolveDeadline(priority, createdAt);
  const stopped =
    status === IssueStatus.RESOLVED ||
    status === IssueStatus.CLOSED ||
    status === IssueStatus.REJECTED ||
    status === IssueStatus.MERGED;

  if (stopped) {
    return { msRemaining: 0, breached: false, daysOverdue: 0, deadline };
  }

  const msRemaining = deadline.getTime() - now.getTime();
  const breached = msRemaining < 0;
  return {
    msRemaining,
    breached,
    daysOverdue: breached ? Math.floor(-msRemaining / 86_400_000) : 0,
    deadline,
  };
}

/* ================================================================== *
 * Civic pressure — PRD §06
 * ================================================================== */

export interface CivicPressureInput {
  /** Distinct citizen reports of the same problem. */
  readonly reportCount: number;
  /** "I'm facing this too" taps. */
  readonly supporterCount: number;
  readonly followerCount: number;
  /** Public comments on the thread. */
  readonly commentCount: number;
  /** Days the issue has gone unresolved. */
  readonly daysUnresolved: number;
  /** Times a submitted resolution was rejected by the community. Each one
   *  raises pressure — this is the accountability loop's teeth. */
  readonly rejectedResolutions?: number;
  /** The authority has acknowledged. Dampens pressure. */
  readonly acknowledged?: boolean;
  /** Official replies posted by the authority. Dampen pressure. */
  readonly officialReplies?: number;
  /** Progress evidence uploads. Dampen pressure. */
  readonly progressUpdates?: number;
}

/** Published weights. Server-side config in production; these are the defaults. */
export const PRESSURE_WEIGHTS = {
  reports: 30,
  supporters: 25,
  discussion: 10,
  age: 20,
  rejection: 15,
} as const;

/** Saturating curve: fast at the start, flat at the end. Returns 0…1.
 *  `half` is the input value at which the output reaches 0.5. */
function saturate(value: number, half: number): number {
  const v = Math.max(0, value);
  return v / (v + half);
}

/**
 * Civic pressure, 0-100. The "rage meter".
 *
 * It measures *unmet demand*, not hostility — which is why every term that
 * counts the crowd is saturating (the 200th report cannot pin an issue at 100)
 * and why genuine engagement by the authority subtracts. An acknowledged issue
 * with weekly progress photos should cool down even while the crowd grows.
 *
 * This number never touches the SLA (PRD §06). It drives feed rank, escalation
 * candidacy and the weekly digest, and it is shown to officers as context, not
 * as a leaderboard.
 */
export function civicPressure(input: CivicPressureInput): number {
  const {
    reportCount,
    supporterCount,
    followerCount,
    commentCount,
    daysUnresolved,
    rejectedResolutions = 0,
    acknowledged = false,
    officialReplies = 0,
    progressUpdates = 0,
  } = input;

  const reports = saturate(reportCount, 25) * PRESSURE_WEIGHTS.reports;
  const backing = saturate(supporterCount + followerCount * 0.5, 150) *
    PRESSURE_WEIGHTS.supporters;
  const discussion = saturate(commentCount, 40) * PRESSURE_WEIGHTS.discussion;
  const age = saturate(daysUnresolved, 21) * PRESSURE_WEIGHTS.age;
  // Rejection is not saturating in the same way: two rejections is a scandal.
  const rejection = Math.min(1, rejectedResolutions / 2) * PRESSURE_WEIGHTS.rejection;

  const raw = reports + backing + discussion + age + rejection;

  // Engagement damping. Capped at 30% off — an authority cannot talk an issue
  // down to zero without actually fixing it.
  const damping = Math.min(
    0.3,
    (acknowledged ? 0.1 : 0) +
      Math.min(0.12, officialReplies * 0.04) +
      Math.min(0.12, progressUpdates * 0.06),
  );

  return clamp01to100(raw * (1 - damping));
}

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Presentation band for the pressure meter. Text, never colour alone. */
export type PressureBand = 'CALM' | 'RISING' | 'HEATING_UP' | 'BOILING';

export function pressureBand(pressure: number): PressureBand {
  if (pressure >= 85) return 'BOILING';
  if (pressure >= 70) return 'HEATING_UP';
  if (pressure >= 40) return 'RISING';
  return 'CALM';
}

export const PRESSURE_BAND_LABEL: Record<PressureBand, string> = {
  CALM: 'Calm',
  RISING: 'Rising',
  HEATING_UP: 'Heating up',
  BOILING: 'Boiling',
};

/* ================================================================== *
 * Feed ranking — PRD §06
 * ================================================================== */

/** Default weights (PRD §06). Server-side config in production; tunable
 *  without a client release and logged per feed request. */
export const FEED_WEIGHTS = {
  /** w1 · proximity */
  proximity: 0.3,
  /** w2 · severity */
  severity: 0.2,
  /** w3 · report count, log scale, capped */
  reportCount: 0.2,
  /** w4 · recent activity, decayed over 72 h */
  recentActivity: 0.15,
  /** w5 · people affected */
  peopleAffected: 0.1,
  /** w6 · staleness — SUBTRACTED */
  staleness: 0.05,
} as const;

export type FeedWeights = {
  readonly [K in keyof typeof FEED_WEIGHTS]: number;
};

export interface FeedRankInput {
  /** Distance from the viewer, kilometres. */
  readonly distanceKm: number;
  readonly severity: IssueSeverity;
  readonly reportCount: number;
  /** When the issue last had a report, comment or official update. */
  readonly lastActivityAt: Date;
  /** Estimated, not counted. Capped in its influence (PRD §06). */
  readonly estimatedPeopleAffected: number;
  readonly status: IssueStatus;
  /** When the issue reached a terminal status, if it has. */
  readonly resolvedAt?: Date | null;
  readonly createdAt: Date;
}

/** Report count above which the log term is capped, so the 200th report does
 *  not permanently pin one issue to the top. */
export const REPORT_COUNT_CAP = 200;

/** Estimated-affected value at which the term saturates. An AI estimate of
 *  "~50,000 affected" must not hijack a department's whole queue. */
export const PEOPLE_AFFECTED_CAP = 5_000;

/** Window during which a fresh report earns the boost multiplier. */
export const FRESH_REPORT_WINDOW_MS = 3_600_000;
export const FRESH_REPORT_MULTIPLIER = 1.15;

/** 1 / (1 + km). 0 km → 1.0, 1 km → 0.5, 9 km → 0.1. */
export function proximityTerm(distanceKm: number): number {
  return 1 / (1 + Math.max(0, distanceKm));
}

/**
 * log(1 + n) / log(1 + cap), clamped to 1.
 *
 * Log-scaled on purpose: going from 1 report to 10 must matter far more than
 * going from 190 to 200. Without this a single viral complaint outranks a
 * sewage overflow next to a school that nobody has tweeted about.
 */
export function reportCountTerm(reportCount: number, cap = REPORT_COUNT_CAP): number {
  const n = Math.max(0, reportCount);
  return Math.min(1, Math.log1p(n) / Math.log1p(cap));
}

/** Exponential decay with a 72 h half-life-ish shape: 1.0 now, ~0.37 at 72 h. */
export function recentActivityTerm(lastActivityAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / 3_600_000);
  return Math.exp(-hours / 72);
}

/** Saturating, so the estimate cannot dominate. */
export function peopleAffectedTerm(
  estimated: number,
  cap = PEOPLE_AFFECTED_CAP,
): number {
  const n = Math.max(0, estimated);
  return Math.min(1, Math.log1p(n) / Math.log1p(cap));
}

/** How long resolved issues stay in the feed before sinking (PRD §06). */
export const RESOLVED_FEED_WINDOW_HOURS = 48;

/**
 * Staleness, 0…1. Subtracted from the score.
 *
 * Resolved issues stay in the feed for 48 h with before/after media — visible
 * wins are what keep people reporting — then sink. Unresolved issues gather a
 * mild staleness only from silence, never enough to bury real neglect: the
 * "longest pending" sort exists precisely so neglect surfaces.
 */
export function stalenessTerm(input: FeedRankInput, now: Date): number {
  const { status, resolvedAt, lastActivityAt } = input;
  const terminal =
    status === IssueStatus.RESOLVED ||
    status === IssueStatus.CLOSED ||
    status === IssueStatus.REJECTED ||
    status === IssueStatus.MERGED;

  if (terminal) {
    const since = resolvedAt ?? lastActivityAt;
    const hours = Math.max(0, (now.getTime() - since.getTime()) / 3_600_000);
    return Math.min(1, hours / RESOLVED_FEED_WINDOW_HOURS);
  }

  const daysQuiet = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / 86_400_000);
  return Math.min(0.5, daysQuiet / 60);
}

export interface FeedRankBreakdown {
  readonly score: number;
  readonly terms: {
    readonly proximity: number;
    readonly severity: number;
    readonly reportCount: number;
    readonly recentActivity: number;
    readonly peopleAffected: number;
    readonly staleness: number;
  };
  readonly freshReportBoost: boolean;
}

/**
 * Feed rank, PRD §06. Returns the score and every term that produced it,
 * because "why is this card third?" must be answerable from a log line.
 *
 *   score = .30·proximity + .20·severity + .20·log(reports)
 *         + .15·recentActivity + .10·peopleAffected − .05·staleness
 *
 * Note that civic pressure is NOT a term. Pressure is itself built from reports
 * and age; feeding it in here would double-count the crowd and let popularity
 * quietly become importance, which is the exact failure §06 forbids.
 */
export function feedRankDetailed(
  input: FeedRankInput,
  now: Date,
  weights: FeedWeights = FEED_WEIGHTS,
): FeedRankBreakdown {
  const terms = {
    proximity: proximityTerm(input.distanceKm),
    severity: severityWeight(input.severity),
    reportCount: reportCountTerm(input.reportCount),
    recentActivity: recentActivityTerm(input.lastActivityAt, now),
    peopleAffected: peopleAffectedTerm(input.estimatedPeopleAffected),
    staleness: stalenessTerm(input, now),
  };

  const base =
    weights.proximity * terms.proximity +
    weights.severity * terms.severity +
    weights.reportCount * terms.reportCount +
    weights.recentActivity * terms.recentActivity +
    weights.peopleAffected * terms.peopleAffected -
    weights.staleness * terms.staleness;

  const freshReportBoost =
    now.getTime() - input.lastActivityAt.getTime() < FRESH_REPORT_WINDOW_MS &&
    !isTerminal(input.status);

  return {
    score: freshReportBoost ? base * FRESH_REPORT_MULTIPLIER : base,
    terms,
    freshReportBoost,
  };
}

function isTerminal(status: IssueStatus): boolean {
  return (
    status === IssueStatus.RESOLVED ||
    status === IssueStatus.CLOSED ||
    status === IssueStatus.REJECTED ||
    status === IssueStatus.MERGED
  );
}

/** Feed rank score alone. See feedRankDetailed for the breakdown. */
export function feedRank(
  input: FeedRankInput,
  now: Date,
  weights: FeedWeights = FEED_WEIGHTS,
): number {
  return feedRankDetailed(input, now, weights).score;
}

/**
 * Order a feed, then enforce the diversity rule: no more than 3 consecutive
 * cards from the same department (PRD §06). Pure — it sorts a copy.
 */
export function applyDepartmentDiversity<T extends { departmentId: string | null }>(
  ranked: readonly T[],
  maxConsecutive = 3,
): T[] {
  const out: T[] = [];
  const pool = [...ranked];

  while (pool.length > 0) {
    let pickedIndex = 0;

    const tailRun = runLengthAtTail(out);
    if (tailRun.length >= maxConsecutive) {
      const alt = pool.findIndex((c) => c.departmentId !== tailRun.departmentId);
      if (alt !== -1) pickedIndex = alt;
    }

    out.push(pool.splice(pickedIndex, 1)[0] as T);
  }
  return out;
}

function runLengthAtTail<T extends { departmentId: string | null }>(
  out: readonly T[],
): { departmentId: string | null; length: number } {
  if (out.length === 0) return { departmentId: null, length: 0 };
  const departmentId = (out[out.length - 1] as T).departmentId;
  let length = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    if ((out[i] as T).departmentId !== departmentId) break;
    length++;
  }
  return { departmentId, length };
}

/* ================================================================== *
 * Satisfaction — arithmetic over citizen votes, PRD §03
 * ================================================================== */

export interface VerificationTally {
  readonly COMPLETELY_FIXED: number;
  readonly PARTIALLY_FIXED: number;
  readonly STILL_EXISTS: number;
  readonly NEW_PROBLEM: number;
}

export interface SatisfactionResult {
  /** 0-100. Partial credit for PARTIALLY_FIXED. */
  readonly score: number;
  /** Share who said COMPLETELY_FIXED, 0-100. The number shown to citizens. */
  readonly completelyFixedPct: number;
  readonly totalResponses: number;
  /** Below ~50% completely-fixed the issue does not close (PRD §03). */
  readonly closes: boolean;
  /** True when turnout was too low to mean anything. Recorded honestly rather
   *  than manufacturing consent. */
  readonly insufficientVerification: boolean;
}

/** Minimum responses before a verdict is treated as a community judgment. */
export const VERIFICATION_QUORUM = 5;
/** Share of COMPLETELY_FIXED at or above which an issue closes. */
export const CLOSE_THRESHOLD_PCT = 50;

export function satisfaction(
  tally: VerificationTally,
  quorum = VERIFICATION_QUORUM,
): SatisfactionResult {
  const totalResponses =
    tally.COMPLETELY_FIXED +
    tally.PARTIALLY_FIXED +
    tally.STILL_EXISTS +
    tally.NEW_PROBLEM;

  if (totalResponses === 0) {
    return {
      score: 0,
      completelyFixedPct: 0,
      totalResponses: 0,
      closes: false,
      insufficientVerification: true,
    };
  }

  const score = Math.round(
    ((tally.COMPLETELY_FIXED * 1 + tally.PARTIALLY_FIXED * 0.5) / totalResponses) * 100,
  );
  const completelyFixedPct = Math.round((tally.COMPLETELY_FIXED / totalResponses) * 100);
  const insufficientVerification = totalResponses < quorum;

  return {
    score,
    completelyFixedPct,
    totalResponses,
    // Low turnout closes the issue at the window's end, but records
    // "insufficient verification" rather than manufacturing consent.
    closes: insufficientVerification || completelyFixedPct >= CLOSE_THRESHOLD_PCT,
    insufficientVerification,
  };
}

/* ================================================================== *
 * Priority — severity + affected, never the crowd
 * ================================================================== */

export interface PriorityInput {
  readonly severity: IssueSeverity;
  readonly estimatedPeopleAffected: number;
  readonly emergency?: boolean;
}

/**
 * Derive a queue priority. Severity dominates; scale can promote by at most one
 * step. Report count is not a parameter and must never become one — that is
 * what would let a well-organised WhatsApp group outrank a school's sewage.
 */
export function derivePriority(input: PriorityInput): IssuePriority {
  if (input.emergency || input.severity === IssueSeverity.CRITICAL) {
    return IssuePriority.CRITICAL;
  }

  const ladder: IssuePriority[] = [
    IssuePriority.LOW,
    IssuePriority.MEDIUM,
    IssuePriority.HIGH,
    IssuePriority.CRITICAL,
  ];
  const base: Record<IssueSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

  const scaleBump = input.estimatedPeopleAffected >= 1_000 ? 1 : 0;
  const index = Math.min(ladder.length - 1, base[input.severity] + scaleBump);
  return ladder[index] as IssuePriority;
}

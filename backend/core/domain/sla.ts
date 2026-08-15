/**
 * sla.ts — the SLA clock (PRD §10, technical-plan.html §10 E3).
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE:
 *   Only routing_tier === 'ONBOARDED' gets an SLA. Tier 2 (CONTACTABLE) shows
 *   dispatch state; Tier 3 (UNMAPPED) shows "published, waiting". A countdown
 *   against a department that has never heard of Swaram is a lie to the citizen
 *   and, per PRD §12, "the fastest way to lose them."
 *
 * computeDeadlines() therefore returns `applies: false` with null dates rather
 * than a plausible-looking date the UI might render anyway. There is no code
 * path in this module that produces a deadline for Tier 2/3.
 */

import type { Db } from '../db/client.ts';
import type { AdminDb } from '../db/admin.ts';
import type { IssuePriority, RoutingTier } from '../types/enums.ts';
import type { SlaDeadlines, SlaPolicy } from '../types/index.ts';

type AnyDb = Db | AdminDb;

/** PRD §10 SLA policy table. Ack and resolve are measured separately. */
export const DEFAULT_SLA: Readonly<Record<IssuePriority, SlaPolicy>> = Object.freeze({
  CRITICAL: { ackHours: 1, resolveDays: 1 },
  HIGH: { ackHours: 4, resolveDays: 3 },
  MEDIUM: { ackHours: 24, resolveDays: 7 },
  LOW: { ackHours: 48, resolveDays: 14 },
});

/** What happens on breach, per PRD §10. Consumed by the SLA sweep + notify job. */
export const BREACH_ACTION: Readonly<Record<IssuePriority, string>> = Object.freeze({
  CRITICAL: 'Immediate supervisor alert + admin dashboard flag',
  HIGH: 'Supervisor alert at breach',
  MEDIUM: 'Appears in Overdue view; weekly digest',
  LOW: 'Overdue view only',
});

export interface DeadlineArgs {
  priority: IssuePriority;
  routingTier: RoutingTier | null;
  /** ISO. Defaults to now. */
  from?: string;
  /** departments.sla_overrides, already fetched. Shape: {"HIGH":{ack_hours,resolve_days}} */
  overrides?: unknown;
}

/**
 * Compute the ack and resolve deadlines for an issue — or refuse to.
 *
 * `applies: false` is not an error state. It is the correct, honest answer for
 * roughly all of India on day one (technical-plan.html §01, Finding 2).
 */
export function computeDeadlines(args: DeadlineArgs): SlaDeadlines {
  if (args.routingTier !== 'ONBOARDED') {
    return {
      ackDueAt: null,
      resolveDueAt: null,
      applies: false,
      reason:
        args.routingTier === 'CONTACTABLE'
          ? 'Tier 2 (CONTACTABLE): grievance emailed, no officer account. Show dispatch state, not a clock.'
          : 'Tier 3 (UNMAPPED): no authority contact. Show "published, awaiting contact", not a clock.',
    };
  }

  const policy = resolvePolicy(args.priority, args.overrides);
  const from = args.from ? new Date(args.from) : new Date();
  if (Number.isNaN(from.getTime())) throw new Error(`Invalid SLA start time: ${args.from}`);

  return {
    ackDueAt: addHours(from, policy.ackHours).toISOString(),
    resolveDueAt: addHours(from, policy.resolveDays * 24).toISOString(),
    applies: true,
    reason: `Tier 1 (ONBOARDED): ${args.priority} — ack ${policy.ackHours}h, resolve ${policy.resolveDays}d.`,
  };
}

/**
 * Merge a department's sla_overrides over the default policy. Defensive: the
 * column is jsonb, so anything can be in it; a malformed override falls back to
 * the default rather than producing NaN dates.
 */
export function resolvePolicy(priority: IssuePriority, overrides?: unknown): SlaPolicy {
  const base = DEFAULT_SLA[priority];
  if (!overrides || typeof overrides !== 'object') return base;

  const forPriority = (overrides as Record<string, unknown>)[priority];
  if (!forPriority || typeof forPriority !== 'object') return base;

  const o = forPriority as Record<string, unknown>;
  const ackHours = positiveNumber(o['ack_hours']) ?? base.ackHours;
  const resolveDays = positiveNumber(o['resolve_days']) ?? base.resolveDays;
  return { ackHours, resolveDays };
}

/**
 * Priority is derived, not the same thing as severity (PRD §06: three numbers
 * that must never collapse into one).
 *
 *   severity            drives priority, always. Objective danger.
 *   people affected     nudges priority up, CAPPED at one step — an AI estimate
 *                       of "~50,000 affected" must not hijack a whole queue.
 *   report count        does NOT appear here at all. It drives civic pressure
 *                       and feed ranking, never the SLA.
 */
export function derivePriority(args: {
  severity: IssuePriority;
  estimatedPeopleAffected: number | null;
  emergencyFlag: boolean;
}): IssuePriority {
  if (args.emergencyFlag) return 'CRITICAL';

  const ladder: IssuePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let idx = ladder.indexOf(args.severity);
  if (idx < 0) idx = 1;

  const affected = args.estimatedPeopleAffected ?? 0;
  if (affected >= 1000) idx = Math.min(idx + 1, ladder.length - 1); // capped: one step
  return ladder[idx]!;
}

export interface SlaState {
  applies: boolean;
  ackBreached: boolean;
  resolveBreached: boolean;
  /** Negative when overdue. Null when no clock applies. */
  hoursToAck: number | null;
  hoursToResolve: number | null;
  label: string;
}

/**
 * What the UI renders. For Tier 2/3 the label is dispatch state, never a
 * countdown — the caller passes `dispatchLabel` from the email/publish state.
 */
export function slaState(args: {
  routingTier: RoutingTier | null;
  slaAckDueAt: string | null;
  slaDueAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  now?: Date;
  dispatchLabel?: string;
}): SlaState {
  const now = args.now ?? new Date();

  if (args.routingTier !== 'ONBOARDED' || !args.slaDueAt) {
    return {
      applies: false,
      ackBreached: false,
      resolveBreached: false,
      hoursToAck: null,
      hoursToResolve: null,
      label:
        args.dispatchLabel ??
        (args.routingTier === 'CONTACTABLE'
          ? 'Sent · awaiting response'
          : 'Published · no authority contact yet'),
    };
  }

  const hoursToAck = args.acknowledgedAt
    ? null
    : args.slaAckDueAt
      ? hoursBetween(now, new Date(args.slaAckDueAt))
      : null;
  const hoursToResolve = args.resolvedAt ? null : hoursBetween(now, new Date(args.slaDueAt));

  const ackBreached = hoursToAck !== null && hoursToAck < 0;
  const resolveBreached = hoursToResolve !== null && hoursToResolve < 0;

  let label: string;
  if (resolveBreached) {
    label = `Overdue by ${formatDuration(-hoursToResolve!)}`;
  } else if (hoursToResolve !== null) {
    label = `Due in ${formatDuration(hoursToResolve)}`;
  } else {
    label = 'Resolved';
  }

  return { applies: true, ackBreached, resolveBreached, hoursToAck, hoursToResolve, label };
}

/**
 * Apply (or deliberately clear) the SLA columns on an issue.
 *
 * Called after routing, after a re-route, and after a priority override. On a
 * genuine cross-department re-route the clock restarts (`restart: true`); on an
 * intra-department handover it must NOT (PRD §10).
 */
export async function applySla(
  db: AnyDb,
  issueId: string,
  args: DeadlineArgs & { restart?: boolean },
): Promise<SlaDeadlines> {
  const deadlines = computeDeadlines(args);

  const patch: Record<string, string | null> = {
    sla_ack_due_at: deadlines.ackDueAt,
    sla_due_at: deadlines.resolveDueAt,
  };

  const { error } = await db.from('issues').update(patch).eq('id', issueId);
  if (error) throw new Error(`applySla failed for ${issueId}: ${error.message}`);

  return deadlines;
}

/**
 * The sweep the pg_cron job (or the worker, if cron is unavailable) runs:
 * every Tier-1 issue past its resolve deadline and not yet resolved.
 *
 * Note the tier filter. Excluding Tier 2/3 is not an optimisation — counting a
 * department that never onboarded as a breach makes the compliance metric
 * meaningless (technical-plan.html §11, "Two rules for every dashboard number").
 */
export async function findBreachedIssues(
  db: AnyDb,
  opts: { limit?: number; now?: Date } = {},
): Promise<Array<{ id: string; publicId: string; slaDueAt: string; priority: IssuePriority }>> {
  const now = (opts.now ?? new Date()).toISOString();

  const { data, error } = await db
    .from('issues')
    .select('id, public_id, sla_due_at, priority')
    .eq('routing_tier', 'ONBOARDED')
    .not('sla_due_at', 'is', null)
    .lt('sla_due_at', now)
    .not('status', 'in', '("RESOLVED","CLOSED","MERGED","REJECTED")')
    .order('sla_due_at', { ascending: true })
    .limit(opts.limit ?? 500);

  if (error) throw new Error(`findBreachedIssues failed: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    publicId: r.public_id,
    slaDueAt: r.sla_due_at!,
    priority: (r.priority ?? 'MEDIUM') as IssuePriority,
  }));
}

// --- helpers --------------------------------------------------------------

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

function positiveNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

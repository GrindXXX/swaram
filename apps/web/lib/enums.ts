/**
 * enums.ts — the closed vocabularies this surface renders.
 *
 * ⚠ MIRROR, NOT SOURCE. Every value here is copied verbatim from
 * `backend/supabase/migrations/0002_enums.sql` (and re-declared in
 * `packages/shared/enums.ts`). When the repo root gains a workspace manifest,
 * the whole block below collapses to:
 *
 *     export * from '@swaram/shared/enums';
 *
 * It is duplicated today only so that apps/web builds and demos standalone.
 * Declaration order is lifecycle order and the status ladder depends on it.
 */

export const ISSUE_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'HELD',
  'RESOLUTION_SUBMITTED',
  'AWAITING_VERIFICATION',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'REJECTED',
  'MERGED',
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ROUTING_TIERS = ['ONBOARDED', 'CONTACTABLE', 'UNMAPPED'] as const;
export type RoutingTier = (typeof ROUTING_TIERS)[number];

export const ESCALATION_LEVELS = [
  'LOCAL',
  'WARD',
  'CITY',
  'DISTRICT',
  'STATE',
  'NATIONAL',
] as const;
export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export const VERIFICATION_VERDICTS = [
  'COMPLETELY_FIXED',
  'PARTIALLY_FIXED',
  'STILL_EXISTS',
  'NEW_PROBLEM',
] as const;
export type VerificationVerdict = (typeof VERIFICATION_VERDICTS)[number];

export const MEDIA_TYPES = ['PHOTO', 'VIDEO', 'AUDIO', 'NONE'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const COMMENT_VISIBILITIES = ['PUBLIC', 'INTERNAL'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const ISSUE_VISIBILITIES = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] as const;
export type IssueVisibility = (typeof ISSUE_VISIBILITIES)[number];

export const APP_ROLES = ['CITIZEN', 'GOVERNMENT', 'ADMIN'] as const;
export type AppRole = (typeof APP_ROLES)[number];

/* -------------------------------------------------------------------------- */
/* Human labels. PRD §15: status is never colour alone — every pill has text.  */
/* -------------------------------------------------------------------------- */

export const STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In progress',
  HELD: 'Being checked',
  RESOLUTION_SUBMITTED: 'Fix submitted',
  AWAITING_VERIFICATION: 'Verify this',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  REJECTED: 'Rejected',
  MERGED: 'Merged',
};

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High priority',
  CRITICAL: 'Critical',
};

export const VERDICT_LABEL: Record<VerificationVerdict, string> = {
  COMPLETELY_FIXED: 'Completely fixed',
  PARTIALLY_FIXED: 'Partially fixed',
  STILL_EXISTS: 'Still exists',
  NEW_PROBLEM: 'A new problem was created',
};

export const VERDICT_HINT: Record<VerificationVerdict, string> = {
  COMPLETELY_FIXED: 'The problem is gone. Nothing left to do.',
  PARTIALLY_FIXED: 'Some of it was done, some of it was not.',
  STILL_EXISTS: 'Nothing changed on the ground.',
  NEW_PROBLEM: 'The work caused something else.',
};

/** Which semantic ink a status is printed in (PRD §15 semantic colour). */
export type Ink = 'rage' | 'ember' | 'resolved' | 'gov' | 'neutral' | 'ink';

export const STATUS_INK: Record<IssueStatus, Ink> = {
  OPEN: 'rage',
  ASSIGNED: 'gov',
  ACKNOWLEDGED: 'gov',
  IN_PROGRESS: 'ember',
  HELD: 'neutral',
  RESOLUTION_SUBMITTED: 'ember',
  AWAITING_VERIFICATION: 'ember',
  RESOLVED: 'resolved',
  CLOSED: 'neutral',
  REOPENED: 'rage',
  REJECTED: 'neutral',
  MERGED: 'neutral',
};

export const PRIORITY_INK: Record<IssuePriority, Ink> = {
  LOW: 'ink',
  MEDIUM: 'ink',
  HIGH: 'rage',
  CRITICAL: 'rage',
};

/** The four rungs a citizen is shown, collapsed from twelve DB statuses. */
export const LADDER_RUNGS = ['Reported', 'Assigned', 'In progress', 'Resolved'] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

export function rungIndexFor(status: IssueStatus): number {
  switch (status) {
    case 'OPEN':
    case 'HELD':
    case 'REJECTED':
    case 'MERGED':
      return 0;
    case 'ASSIGNED':
    case 'ACKNOWLEDGED':
      return 1;
    case 'IN_PROGRESS':
    case 'RESOLUTION_SUBMITTED':
    case 'AWAITING_VERIFICATION':
    case 'REOPENED':
      return 2;
    case 'RESOLVED':
    case 'CLOSED':
      return 3;
  }
}

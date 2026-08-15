/**
 * enums.ts — mirrors backend/supabase/migrations/0002_enums.sql exactly.
 *
 * Every closed vocabulary in Swaram, in one file. If you change a value here
 * without an accompanying `ALTER TYPE ... ADD VALUE` migration, the app and the
 * database have drifted and something will fail at insert time, not compile
 * time. Order is preserved from the SQL file — several UI surfaces (the status
 * ladder, priority sorting) depend on declaration order being lifecycle order.
 *
 * No imports. No side effects. Safe in workers, edge functions and the browser.
 */

/* ------------------------------------------------------------------ *
 * app_role
 * ------------------------------------------------------------------ */

/** Account-level role. Exactly three (PRD §18). Officer vs supervisor is a
 *  *scope* difference expressed by government_officers.jurisdiction_level. */
export const AppRole = {
  CITIZEN: 'CITIZEN',
  GOVERNMENT: 'GOVERNMENT',
  ADMIN: 'ADMIN',
} as const;
export type AppRole = (typeof AppRole)[keyof typeof AppRole];
export const APP_ROLES = Object.values(AppRole) as readonly AppRole[];

/* ------------------------------------------------------------------ *
 * issue_status
 * ------------------------------------------------------------------ */

/** Issue lifecycle. Twelve values, in lifecycle order. */
export const IssueStatus = {
  /** created and routed, no named owner yet */
  OPEN: 'OPEN',
  /** owned, not started */
  ASSIGNED: 'ASSIGNED',
  /** owner has seen it (SLA ack stop) */
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  /** safety gate withheld from the feed, still routed */
  HELD: 'HELD',
  /** authority filed evidence */
  RESOLUTION_SUBMITTED: 'RESOLUTION_SUBMITTED',
  /** citizens judging */
  AWAITING_VERIFICATION: 'AWAITING_VERIFICATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  REJECTED: 'REJECTED',
  MERGED: 'MERGED',
} as const;
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus];
export const ISSUE_STATUSES = Object.values(IssueStatus) as readonly IssueStatus[];

/* ------------------------------------------------------------------ *
 * issue_severity / issue_priority
 * ------------------------------------------------------------------ */

/** Objective danger, judged by the intake agent. Never influenced by report
 *  count (PRD §06). */
export const IssueSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity];
export const ISSUE_SEVERITIES = Object.values(IssueSeverity) as readonly IssueSeverity[];

/** Queue priority. Drives the SLA clock (PRD §10). */
export const IssuePriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IssuePriority = (typeof IssuePriority)[keyof typeof IssuePriority];
export const ISSUE_PRIORITIES = Object.values(IssuePriority) as readonly IssuePriority[];

/* ------------------------------------------------------------------ *
 * visibility & location
 * ------------------------------------------------------------------ */

/** What the public may see. Fails safe — the intake agent defaults
 *  safety-related categories to CONFIDENTIAL and a human must downgrade. */
export const IssueVisibility = {
  PUBLIC: 'PUBLIC',
  RESTRICTED: 'RESTRICTED',
  CONFIDENTIAL: 'CONFIDENTIAL',
} as const;
export type IssueVisibility = (typeof IssueVisibility)[keyof typeof IssueVisibility];
export const ISSUE_VISIBILITIES = Object.values(IssueVisibility) as readonly IssueVisibility[];

/** How precisely the problem is located. Independent of who may see it. */
export const LocationPrecision = {
  POINT: 'POINT',
  AREA: 'AREA',
  JURISDICTION: 'JURISDICTION',
} as const;
export type LocationPrecision = (typeof LocationPrecision)[keyof typeof LocationPrecision];
export const LOCATION_PRECISIONS = Object.values(LocationPrecision) as readonly LocationPrecision[];

/** How publicly the location is shown. Independent of precision. */
export const LocationVisibility = {
  EXACT: 'EXACT',
  APPROXIMATE: 'APPROXIMATE',
  PRIVATE: 'PRIVATE',
} as const;
export type LocationVisibility = (typeof LocationVisibility)[keyof typeof LocationVisibility];
export const LOCATION_VISIBILITIES = Object.values(
  LocationVisibility,
) as readonly LocationVisibility[];

/* ------------------------------------------------------------------ *
 * routing & escalation
 * ------------------------------------------------------------------ */

/** PRD §12: the product must work in all three. UNMAPPED is a valid outcome,
 *  never an error. */
export const RoutingTier = {
  ONBOARDED: 'ONBOARDED',
  CONTACTABLE: 'CONTACTABLE',
  UNMAPPED: 'UNMAPPED',
} as const;
export type RoutingTier = (typeof RoutingTier)[keyof typeof RoutingTier];
export const ROUTING_TIERS = Object.values(RoutingTier) as readonly RoutingTier[];

/** PRD §12: scale escalation, a separate ladder from SLA escalation. */
export const EscalationLevel = {
  LOCAL: 'LOCAL',
  WARD: 'WARD',
  CITY: 'CITY',
  DISTRICT: 'DISTRICT',
  STATE: 'STATE',
  NATIONAL: 'NATIONAL',
} as const;
export type EscalationLevel = (typeof EscalationLevel)[keyof typeof EscalationLevel];
export const ESCALATION_LEVELS = Object.values(EscalationLevel) as readonly EscalationLevel[];

export const JurisdictionLevel = {
  STATE: 'STATE',
  DISTRICT: 'DISTRICT',
  ULB: 'ULB',
  ZONE: 'ZONE',
  WARD: 'WARD',
} as const;
export type JurisdictionLevel = (typeof JurisdictionLevel)[keyof typeof JurisdictionLevel];
export const JURISDICTION_LEVELS = Object.values(
  JurisdictionLevel,
) as readonly JurisdictionLevel[];

/* ------------------------------------------------------------------ *
 * participants & discussion
 * ------------------------------------------------------------------ */

/** PRD §10/§18: many participants, exactly one OWNER (enforced in 0009). */
export const ParticipantRole = {
  OWNER: 'OWNER',
  ASSIGNEE: 'ASSIGNEE',
  CONTRACTOR: 'CONTRACTOR',
  FIELD_CREW: 'FIELD_CREW',
  SUPERVISOR: 'SUPERVISOR',
  REPRESENTATIVE: 'REPRESENTATIVE',
  OBSERVER: 'OBSERVER',
} as const;
export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole];
export const PARTICIPANT_ROLES = Object.values(ParticipantRole) as readonly ParticipantRole[];

export const CommentVisibility = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
} as const;
export type CommentVisibility = (typeof CommentVisibility)[keyof typeof CommentVisibility];
export const COMMENT_VISIBILITIES = Object.values(
  CommentVisibility,
) as readonly CommentVisibility[];

/* ------------------------------------------------------------------ *
 * evidence, verification, moderation
 * ------------------------------------------------------------------ */

export const EvidenceType = {
  INITIAL_REPORT: 'INITIAL_REPORT',
  PROGRESS: 'PROGRESS',
  RESOLUTION: 'RESOLUTION',
} as const;
export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];
export const EVIDENCE_TYPES = Object.values(EvidenceType) as readonly EvidenceType[];

/** PRD §03: the community verdict is a distribution, not a boolean. */
export const VerificationVerdict = {
  COMPLETELY_FIXED: 'COMPLETELY_FIXED',
  PARTIALLY_FIXED: 'PARTIALLY_FIXED',
  STILL_EXISTS: 'STILL_EXISTS',
  NEW_PROBLEM: 'NEW_PROBLEM',
} as const;
export type VerificationVerdict =
  (typeof VerificationVerdict)[keyof typeof VerificationVerdict];
export const VERIFICATION_VERDICTS = Object.values(
  VerificationVerdict,
) as readonly VerificationVerdict[];

/** PRD §20: five verdicts from the pre-publication safety gate. */
export const ModerationVerdict = {
  CLEAR: 'CLEAR',
  REDACT: 'REDACT',
  HOLD: 'HOLD',
  EMERGENCY: 'EMERGENCY',
  REJECT: 'REJECT',
} as const;
export type ModerationVerdict = (typeof ModerationVerdict)[keyof typeof ModerationVerdict];
export const MODERATION_VERDICTS = Object.values(
  ModerationVerdict,
) as readonly ModerationVerdict[];

/** D4: only VERIFIED authorities may be contacted automatically. */
export const VerificationStatus = {
  VERIFIED: 'VERIFIED',
  SCRAPED_UNVERIFIED: 'SCRAPED_UNVERIFIED',
  DRAFT: 'DRAFT',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];
export const VERIFICATION_STATUSES = Object.values(
  VerificationStatus,
) as readonly VerificationStatus[];

/* ------------------------------------------------------------------ *
 * plumbing
 * ------------------------------------------------------------------ */

/** How a pin became a jurisdiction. Anything other than POLYGON is a degraded
 *  match and must be surfaced, never silently trusted. */
export const JurisdictionMatchMethod = {
  POLYGON: 'POLYGON',
  CENTROID_FALLBACK: 'CENTROID_FALLBACK',
  GEOCODE_FALLBACK: 'GEOCODE_FALLBACK',
  MANUAL: 'MANUAL',
  NONE: 'NONE',
} as const;
export type JurisdictionMatchMethod =
  (typeof JurisdictionMatchMethod)[keyof typeof JurisdictionMatchMethod];
export const JURISDICTION_MATCH_METHODS = Object.values(
  JurisdictionMatchMethod,
) as readonly JurisdictionMatchMethod[];

export const MediaType = {
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  NONE: 'NONE',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];
export const MEDIA_TYPES = Object.values(MediaType) as readonly MediaType[];

export const ReportSource = {
  CITIZEN_APP: 'CITIZEN_APP',
  OFFICER: 'OFFICER',
  IMPORT: 'IMPORT',
} as const;
export type ReportSource = (typeof ReportSource)[keyof typeof ReportSource];
export const REPORT_SOURCES = Object.values(ReportSource) as readonly ReportSource[];

/** Lowercase in the database — deliberately, this one is an audit verb log. */
export const TransferAction = {
  received: 'received',
  forwarded: 'forwarded',
  resolved: 'resolved',
  reopened: 'reopened',
} as const;
export type TransferAction = (typeof TransferAction)[keyof typeof TransferAction];
export const TRANSFER_ACTIONS = Object.values(TransferAction) as readonly TransferAction[];

/* ------------------------------------------------------------------ *
 * Presentation-layer derivations
 *
 * These are NOT database enums. They are the small amount of shared
 * interpretation that both the citizen app and the gov portal need, kept here
 * so the two surfaces cannot disagree about what "in progress" means.
 * ------------------------------------------------------------------ */

/** Statuses where the authority still owes work. */
export const ACTIVE_STATUSES: readonly IssueStatus[] = [
  IssueStatus.OPEN,
  IssueStatus.ASSIGNED,
  IssueStatus.ACKNOWLEDGED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.HELD,
  IssueStatus.REOPENED,
];

/** Statuses where the ball is with the citizens, not the department. */
export const VERIFYING_STATUSES: readonly IssueStatus[] = [
  IssueStatus.RESOLUTION_SUBMITTED,
  IssueStatus.AWAITING_VERIFICATION,
];

/** Statuses where nothing further is owed. */
export const TERMINAL_STATUSES: readonly IssueStatus[] = [
  IssueStatus.RESOLVED,
  IssueStatus.CLOSED,
  IssueStatus.REJECTED,
  IssueStatus.MERGED,
];

export const isActiveStatus = (s: IssueStatus): boolean => ACTIVE_STATUSES.includes(s);
export const isVerifyingStatus = (s: IssueStatus): boolean => VERIFYING_STATUSES.includes(s);
export const isTerminalStatus = (s: IssueStatus): boolean => TERMINAL_STATUSES.includes(s);

/**
 * The five rungs of the public status ladder (PRD §07). Twelve database
 * statuses collapse into five things a citizen can actually read. HELD is
 * deliberately mapped to ROUTED: the citizen is never told they were flagged.
 */
export const LadderStage = {
  REPORTED: 'REPORTED',
  ROUTED: 'ROUTED',
  RESPONSE: 'RESPONSE',
  EVIDENCE: 'EVIDENCE',
  VERIFIED: 'VERIFIED',
} as const;
export type LadderStage = (typeof LadderStage)[keyof typeof LadderStage];
export const LADDER_STAGES = Object.values(LadderStage) as readonly LadderStage[];

const LADDER_INDEX: Record<IssueStatus, number> = {
  OPEN: 1,
  HELD: 1,
  ASSIGNED: 1,
  ACKNOWLEDGED: 2,
  IN_PROGRESS: 2,
  REOPENED: 2,
  RESOLUTION_SUBMITTED: 3,
  AWAITING_VERIFICATION: 3,
  RESOLVED: 4,
  CLOSED: 4,
  REJECTED: 4,
  MERGED: 4,
};

/** Index into LADDER_STAGES that the given status currently occupies. */
export function ladderIndexFor(status: IssueStatus): number {
  return LADDER_INDEX[status];
}

/** The public-facing stage a raw status sits at. */
export function ladderStageFor(status: IssueStatus): LadderStage {
  return LADDER_STAGES[LADDER_INDEX[status]] as LadderStage;
}

/**
 * enums.ts — the TypeScript mirror of backend/supabase/migrations/0002_enums.sql.
 *
 * These are hand-maintained const arrays rather than plain `type X = 'a' | 'b'`
 * because the workers and the ingest scripts need to *validate at runtime* —
 * a CSV or an LLM can hand us a string that is not a member. The derived union
 * types come free from `typeof ARRAY[number]`.
 *
 * If you change 0002_enums.sql, change this file in the same commit. There is
 * no generator that can do it for you: `supabase gen types typescript` emits
 * the enums into db/types.gen.ts, but that file is regenerated wholesale and
 * this one is what the domain layer imports.
 */

export const APP_ROLES = ['CITIZEN', 'GOVERNMENT', 'ADMIN'] as const;
export type AppRole = (typeof APP_ROLES)[number];

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

export const ISSUE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_VISIBILITIES = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] as const;
export type IssueVisibility = (typeof ISSUE_VISIBILITIES)[number];

export const LOCATION_PRECISIONS = ['POINT', 'AREA', 'JURISDICTION'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export const LOCATION_VISIBILITIES = ['EXACT', 'APPROXIMATE', 'PRIVATE'] as const;
export type LocationVisibility = (typeof LOCATION_VISIBILITIES)[number];

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

export const JURISDICTION_LEVELS = ['STATE', 'DISTRICT', 'ULB', 'ZONE', 'WARD'] as const;
export type JurisdictionLevel = (typeof JURISDICTION_LEVELS)[number];

export const PARTICIPANT_ROLES = [
  'OWNER',
  'ASSIGNEE',
  'CONTRACTOR',
  'FIELD_CREW',
  'SUPERVISOR',
  'REPRESENTATIVE',
  'OBSERVER',
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const COMMENT_VISIBILITIES = ['PUBLIC', 'INTERNAL'] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const EVIDENCE_TYPES = ['INITIAL_REPORT', 'PROGRESS', 'RESOLUTION'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const VERIFICATION_VERDICTS = [
  'COMPLETELY_FIXED',
  'PARTIALLY_FIXED',
  'STILL_EXISTS',
  'NEW_PROBLEM',
] as const;
export type VerificationVerdict = (typeof VERIFICATION_VERDICTS)[number];

export const MODERATION_VERDICTS = ['CLEAR', 'REDACT', 'HOLD', 'EMERGENCY', 'REJECT'] as const;
export type ModerationVerdict = (typeof MODERATION_VERDICTS)[number];

export const VERIFICATION_STATUSES = ['VERIFIED', 'SCRAPED_UNVERIFIED', 'DRAFT'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const JURISDICTION_MATCH_METHODS = [
  'POLYGON',
  'CENTROID_FALLBACK',
  'GEOCODE_FALLBACK',
  'MANUAL',
  'NONE',
] as const;
export type JurisdictionMatchMethod = (typeof JURISDICTION_MATCH_METHODS)[number];

export const MEDIA_TYPES = ['PHOTO', 'VIDEO', 'AUDIO', 'NONE'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const REPORT_SOURCES = ['CITIZEN_APP', 'OFFICER', 'IMPORT'] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export const TRANSFER_ACTIONS = ['received', 'forwarded', 'resolved', 'reopened'] as const;
export type TransferAction = (typeof TRANSFER_ACTIONS)[number];

/** officer_roster_records.match_status — a CHECK constraint, not a PG enum. */
export const ROSTER_MATCH_STATUSES = [
  'PENDING',
  'MATCHED',
  'CONFIRMED',
  'AMBIGUOUS',
  'UNUSABLE_CONTACT',
] as const;
export type RosterMatchStatus = (typeof ROSTER_MATCH_STATUSES)[number];

/** The 15 jurisdiction-generic authority types from taxonomy.json._meta. */
export const AUTHORITY_TYPES = [
  'ULB_ENGINEERING',
  'ULB_SANITATION',
  'ULB_ELECTRICAL',
  'ULB_HEALTH',
  'ULB_HORTICULTURE',
  'ULB_TOWN_PLANNING',
  'ULB_ANIMAL_HUSBANDRY',
  'STATE_WATER_BOARD',
  'STATE_PHED',
  'STATE_DISCOM',
  'STATE_PWD',
  'NHAI',
  'TRAFFIC_POLICE',
  'STATE_FIRE',
  'REVENUE_DEPT',
] as const;
export type AuthorityTypeId = (typeof AUTHORITY_TYPES)[number];

/** pgmq queue names created in 0001_extensions.sql. */
export const QUEUE_NAMES = ['intake', 'cluster', 'verify', 'dispatch', 'notify'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

// --- runtime guards -------------------------------------------------------

function memberOf<T extends readonly string[]>(values: T) {
  const set = new Set<string>(values);
  return (v: unknown): v is T[number] => typeof v === 'string' && set.has(v);
}

export const isIssueStatus = memberOf(ISSUE_STATUSES);
export const isIssueSeverity = memberOf(ISSUE_SEVERITIES);
export const isIssueVisibility = memberOf(ISSUE_VISIBILITIES);
export const isRoutingTier = memberOf(ROUTING_TIERS);
export const isVerificationVerdict = memberOf(VERIFICATION_VERDICTS);
export const isModerationVerdict = memberOf(MODERATION_VERDICTS);
export const isJurisdictionLevel = memberOf(JURISDICTION_LEVELS);
export const isAuthorityType = memberOf(AUTHORITY_TYPES);
export const isLocationPrecision = memberOf(LOCATION_PRECISIONS);
export const isLocationVisibility = memberOf(LOCATION_VISIBILITIES);

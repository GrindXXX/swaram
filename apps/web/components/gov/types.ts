/* ============================================================================
   VIEW MODELS for the government + admin surfaces.

   The closed vocabularies are imported as TYPES ONLY from @swaram/shared, which
   is assumed to mirror backend/supabase/migrations/0002_enums.sql exactly.
   Type-only imports are erased at build time, so this file is the single place
   to patch if @swaram/shared names them differently.
   ========================================================================== */
import type {
  IssueStatus,
  IssuePriority,
  IssueSeverity,
  RoutingTier,
  ParticipantRole,
  CommentVisibility,
  EvidenceType,
  ModerationVerdict,
  VerificationVerdict,
  VerificationStatus,
  TransferAction,
} from '@swaram/shared';

export type {
  IssueStatus,
  IssuePriority,
  IssueSeverity,
  RoutingTier,
  ParticipantRole,
  CommentVisibility,
  EvidenceType,
  ModerationVerdict,
  VerificationVerdict,
  VerificationStatus,
  TransferAction,
};

/* -------------------------------------------------------------------------- */
/* Queue                                                                      */
/* -------------------------------------------------------------------------- */

/** One row of the officer queue. Mirrors the columns §10 requires:
 *  ID · title · status · priority · report count · owner · SLA · last activity. */
export interface QueueIssue {
  id: string;
  public_id: string;                 // CIV-10234
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  severity: IssueSeverity;
  department: string;
  jurisdiction: string;
  routing_tier: RoutingTier;
  owner: string | null;              // display name of the ONE accountable owner
  owner_id: string | null;
  /** Reports, NOT issues. "27 people reported this." Never summed with issue counts. */
  report_count: number;
  follower_count: number;
  /** 0–100. Context for the officer, never a leaderboard. */
  civic_pressure: number;
  /** null for TIER 2/3 — they have no SLA and must never show a countdown. */
  sla_due_at: string | null;
  created_at: string;
  last_activity_at: string;
  lat: number;
  lng: number;
  /** intake agent confidence, drives the `ai-unsure` saved view */
  intake_confidence: number;
  /** clustering agent confidence against a candidate parent, drives `suggested-merges` */
  cluster_confidence: number | null;
  cluster_parent_public_id: string | null;
  /** metres from the officer's current position — field mode sort */
  distance_m?: number;
}

export type SavedView =
  | 'my-work'
  | 'unassigned'
  | 'overdue'
  | 'awaiting-verify'
  | 'suggested-merges'
  | 'ai-unsure'
  | 'all';

export interface ViewSpec {
  slug: SavedView;
  label: string;
  blurb: string;
  /** the sort the view ships with. SLA ascending unless the view has no SLA meaning. */
  sort: 'sla-asc' | 'pressure-desc' | 'most-overdue' | 'submitted-asc' | 'confidence-desc' | 'created-asc';
}

/* -------------------------------------------------------------------------- */
/* Ticket                                                                     */
/* -------------------------------------------------------------------------- */

export interface Participant {
  id: string;
  name: string;
  org: string | null;
  designation: string | null;
  role: ParticipantRole;
  is_public: boolean;
  added_by: string;
  added_reason: string | null;
  added_at: string;
}

export interface Comment {
  id: string;
  author: string;
  author_kind: 'OFFICIAL' | 'REPRESENTATIVE' | 'CONTRACTOR' | 'CITIZEN';
  visibility: CommentVisibility;
  content: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter: string;               // "Anonymous" when is_anonymous
  description: string;
  transcript: string | null;
  media_type: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'NONE';
  lat: number;
  lng: number;
  created_at: string;
  source: 'CITIZEN_APP' | 'OFFICER' | 'IMPORT';
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  caption: string;
  uploaded_by: string;
  lat: number | null;
  lng: number | null;
  captured_at: string;
}

export interface ActivityEntry {
  id: string;
  actor: string;
  actor_type: 'OFFICER' | 'CITIZEN' | 'AI' | 'SYSTEM';
  action: string;
  detail: string | null;
  /** present only for actor_type === 'AI' */
  agent_name?: string;
  confidence?: number;
  was_overridden?: boolean;
  created_at: string;
}

export interface Transfer {
  id: string;
  from_authority: string | null;
  to_authority: string;
  action: TransferAction;
  reason: string | null;
  actor: string;
  created_at: string;
}

export interface TicketDetail extends QueueIssue {
  description: string;
  address: string;
  escalation_level: string;
  sla_ack_due_at: string | null;
  acknowledged_at: string | null;
  satisfaction_score: number | null;
  participants: Participant[];
  reports: ReportRow[];
  comments: Comment[];
  evidence: EvidenceItem[];
  activity: ActivityEntry[];
  transfers: Transfer[];
  ai_runs: { agent_name: string; output: string; confidence: number; was_overridden: boolean }[];
}

/* -------------------------------------------------------------------------- */
/* Dashboards                                                                 */
/* -------------------------------------------------------------------------- */

/** Exactly the five columns returned by gov_kpis(p_juris, p_dept). */
export interface GovKpis {
  open: number;
  in_progress: number;
  overdue: number;
  awaiting_verify: number;
  resolved_30d: number;
}

/** One row of mv_department_performance. */
export interface DeptPerformance {
  id: number;
  name: string;
  total: number;                  // ISSUES
  resolved: number;               // ISSUES
  resolution_rate: number;
  median_ack_hours: number | null;
  median_resolve_days: number | null;
  /** Computed over TIER 1 only. Tier 2/3 have no SLA to breach. */
  sla_compliance: number | null;
  sla_eligible: number;           // tier-1 issue count the compliance % is over
  avg_satisfaction: number | null;
  reopened: number;
  /** movement in satisfaction vs the previous period, in points */
  satisfaction_delta: number | null;
}

/** One row of mv_agent_quality (one per agent per day). */
export interface AgentQualityRow {
  agent_name: string;
  day: string;
  runs: number;
  avg_confidence: number;
  override_rate: number;
  avg_latency_ms: number;
}

/** One row of mv_coverage. */
export interface CoverageRow {
  id: number;
  name: string;
  level: string;
  issues: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

export interface AuthorityHealthRow {
  source: string;
  scope: string;
  rows: number;
  verified: number;
  bounce_rate: number | null;
  last_verified_at: string | null;
  status: VerificationStatus;
  note: string;
}

export interface ModerationItem {
  id: string;
  kind: 'ISSUE_HELD' | 'FLAGGED_COMMENT' | 'FLAGGED_REPORT' | 'FLAGGED_USER';
  public_id: string | null;
  excerpt: string;
  detection_class: string;
  verdict: ModerationVerdict;
  confidence: number;
  held_at: string;
  /** unreviewed holds auto-publish at 24h — the clock, not a queue */
  auto_publish_at: string | null;
  reporter_notified: boolean;
}

export interface TrendPoint {
  day: string;
  created: number;   // ISSUES created
  resolved: number;  // ISSUES resolved
}

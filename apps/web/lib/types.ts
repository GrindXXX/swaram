import type {
  EscalationLevel,
  IssuePriority,
  IssueSeverity,
  IssueStatus,
  RoutingTier,
  VerificationVerdict,
} from './enums';

/**
 * View models for the citizen surface.
 *
 * These are *presentation* shapes, deliberately flatter than the DB rows: the
 * feed card needs "500 m away", not a PostGIS geography. The mapping from
 * `backend/core/db/types.gen.ts` rows to these lives in lib/queries/issues.ts.
 */

export type Media = {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'AUDIO';
  /** Absent in fixtures — components fall back to a printed halftone plate. */
  url?: string;
  /** Solid colour / blurhash stand-in painted under the image while it loads. */
  placeholder?: string;
  caption?: string;
  takenAt?: string;
  /** RESOLUTION evidence renders in the before/after comparison. */
  role?: 'INITIAL_REPORT' | 'PROGRESS' | 'RESOLUTION';
};

export type IssueSummary = {
  id: string;
  /** CIV-##### — the shareable public identifier. */
  publicId: string;
  title: string;
  summary: string;
  status: IssueStatus;
  priority: IssuePriority;
  severity: IssueSeverity;
  /** e.g. "Roads" */
  department: string;
  /** e.g. "Ward 42, Bengaluru" */
  jurisdiction: string;
  /** e.g. "Pothole" */
  category: string;
  /** metres from the viewer. null when location permission was denied. */
  distanceM: number | null;
  lat: number;
  lng: number;
  createdAt: string;
  lastActivityAt: string;
  /** "27 people reported this" — the emotional payload of the card. */
  reportCount: number;
  followerCount: number;
  supportCount: number;
  commentCount: number;
  /** 0–100 social pressure. Never drives SLA. */
  pressure: number;
  /** An estimate, always rendered with a ~. */
  peopleAffected: number;
  routingTier: RoutingTier;
  escalationLevel: EscalationLevel;
  /** null whenever routingTier !== 'ONBOARDED'. Never fabricate one. */
  slaDueAt: string | null;
  /** What actually happened, for CONTACTABLE/UNMAPPED. */
  authorityName: string | null;
  dispatchedAt: string | null;
  media: Media[];
  /** Viewer-relative state; false for logged-out. */
  viewerFollows: boolean;
  viewerSupported: boolean;
  viewerReported: boolean;
};

export type StatusEvent = {
  status: IssueStatus;
  at: string;
  /** Role, not a name — "Officer K, Roads". */
  actor: string | null;
  note: string | null;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  /** Official replies are visually distinct and can never be confused. */
  official: boolean;
  authorLabel: string;
  /** "Junior Engineer, Roads · Ward 42" */
  designation?: string;
  flagged?: boolean;
  replies?: Comment[];
};

export type ReportRow = {
  id: string;
  at: string;
  /** "Citizen #A82F" when the reporter chose to stay anonymous. */
  authorLabel: string;
  note: string | null;
  mediaCount: number;
};

export type AiTrace = {
  classification: { value: string; confidence: number };
  jurisdiction: { value: string; method: string; confidence: number | null };
  routing: { value: string; confidence: number; tier: RoutingTier };
  priority: { value: IssuePriority; reason: string };
  /** Passive only. Never blocks or redirects submission. */
  similarNearby: number;
  overriddenByHuman?: boolean;
};

export type VerificationTally = Record<VerificationVerdict, number>;

export type IssueDetail = IssueSummary & {
  /** AI summary across every report on the issue. */
  description: string;
  timeline: StatusEvent[];
  comments: Comment[];
  reports: ReportRow[];
  aiTrace: AiTrace;
  verification: {
    open: boolean;
    closesAt: string | null;
    tally: VerificationTally;
    viewerVerdict: VerificationVerdict | null;
  };
  /** Set when the resolution was rejected and pressure rose instead of resetting. */
  reopenedCount: number;
  /** RESOLVED issues can be reopened for 14 days by anyone who reported. */
  reopenWindowClosesAt: string | null;
  growthToday: number;
};

export type AlertItem = {
  id: string;
  kind:
    | 'STATUS_CHANGE'
    | 'OFFICIAL_REPLY'
    | 'COMMENT_REPLY'
    | 'RESOLVED'
    | 'REOPEN_WINDOW'
    | 'NEARBY_HIGH_PRIORITY'
    | 'MERGED';
  title: string;
  body: string;
  at: string;
  read: boolean;
  publicId: string;
  /** Deep-link to the exact section that changed (PRD §09). */
  anchor: string;
};

export type FeedPage = {
  items: IssueSummary[];
  nextCursor: string | null;
};

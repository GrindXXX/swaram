/**
 * Shared interfaces for the Swaram backend. Everything here is a contract
 * between layers (domain <-> agents <-> services <-> workers); nothing here
 * touches the network or the database.
 */

export * from './enums.ts';

import type {
  EscalationLevel,
  IssueSeverity,
  IssueStatus,
  IssueVisibility,
  JurisdictionMatchMethod,
  LocationPrecision,
  LocationVisibility,
  MediaType,
  ModerationVerdict,
  RoutingTier,
  VerificationVerdict,
} from './enums.ts';

/** A WGS84 pin. lat/lng order is explicit everywhere to stop the classic swap. */
export interface LatLng {
  lat: number;
  lng: number;
}

// --- routing --------------------------------------------------------------

/**
 * The output of the resolution chain (technical-plan.html §08).
 *
 * tier === 'UNMAPPED' is a VALID, EXPECTED result — jurisdiction may be known
 * with nobody to send the issue to, or the pin may not resolve at all. Callers
 * must render it honestly ("Published · no authority contact yet"), never as
 * an error and never with a fabricated assignee or SLA.
 */
export interface RoutingResult {
  jurisdictionId: number | null;
  authorityId: number | null;
  departmentId: number | null;
  tier: RoutingTier;
  method: JurisdictionMatchMethod;
}

// --- media pipeline (C1) --------------------------------------------------

export interface NormalisedImage {
  /** Compressed, EXIF-stripped bytes, ready to hand to the model or to upload. */
  data: Buffer;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  bytes: number;
  /** GPS read from EXIF *before* stripping, if the original carried any. */
  exifLocation: LatLng | null;
  exifCapturedAt: string | null;
}

export interface NormalisedMedia {
  type: MediaType;
  /** Keyframes for video, the single frame for a photo, empty for audio/text. */
  images: NormalisedImage[];
  /** Original audio, untouched — the transcript is interpretation, this is evidence. */
  audio: { data: Buffer; mediaType: string } | null;
  /** Any GPS recovered from the media itself. */
  exifLocation: LatLng | null;
}

// --- agent I/O ------------------------------------------------------------

/** The uniform shape every input type is normalised into before the one call. */
export interface IntakeAgentInput {
  /** Typed text, ASR transcript, or both concatenated. May be empty. */
  text: string;
  images: NormalisedImage[];
  location: LatLng;
  /** Reverse-geocoded address + area context, if geocoding succeeded. */
  locationContext: string | null;
  /** The reporter's chosen language, for the title. */
  language: string;
}

export interface IntakeAgentResult {
  categoryId: string;
  subcategory: string | null;
  severity: IssueSeverity;
  title: string;
  estimatedPeopleAffected: number | null;
  emergencyFlag: boolean;
  visibilityClass: IssueVisibility;
  safetyVerdict: ModerationVerdict;
  safetyReasons: string[];
  locationPrecision: LocationPrecision;
  confidence: number;
  reasoning: string;
}

export interface ClusterAgentCandidate {
  issueId: string;
  publicId: string;
  title: string | null;
  metres: number;
  textSimilarity: number | null;
  createdAt: string;
  image: NormalisedImage | null;
}

export interface ClusterAgentResult {
  candidateIssueId: string;
  /** 0..1. >=0.90 auto-merge, 0.75–0.90 officer confirms, <0.75 nothing. */
  confidence: number;
  reasoning: string;
  locationScore: number;
  imageScore: number | null;
  textScore: number;
}

export interface VerifyAgentResult {
  /** ADVISORY ONLY. Nothing in this object may close an issue. */
  recommendation: 'LIKELY_FIXED' | 'PARTIAL' | 'NOT_FIXED' | 'INCONCLUSIVE';
  confidence: number;
  reasoning: string;
  observedChanges: string[];
  sameLocation: boolean | null;
}

// --- verification ---------------------------------------------------------

export interface VerificationTally {
  counts: Record<VerificationVerdict, number>;
  total: number;
  /** Percentage 0..100 of respondents saying COMPLETELY_FIXED. */
  satisfactionScore: number;
  quorumReached: boolean;
  quorumReason: 'PROPORTION' | 'ABSOLUTE' | 'WINDOW_EXPIRED' | null;
  /** False when satisfaction is below the close threshold. */
  shouldClose: boolean;
  insufficientVerification: boolean;
}

// --- SLA ------------------------------------------------------------------

export interface SlaPolicy {
  ackHours: number;
  resolveDays: number;
}

export interface SlaDeadlines {
  /** Null for Tier 2/3 — no fabricated clock, ever. */
  ackDueAt: string | null;
  resolveDueAt: string | null;
  applies: boolean;
  reason: string;
}

// --- pressure -------------------------------------------------------------

export interface PressureInputs {
  reportCount: number;
  supportCount: number;
  followerCount: number;
  commentCount: number;
  ageHours: number;
  hoursSinceAuthorityActivity: number | null;
  acknowledged: boolean;
  officialReplies: number;
  progressEvidenceCount: number;
  rejectedResolutions: number;
  reopenCount: number;
}

export interface PressureResult {
  /** 0..100. */
  score: number;
  /** Every term, so an officer who disagrees can be shown the arithmetic. */
  breakdown: Record<string, number>;
}

// --- issue helpers --------------------------------------------------------

export interface IssueSummary {
  id: string;
  publicId: string;
  status: IssueStatus;
  visibility: IssueVisibility;
  locationVisibility: LocationVisibility;
  escalationLevel: EscalationLevel;
  routingTier: RoutingTier | null;
  createdAt: string;
}

// --- job queue ------------------------------------------------------------

export interface JobEnvelope<T> {
  msgId: number;
  readCt: number;
  enqueuedAt: string;
  message: T;
}

export interface IntakeJob {
  issueId: string;
  reportId: string;
}
export interface ClusterJob {
  issueId: string;
}
export interface VerifyJob {
  issueId: string;
  resolutionEvidenceId: number;
}
export interface DispatchJob {
  issueId: string;
  authorityId: number;
}
export interface NotifyJob {
  userIds: string[];
  issueId: string | null;
  kind: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
}

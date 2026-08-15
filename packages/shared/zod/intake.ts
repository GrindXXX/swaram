/**
 * zod/intake.ts — the contract with Agent 1 (PRD §13).
 *
 * Intake is deliberately ONE agent doing one reasoning pass over
 * `text + image(s) + location context`, and emitting everything below at once.
 * This schema is the boundary: model output is parsed through it before it
 * touches a table, so a hallucinated department name or an out-of-range
 * confidence fails here and lands in the human triage queue rather than
 * corrupting a routing decision.
 */

import { z } from 'zod';
import {
  boundedText,
  zCategoryId,
  zConfidence,
  zCoordinates,
  zIssueSeverity,
  zIssueVisibility,
  zLanguage,
  zLocationPrecision,
  zModerationVerdict,
} from './common.js';

/** Confidence at or above which intake auto-applies (PRD §13). */
export const INTAKE_AUTO_APPLY_CONFIDENCE = 0.8;
/** A CLEAR safety verdict must be this confident to publish without review. */
export const SAFETY_AUTO_PUBLISH_CONFIDENCE = 0.98;

/**
 * The pre-publication safety screen (PRD §20). Note what it does NOT decide:
 * whether the issue is created, classified, routed or given an SLA. It decides
 * one thing — whether the issue appears on the public feed while a human looks
 * at it. Fail open for the department, fail closed for the feed.
 */
export const zSafetyScreen = z.object({
  verdict: zModerationVerdict,
  confidence: zConfidence,
  /** Machine-readable reasons. Never shown to the reporter verbatim, and the
   *  word "flagged" is never used in citizen-facing copy (PRD §16). */
  reasons: z.array(z.string().min(1)).max(10).default([]),
  /** Spans of the description to mask when verdict is REDACT. */
  redactions: z
    .array(
      z.object({
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
        reason: z.string().min(1),
      }),
    )
    .default([]),
  /** Media ids where a face, plate or document must be blurred. */
  redactMediaIds: z.array(z.string()).default([]),
});
export type SafetyScreen = z.infer<typeof zSafetyScreen>;

/** The normalised shape every input type collapses into before the agent runs. */
export const zIntakeAgentInput = z.object({
  /** Typed text and/or ASR transcript, concatenated. May be empty if there is
   *  a photo — any single input is sufficient (PRD §13). */
  text: z.string().max(5_000).default(''),
  transcript: z
    .object({
      text: z.string(),
      language: zLanguage,
      confidence: zConfidence.optional(),
      /** The citizen may correct the transcript before submitting. */
      editedByReporter: z.boolean().default(false),
    })
    .optional(),
  /** Storage keys of compressed, EXIF-stripped stills and video keyframes.
   *  Raw audio never reaches the reasoning model. */
  imageKeys: z.array(z.string().min(1)).max(8).default([]),
  locationContext: z.object({
    coordinates: zCoordinates,
    address: z.string().max(500).optional(),
    /** Reverse-geocoded context: "near ITPL signal, opposite a school". */
    areaContext: z.string().max(1_000).optional(),
    jurisdictionName: z.string().max(200).optional(),
  }),
});
export type IntakeAgentInput = z.infer<typeof zIntakeAgentInput>;

/**
 * Agent 1 output. Everything from a single pass.
 *
 * `category` is a taxonomy id and never a department name — the agent decides
 * *what kind of problem this is*; who owns it is a SQL join (PRD §13). A
 * reorganisation is a row change in `category_department_map`, not a prompt
 * change, and that only holds if this field stays jurisdiction-generic.
 */
export const zIntakeAgentOutput = z
  .object({
    category: zCategoryId,
    /** Free-form refinement within the category: "surface defect". */
    subcategory: boundedText(2, 80).optional(),

    /** Objective danger read off the content. Report count is not an input to
     *  this and cannot be — see scoring.ts (PRD §06). */
    severity: zIssueSeverity,

    /** Generated headline. Short because it is set in Special Elite at 22px on
     *  a 360px screen; anything longer wraps to four lines and stops scanning. */
    title: boundedText(8, 90),

    /** Neutral restatement of what was reported. */
    summary: boundedText(0, 600).optional(),

    /** Life-safety interception: live wire, gas leak, collapse, fire. Bypasses
     *  the queue entirely. */
    emergency: z.boolean().default(false),

    /** Fails safe — safety-related categories default to CONFIDENTIAL and a
     *  human must downgrade (PRD §03). */
    visibility: zIssueVisibility,
    locationPrecision: zLocationPrecision.default('POINT'),

    /** An estimate, not a count. Always rendered with a "~". */
    estimatedPeopleAffected: z.number().int().nonnegative().max(10_000_000),

    /** How the estimate was reached, so an officer can correct it credibly. */
    peopleAffectedBasis: z.string().max(300).optional(),

    safetyScreen: zSafetyScreen,

    /** Overall classification confidence. Below INTAKE_AUTO_APPLY_CONFIDENCE
     *  the issue is still created and routed — it is shown as "Being routed"
     *  and lands in the supervisor triage view. Low confidence never fails
     *  silently (PRD §13, §16). */
    confidence: zConfidence,

    /** One line an officer can read to understand the call. Required: an
     *  unexplainable routing decision is one an officer will start overriding
     *  on principle. */
    reasoning: boundedText(10, 500),

    /** Provenance for the AI trace. */
    model: z.string().min(1),
    latencyMs: z.number().int().nonnegative(),
    promptVersion: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    // An emergency that the safety screen called CLEAR is a contradiction the
    // pipeline must not paper over.
    if (v.emergency && v.safetyScreen.verdict === 'CLEAR') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safetyScreen', 'verdict'],
        message:
          'An emergency=true classification cannot carry a CLEAR safety verdict; expected EMERGENCY.',
      });
    }
    if (v.safetyScreen.verdict === 'REDACT' &&
        v.safetyScreen.redactions.length === 0 &&
        v.safetyScreen.redactMediaIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safetyScreen'],
        message: 'REDACT requires at least one redaction span or media id.',
      });
    }
  });
export type IntakeAgentOutput = z.infer<typeof zIntakeAgentOutput>;

/** Does this output clear the bar to apply without a human? (PRD §13) */
export function intakeAutoApplies(output: IntakeAgentOutput): boolean {
  return output.confidence >= INTAKE_AUTO_APPLY_CONFIDENCE;
}

/** Does this output publish to the feed immediately? Anything other than a
 *  very confident CLEAR waits for review — fail closed for the feed. */
export function intakeAutoPublishes(output: IntakeAgentOutput): boolean {
  return (
    output.safetyScreen.verdict === 'CLEAR' &&
    output.safetyScreen.confidence >= SAFETY_AUTO_PUBLISH_CONFIDENCE
  );
}

/* ------------------------------------------------------------------ *
 * Agent 2 — clustering
 * ------------------------------------------------------------------ */

/** Merge confidence at or above which a merge auto-applies (PRD §13). */
export const MERGE_AUTO_CONFIDENCE = 0.9;
/** Below this, nothing is suggested at all. */
export const MERGE_SUGGEST_CONFIDENCE = 0.75;

export const zClusterDecision = z.object({
  candidateIssueId: z.string().min(1),
  /** Same physical problem, or merely nearby? */
  isSameProblem: z.boolean(),
  confidence: zConfidence,
  reasoning: boundedText(10, 500),
  /** Distance between the two pins, for the officer's side-by-side view. */
  distanceM: z.number().nonnegative().optional(),
  sameRoadSegment: z.boolean().optional(),
  model: z.string().min(1),
});
export type ClusterDecision = z.infer<typeof zClusterDecision>;

/* ------------------------------------------------------------------ *
 * Agent 3 — before/after verifier. Always advisory (PRD §13).
 * ------------------------------------------------------------------ */

export const zVerifierOpinion = z.object({
  /** The AI never closes an issue. This is a recommendation a human confirms. */
  recommendation: z.enum(['LOOKS_FIXED', 'LOOKS_UNFIXED', 'CANNOT_TELL']),
  confidence: zConfidence,
  reasoning: boundedText(10, 500),
  /** Does the "after" photo appear to be the same place as the "before"? */
  sameLocation: z.boolean().optional(),
  model: z.string().min(1),
});
export type VerifierOpinion = z.infer<typeof zVerifierOpinion>;

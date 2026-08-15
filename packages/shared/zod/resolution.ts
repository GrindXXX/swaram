/**
 * zod/resolution.ts — the authority's account of what was done, and the
 * community's ruling on it (PRD §10, §03).
 *
 * There is no "Mark Resolved" button anywhere in Swaram. The authority files a
 * Resolution Submission — what was done, plus evidence — and that moves the
 * issue to community verification, not to RESOLVED. A one-click close is what
 * makes existing grievance portals worthless.
 */

import { z } from 'zod';
import {
  boundedText,
  zCoordinates,
  zMediaAsset,
  zTimestamp,
  zUuid,
  zVerificationVerdict,
} from './common.js';

/** Minimum evidence for a resolution. Photographs are not optional: the whole
 *  accountability loop rests on there being an "after" to compare. */
export const MIN_RESOLUTION_PHOTOS = 1;

export const zResolutionSubmission = z
  .object({
    issueId: zUuid,

    /** The officer filing this. Must be the Owner or an ASSIGNEE — a
     *  CONTRACTOR may upload evidence but may never certify completion, since
     *  the party paid to do the work does not get to sign it off (PRD §18).
     *  Role is checked server-side; this field is provenance. */
    submittedBy: zUuid,
    authorityId: zUuid,

    /** What was actually done. Free text, mandatory, and long enough to be a
     *  real account rather than "done". */
    actionTaken: boundedText(20, 4_000),

    /** Distinguishes a completed repair from a scheduled one. A promise is a
     *  legitimate response, but it must not masquerade as a fix. */
    intent: z.enum(['COMPLETED', 'SCHEDULED', 'PARTIAL', 'NOT_ACTIONABLE']),

    /** Present when intent is SCHEDULED. */
    scheduledFor: zTimestamp.optional(),

    /** Mandatory when intent is NOT_ACTIONABLE — an issue is never dismissed
     *  without a reason the citizen can read. */
    notActionableReason: boundedText(20, 1_000).optional(),

    /** Municipal work order reference, e.g. "BBMP/RD/8842". Rendered
     *  monospaced next to the evidence. */
    workOrderRef: z.string().max(120).optional(),

    /** Before/after imagery, completion reports, GPS-stamped site photos. */
    evidence: z.array(zMediaAsset).min(MIN_RESOLUTION_PHOTOS).max(20),

    /** Where the crew actually stood. Compared against the report pin so the
     *  citizen sees "photo location matches the report". */
    siteCoordinates: zCoordinates.optional(),

    /** Cost and quantum, when the department publishes them. */
    quantum: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.intent === 'SCHEDULED' && !v.scheduledFor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledFor'],
        message: 'A SCHEDULED resolution must name the date it is scheduled for.',
      });
    }
    if (v.intent === 'NOT_ACTIONABLE' && !v.notActionableReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notActionableReason'],
        message: 'A NOT_ACTIONABLE resolution must carry a reason shown to the citizen.',
      });
    }
  });
export type ResolutionSubmission = z.infer<typeof zResolutionSubmission>;

/** What the officer is told after filing. The wording matters: this submission
 *  goes to the citizens who reported it. It is not a closure. */
export const zResolutionAccepted = z.object({
  resolutionId: zUuid,
  issueId: zUuid,
  /** How many citizens will be asked to verify. */
  verifierCount: z.number().int().nonnegative(),
  verificationOpensAt: zTimestamp,
  verificationClosesAt: zTimestamp,
});
export type ResolutionAccepted = z.infer<typeof zResolutionAccepted>;

/* ------------------------------------------------------------------ *
 * Community verification (PRD §03)
 * ------------------------------------------------------------------ */

/** How long citizens have to rule on a submitted resolution. */
export const VERIFICATION_WINDOW_DAYS = 7;

/**
 * One citizen's ruling. The verdict is a distribution across the whole cohort,
 * never a boolean — "72% completely fixed, 19% partly, 9% still there" is a
 * far more honest artefact than a green tick.
 */
export const zVerificationResponse = z
  .object({
    resolutionId: zUuid,
    issueId: zUuid,

    verdict: zVerificationVerdict,

    /** Optional supporting photo. A citizen saying "still there" with a picture
     *  is what reopens an issue credibly. */
    media: z.array(zMediaAsset).max(4).default([]),

    comment: boundedText(0, 1_000).optional(),

    /** Where the verifier was when they answered. Used to weight responses
     *  from people actually near the site, never to identify them. */
    coordinates: zCoordinates.optional(),

    /** True when the responder is one of the original reporters. */
    wasReporter: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    // A "new problem" verdict without a word about what the new problem is
    // gives the officer nothing to act on.
    if (v.verdict === 'NEW_PROBLEM' && !v.comment && v.media.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'A NEW_PROBLEM verdict needs a comment or a photo describing it.',
      });
    }
  });
export type VerificationResponse = z.infer<typeof zVerificationResponse>;

/** The aggregate, as shown on the public page and in the weekly record. */
export const zVerificationOutcome = z.object({
  resolutionId: zUuid,
  issueId: zUuid,
  tally: z.object({
    COMPLETELY_FIXED: z.number().int().nonnegative(),
    PARTIALLY_FIXED: z.number().int().nonnegative(),
    STILL_EXISTS: z.number().int().nonnegative(),
    NEW_PROBLEM: z.number().int().nonnegative(),
  }),
  totalResponses: z.number().int().nonnegative(),
  /** How many were invited. Turnout is published, not hidden. */
  invitedCount: z.number().int().nonnegative(),
  satisfactionScore: z.number().min(0).max(100),
  /** Recorded honestly rather than manufacturing consent from three votes. */
  insufficientVerification: z.boolean(),
  /** False sends the issue back to active with pressure raised, not to RESOLVED. */
  closes: z.boolean(),
  closedAt: zTimestamp.nullable().default(null),
});
export type VerificationOutcome = z.infer<typeof zVerificationOutcome>;

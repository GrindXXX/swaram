/**
 * zod/report.ts — what a citizen submits (PRD §04).
 *
 * The hard rule: a submission is never blocked. This schema validates shape,
 * not worthiness. It has no "is this a real problem" gate, no duplicate check
 * and no moderation verdict — those all happen after creation, and none of them
 * prevent it.
 *
 * Location is mandatory and deliberately so: without a jurisdiction there is no
 * department, no officer, no SLA and no accountability — the issue has nowhere
 * to go (PRD §03).
 */

import { z } from 'zod';
import {
  boundedText,
  zCategoryId,
  zCoordinates,
  zIssueSeverity,
  zLanguage,
  zLocationPrecision,
  zLocationVisibility,
  zMediaAsset,
  zPublicId,
  zReportSource,
  zTimestamp,
  zUuid,
} from './common.js';

/** Corrections the citizen made to the machine's classification. Every one is
 *  recorded as training signal (PRD §13). */
export const zCitizenOverride = z.object({
  category: zCategoryId.optional(),
  severity: zIssueSeverity.optional(),
  estimatedPeopleAffected: z.number().int().nonnegative().optional(),
});
export type CitizenOverride = z.infer<typeof zCitizenOverride>;

export const zReportSubmission = z
  .object({
    /** Idempotency key minted on the device before the first upload attempt.
     *  A queued offline report that retries three times must create one issue,
     *  not three. */
    clientReportId: zUuid,

    source: zReportSource.default('CITIZEN_APP'),

    /** Typed description. Optional — a photo alone, or a voice note alone, is a
     *  complete report (PRD §13). */
    description: boundedText(0, 4_000).optional(),

    /** Voice note transcript, as shown back to and possibly corrected by the
     *  reporter. The original audio stays attached as evidence. */
    transcript: z
      .object({
        text: z.string().max(4_000),
        language: zLanguage,
        editedByReporter: z.boolean().default(false),
      })
      .optional(),

    media: z.array(zMediaAsset).max(10).default([]),

    /** Mandatory. See the file header. */
    coordinates: zCoordinates,
    /** Whether the problem is a point, an area or jurisdiction-wide. This is
     *  independent of whether the public may see the exact location. */
    locationPrecision: zLocationPrecision.default('POINT'),
    /** Reverse-geocoded or citizen-corrected. */
    address: z.string().max(500).optional(),
    /** Precision and publicity of location are independent axes (PRD §03).
     *  Default APPROXIMATE: the safe choice, since an exact pin outside a
     *  house identifies a household. */
    locationVisibility: zLocationVisibility.default('APPROXIMATE'),

    /** Citizen corrections to the machine's reading, if any. */
    override: zCitizenOverride.optional(),

    /** Set when the citizen chose "join it" on a duplicate suggestion rather
     *  than opening a new record. Carries more weight together. */
    joinIssuePublicId: zPublicId.optional(),

    /** Citizens are pseudonymous by default and their name is never shown.
     *  Opting out of even the handle is allowed. */
    anonymous: z.boolean().default(true),

    /** When the device captured this, which may be well before it uploaded.
     *  The SLA clock runs from server receipt, but "12 days pending" is
     *  measured from here. */
    capturedAt: zTimestamp.optional(),

    /** True when this was filed with no connectivity and synced later. */
    queuedOffline: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const hasText =
      (v.description?.trim().length ?? 0) > 0 || (v.transcript?.text.trim().length ?? 0) > 0;
    if (!hasText && v.media.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'A report needs at least one of: a photo, a voice note or a description.',
      });
    }
  });
export type ReportSubmission = z.infer<typeof zReportSubmission>;

/**
 * What the citizen gets back. Note that it always contains a public id and a
 * department — even in routing tier CONTACTABLE or UNMAPPED, where there is no
 * logged-in officer. What it does NOT contain in those tiers is an assignee or
 * an SLA countdown, because a countdown against a department that has never
 * heard of Swaram is a lie to the citizen (PRD §12).
 */
export const zReportAccepted = z.object({
  issueId: zUuid,
  publicId: zPublicId,
  title: z.string(),
  /** True when this report joined an existing record rather than opening one. */
  joinedExisting: z.boolean(),
  /** How many people have now reported this same problem. */
  reportCount: z.number().int().positive(),
  routingTier: z.enum(['ONBOARDED', 'CONTACTABLE', 'UNMAPPED']),
  /** Present in ONBOARDED and CONTACTABLE. */
  authorityName: z.string().optional(),
  /** Present only in ONBOARDED. Never fabricated (PRD §12). */
  slaDueAt: zTimestamp.nullable().default(null),
  /** False while the safety screen is still reviewing. The citizen is told the
   *  department has it and that it is not on the public feed yet — never that
   *  they were "flagged" (PRD §16). */
  publishedToFeed: z.boolean(),
  /** Pseudonymous handle this was filed under, e.g. "#A82F". */
  filedAs: z.string(),
});
export type ReportAccepted = z.infer<typeof zReportAccepted>;

/** "I'm facing this too" — the support tap. Its own tiny schema because it is
 *  the single highest-volume write in the product. */
export const zSupportSubmission = z.object({
  issueId: zUuid,
  /** The tap also creates a report when the citizen confirms they are
   *  independently affected, which is what makes reportCount meaningful. */
  countsAsReport: z.boolean().default(true),
  coordinates: zCoordinates.optional(),
});
export type SupportSubmission = z.infer<typeof zSupportSubmission>;

/**
 * zod/common.ts — primitives shared by every schema in this folder.
 */

import { z } from 'zod';
import {
  APP_ROLES,
  ESCALATION_LEVELS,
  EVIDENCE_TYPES,
  ISSUE_PRIORITIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_VISIBILITIES,
  LOCATION_PRECISIONS,
  LOCATION_VISIBILITIES,
  MEDIA_TYPES,
  MODERATION_VERDICTS,
  PARTICIPANT_ROLES,
  REPORT_SOURCES,
  ROUTING_TIERS,
  VERIFICATION_VERDICTS,
} from '../enums.js';
import { CATEGORY_IDS } from '../taxonomy.js';

/** Build a zod enum from a readonly string tuple derived from enums.ts, so a
 *  migration that adds a value cannot leave a schema behind. */
const fromEnum = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

export const zAppRole = fromEnum(APP_ROLES);
export const zIssueStatus = fromEnum(ISSUE_STATUSES);
export const zIssueSeverity = fromEnum(ISSUE_SEVERITIES);
export const zIssuePriority = fromEnum(ISSUE_PRIORITIES);
export const zIssueVisibility = fromEnum(ISSUE_VISIBILITIES);
export const zLocationPrecision = fromEnum(LOCATION_PRECISIONS);
export const zLocationVisibility = fromEnum(LOCATION_VISIBILITIES);
export const zRoutingTier = fromEnum(ROUTING_TIERS);
export const zEscalationLevel = fromEnum(ESCALATION_LEVELS);
export const zParticipantRole = fromEnum(PARTICIPANT_ROLES);
export const zEvidenceType = fromEnum(EVIDENCE_TYPES);
export const zMediaType = fromEnum(MEDIA_TYPES);
export const zModerationVerdict = fromEnum(MODERATION_VERDICTS);
export const zVerificationVerdict = fromEnum(VERIFICATION_VERDICTS);
export const zReportSource = fromEnum(REPORT_SOURCES);
export const zCategoryId = fromEnum(CATEGORY_IDS);

export const zUuid = z.string().uuid();

export const zPublicId = z
  .string()
  .regex(/^CIV-\d{5,}$/, 'Public id must look like CIV-10482');

/** 0–1 model confidence. */
export const zConfidence = z.number().min(0).max(1);

/** A WGS84 point inside the Indian bounding box (incl. Andamans and Ladakh).
 *  Loose enough for every territory, tight enough to catch a swapped lat/lng —
 *  which is the single most common geo bug and silently routes an issue to the
 *  wrong ocean. */
export const zLatitude = z.number().min(6).max(38);
export const zLongitude = z.number().min(68).max(98);

export const zCoordinates = z.object({
  lat: zLatitude,
  lng: zLongitude,
  /** GPS horizontal accuracy in metres, when the device reports it. */
  accuracyM: z.number().positive().max(10_000).optional(),
});
export type Coordinates = z.infer<typeof zCoordinates>;

/** ISO 8601 instant. Strings, not Dates — these cross a network boundary. */
export const zTimestamp = z.string().datetime({ offset: true });

/** Languages the intake pipeline transcribes (PRD §13). */
export const zLanguage = z.enum(['en', 'hi', 'kn', 'te', 'ta', 'mr', 'bn', 'gu']);
export type Language = z.infer<typeof zLanguage>;

export const zMediaAsset = z.object({
  id: zUuid,
  type: zMediaType,
  /** Storage key, not a signed URL — signed URLs expire and must never be
   *  persisted into a record. */
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  bytes: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationS: z.number().positive().optional(),
  /** Coordinates read from EXIF before it was stripped. Kept separately
   *  because it is evidence that the photo was taken at the site. */
  capturedAt: zTimestamp.optional(),
  capturedCoordinates: zCoordinates.optional(),
  /** A face or plate was blurred at intake (PRD §16). */
  redacted: z.boolean().default(false),
});
export type MediaAsset = z.infer<typeof zMediaAsset>;

/** Human-entered free text: trimmed, length-bounded, never empty-after-trim. */
export const boundedText = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(min).max(max));

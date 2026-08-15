import { z } from 'zod';

// Local mirrors of packages/shared/zod/intake.ts. The repository has no
// workspace linking @swaram/shared, so these keep the model boundary validated.
export const CATEGORY_IDS = [
  'pothole_road_damage',
  'streetlight',
  'garbage_swm',
  'water_supply',
  'sewerage_drainage',
  'power_outage',
  'traffic_signal_signage',
  'encroachment',
  'stray_animals',
  'parks_trees',
  'illegal_construction',
  'public_health_sanitation',
  'fire_hazard',
] as const;

const confidence = z.number().min(0).max(1);
const boundedText = (min: number, max: number) =>
  z.string().transform((value) => value.trim()).pipe(z.string().min(min).max(max));

export const intakeOutputSchema = z
  .object({
    category: z.enum(CATEGORY_IDS),
    subcategory: boundedText(2, 80).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    title: boundedText(8, 90),
    summary: boundedText(0, 600).optional(),
    emergency: z.boolean().default(false),
    visibility: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']),
    locationPrecision: z.enum(['POINT', 'AREA', 'JURISDICTION']).default('POINT'),
    estimatedPeopleAffected: z.number().int().nonnegative().max(10_000_000),
    peopleAffectedBasis: z.string().max(300).optional(),
    safetyScreen: z.object({
      verdict: z.enum(['CLEAR', 'REDACT', 'HOLD', 'EMERGENCY', 'REJECT']),
      confidence,
      reasons: z.array(z.string().min(1)).max(10).default([]),
      redactions: z
        .array(
          z.object({
            start: z.number().int().nonnegative(),
            end: z.number().int().positive(),
            reason: z.string().min(1),
          }),
        )
        .default([]),
      redactMediaIds: z.array(z.string()).default([]),
    }),
    confidence,
    reasoning: boundedText(10, 500),
    model: z.string().min(1),
    latencyMs: z.number().int().nonnegative(),
    promptVersion: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.emergency && value.safetyScreen.verdict === 'CLEAR') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safetyScreen', 'verdict'],
        message: 'An emergency cannot carry a CLEAR safety verdict.',
      });
    }
    if (
      value.safetyScreen.verdict === 'REDACT' &&
      value.safetyScreen.redactions.length === 0 &&
      value.safetyScreen.redactMediaIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['safetyScreen'],
        message: 'REDACT requires a redaction span or media id.',
      });
    }
  });

export type IntakeOutput = z.infer<typeof intakeOutputSchema>;

export const clusterDecisionSchema = z.object({
  candidateIssueId: z.string().min(1),
  isSameProblem: z.boolean(),
  confidence,
  reasoning: boundedText(10, 500),
  distanceM: z.number().nonnegative().optional(),
  sameRoadSegment: z.boolean().optional(),
  model: z.string().min(1),
});

export type ClusterDecision = z.infer<typeof clusterDecisionSchema>;

export const verifierOpinionSchema = z.object({
  recommendation: z.enum(['LOOKS_FIXED', 'LOOKS_UNFIXED', 'CANNOT_TELL']),
  confidence,
  reasoning: boundedText(10, 500),
  sameLocation: z.boolean().optional(),
  model: z.string().min(1),
});

export type VerifierOpinion = z.infer<typeof verifierOpinionSchema>;

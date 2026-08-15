import { z } from 'zod';

export const queueNameSchema = z.enum([
  'intake',
  'cluster',
  'verify',
  'dispatch',
  'notify',
]);

export type QueueName = z.infer<typeof queueNameSchema>;

const baseEnvelopeSchema = z.object({
  issue_id: z.string().uuid(),
  enqueued_at: z.string().datetime({ offset: true }).optional(),
});

export const intakeEnvelopeSchema = baseEnvelopeSchema.extend({
  report_id: z.string().uuid(),
  source: z.string().min(1).optional(),
});

export const clusterEnvelopeSchema = baseEnvelopeSchema.extend({
  report_id: z.string().uuid(),
});

export const verifyEnvelopeSchema = baseEnvelopeSchema.extend({
  resolution_id: z.union([z.string().min(1), z.number().int().nonnegative()]),
});

export const passiveEnvelopeSchema = z.record(z.unknown());

export const queueMessageSchema = z.object({
  msg_id: z.string().regex(/^\d+$/),
  read_ct: z.coerce.number().int().nonnegative().default(1),
  enqueued_at: z.string().optional(),
  vt: z.string().optional(),
  message: z.unknown(),
});

export const intakeContextSchema = z.object({
  issue_id: z.string().uuid(),
  report_id: z.string().uuid(),
  text: z.string(),
  transcript: z.string().nullable(),
  address: z.string().nullable(),
});

export const intakeAgentOutputSchema = z.object({
  category: z.string().min(1),
  subcategory: z.string().nullable().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1),
  summary: z.string().optional(),
  emergency: z.boolean(),
  visibility: z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']),
  locationPrecision: z.enum(['POINT', 'AREA', 'JURISDICTION']),
  estimatedPeopleAffected: z.number().int().nonnegative(),
  peopleAffectedBasis: z.string().optional(),
  safetyScreen: z.object({
    verdict: z.enum(['CLEAR', 'REDACT', 'HOLD', 'EMERGENCY', 'REJECT']),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string()),
    redactions: z.array(z.unknown()),
    redactMediaIds: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  model: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
  promptVersion: z.string().optional(),
}).transform((value) => ({
  ...value,
  category_id: value.category,
  moderation_verdict: value.safetyScreen.verdict,
  estimated_people_affected: value.estimatedPeopleAffected,
  location_precision: value.locationPrecision,
  emergency_flag: value.emergency,
  routing_tier: 'UNMAPPED' as const,
  jurisdiction_id: null,
  jurisdiction_match_method: 'NONE' as const,
  authority_id: null,
  department_id: null,
}));

const clusterIssueSchema = z.object({
  issueId: z.string().uuid(),
  text: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
});

export const clusterContextSchema = z.object({
  issue: clusterIssueSchema,
  candidates: z.array(clusterIssueSchema.extend({ distanceM: z.number().nonnegative() })),
});

export const clusterDecisionSchema = z.object({
  candidateIssueId: z.string().uuid(),
  isSameProblem: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  distanceM: z.number().nonnegative().optional(),
  sameRoadSegment: z.boolean().optional(),
  model: z.string().min(1),
});

export const verifyContextSchema = z.object({
  issue_id: z.string().uuid(),
  resolution_id: z.string().uuid(),
  before_description: z.string().nullable(),
  after_description: z.string().nullable(),
  same_location: z.boolean().nullable(),
});

export const verifyOpinionSchema = z.object({
  recommendation: z.enum(['LOOKS_FIXED', 'LOOKS_UNFIXED', 'CANNOT_TELL']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  sameLocation: z.boolean().optional(),
  model: z.string().min(1),
});

export type QueueMessage = z.infer<typeof queueMessageSchema>;
export type IntakeEnvelope = z.infer<typeof intakeEnvelopeSchema>;
export type ClusterEnvelope = z.infer<typeof clusterEnvelopeSchema>;
export type VerifyEnvelope = z.infer<typeof verifyEnvelopeSchema>;
export type IntakeAgentOutput = z.infer<typeof intakeAgentOutputSchema>;
export type ClusterDecision = z.infer<typeof clusterDecisionSchema>;
export type VerifyOpinion = z.infer<typeof verifyOpinionSchema>;

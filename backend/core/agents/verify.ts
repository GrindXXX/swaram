import type { AgentImage, JsonProvider } from './provider.ts';
import { configuredProvider } from './provider.ts';
import { verifierOpinionSchema, type VerifierOpinion } from './schemas.ts';

export interface VerifyInput {
  before: readonly AgentImage[];
  after: readonly AgentImage[];
  beforeDescription?: string;
  afterDescription?: string;
  sameLocationEvidence?: boolean;
}

export interface VerifyOptions { provider?: JsonProvider | null }

export async function runVerify(input: VerifyInput, options: VerifyOptions = {}): Promise<VerifierOpinion> {
  const provider = options.provider === undefined ? configuredProvider() : options.provider ?? undefined;
  if (provider && input.before.length > 0 && input.after.length > 0) {
    try {
      const raw = await provider.generateJson({
        system:
          'Give an advisory before/after opinion only. Never close or mutate an issue. Use CANNOT_TELL unless the same location and the repair state are visually supported.',
        prompt: JSON.stringify({
          beforeImageCount: input.before.length,
          afterImageCount: input.after.length,
          beforeDescription: input.beforeDescription ?? null,
          afterDescription: input.afterDescription ?? null,
          sameLocationEvidence: input.sameLocationEvidence ?? null,
          imageOrder: 'All before images, then all after images',
          outputFields: ['recommendation', 'confidence', 'reasoning', 'sameLocation?', 'model'],
        }),
        images: [...input.before, ...input.after],
      });
      return verifierOpinionSchema.parse({ ...(isRecord(raw) ? raw : {}), model: provider.model });
    } catch {
      // Verification remains advisory and degrades safely.
    }
  }
  return fallbackVerify(input);
}

export function fallbackVerify(input: VerifyInput): VerifierOpinion {
  const descriptionsAdequate = Boolean(input.beforeDescription?.trim() && input.afterDescription?.trim());
  const evidenceAdequate =
    input.before.length > 0 && input.after.length > 0 && input.sameLocationEvidence === true && descriptionsAdequate;
  if (evidenceAdequate) {
    const after = input.afterDescription?.toLowerCase() ?? '';
    const fixed = ['repaired', 'fixed', 'cleared', 'restored', 'removed'].some((term) => after.includes(term));
    const unfixed = ['still broken', 'not fixed', 'still exists', 'unchanged'].some((term) => after.includes(term));
    if (fixed !== unfixed) {
      return verifierOpinionSchema.parse({
        recommendation: fixed ? 'LOOKS_FIXED' : 'LOOKS_UNFIXED',
        confidence: 0.65,
        reasoning: 'Matched explicit after-evidence wording with same-location evidence; human confirmation is still required.',
        sameLocation: true,
        model: 'deterministic-fallback',
      });
    }
  }
  return verifierOpinionSchema.parse({
    recommendation: 'CANNOT_TELL',
    confidence: 0.99,
    reasoning: 'Evidence is insufficient for a deterministic before-and-after opinion; human review is required.',
    sameLocation: input.sameLocationEvidence,
    model: 'deterministic-fallback',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import type { AgentImage, JsonProvider } from './provider.ts';
import { configuredProvider } from './provider.ts';
import { intakeOutputSchema, type IntakeOutput } from './schemas.ts';

export interface IntakeInput {
  text: string;
  transcript?: string;
  images?: readonly AgentImage[];
  locationContext?: string;
}

export interface IntakeOptions {
  provider?: JsonProvider | null;
}

const PROMPT_VERSION = 'intake-v1';
const categoryRules = [
  ['fire_hazard', ['fire', 'smoke', 'flammable', 'gas leak']],
  ['power_outage', ['power outage', 'electricity', 'transformer', 'power cut', 'live wire']],
  ['streetlight', ['streetlight', 'street light', 'lamp post']],
  ['pothole_road_damage', ['pothole', 'road damage', 'broken road', 'footpath', 'sidewalk']],
  ['garbage_swm', ['garbage', 'rubbish', 'trash', 'waste dump', 'waste collection']],
  ['water_supply', ['no water', 'water supply', 'low pressure', 'drinking water']],
  ['sewerage_drainage', ['sewage', 'sewer', 'drain', 'waterlogging', 'flooded road']],
  ['traffic_signal_signage', ['traffic signal', 'traffic light', 'road sign', 'road marking']],
  ['encroachment', ['encroachment', 'public land', 'blocked footpath']],
  ['stray_animals', ['stray dog', 'stray animal', 'cattle on road']],
  ['parks_trees', ['fallen tree', 'park', 'tree branch', 'green cover']],
  ['illegal_construction', ['illegal construction', 'unauthorized construction']],
  ['public_health_sanitation', ['mosquito', 'open defecation', 'dead animal', 'sanitation']],
] as const;

const emergencyTerms = ['active fire', 'building collapse', 'collapsed building', 'gas leak', 'live wire', 'electrocution'];
const personalSafetyTerms = ['assault', 'stalk', 'abuse', 'suicide', 'missing person', 'threat', 'injured person', 'accident victim'];

export async function runIntake(input: IntakeInput, options: IntakeOptions = {}): Promise<IntakeOutput> {
  const provider = options.provider === undefined ? configuredProvider() : options.provider ?? undefined;
  if (provider) {
    const startedAt = Date.now();
    try {
      const raw = await provider.generateJson({
        system:
          'Classify civic reports using only the supplied taxonomy. Never name or choose a department. Treat uncertain or personal-safety content as HOLD and confidential. Return fields matching the requested contract.',
        prompt: JSON.stringify({
          taxonomy: categoryRules.map(([id]) => id),
          input: { text: combinedText(input), locationContext: input.locationContext ?? null },
          outputFields: [
            'category', 'subcategory?', 'severity', 'title', 'summary?', 'emergency', 'visibility',
            'locationPrecision', 'estimatedPeopleAffected', 'peopleAffectedBasis?', 'safetyScreen',
            'confidence', 'reasoning', 'model', 'latencyMs', 'promptVersion',
          ],
        }),
        images: input.images,
      });
      return intakeOutputSchema.parse({
        ...(isRecord(raw) ? raw : {}),
        model: provider.model,
        latencyMs: Date.now() - startedAt,
        promptVersion: PROMPT_VERSION,
      });
    } catch {
      // A malformed or unavailable model must not stop intake jobs.
    }
  }
  return fallbackIntake(input);
}

export function fallbackIntake(input: IntakeInput): IntakeOutput {
  const text = combinedText(input).toLowerCase();
  const match = categoryRules
    .map(([category, keywords]) => ({ category, score: keywords.filter((keyword) => text.includes(keyword)).length }))
    .sort((a, b) => b.score - a.score)[0];
  const category = match && match.score > 0 ? match.category : 'pothole_road_damage';
  const emergency = emergencyTerms.some((term) => text.includes(term));
  const personalSafety = personalSafetyTerms.some((term) => text.includes(term));
  const uncertain = !match || match.score === 0;
  const inherentlySensitive = category === 'fire_hazard';
  const hold = !emergency && (personalSafety || uncertain || inherentlySensitive);
  const label = category.replaceAll('_', ' ');

  return intakeOutputSchema.parse({
    category,
    severity: emergency ? 'CRITICAL' : inherentlySensitive ? 'HIGH' : 'MEDIUM',
    title: titleFrom(text, label),
    summary: combinedText(input).trim().slice(0, 600) || undefined,
    emergency,
    visibility: emergency || hold ? 'CONFIDENTIAL' : 'PUBLIC',
    locationPrecision: 'POINT',
    estimatedPeopleAffected: 0,
    peopleAffectedBasis: 'No reliable population estimate was available in deterministic intake.',
    safetyScreen: {
      verdict: emergency ? 'EMERGENCY' : hold ? 'HOLD' : 'CLEAR',
      confidence: emergency || hold ? 0.99 : 0.9,
      reasons: emergency
        ? ['Explicit life-safety keyword requires emergency review.']
        : hold
          ? ['Content is uncertain or safety-sensitive and requires human review.']
          : [],
      redactions: [],
      redactMediaIds: [],
    },
    confidence: uncertain ? 0.2 : match && match.score > 1 ? 0.82 : 0.65,
    reasoning: uncertain
      ? 'No known taxonomy keyword matched; placeholder classification requires human triage.'
      : `Matched deterministic taxonomy keywords for ${category}; no department was selected.`,
    model: 'deterministic-fallback',
    latencyMs: 0,
    promptVersion: PROMPT_VERSION,
  });
}

function combinedText(input: IntakeInput): string {
  return [input.text, input.transcript].filter((value): value is string => Boolean(value?.trim())).join('\n');
}

function titleFrom(text: string, label: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 10).join(' ');
  const title = words.length >= 8 ? words : `${label} reported`;
  return title.charAt(0).toUpperCase() + title.slice(1, 90);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

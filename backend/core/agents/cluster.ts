import type { JsonProvider } from './provider.ts';
import { configuredProvider } from './provider.ts';
import { clusterDecisionSchema, type ClusterDecision } from './schemas.ts';

export interface ClusterLocation { lat: number; lng: number }
export interface ClusterIssue { issueId: string; text: string; location: ClusterLocation }
export interface ClusterCandidate extends ClusterIssue { distanceM?: number }
export interface ClusterInput { issue: ClusterIssue; candidates: readonly ClusterCandidate[] }
export interface ClusterOptions { provider?: JsonProvider | null }

export async function runCluster(input: ClusterInput, options: ClusterOptions = {}): Promise<ClusterDecision[]> {
  const provider = options.provider === undefined ? configuredProvider() : options.provider ?? undefined;
  if (provider && input.candidates.length > 0) {
    try {
      const raw = await provider.generateJson({
        system:
          'Propose duplicate civic reports only. Do not merge, mutate, route, or close anything. Compare normalized report meaning and physical distance. Return a JSON array.',
        prompt: JSON.stringify({
          issue: input.issue,
          candidates: input.candidates.map((candidate) => ({
            ...candidate,
            distanceM: candidate.distanceM ?? distanceMetres(input.issue.location, candidate.location),
          })),
          outputFields: ['candidateIssueId', 'isSameProblem', 'confidence', 'reasoning', 'distanceM', 'sameRoadSegment?', 'model'],
        }),
      });
      return clusterDecisionSchema
        .array()
        .parse(raw)
        .filter((decision) => decision.isSameProblem && decision.confidence >= 0.75)
        .map((decision) => ({ ...decision, model: provider.model }));
    } catch {
      // Invalid model proposals fall back to reproducible comparisons.
    }
  }
  return fallbackCluster(input);
}

export function fallbackCluster(input: ClusterInput): ClusterDecision[] {
  const source = normalize(input.issue.text);
  return input.candidates.flatMap((candidate) => {
    const target = normalize(candidate.text);
    const distanceM = candidate.distanceM ?? distanceMetres(input.issue.location, candidate.location);
    const exact = source.length >= 8 && source === target;
    const similarity = tokenSimilarity(source, target);
    const isSameProblem = distanceM <= 100 && (exact || similarity >= 0.8);
    const confidence = exact && distanceM <= 50 ? 0.94 : similarity >= 0.8 && distanceM <= 100 ? 0.8 : 0.4;
    if (!isSameProblem || confidence < 0.75) return [];
    return [clusterDecisionSchema.parse({
      candidateIssueId: candidate.issueId,
      isSameProblem: true,
      confidence,
      reasoning: `Normalized text similarity is ${similarity.toFixed(2)} and pins are ${Math.round(distanceM)}m apart; proposal only.`,
      distanceM,
      model: 'deterministic-fallback',
    })];
  });
}

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(left.split(' ').filter(Boolean));
  const b = new Set(right.split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function distanceMetres(a: ClusterLocation, b: ClusterLocation): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(b.lat - a.lat);
  const lng = radians(b.lng - a.lng);
  const value =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

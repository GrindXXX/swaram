import { describe, expect, it } from 'vitest';
import { fallbackIntake, runIntake } from './intake.ts';
import { fallbackCluster } from './cluster.ts';
import { fallbackVerify } from './verify.ts';

describe('intake agent', () => {
  it('classifies known infrastructure without choosing an authority', () => {
    const result = fallbackIntake({ text: 'Large pothole on the main road' });
    expect(result.category).toBe('pothole_road_damage');
    expect(result.safetyScreen.verdict).toBe('CLEAR');
    expect(result).not.toHaveProperty('department');
    expect(result).not.toHaveProperty('authority');
  });

  it('fails closed for unknown content', () => {
    const result = fallbackIntake({ text: 'Something unusual happened nearby' });
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.visibility).toBe('CONFIDENTIAL');
    expect(result.safetyScreen.verdict).toBe('HOLD');
  });

  it('falls back when a provider returns invalid output', async () => {
    const result = await runIntake(
      { text: 'Garbage has not been collected' },
      { provider: { model: 'test', generateJson: async () => ({ invalid: true }) } },
    );
    expect(result.model).toBe('deterministic-fallback');
    expect(result.category).toBe('garbage_swm');
  });
});

describe('cluster agent', () => {
  it('returns a proposal without mutating either issue', () => {
    const source = { issueId: crypto.randomUUID(), text: 'Pothole outside school gate', location: { lat: 12.97, lng: 77.59 } };
    const target = { issueId: crypto.randomUUID(), text: 'Pothole outside school gate', location: { lat: 12.9701, lng: 77.5901 } };
    const decisions = fallbackCluster({ issue: source, candidates: [target] });
    expect(decisions[0]?.candidateIssueId).toBe(target.issueId);
    expect(decisions[0]?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(source.issueId).not.toBe(target.issueId);
  });
});

describe('verification agent', () => {
  it('cannot declare a fix without before and after evidence', () => {
    const result = fallbackVerify({ before: [], after: [] });
    expect(result.recommendation).toBe('CANNOT_TELL');
    expect(result.reasoning).toContain('human review');
  });
});

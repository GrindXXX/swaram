import { describe, expect, it } from 'vitest';
import { zReportSubmission } from './zod/report.js';

const base = {
  clientReportId: '6a04d8f4-b2cc-4ee0-82d4-b9b5228ea184',
  description: 'A broken drain is overflowing across the road.',
  coordinates: { lat: 12.9716, lng: 77.5946 },
};

describe('report submission contract', () => {
  it('requires a location and at least one report input', () => {
    expect(zReportSubmission.safeParse({ ...base, coordinates: undefined }).success).toBe(false);
    expect(
      zReportSubmission.safeParse({
        clientReportId: base.clientReportId,
        coordinates: base.coordinates,
      }).success,
    ).toBe(false);
  });

  it('keeps location precision independent from public visibility', () => {
    const parsed = zReportSubmission.parse({
      ...base,
      locationPrecision: 'AREA',
      locationVisibility: 'PRIVATE',
    });

    expect(parsed.locationPrecision).toBe('AREA');
    expect(parsed.locationVisibility).toBe('PRIVATE');
  });

  it('defaults to a point with approximate public location', () => {
    const parsed = zReportSubmission.parse(base);

    expect(parsed.locationPrecision).toBe('POINT');
    expect(parsed.locationVisibility).toBe('APPROXIMATE');
  });
});

/**
 * geo.ts — reverse geocoding and the GEOCODE_FALLBACK name match.
 *
 * Two jobs, both of which exist because the repo ships no boundary geometry
 * (technical-plan.html §01, Finding 1):
 *
 *   1. reverse geocode a pin into address + area context, which the intake
 *      agent needs as its "location context" input (§09 C1);
 *   2. when point-in-polygon and centroid matching both fail, turn that
 *      geocoded name into a jurisdiction row — step 3 of the fallback ladder.
 *
 * The provider is pluggable because the right one is a deployment decision
 * (Nominatim is free but rate-limited and forbids heavy commercial use;
 * MapMyIndia/Ola/Google are better for Indian addresses and cost money).
 */

import type { Db } from '../db/client.ts';
import type { AdminDb } from '../db/admin.ts';
import type { LatLng } from '../types/index.ts';

type AnyDb = Db | AdminDb;

export interface ReverseGeocodeResult {
  /** Human-readable, shown to the citizen and given to the intake agent. */
  formatted: string;
  ward: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  postcode: string | null;
  /** Nearby landmark/POI names, if the provider offers them — helps severity. */
  context: string[];
}

export interface GeoProvider {
  readonly name: string;
  reverse(point: LatLng): Promise<ReverseGeocodeResult | null>;
}

// --- Nominatim (default; fine for dev and low volume) ---------------------

export interface NominatimOptions {
  baseUrl?: string;
  /** Nominatim's usage policy REQUIRES a real identifying UA. */
  userAgent?: string;
  timeoutMs?: number;
  language?: string;
}

export function nominatimProvider(opts: NominatimOptions = {}): GeoProvider {
  const baseUrl = opts.baseUrl ?? process.env['GEOCODER_BASE_URL'] ?? 'https://nominatim.openstreetmap.org';
  const userAgent =
    opts.userAgent ??
    process.env['GEOCODER_USER_AGENT'] ??
    'swaram-civic/0.1 (contact: ops@swaram.example)';
  const timeoutMs = opts.timeoutMs ?? 8000;
  const language = opts.language ?? 'en';

  return {
    name: 'nominatim',
    async reverse(point: LatLng): Promise<ReverseGeocodeResult | null> {
      const url = new URL('/reverse', baseUrl);
      url.searchParams.set('lat', String(point.lat));
      url.searchParams.set('lon', String(point.lng));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('zoom', '16');
      url.searchParams.set('addressdetails', '1');

      const res = await fetchWithTimeout(url, timeoutMs, {
        headers: { 'User-Agent': userAgent, 'Accept-Language': language },
      });
      if (!res.ok) return null;

      const body = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
        name?: string;
      };
      const a = body.address ?? {};

      return {
        formatted: body.display_name ?? '',
        // Indian OSM data puts wards under a few different keys.
        ward: a['city_block'] ?? a['suburb'] ?? a['neighbourhood'] ?? a['ward'] ?? null,
        city: a['city'] ?? a['town'] ?? a['municipality'] ?? a['village'] ?? null,
        district: a['state_district'] ?? a['county'] ?? a['district'] ?? null,
        state: a['state'] ?? null,
        postcode: a['postcode'] ?? null,
        context: [body.name, a['amenity'], a['road']].filter(
          (s): s is string => typeof s === 'string' && s.length > 0,
        ),
      };
    },
  };
}

/** No-op provider. Use when no geocoding budget exists; routing degrades honestly. */
export const nullGeoProvider: GeoProvider = {
  name: 'none',
  async reverse() {
    return null;
  },
};

export function defaultGeoProvider(): GeoProvider {
  return process.env['GEOCODER_DISABLED'] === '1' ? nullGeoProvider : nominatimProvider();
}

// --- GEOCODE_FALLBACK name match -----------------------------------------

export interface JurisdictionMatch {
  id: number;
  name: string;
  level: string;
  /** 0..1 confidence in the *name* match, not in the routing decision. */
  score: number;
  matchedOn: string;
}

/**
 * Fuzzy-match geocoded place names against the LGD jurisdiction table.
 *
 * `names` is ordered most-specific-first (ward, city, district, state) and the
 * first confident hit wins, so a pin resolves as tightly as the data allows.
 *
 * Implementation note: this uses case-insensitive equality and then a
 * contains-search, and ranks the shortlist in TypeScript. The schema has a
 * `gin (name gin_trgm_ops)` index for a real `similarity()` query, but
 * PostgREST cannot express the `%` operator — a `jurisdiction_by_name(text)`
 * SQL function in a later migration would be strictly better and this function
 * should be switched over to it when one exists.
 */
export async function matchJurisdictionByName(
  db: AnyDb,
  names: string[],
  minScore = 0.72,
): Promise<JurisdictionMatch | null> {
  for (const raw of names) {
    const needle = normaliseName(raw);
    if (needle.length < 3) continue;

    // 1. exact, case-insensitive.
    const { data: exact, error: exactErr } = await db
      .from('jurisdictions')
      .select('id, name, level')
      .ilike('name', raw.trim())
      .limit(5);
    if (exactErr) throw new Error(`jurisdictions read failed: ${exactErr.message}`);
    if (exact && exact.length === 1) {
      const only = exact[0]!;
      return { id: only.id, name: only.name, level: only.level, score: 1, matchedOn: raw };
    }

    // 2. contains-search, ranked client-side.
    const { data: fuzzy, error: fuzzyErr } = await db
      .from('jurisdictions')
      .select('id, name, level')
      .ilike('name', `%${escapeLike(raw.trim())}%`)
      .limit(25);
    if (fuzzyErr) throw new Error(`jurisdictions read failed: ${fuzzyErr.message}`);

    const pool = [...(exact ?? []), ...(fuzzy ?? [])];
    let best: JurisdictionMatch | null = null;
    for (const row of pool) {
      const score = diceCoefficient(needle, normaliseName(row.name));
      if (!best || score > best.score) {
        best = { id: row.id, name: row.name, level: row.level, score, matchedOn: raw };
      }
    }
    if (best && best.score >= minScore) return best;
  }
  return null;
}

/**
 * Sørensen–Dice over character bigrams. Chosen over Levenshtein because Indian
 * place names differ mostly by transliteration and suffixes ("Bengaluru" vs
 * "Bangalore", "Nagar"/"Nagara"), where bigram overlap behaves far better than
 * edit distance.
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const [g, count] of ba) {
    const other = bb.get(g);
    if (other) intersection += Math.min(count, other);
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(municipal corporation|municipality|nagar palika|town panchayat|district|city)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

// --- distance -------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_008.8;

/** Haversine metres. Used for the resolution-photo GPS distance check. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Blur a point to ~200 m for LocationVisibility.APPROXIMATE (PRD §03).
 * Deterministic per issue so the blurred pin does not jitter between renders,
 * which would let an observer average it back to the true location.
 */
export function blurPoint(point: LatLng, seed: string, radiusM = 200): LatLng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const angle = ((h >>> 0) % 3600) / 3600 * 2 * Math.PI;
  const dist = radiusM * Math.sqrt(((h >>> 8) % 1000) / 1000);
  const dLat = (dist * Math.cos(angle)) / 111_320;
  const dLng = (dist * Math.sin(angle)) / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

/** PostGIS `geography(Point,4326)` literal for inserts. lng first — always. */
export function toWkt(point: LatLng): string {
  return `SRID=4326;POINT(${point.lng} ${point.lat})`;
}

/** Parse the GeoJSON PostgREST returns for a geography column. */
export function fromGeoJson(value: unknown): LatLng | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as { type?: string; coordinates?: unknown };
  if (g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const [lng, lat] = g.coordinates as number[];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

async function fetchWithTimeout(url: URL, timeoutMs: number, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
